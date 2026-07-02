import AppError from "../errors/AppError.js";

/**
 * Zod 스키마 검증 헬퍼
 * 실패 시 각 issue 를 정리해 AppError 400/VALIDATION_ERROR 로 변환 (첫 메시지를 message 로 노출)
 * @param {import('zod').ZodType} schema
 * @param {unknown} data 요청 바디 등
 * @returns {any} 검증 통과한 파싱 결과
 */
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((err) => ({
      path: err.path.join("."), // ex: 0.text
      message: err.message,
      code: err.code,
    }));

    const first = result.error.issues[0];
    const firstPath = first.path.join(".");
    const displayMessage = firstPath
      ? `[${firstPath}] ${first.message}`
      : first.message;

    throw new AppError(
      displayMessage,
      400,
      "VALIDATION_ERROR",
      issues, // 🔥 여기 중요
    );
  }
  return result.data;
}
