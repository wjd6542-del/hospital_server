/**
 * 비즈니스 로직에서 던지는 운영(예상) 에러 커스텀 클래스.
 * isOperational=true 플래그로 전역 에러 핸들러가 사용자에게 message 를 그대로 노출.
 * 예상 외 에러는 statusCode 500, '서버 오류가 발생했습니다.' 로 마스킹된다.
 */
export default class AppError extends Error {
  constructor(message, statusCode = 400, code = "APP_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}
