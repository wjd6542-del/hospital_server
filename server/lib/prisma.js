import { PrismaClient } from "@prisma/client";
import { auditMiddleware } from "./prismaAuditMiddleware.js";

/**
 * 앱 전역 Prisma 클라이언트 싱글톤
 * 감사 미들웨어(auditMiddleware) 를 적용해 모든 write 작업이 AuditLog 에 자동 기록된다
 */
const prisma = new PrismaClient();

auditMiddleware(prisma);

export default prisma;
