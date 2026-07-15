import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

/** Date → "2026-08-03" (로컬 기준). DB 의 @db.Date 는 UTC 자정으로 오므로 UTC 로 읽는다. */
function ymd(d) {
  const dt = new Date(d);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "2026-08-03" → Date (UTC 자정). @db.Date 컬럼에 넣을 값. */
function toDate(s) {
  return new Date(`${ymd(s)}T00:00:00.000Z`);
}

/** 그 달의 1일 ~ 말일 (UTC 자정) */
function monthRange(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // 다음달 0일 = 이번달 말일
  return { start, end, lastDay: end.getUTCDate() };
}

export default {
  /** 직원 × 날짜 2차원. 셀마다 API 를 부르면 30일 × 20명 = 600번이 된다. */
  async grid({ department_id, year, month }) {
    const { start, end, lastDay } = monthRange(year, month);

    const employees = await prisma.employee.findMany({
      where: { department_id, resigned_at: null },
      orderBy: [{ emp_no: "asc" }],
      select: {
        id: true,
        emp_no: true,
        name: true,
        position: { select: { text: true } },
        job_type: { select: { text: true } },
      },
    });

    const rows = await prisma.shiftSchedule.findMany({
      where: {
        employee_id: { in: employees.map((e) => e.id) },
        work_date: { gte: start, lte: end },
      },
      include: { shift_type: { select: { id: true, code: true, name: true, color: true } } },
    });

    // cells: "employeeId:YYYY-MM-DD" → { shift_type_id, code, color, memo }
    const cells = {};
    // counts: "YYYY-MM-DD" → { D: 5, E: 3, ... }
    const counts = {};

    for (const r of rows) {
      const key = ymd(r.work_date);
      cells[`${r.employee_id}:${key}`] = {
        shift_type_id: r.shift_type_id,
        code: r.shift_type.code,
        color: r.shift_type.color,
        memo: r.memo,
      };
      if (!counts[key]) counts[key] = {};
      counts[key][r.shift_type.code] = (counts[key][r.shift_type.code] ?? 0) + 1;
    }

    const days = [];
    for (let d = 1; d <= lastDay; d++) {
      const dt = new Date(Date.UTC(year, month - 1, d));
      days.push({
        date: ymd(dt),
        day: d,
        weekday: dt.getUTCDay(), // 0=일 … 6=토
      });
    }

    return {
      employees: employees.map((e) => ({
        id: e.id,
        emp_no: e.emp_no,
        name: e.name,
        position: e.position?.text ?? null,
        job_type: e.job_type?.text ?? null,
      })),
      days,
      cells,
      counts,
    };
  },

  async saveCell({ employee_id, work_date, shift_type_id, memo }) {
    const wd = toDate(work_date);
    return prisma.shiftSchedule.upsert({
      where: { employee_id_work_date: { employee_id, work_date: wd } },
      update: { shift_type_id, memo: memo ?? null },
      create: { employee_id, work_date: wd, shift_type_id, memo: memo ?? null },
    });
  },

  /** 드래그로 여러 칸을 한 번에 칠할 때 */
  async saveBulk({ cells }) {
    await prisma.$transaction(
      cells.map((c) =>
        prisma.shiftSchedule.upsert({
          where: {
            employee_id_work_date: { employee_id: c.employee_id, work_date: toDate(c.work_date) },
          },
          update: { shift_type_id: c.shift_type_id, memo: c.memo ?? null },
          create: {
            employee_id: c.employee_id,
            work_date: toDate(c.work_date),
            shift_type_id: c.shift_type_id,
            memo: c.memo ?? null,
          },
        }),
      ),
    );
    return { saved: cells.length };
  },

  /**
   * 지난달 근무표 복사. 수간호사가 매달 처음부터 짜지 않도록.
   * 대상 월에 이미 근무가 있는 칸은 건너뛴다 — 실수로 짜둔 근무표를 날리면 안 된다.
   */
  async copyMonth({ department_id, from_year, from_month, to_year, to_month }) {
    const from = monthRange(from_year, from_month);
    const to = monthRange(to_year, to_month);

    const employees = await prisma.employee.findMany({
      where: { department_id, resigned_at: null },
      select: { id: true },
    });
    const empIds = employees.map((e) => e.id);
    if (!empIds.length) return { copied: 0, skipped: 0 };

    const [source, existing] = await Promise.all([
      prisma.shiftSchedule.findMany({
        where: { employee_id: { in: empIds }, work_date: { gte: from.start, lte: from.end } },
        select: { employee_id: true, work_date: true, shift_type_id: true },
      }),
      prisma.shiftSchedule.findMany({
        where: { employee_id: { in: empIds }, work_date: { gte: to.start, lte: to.end } },
        select: { employee_id: true, work_date: true },
      }),
    ]);

    const taken = new Set(existing.map((e) => `${e.employee_id}:${ymd(e.work_date)}`));

    const toCreate = [];
    let skipped = 0;
    for (const s of source) {
      const day = new Date(s.work_date).getUTCDate();
      if (day > to.lastDay) { skipped++; continue; } // 31일 → 30일뿐인 달

      const target = new Date(Date.UTC(to_year, to_month - 1, day));
      const key = `${s.employee_id}:${ymd(target)}`;
      if (taken.has(key)) { skipped++; continue; }

      toCreate.push({
        employee_id: s.employee_id,
        work_date: target,
        shift_type_id: s.shift_type_id,
      });
    }

    if (toCreate.length) {
      await prisma.shiftSchedule.createMany({ data: toCreate });
    }
    return { copied: toCreate.length, skipped };
  },

  async removeCell({ employee_id, work_date }) {
    const wd = toDate(work_date);
    const ex = await prisma.shiftSchedule.findUnique({
      where: { employee_id_work_date: { employee_id, work_date: wd } },
    });
    if (!ex) throw new AppError("근무를 찾을 수 없습니다.", 404, "NOT_FOUND");
    await prisma.shiftSchedule.delete({ where: { id: ex.id } });
    return { ok: true };
  },
};
