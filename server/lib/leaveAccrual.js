/**
 * 법정 연차 제안값 — 순수 함수. 관리자가 부여 화면에서 수정할 수 있는 참고치다.
 *
 * 근로기준법 기준(단순화):
 *  - 입사 1년 미만: 1개월 개근당 1일, 최대 11일
 *  - 입사 1년 이상: 15일 + 3년차부터 2년마다 1일 가산, 최대 25일
 *
 * @db.Date 는 UTC 자정으로 저장되므로 getUTC* 로 읽는다.
 */

/** 두 날짜 사이의 완전한 개월 수 (a → b) */
function monthsBetween(a, b) {
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m -= 1; // 일자가 못 미치면 그 달은 미완성
  return m;
}

/**
 * @param {Date|string} hiredAt 입사일
 * @param {number} year 부여 대상 연도 (예: 2026)
 * @returns {number} 제안 연차 일수
 */
export function suggestAnnualDays(hiredAt, year) {
  const hire = new Date(hiredAt);
  const hireY = hire.getUTCFullYear();
  const hireM = hire.getUTCMonth();
  const hireD = hire.getUTCDate();

  if (year < hireY) return 0; // 입사 전 연도

  const firstAnniv = new Date(Date.UTC(hireY + 1, hireM, hireD));
  const yearEnd = new Date(Date.UTC(year, 11, 31));

  // 대상 연도 말까지도 1주년이 안 됐으면 → 1년 미만 (월 단위 발생)
  if (yearEnd < firstAnniv) {
    const months = monthsBetween(hire, yearEnd);
    return Math.max(0, Math.min(11, months));
  }

  // 1년 이상 — 대상 연도 말 기준 근속 연수
  const tenure = year - hireY;
  const extra = Math.floor(Math.max(0, tenure - 1) / 2);
  return Math.min(25, 15 + extra);
}
