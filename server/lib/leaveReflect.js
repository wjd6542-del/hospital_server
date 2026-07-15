import prisma from "./prisma.js";
import { calcAttendance } from "./attendanceCalc.js";

/** @db.Date 는 UTC 자정으로 저장된다 */
function toDateOnly(d) {
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

/** [start, end] 사이의 UTC 자정 날짜 배열 (양끝 포함) */
function eachDate(start, end) {
  const out = [];
  let cur = toDateOnly(start);
  const last = toDateOnly(end);
  // 폭주 방지 — 최대 366일
  for (let i = 0; cur <= last && i < 366; i++) {
    out.push(new Date(cur));
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() + 1));
  }
  return out;
}

/** 그 직원·그 날짜의 출퇴근 행이 있으면 근무표 기준으로 재판정한다 */
async function rejudgeAttendance(tx, employee_id, wd) {
  const att = await tx.attendance.findUnique({
    where: { employee_id_work_date: { employee_id, work_date: wd } },
  });
  if (!att) return;

  const schedule = await tx.shiftSchedule.findUnique({
    where: { employee_id_work_date: { employee_id, work_date: wd } },
    include: { shift_type: true },
  });
  const shiftType = schedule?.shift_type ?? null;

  const calc = calcAttendance({
    shiftType,
    checkIn: att.check_in,
    checkOut: att.check_out,
    workDate: wd,
  });

  await tx.attendance.update({
    where: { id: att.id },
    data: {
      shift_type_id: shiftType?.id ?? null,
      status: calc.status,
      work_minutes: calc.workMinutes,
      overtime_minutes: calc.overtimeMinutes,
      late_minutes: calc.lateMinutes,
      early_leave_minutes: calc.earlyLeaveMinutes,
    },
  });
}

/**
 * 휴가 승인 반영 — 신청 기간의 각 날짜에 근무표 셀(연차/병가 등)을 찍고
 * 이미 출퇴근 행이 있으면 재판정한다. leave_type.shift_type_id 가 없으면 근무표 미반영.
 * @param request LeaveRequest (leave_type 포함)
 */
export async function applyLeaveToSchedule(request) {
  const shiftTypeId = request.leave_type?.shift_type_id;
  if (!shiftTypeId) return; // 근무표에 매핑되지 않은 유형

  const { employee_id } = request;
  const dates = eachDate(request.start_date, request.end_date);

  await prisma.$transaction(async (tx) => {
    for (const wd of dates) {
      await tx.shiftSchedule.upsert({
        where: { employee_id_work_date: { employee_id, work_date: wd } },
        update: { shift_type_id: shiftTypeId, memo: "휴가 승인" },
        create: { employee_id, work_date: wd, shift_type_id: shiftTypeId, memo: "휴가 승인" },
      });
      await rejudgeAttendance(tx, employee_id, wd);
    }
  });
}

/**
 * 휴가 승인 취소 반영 — 승인 때 찍은 근무표 셀(같은 shift_type 인 것만) 을 지우고
 * 출퇴근 행이 있으면 재판정한다.
 */
export async function revertLeaveFromSchedule(request) {
  const shiftTypeId = request.leave_type?.shift_type_id;
  if (!shiftTypeId) return;

  const { employee_id } = request;
  const dates = eachDate(request.start_date, request.end_date);

  await prisma.$transaction(async (tx) => {
    for (const wd of dates) {
      const cell = await tx.shiftSchedule.findUnique({
        where: { employee_id_work_date: { employee_id, work_date: wd } },
      });
      // 승인으로 찍힌(같은 유형) 셀만 원복한다 — 관리자가 따로 지정한 셀은 건드리지 않는다
      if (cell && cell.shift_type_id === shiftTypeId) {
        await tx.shiftSchedule.delete({ where: { id: cell.id } });
      }
      await rejudgeAttendance(tx, employee_id, wd);
    }
  });
}
