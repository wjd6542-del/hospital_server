import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { suggestAnnualDays } from "../lib/leaveAccrual.js";

/** 그 연도에 승인된 "연차 차감성" 휴가 일수 합계 (직원별) */
async function usedByEmployee(empIds, year) {
  if (!empIds.length) return new Map();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));

  const rows = await prisma.leaveRequest.findMany({
    where: {
      employee_id: { in: empIds },
      status: "APPROVED",
      leave_type: { deduct_annual: true },
      start_date: { gte: start, lte: end },
    },
    select: { employee_id: true, days: true },
  });

  const used = new Map();
  for (const r of rows) {
    used.set(r.employee_id, (used.get(r.employee_id) ?? 0) + r.days);
  }
  return used;
}

export default {
  /** 부서×연도 직원 목록 + 부여/사용/잔여 + 법정 제안값 */
  async list({ department_id, year, q }) {
    const where = { resigned_at: null };
    if (department_id) where.department_id = department_id;
    if (q) where.OR = [{ name: { contains: q } }, { emp_no: { contains: q } }];

    const employees = await prisma.employee.findMany({
      where,
      orderBy: [{ emp_no: "asc" }],
      select: {
        id: true,
        emp_no: true,
        name: true,
        hired_at: true,
        department: { select: { id: true, name: true } },
      },
    });
    const empIds = employees.map((e) => e.id);
    if (!empIds.length) return [];

    const [grants, used] = await Promise.all([
      prisma.leaveGrant.findMany({ where: { employee_id: { in: empIds }, year } }),
      usedByEmployee(empIds, year),
    ]);
    const grantByEmp = new Map(grants.map((g) => [g.employee_id, g]));

    return employees.map((e) => {
      const g = grantByEmp.get(e.id) ?? null;
      const granted = g?.granted_days ?? null;
      const usedDays = used.get(e.id) ?? 0;
      return {
        grant_id: g?.id ?? null,
        employee_id: e.id,
        emp_no: e.emp_no,
        name: e.name,
        department: e.department,
        hired_at: e.hired_at,
        year,
        granted_days: granted,
        used_days: usedDays,
        remaining_days: granted == null ? null : granted - usedDays,
        suggested_days: suggestAnnualDays(e.hired_at, year),
        note: g?.note ?? null,
      };
    });
  },

  async save({ id, employee_id, year, granted_days, note }) {
    const emp = await prisma.employee.findUnique({ where: { id: employee_id } });
    if (!emp) throw new AppError("직원을 찾을 수 없습니다.", 404, "NOT_FOUND");

    const payload = { employee_id, year, granted_days, note: note ?? null };
    return prisma.leaveGrant.upsert({
      where: { employee_id_year: { employee_id, year } },
      update: { granted_days, note: note ?? null },
      create: payload,
    });
  },

  async remove(id) {
    const ex = await prisma.leaveGrant.findUnique({ where: { id } });
    if (!ex) throw new AppError("부여 내역을 찾을 수 없습니다.", 404, "NOT_FOUND");
    await prisma.leaveGrant.delete({ where: { id } });
    return { ok: true };
  },
};
