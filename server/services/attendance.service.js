import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";
import { calcAttendance } from "../lib/attendanceCalc.js";

/** "" 를 null 로 — 입력을 비우면 빈 문자열이 온다 */
function normDate(v) {
  return v === "" || v === undefined ? null : v;
}

/** @db.Date 는 UTC 자정으로 저장된다 */
function toDateOnly(d) {
  const dt = new Date(d);
  return new Date(
    Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()),
  );
}

function monthRange(year, month) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0)),
  };
}

const DETAIL_INCLUDE = {
  employee: {
    select: {
      id: true,
      emp_no: true,
      name: true,
      department: { select: { id: true, name: true } },
    },
  },
  shift_type: { select: { id: true, code: true, name: true, color: true } },
};

export default {
  async list({ department_id, employee_id, date_from, date_to, status, q, page, limit }) {
    const where = {
      work_date: { gte: toDateOnly(date_from), lte: toDateOnly(date_to) },
    };
    if (employee_id) where.employee_id = employee_id;
    if (status) where.status = status;
    if (department_id || q) {
      where.employee = {};
      if (department_id) where.employee.department_id = department_id;
      if (q) where.employee.OR = [{ name: { contains: q } }, { emp_no: { contains: q } }];
    }

    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        orderBy: [{ work_date: "desc" }, { employee_id: "asc" }],
        skip,
        take: l,
        include: DETAIL_INCLUDE,
      }),
      prisma.attendance.count({ where }),
    ]);
    return buildPageResult({ rows, total, page: p, limit: l });
  },

  /**
   * 저장 시 서버가 판정한다.
   * 1) 근무표에서 그 직원·그 날짜의 예정 근무유형을 찾는다
   * 2) 없으면 shift_type_id = null (근무표에 없는 날 출근)
   * 3) calcAttendance() 에 넘겨 판정
   * 4) 결과와 판정 기준(shift_type_id 스냅샷)을 저장
   */
  async save(data) {
    const { id, employee_id, work_date, memo } = data;
    const checkIn = normDate(data.check_in);
    const checkOut = normDate(data.check_out);
    const wd = toDateOnly(work_date);

    const emp = await prisma.employee.findUnique({ where: { id: employee_id } });
    if (!emp) throw new AppError("직원을 찾을 수 없습니다.", 404, "NOT_FOUND");

    const schedule = await prisma.shiftSchedule.findUnique({
      where: { employee_id_work_date: { employee_id, work_date: wd } },
      include: { shift_type: true },
    });
    const shiftType = schedule?.shift_type ?? null;

    const calc = calcAttendance({
      shiftType,
      checkIn: checkIn ? new Date(checkIn) : null,
      checkOut: checkOut ? new Date(checkOut) : null,
      workDate: wd,
    });

    const payload = {
      employee_id,
      work_date: wd,
      check_in: checkIn ? new Date(checkIn) : null,
      check_out: checkOut ? new Date(checkOut) : null,
      shift_type_id: shiftType?.id ?? null, // 판정 기준 스냅샷
      status: calc.status,
      work_minutes: calc.workMinutes,
      overtime_minutes: calc.overtimeMinutes,
      late_minutes: calc.lateMinutes,
      early_leave_minutes: calc.earlyLeaveMinutes,
      memo: memo ?? null,
    };

    return prisma.attendance.upsert({
      where: { employee_id_work_date: { employee_id, work_date: wd } },
      update: payload,
      create: payload,
      include: DETAIL_INCLUDE,
    });
  },

  /**
   * 그날 근무표에 있는 직원의 빈 출퇴근 행을 만든다.
   * 관리자가 시각만 채우면 되도록. 이미 있는 행은 건드리지 않는다.
   */
  async bulkGenerate({ department_id, work_date }) {
    const wd = toDateOnly(work_date);

    const employees = await prisma.employee.findMany({
      where: { department_id, resigned_at: null },
      select: { id: true },
    });
    const empIds = employees.map((e) => e.id);
    if (!empIds.length) return { created: 0, skipped: 0 };

    const [schedules, existing] = await Promise.all([
      prisma.shiftSchedule.findMany({
        where: { employee_id: { in: empIds }, work_date: wd },
        include: { shift_type: true },
      }),
      prisma.attendance.findMany({
        where: { employee_id: { in: empIds }, work_date: wd },
        select: { employee_id: true },
      }),
    ]);

    const taken = new Set(existing.map((e) => e.employee_id));

    const toCreate = [];
    let skipped = 0;
    for (const s of schedules) {
      if (taken.has(s.employee_id)) { skipped++; continue; }

      // 시각이 비어 있으므로 판정은 ABSENT(출근 없음) 또는 LEAVE(비근무 유형)
      const calc = calcAttendance({
        shiftType: s.shift_type,
        checkIn: null,
        checkOut: null,
        workDate: wd,
      });

      toCreate.push({
        employee_id: s.employee_id,
        work_date: wd,
        shift_type_id: s.shift_type_id,
        status: calc.status,
        work_minutes: 0,
        overtime_minutes: 0,
        late_minutes: 0,
        early_leave_minutes: 0,
      });
    }

    if (toCreate.length) {
      await prisma.attendance.createMany({ data: toCreate });
    }
    return { created: toCreate.length, skipped };
  },

  /** 직원별 월간 집계 */
  async summary({ department_id, year, month }) {
    const { start, end } = monthRange(year, month);

    const employees = await prisma.employee.findMany({
      where: { department_id, resigned_at: null },
      orderBy: [{ emp_no: "asc" }],
      select: { id: true, emp_no: true, name: true },
    });
    const empIds = employees.map((e) => e.id);
    if (!empIds.length) return [];

    const rows = await prisma.attendance.findMany({
      where: { employee_id: { in: empIds }, work_date: { gte: start, lte: end } },
      select: {
        employee_id: true,
        status: true,
        work_minutes: true,
        overtime_minutes: true,
        late_minutes: true,
      },
    });

    const byEmp = new Map();
    for (const e of employees) {
      byEmp.set(e.id, {
        employee_id: e.id,
        emp_no: e.emp_no,
        name: e.name,
        work_days: 0,
        work_minutes: 0,
        overtime_minutes: 0,
        late_count: 0,
        absent_count: 0,
        leave_count: 0,
      });
    }

    for (const r of rows) {
      const s = byEmp.get(r.employee_id);
      if (!s) continue;
      if (r.status === "ABSENT") s.absent_count++;
      else if (r.status === "LEAVE") s.leave_count++;
      else {
        s.work_days++;
        s.work_minutes += r.work_minutes;
        s.overtime_minutes += r.overtime_minutes;
        if (r.status === "LATE") s.late_count++;
      }
    }

    return [...byEmp.values()];
  },

  async remove(id) {
    const ex = await prisma.attendance.findUnique({ where: { id } });
    if (!ex) throw new AppError("근태를 찾을 수 없습니다.", 404, "NOT_FOUND");
    await prisma.attendance.delete({ where: { id } });
    return { ok: true };
  },
};
