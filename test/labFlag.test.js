import { test } from "node:test";
import assert from "node:assert/strict";
import { judgeFlag } from "../server/lib/labFlag.js";

test("참고범위 안 → NORMAL", () => {
  assert.equal(judgeFlag(5.0, 4.0, 10.0), "NORMAL");
});

test("하한 미만 → LOW", () => {
  assert.equal(judgeFlag(3.0, 4.0, 10.0), "LOW");
});

test("상한 초과 → HIGH", () => {
  assert.equal(judgeFlag(12, 4, 10), "HIGH");
  assert.equal(judgeFlag(50, 0, 40), "HIGH"); // AST 예
});

test("비수치 결과(음성)는 자동판정 안 함 → null", () => {
  assert.equal(judgeFlag("음성", null, null), null);
  assert.equal(judgeFlag("양성", 4, 10), null);
});

test("빈 값·null → null", () => {
  assert.equal(judgeFlag("", 4, 10), null);
  assert.equal(judgeFlag(null, 4, 10), null);
});

test("수치지만 참고범위 없음 → null", () => {
  assert.equal(judgeFlag(5, null, null), null);
});

test("한쪽 경계만 있어도 판정", () => {
  assert.equal(judgeFlag(5, null, 10), "NORMAL"); // 상한만
  assert.equal(judgeFlag(15, null, 10), "HIGH");
  assert.equal(judgeFlag(2, 4, null), "LOW"); // 하한만
  assert.equal(judgeFlag(6, 4, null), "NORMAL");
});

test("경계값은 정상 (경계 포함)", () => {
  assert.equal(judgeFlag(4, 4, 10), "NORMAL");
  assert.equal(judgeFlag(10, 4, 10), "NORMAL");
});
