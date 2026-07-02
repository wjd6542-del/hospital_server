import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

/**
 * 권한 코드 기반 preHandler 미들웨어 팩토리
 * - Authorization 헤더의 JWT 를 로컬 검증(DB 조회 없음)
 * - decoded.is_super === true 면 모든 권한 체크 우회
 * - 아니면 decoded.permissions 에 `code` 가 포함되는지 확인
 * @param {string} code 요구 권한 코드 (예: 'inbound.view')
 * @returns {import('fastify').preHandlerAsyncHookHandler}
 */
export const permission = (code) => {
  return async (req, reply) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return reply.code(401).send({ message: "인증 필요" });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 🔥 DB 조회 없음
      if (decoded.is_super) {
        req.user = decoded;
        return;
      }

      const permissions = decoded.permissions || [];

      if (code && !permissions.includes(code)) {
        return reply.code(403).send({ message: "권한 없음" });
      }

      req.user = decoded;
    } catch (err) {
      return reply.code(401).send({ message: "토큰 오류" });
    }
  };
};
