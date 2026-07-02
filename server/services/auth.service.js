import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendMail } from "../lib/mail.js";

export default {
  /**
   * 6자리 랜덤 숫자 인증코드 생성 (이메일 인증용)
   * @returns {string}
   */
  generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  /**
   * 사용자 로그인
   * 1) username 조회 + role.permissions 포함
   * 2) ip_restrict 사용자는 UserIpWhitelist 검증
   * 3) bcrypt 비밀번호 비교
   * 4) JWT 발급 (permissions 코드 배열 포함, 3h 만료)
   * @param {{username:string,password:string}} data
   * @param {string} ip 요청 IP
   * @returns {Promise<{token:string,user:Object}>}
   */
  async login(data, ip) {
    const { username, password } = data;

    // 🔥 사용자 조회 + 권한까지 포함
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true, // 🔥 핵심 (code, action 가져오기)
              },
            },
          },
        },
      },
    });

    // 사용자 없음
    if (!user) {
      throw new AppError(
        "아이디 또는 비밀번호가 틀렸습니다.",
        400,
        "INVALID_USER",
      );
    }

    // 🔥 IP 제한 체크
    if (user.ip_restrict) {
      const allow = await prisma.userIpWhitelist.findFirst({
        where: {
          user_id: user.id,
          ip: ip,
          is_active: true,
        },
      });

      if (!allow) {
        throw new AppError("허용되지 않은 IP 입니다.", 403, "IP_BLOCKED");
      }
    }

    // 비밀번호 확인
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new AppError(
        "아이디 또는 비밀번호가 틀렸습니다.",
        400,
        "INVALID_USER",
      );
    }

    // 🔥 권한 리스트 가공
    const permissionList =
      user.role?.permissions?.map((rp) => rp.permission) || [];

    // 🔥 code 기준 권한 배열 (프론트에서 사용)
    const permissionCodes = permissionList.map((p) => p.code);

    // 🔥 JWT 생성
    const token = jwt.sign(
      {
        id: user.id,
        // 회원 키
        userId: user.id,
        // 회원 아이디
        username: user.username,
        // 권한 배열
        permissions: permissionCodes,
        // 관리자 권한 확인처리
        is_super: user.role.is_super,
        // 아이피 필터링 여부 채크
        ip_restrict: user.ip_restrict,
      },
      process.env.JWT_SECRET,
      { expiresIn: "3h" },
    );

    // 🔥 응답
    return {
      token,

      user: {
        id: user.id,
        name: user.name,
        username: user.username,

        role: {
          id: user.role?.id,
          name: user.role?.name,
        },

        // 관리자 권한 확인
        is_super: user.role.is_super,

        // 🔥 핵심 (프론트 권한 체크용)
        permissions: permissionCodes,

        // 🔥 선택 (디버깅 / UI용)
        permissionList,
      },
    };
  },

  /**
   * 회원가입 (username·email 중복 검사 → USER 역할 부여 → bcrypt 해시 저장)
   * @param {{name:string,username:string,email:string,password:string}} data
   * @returns {Promise<boolean>}
   */
  async signup(data) {
    const { name, username, email, password } = data;

    // 2. 중복 체크
    const existUser = await prisma.user.findFirst({
      where: {
        username,
      },
    });

    if (existUser) {
      throw new AppError("중복된 유저입니다.", 400, "INVALID_USER");
    }

    // 2. 중복 체크
    const existEmail = await prisma.user.findFirst({
      where: {
        email,
      },
    });

    if (existEmail) {
      throw new AppError("중복된 이메일 입니다.", 400, "INVALID_USER");
    }

    // USER 권한 조회
    const role = await prisma.role.findUnique({
      where: {
        name: "USER",
      },
    });

    // 3. 비밀번호 암호화
    const hash = await bcrypt.hash(password, 10);

    // 4. 회원 저장
    const user = await prisma.user.create({
      data: {
        username,
        password: hash,
        name,
        email,
        role_id: role.id,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true, // 🔥 핵심 (code, action 가져오기)
              },
            },
          },
        },
      },
    });

    return true;
  },

  /**
   * 로그인 사용자 비밀번호 변경 (기존 비밀번호 bcrypt 비교 → 신규 해시 저장)
   * @param {number} userId 로그인 사용자 ID
   * @param {{old_password:string,new_password:string}} data
   * @returns {Promise<boolean>}
   */
  async changePassword(userId, data) {
    const { old_password, new_password } = data;

    // 1. 유저 존재 여부 및 기존 비밀번호 조회를 위해 유저 정보 가져오기
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError("존재하지 않는 유저입니다.", 404, "USER_NOT_FOUND");
    }

    // 2. 입력받은 기존 비밀번호(old_password)와 DB의 해시값 비교
    const isMatch = await bcrypt.compare(old_password, user.password);
    if (!isMatch) {
      throw new AppError(
        "기존 비밀번호가 일치하지 않습니다.",
        401,
        "INVALID_PASSWORD",
      );
    }

    // 3. 새로운 비밀번호 해싱
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(new_password, saltRounds);

    // 4. DB 업데이트
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });
    } catch (error) {
      // 업데이트 과정에서 발생할 수 있는 DB 에러 처리
      throw new AppError(
        "비밀번호 변경 중 오류가 발생했습니다.",
        500,
        "UPDATE_FAILED",
      );
    }

    return true;
  },

  /**
   * 비밀번호 재설정용 6자리 인증코드를 사용자 이메일로 발송
   * (User.code 에 임시 저장 후 Resend 이메일 전송)
   * @param {{email:string}} data
   * @returns {Promise<boolean>}
   */
  async sendCode(data) {
    const { email } = data;

    const timestamp = this.generateCode();

    const user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user)
      throw new AppError("존재하지 않는 유저 입니다.", 400, "INVALID_USER");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        code: String(timestamp),
      },
    });

    // 2. 메일로 인증코드 발송
    await sendMail({
      email,
      subject: "품목관리 시스템 알림",
      html: `
      <h3>${user.username} 님</h3>
      <p>발급된 코드로 인증후 비밀번호를 변경처리 하세요.</p>
	  <p>인증코드 : ${timestamp}</p>
    `,
    });
    return true;
  },

  /**
   * 이메일 + 인증코드 검증 후 비밀번호 재설정 (bcrypt 해시 저장)
   * @param {{email:string,code:string,password:string}} data
   * @returns {Promise<boolean>}
   */
  async codePasswordChange(data) {
    const { email, code, password } = data;
    const hash = await bcrypt.hash(password, 10);

    try {
      const user = await prisma.user.findFirst({
        where: { email: email, code: code },
      });

      if (!user)
        throw new AppError("존재하지 않는 유저 입니다.", 400, "INVALID_USER");

      // 코드 및 회원 계정으로 조회후 업데이트
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          password: hash,
        },
      });
      return true;
    } catch (error) {
      throw new AppError("존재하지 않는 유저 입니다.", 400, "INVALID_USER");
    }
  },
};
