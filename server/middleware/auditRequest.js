import { setAuditContext } from "../lib/auditContext.js";

/**
 * (레거시) Express 스타일 감사 컨텍스트 미들웨어
 * 현재는 Fastify 플러그인 auditHook.js 로 대체됨
 */
export function auditRequest(req, res, next) {
  const context = {
    user_id: req.user?.user_id || null,
    ip: req.ip,
    user_agent: req.headers["user-agent"],
    page: req.baseUrl,
  };

  setAuditContext(context, () => {
    next();
  });
}
