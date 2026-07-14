/**
 * 근태 판정 — 순수 함수. DB를 모른다.
 *
 * 나이트 근무는 시작일에 귀속된다. 1일 22시 출근 → 2일 07시 퇴근이면
 * workDate = 1일이고, crosses_midnight=true 이므로 예정 퇴근을 다음날로 해석한다.
 */

const MINUTE = 60 * 1000;

/** "08:00" + 기준일 → Date. addDays 만큼 날짜를 민다. */
function atTime(baseDate, hhmm, addDays = 0) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + addDays);
  d.setHours(h, m, 0, 0);
  return d;
}

/** 음수는 0으로 — 지각/조퇴/연장은 모두 "초과분"이라 음수가 될 수 없다 */
function diffMinutes(later, earlier) {
  return Math.max(0, Math.round((later.getTime() - earlier.getTime()) / MINUTE));
}

/**
 * @param {object} args
 * @param {object|null} args.shiftType  { start_time, end_time, crosses_midnight, break_minutes, is_work }
 *   null 이면 근무표에 없는 날 출근한 것 — 실측만 계산한다.
 * @param {Date|null} args.checkIn
 * @param {Date|null} args.checkOut
 * @param {Date} args.workDate  근무 시작일
 * @returns {{status: string, workMinutes: number, overtimeMinutes: number, lateMinutes: number, earlyLeaveMinutes: number}}
 */
export function calcAttendance({ shiftType, checkIn, checkOut, workDate }) {
  const zero = { workMinutes: 0, overtimeMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0 };

  // 1) 비근무 유형(비번·연차·병가) — 시각을 넣어도 무시한다
  if (shiftType && shiftType.is_work === false) {
    return { status: "LEAVE", ...zero };
  }

  // 2) 출근 기록이 없으면 결근
  if (!checkIn) {
    return { status: "ABSENT", ...zero };
  }

  const breakMinutes = shiftType?.break_minutes ?? 0;

  // 3) 실근무 시간 — 퇴근이 없으면 0
  const workMinutes = checkOut ? Math.max(0, diffMinutes(checkOut, checkIn) - breakMinutes) : 0;

  // 4) 판정 기준(예정 시각)이 없으면 실측만 낸다.
  //    - shiftType 이 null (근무표에 없는 날)
  //    - shiftType 은 있는데 시각이 없음 (데이터 오류)
  if (!shiftType?.start_time || !shiftType?.end_time) {
    return { status: "NORMAL", ...zero, workMinutes };
  }

  const plannedIn = atTime(workDate, shiftType.start_time);
  const plannedOut = atTime(workDate, shiftType.end_time, shiftType.crosses_midnight ? 1 : 0);

  const lateMinutes = diffMinutes(checkIn, plannedIn);

  let earlyLeaveMinutes = 0;
  let overtimeMinutes = 0;
  if (checkOut) {
    earlyLeaveMinutes = diffMinutes(plannedOut, checkOut);
    overtimeMinutes = diffMinutes(checkOut, plannedOut);
  }

  // 5) status 우선순위: ABSENT > LATE > EARLY_LEAVE > NORMAL
  //    지각과 조퇴가 동시에 나면 status 는 LATE 지만 두 분(minutes)은 둘 다 남긴다.
  let status = "NORMAL";
  if (lateMinutes > 0) status = "LATE";
  else if (earlyLeaveMinutes > 0) status = "EARLY_LEAVE";

  return { status, workMinutes, overtimeMinutes, lateMinutes, earlyLeaveMinutes };
}
