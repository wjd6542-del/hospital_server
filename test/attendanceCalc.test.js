import { test } from "node:test";
import assert from "node:assert/strict";
import { calcAttendance } from "../server/lib/attendanceCalc.js";

// 근무유형 픽스처
const DAY = { start_time: "07:00", end_time: "15:00", crosses_midnight: false, break_minutes: 30, is_work: true };
const NIGHT = { start_time: "22:00", end_time: "07:00", crosses_midnight: true, break_minutes: 60, is_work: true };
const OFF = { start_time: null, end_time: null, crosses_midnight: false, break_minutes: 0, is_work: false };
const NO_TIME = { start_time: null, end_time: null, crosses_midnight: false, break_minutes: 0, is_work: true };

const d = (s) => new Date(s);
const WORK_DATE = d("2026-08-03T00:00:00");

test("정상 출퇴근 — 휴게시간이 빠진다", () => {
  const r = calcAttendance({
    shiftType: DAY,
    checkIn: d("2026-08-03T07:00:00"),
    checkOut: d("2026-08-03T15:00:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "NORMAL");
  assert.equal(r.workMinutes, 450); // 8시간(480) - 휴게 30
  assert.equal(r.overtimeMinutes, 0);
  assert.equal(r.lateMinutes, 0);
  assert.equal(r.earlyLeaveMinutes, 0);
});

test("지각", () => {
  const r = calcAttendance({
    shiftType: DAY,
    checkIn: d("2026-08-03T07:20:00"),
    checkOut: d("2026-08-03T15:00:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "LATE");
  assert.equal(r.lateMinutes, 20);
  assert.equal(r.earlyLeaveMinutes, 0);
  assert.equal(r.workMinutes, 430); // 7시간40분(460) - 휴게 30
});

test("조퇴", () => {
  const r = calcAttendance({
    shiftType: DAY,
    checkIn: d("2026-08-03T07:00:00"),
    checkOut: d("2026-08-03T14:30:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "EARLY_LEAVE");
  assert.equal(r.earlyLeaveMinutes, 30);
  assert.equal(r.lateMinutes, 0);
});

test("지각 + 조퇴 동시 — status 는 LATE, 두 분(minutes) 다 남는다", () => {
  const r = calcAttendance({
    shiftType: DAY,
    checkIn: d("2026-08-03T07:15:00"),
    checkOut: d("2026-08-03T14:40:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "LATE"); // 우선순위: LATE > EARLY_LEAVE
  assert.equal(r.lateMinutes, 15);
  assert.equal(r.earlyLeaveMinutes, 20); // 잃어버리면 급여 공제를 놓친다
});

test("연장근무", () => {
  const r = calcAttendance({
    shiftType: DAY,
    checkIn: d("2026-08-03T07:00:00"),
    checkOut: d("2026-08-03T17:30:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "NORMAL");
  assert.equal(r.overtimeMinutes, 150); // 15:00 → 17:30
  assert.equal(r.workMinutes, 600); // 10시간30분(630) - 휴게 30
});

test("나이트 — 자정을 넘어 9시간, 휴게 60분 빼고 8시간", () => {
  const r = calcAttendance({
    shiftType: NIGHT,
    checkIn: d("2026-08-03T22:00:00"),
    checkOut: d("2026-08-04T07:00:00"), // 다음날
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "NORMAL");
  assert.equal(r.workMinutes, 480); // 9시간(540) - 휴게 60
  assert.equal(r.overtimeMinutes, 0);
  assert.equal(r.lateMinutes, 0);
});

test("나이트 조기 퇴근 — 다음날 05:00 이면 조퇴 120분", () => {
  const r = calcAttendance({
    shiftType: NIGHT,
    checkIn: d("2026-08-03T22:00:00"),
    checkOut: d("2026-08-04T05:00:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "EARLY_LEAVE");
  assert.equal(r.earlyLeaveMinutes, 120); // 예정 07:00 - 실제 05:00
});

test("나이트 연장 — 다음날 09:00 이면 연장 120분", () => {
  const r = calcAttendance({
    shiftType: NIGHT,
    checkIn: d("2026-08-03T22:00:00"),
    checkOut: d("2026-08-04T09:00:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.overtimeMinutes, 120);
  assert.equal(r.workMinutes, 600); // 11시간(660) - 휴게 60
});

test("출근 없음 → 결근", () => {
  const r = calcAttendance({
    shiftType: DAY,
    checkIn: null,
    checkOut: null,
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "ABSENT");
  assert.equal(r.workMinutes, 0);
  assert.equal(r.lateMinutes, 0);
});

test("퇴근 미기록 — 지각은 판정하되 근무시간은 0", () => {
  const r = calcAttendance({
    shiftType: DAY,
    checkIn: d("2026-08-03T07:10:00"),
    checkOut: null,
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "LATE");
  assert.equal(r.lateMinutes, 10);
  assert.equal(r.workMinutes, 0);
  assert.equal(r.overtimeMinutes, 0);
  assert.equal(r.earlyLeaveMinutes, 0);
});

test("비근무 유형(연차) → LEAVE, 시각을 넣어도 무시", () => {
  const r = calcAttendance({
    shiftType: OFF,
    checkIn: d("2026-08-03T09:00:00"), // 넣어도
    checkOut: d("2026-08-03T18:00:00"), // 무시된다
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "LEAVE");
  assert.equal(r.workMinutes, 0);
  assert.equal(r.overtimeMinutes, 0);
  assert.equal(r.lateMinutes, 0);
  assert.equal(r.earlyLeaveMinutes, 0);
});

test("시각 없는 근무유형 — 실측만 계산, 판정 기준이 없으므로 나머지 0", () => {
  const r = calcAttendance({
    shiftType: NO_TIME,
    checkIn: d("2026-08-03T09:00:00"),
    checkOut: d("2026-08-03T18:00:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "NORMAL");
  assert.equal(r.workMinutes, 540); // 9시간, 휴게 0
  assert.equal(r.lateMinutes, 0);
  assert.equal(r.earlyLeaveMinutes, 0);
  assert.equal(r.overtimeMinutes, 0);
});

test("근무유형이 없음(근무표에 없는 날) — 실측만", () => {
  const r = calcAttendance({
    shiftType: null,
    checkIn: d("2026-08-03T09:00:00"),
    checkOut: d("2026-08-03T18:00:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "NORMAL");
  assert.equal(r.workMinutes, 540);
  assert.equal(r.lateMinutes, 0);
});

test("정시 출근·정시 퇴근은 지각도 조퇴도 아니다", () => {
  const r = calcAttendance({
    shiftType: DAY,
    checkIn: d("2026-08-03T07:00:00"),
    checkOut: d("2026-08-03T15:00:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.lateMinutes, 0);
  assert.equal(r.earlyLeaveMinutes, 0);
  assert.equal(r.overtimeMinutes, 0);
});
