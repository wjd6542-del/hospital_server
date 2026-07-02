import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { buildDateRange } from "../utils/dateRange.js";

export default {
  /**
   * 감사 로그 리스트
   * - status (SUCCESS/FAIL)
   * - user_id: 특정 계정의 활동만 (계정별 활동 페이지용)
   * - search_field: 'target_type' | 'ip' 화이트리스트 기반 부분 매칭
   * - 기간 필터 (created_at)
   * - action: CREATE/UPDATE/DELETE/VIEW/LOGIN/LOGOUT 화이트리스트
   * @param {Object} data
   */
  async getList(data) {
    const where = {};

    if (data.status) {
      where.status = data.status;
    }

    // 계정별 필터 (행위 주체)
    if (data.user_id) {
      where.user_id = Number(data.user_id);
    }

    const allowFields = ["target_type", "ip"];
    if (allowFields.includes(data.search_field) && data.search_text) {
      where[data.search_field] = {
        contains: data.search_text,
      };
    }

    // 날짜 검색
    {
      const range = buildDateRange(data.startDate, data.endDate);
      if (range) where.created_at = range;
    }

    const actoin_check = [
      "CREATE",
      "UPDATE",
      "DELETE",
      "VIEW",
      "LOGIN",
      "LOGOUT",
    ];

    if (data.action && actoin_check.includes(data.action)) {
      where.action = data.action;
    }

    return prisma.auditLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
    });
  },
};
