import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestAnnualDays } from "../server/lib/leaveAccrual.js";

// @db.Date 는 UTC 자정 — 입사일은 "YYYY-MM-DD" 로 넘긴다.

test("입사 전 연도는 0", () => {
  assert.equal(suggestAnnualDays("2025-03-10", 2024), 0);
});

test("입사 첫 해(1년 미만) — 개근 개월 수만큼, 6월 입사 → 6일", () => {
  // 2026-06-15 입사, 2026 말까지 6개월 → 6
  assert.equal(suggestAnnualDays("2026-06-15", 2026), 6);
});

test("입사 첫 달은 아직 발생 없음 → 0", () => {
  // 2026-12-10 입사, 2026-12-31 기준 완성 개월 0
  assert.equal(suggestAnnualDays("2026-12-10", 2026), 0);
});

test("1년 미만 발생은 11일이 상한", () => {
  // 2025-01-15 입사, 2025 말 기준 11개월 → 11 (상한 경계)
  assert.equal(suggestAnnualDays("2025-01-15", 2025), 11);
});

test("정확히 만 1년(2년차)은 기본 15일", () => {
  // 2025-01-01 입사 → 2026 말 근속 1년, 가산 없음
  assert.equal(suggestAnnualDays("2025-01-01", 2026), 15);
});

test("연말 입사도 이듬해엔 15일 — 1주년 경계(yearEnd == firstAnniv)", () => {
  // 2025-12-31 입사, 2026-12-31 = 1주년 → 1년 이상 분기 → 15
  assert.equal(suggestAnnualDays("2025-12-31", 2026), 15);
});

test("근속 가산 — 3년차 16일", () => {
  // 2023-01-01 입사 → 2026 근속 3년, +1
  assert.equal(suggestAnnualDays("2023-01-01", 2026), 16);
});

test("근속 가산 — 5년차 17일", () => {
  // 2021-01-01 입사 → 2026 근속 5년, +2
  assert.equal(suggestAnnualDays("2021-01-01", 2026), 17);
});

test("장기 근속은 25일이 상한", () => {
  // 2000-01-01 입사 → 2026 근속 26년, 15+12=27 → 25 로 상한
  assert.equal(suggestAnnualDays("2000-01-01", 2026), 25);
});
