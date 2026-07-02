import errorHandler from "../errors/errorHandler.js";

/**
 * 전역 에러 핸들러 등록 플러그인
 * AppError(운영 에러) 와 예상치 못한 에러를 구분해 표준화된 응답 반환
 */
export default async function errorHandlerPlugin(fastify) {
  fastify.setErrorHandler(errorHandler);
}
