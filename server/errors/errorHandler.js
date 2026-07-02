/**
 * Fastify 전역 에러 핸들러
 * - AppError(isOperational=true) → statusCode / code / message 를 그대로 응답
 * - 그 외 예외 → 500 / INTERNAL_SERVER_ERROR / 마스킹 메시지, 로그에 상세 에러 기록
 * @param {Error & {isOperational?:boolean, statusCode?:number, code?:string}} error
 * @param {FastifyRequest} request
 * @param {FastifyReply} reply
 */
export default function errorHandler(error, request, reply) {
  const isOperational = error.isOperational === true;

  const statusCode = error.statusCode || 500;
  const code = error.code || "INTERNAL_SERVER_ERROR";
  const message = isOperational ? error.message : "서버 오류가 발생했습니다.";

  if (!isOperational) {
    request.log.error(error);
  }

  return reply.status(statusCode).send({
    success: false,
    code,
    message,
  });
}
