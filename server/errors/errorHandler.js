import { Prisma } from "@prisma/client";

/** Prisma 에러 코드 → {statusCode, code, message} 매핑. 매핑에 없는 P-코드는 500으로 마스킹된다. */
const PRISMA_ERROR_MAP = {
  P2002: { statusCode: 400, code: "DUPLICATE", message: "이미 존재하는 값입니다." },
  P2003: { statusCode: 400, code: "INVALID_REF", message: "참조하는 항목을 찾을 수 없습니다." },
  P2025: { statusCode: 404, code: "NOT_FOUND", message: "대상을 찾을 수 없습니다." },
};

/**
 * Fastify 전역 에러 핸들러
 * - AppError(isOperational=true) → statusCode / code / message 를 그대로 응답
 * - PrismaClientKnownRequestError → PRISMA_ERROR_MAP 매핑 (unique/FK/not-found 위반을 400/404로)
 * - 그 외 예외 → 500 / INTERNAL_SERVER_ERROR / 마스킹 메시지, 로그에 상세 에러 기록
 * @param {Error & {isOperational?:boolean, statusCode?:number, code?:string}} error
 * @param {FastifyRequest} request
 * @param {FastifyReply} reply
 */
export default function errorHandler(error, request, reply) {
  const isOperational = error.isOperational === true;
  const prismaMapping =
    error instanceof Prisma.PrismaClientKnownRequestError ? PRISMA_ERROR_MAP[error.code] : undefined;

  const statusCode = error.statusCode || prismaMapping?.statusCode || 500;
  const code = prismaMapping?.code || error.code || "INTERNAL_SERVER_ERROR";
  const message = prismaMapping ? prismaMapping.message : isOperational ? error.message : "서버 오류가 발생했습니다.";

  if (prismaMapping) {
    request.log.warn({ prismaCode: error.code, meta: error.meta }, "Prisma 에러 매핑됨");
  } else if (!isOperational) {
    request.log.error(error);
  }

  return reply.status(statusCode).send({
    success: false,
    code,
    message,
  });
}
