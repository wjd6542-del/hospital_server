import fp from "fastify-plugin";
import { runAuditContext } from "../lib/auditContext.js";

/**
 * 감사 컨텍스트 바인딩 플러그인
 * 모든 요청에 대해 AsyncLocalStorage 기반 감사 컨텍스트(user_id/ip/user_agent/page/method)를
 * 바인딩하여 Prisma auditMiddleware 가 어떤 사용자의 어떤 요청에서 어떤 DB 변경이 발생했는지
 * 추적할 수 있도록 한다.
 */
export default fp(async function (fastify) {
  fastify.addHook("onRequest", (request, reply, done) => {
    const ctx = {
      user_id: request.user?.id ?? null,
      ip: request.ip,
      user_agent: request.headers["user-agent"],
      page: request.url,
      method: request.method,
    };

    runAuditContext(ctx, () => done());
  });
});
