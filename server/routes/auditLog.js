import auditLogService from "../services/auditLog.service.js";
import { permission } from "../middleware/permission.js";

/**
 * 감사 로그(AuditLog) 라우트 (/api/auditLog/*)
 * Prisma 미들웨어가 자동으로 기록한 CRUD 감사 로그 조회
 */
export default async function auditLogRoutes(app) {
  /**
   * 감사 로그 리스트 (사용자/모델/기간 필터, 권한: logs.view)
   * @route POST /api/auditLog/list
   */
  app.post(
    "/list",
    {
      preHandler: permission("logs.view"),
    },
    async (req) => {
      return auditLogService.getList(req.body);
    },
  );
}
