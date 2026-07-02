import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import bcrypt from "bcrypt";
import { buildDateRange } from "../utils/dateRange.js";

export default {
  /**
   * id 배열로 User Map(id → {id,name,username}) 을 반환한다.
   * 여러 서비스(material/purchaseOrder/supplier 등)에서 created_by/updated_by
   * 표시용으로 반복하던 패턴을 단일화한 헬퍼.
   * @param {Array<number|null|undefined>} ids
   * @returns {Promise<Map<number, {id:number,name:string,username:string}>>}
   */
  async getMapByIds(ids) {
    const uniq = [...new Set((ids || []).filter((v) => v != null))];
    if (!uniq.length) return new Map();
    const rows = await prisma.user.findMany({
      where: { id: { in: uniq } },
      select: { id: true, name: true, username: true },
    });
    return new Map(rows.map((u) => [u.id, u]));
  },

  /**
   * 사용자 리스트 (role_id/키워드/기간 필터, role 조인)
   * @param {{role_id?:number,keyword?:string,startDate?:string,endDate?:string}} data
   */
  async getList(data) {
    const where = {};

    // 권한검색
    if (data?.role_id) {
      where.role_id = data.role_id;
    }

    // 권한 검색
    if (data?.keyword) {
      where.OR = [
        {
          username: {
            contains: data.keyword,
          },
        },
        {
          name: {
            contains: data.keyword,
          },
        },
      ];
    }

    // 날짜 검색
    {
      const range = buildDateRange(data?.startDate, data?.endDate);
      if (range) where.updated_at = range;
    }

    const rows = await prisma.user.findMany({
      where,
      include: {
        role: true,
      },
      orderBy: { updated_at: "desc" },
    });

    return rows.map((row) => ({
      ...row,
      role_name: row.role?.name ?? "",
      role_description: row.role?.description ?? "",
    }));
  },

  /**
   * 사용자 IP 화이트리스트 조회 (user_id 필터, user 조인, 최신순)
   */
  async getUserIpList(data) {
    const where = {};

    // 회원 아이디로 조회
    if (data?.user_id) {
      where.user_id = data.user_id;
    }

    const rows = await prisma.userIpWhitelist.findMany({
      where,
      include: {
        user: true,
      },
      orderBy: { created_at: "desc" },
    });

    return rows;
  },

  /** 사용자 단건 조회 */
  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.user.findUnique({ where: { id } });
    if (!item) {
      throw new AppError("존재하지 않는 정보입니다.", 404, "NOT_FOUND");
    }
    return item;
  },

  /** 사용자 역할(Role) 변경 */
  async setPermission(data) {
    return await prisma.user.update({
      where: { id: data.user_id },
      data: {
        role_id: data.role_id,
      },
    });
  },

  /**
   * 사용자 IP 화이트리스트 일괄 저장 (트랜잭션)
   * - 각 item 에 id>0 이면 update, 없거나 0 이면 create
   * @param {{user_id:number, ipList:Array}} data
   */
  async batchIpSave(data) {
    const { user_id, ipList } = data;
    return await prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of ipList) {
        // 1. ID가 있고 0보다 큰 경우 -> 기존 데이터 수정 (Update)
        if (item.id && item.id > 0) {
          const updated = await tx.userIpWhitelist.update({
            where: { id: Number(item.id) },
            data: {
              ip: item.ip,
              memo: item.memo,
              is_active: item.is_active,
            },
          });
          results.push(updated);
        }
        // 2. ID가 없거나 null인 경우 -> 신규 데이터 생성 (Create)
        else {
          const created = await tx.userIpWhitelist.create({
            data: {
              user_id: Number(user_id),
              ip: item.ip,
              memo: item.memo,
              is_active: item.is_active ?? true,
            },
          });
          results.push(created);
        }
      }

      return results;
    });
  },

  /**
   * 사용자 IP 화이트리스트 일괄 삭제
   * user_id 를 where 조건에 포함해 타 사용자 데이터 삭제 방지
   * @param {{user_id:number, ipList:Array<{id:number}>}} data
   */
  async batchIpDelete(data) {
    const { user_id, ipList } = data;

    // 2. 삭제 대상 ID 추출 (숫자로 변환)
    // 프론트에서 넘어온 객체 배열에서 id값만 뽑아냅니다.
    const deleteIds = ipList
      .filter((item) => item.id !== null && item.id !== undefined)
      .map((item) => Number(item.id));

    if (deleteIds.length === 0) {
      throw new AppError("데이터 정보가 없습니다.", 400, "NOT_FOUND");
    }

    // 3. 삭제 실행
    const result = await prisma.userIpWhitelist.deleteMany({
      where: {
        id: { in: deleteIds },
        user_id: Number(user_id), // 본인 소유의 IP만 삭제되도록 보안 강화
      },
    });

    return result;
  },

  /** (미구현) 계정 권한 그룹 조회 */
  async PermissionGrop(data) {
    const { user_id } = data;
  },

  /**
   * 사용자 IP 제한(ip_restrict) 플래그 토글
   * @param {{user_id:number, ip_restrict:boolean}} data
   */
  async ipToggle(data) {
    if (!data.user_id) {
      throw new AppError("회원 정보가 없습니다", 400, "NOT_FOUND");
    }

    if (data.ip_restrict === undefined || data.ip_restrict === null) {
      throw new AppError("활성정보가 없습니다", 400, "INVALID_PARAMS");
    }

    const result = await prisma.user.update({
      where: {
        id: Number(data.user_id),
      },
      data: {
        ip_restrict: !!data.ip_restrict,
      },
    });

    return result;
  },

  /**
   * 신규 사용자 등록 (username·email 중복 체크 → bcrypt 해시 → 역할 연결)
   * @param {{name,username,email,password,role_id,is_active}} data
   */
  async create(data) {
    const { name, username, email, password, role_id, is_active } = data;

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

    // 3. 비밀번호 암호화
    const hash = await bcrypt.hash(password, 10);

    // 4. 회원 저장
    await prisma.user.create({
      data: {
        username,
        password: hash,
        name,
        email,
        role_id,
        is_active,
      },
    });

    return true;
  },

  /**
   * 사용자 정보 수정 (비밀번호는 별도 API: /changePassword)
   * @param {{id,username,name,email,role_id,is_active}} data
   */
  async update(data) {
    const { name, username, email, role_id, is_active } = data;

    // 4. 회원 저장
    await prisma.user.update({
      where: { id: data.id },
      data: {
        username,
        name,
        email,
        role_id,
        is_active,
      },
    });

    return true;
  },
};
