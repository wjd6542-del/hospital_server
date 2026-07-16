/**
 * 검사 결과 이상 판정 — 순수 함수.
 *
 * 수치 결과를 참고범위(ref_low ~ ref_high)와 비교해 NORMAL/HIGH/LOW 를 낸다.
 * 비수치 결과(음성/양성 등)나 참고범위가 없으면 null → 수동 판정(ABNORMAL 등)에 맡긴다.
 *
 * @param {string|number|null} resultValue 결과값
 * @param {number|null} refLow 참고 하한
 * @param {number|null} refHigh 참고 상한
 * @returns {"NORMAL"|"HIGH"|"LOW"|null}
 */
export function judgeFlag(resultValue, refLow, refHigh) {
  if (resultValue === null || resultValue === undefined || resultValue === "") return null;

  const num = Number(resultValue);
  if (!Number.isFinite(num)) return null; // 비수치 결과

  const hasLow = refLow !== null && refLow !== undefined;
  const hasHigh = refHigh !== null && refHigh !== undefined;
  if (!hasLow && !hasHigh) return null; // 참고범위 없음

  if (hasLow && num < refLow) return "LOW";
  if (hasHigh && num > refHigh) return "HIGH";
  return "NORMAL";
}
