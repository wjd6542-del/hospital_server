/**
 * 시작/종료 일자 문자열을 Prisma where 조건으로 변환.
 *
 * - endDate 는 그날 23:59:59.999 까지 포함하도록 보정 (그렇지 않으면
 *   "00:00:00 으로 해석"되어 그날 데이터가 누락되는 흔한 버그 방지)
 * - 둘 중 하나만 있으면 단방향 비교 (gte 또는 lte) 만 적용
 * - 둘 다 없거나 잘못된 값이면 null 반환 (호출자에서 조건 미적용)
 *
 * @param {string|Date|undefined|null} startDate
 * @param {string|Date|undefined|null} endDate
 * @returns {{gte?:Date, lte?:Date} | null}
 */
export function buildDateRange(startDate, endDate) {
  const range = {};

  if (startDate) {
    const s = new Date(startDate);
    if (!isNaN(s.getTime())) {
      range.gte = s;
    }
  }

  if (endDate) {
    const e = new Date(endDate);
    if (!isNaN(e.getTime())) {
      // 종료일은 그날 23:59:59.999 까지 포함
      e.setHours(23, 59, 59, 999);
      range.lte = e;
    }
  }

  return Object.keys(range).length ? range : null;
}
