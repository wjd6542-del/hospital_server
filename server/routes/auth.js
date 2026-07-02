import authService from "../services/auth.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  loginSchema,
  saveSchema,
  changePassword,
  sendCodeSchema,
  codePasswordChangeSchema,
} from "../validators/auth.schema.js";

/**
 * 요청 헤더/소켓에서 실제 클라이언트 IP 추출
 * @param {FastifyRequest} req
 * @returns {string} IPv4/IPv6 주소 문자열
 */
function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    ""
  );
}

/**
 * 인증 라우트 (/api/auth/*)
 * 로그인 / 회원가입 / 비밀번호 변경 / 이메일 인증 코드 발급 등
 */
export default async function authnRoutes(app) {
  /**
   * 사용자 로그인 (JWT 발급 + IP 화이트리스트 검증)
   * @route POST /api/auth/login
   * @param {Object} req.body - { username, password }
   * @returns {Object} { token, user }
   */
  app.post("/login", async (req) => {
    const ip = getClientIp(req);
    const body = validate(loginSchema, req.body);
    return authService.login(body, ip);
  });

  /**
   * 회원가입 (일반 USER 권한으로 신규 계정 생성)
   * @route POST /api/auth/signup
   * @param {Object} req.body - { name, username, email, password }
   * @returns {boolean}
   */
  app.post("/signup", async (req) => {
    const body = validate(saveSchema, req.body);
    return authService.signup(body);
  });

  /**
   * 로그인 사용자의 비밀번호 변경 (기존 비밀번호 확인 후 교체)
   * @route POST /api/auth/changePassword
   * @param {Object} req.body - { old_password, new_password }
   * @returns {boolean}
   */
  app.post("/changePassword", async (req) => {
    const userId = req.user.id;
    const body = validate(changePassword, req.body);
    return authService.changePassword(userId, body);
  });

  /**
   * 비밀번호 찾기 - 이메일로 6자리 인증코드 발송
   * @route POST /api/auth/sendCode
   * @param {Object} req.body - { email }
   * @returns {boolean}
   */
  app.post("/sendCode", async (req) => {
    const body = validate(sendCodeSchema, req.body);
    return authService.sendCode(body);
  });

  /**
   * 이메일 인증코드 검증 후 비밀번호 재설정
   * @route POST /api/auth/codePasswordChange
   * @param {Object} req.body - { email, code, password }
   * @returns {boolean}
   */
  app.post("/codePasswordChange", async (req) => {
    const body = validate(codePasswordChangeSchema, req.body);
    return authService.codePasswordChange(body);
  });
}
