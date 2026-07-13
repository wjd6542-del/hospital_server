import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

const DETAIL_INCLUDE = {
  department: { select: { id: true, name: true, code: true } },
  position: true,
  job_type: true,
  employment_type: true,
  licenses: { include: { license_type: true }, orderBy: { id: "asc" } },
};

export default {
  async list({ q, department_id, job_type_id, status, page, limit } = {}) {
    const where = {};
    if (department_id) where.department_id = department_id;
    if (job_type_id) where.job_type_id = job_type_id;
    if (status === "active") where.resigned_at = null;
    if (status === "resigned") where.resigned_at = { not: null };
    if (q) where.OR = [{ name: { contains: q } }, { emp_no: { contains: q } }];

    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        orderBy: [{ emp_no: "asc" }],
        skip,
        take: l,
        include: {
          department: { select: { id: true, name: true } },
          position: { select: { id: true, text: true } },
          job_type: { select: { id: true, text: true } },
        },
      }),
      prisma.employee.count({ where }),
    ]);
    return buildPageResult({ rows, total, page: p, limit: l });
  },

  async options() {
    return prisma.employee.findMany({
      where: { resigned_at: null, is_active: true },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, emp_no: true },
    });
  },

  async get(id) {
    const e = await prisma.employee.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!e) throw new AppError("직원을 찾을 수 없습니다.", 404, "NOT_FOUND");
    return e;
  },

  /** 신규/수정 겸용. 면허는 통째로 갈아끼운다(deleteMany → createMany). */
  async save(data) {
    const { id, licenses, ...fields } = data;
    if (fields.email === "") fields.email = null;

    const dup = await prisma.employee.findFirst({
      where: { emp_no: fields.emp_no, ...(id ? { id: { not: id } } : {}) },
    });
    if (dup) throw new AppError("이미 존재하는 사번입니다.", 400, "DUPLICATE");

    return prisma.$transaction(async (tx) => {
      let emp;
      if (id) {
        const ex = await tx.employee.findUnique({ where: { id } });
        if (!ex) throw new AppError("직원을 찾을 수 없습니다.", 404, "NOT_FOUND");
        emp = await tx.employee.update({ where: { id }, data: fields });
        await tx.employeeLicense.deleteMany({ where: { employee_id: id } });
      } else {
        emp = await tx.employee.create({ data: fields });
      }

      if (licenses?.length) {
        await tx.employeeLicense.createMany({
          data: licenses.map((l) => ({ ...l, employee_id: emp.id })),
        });
      }

      return tx.employee.findUnique({ where: { id: emp.id }, include: DETAIL_INCLUDE });
    });
  },

  /** 퇴사 처리 — 물리 삭제 대신 이걸 쓴다. 인사 기록은 보존한다. */
  async resign({ id, resigned_at }) {
    const ex = await prisma.employee.findUnique({ where: { id } });
    if (!ex) throw new AppError("직원을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (ex.resigned_at) throw new AppError("이미 퇴사 처리된 직원입니다.", 400, "ALREADY_RESIGNED");

    return prisma.employee.update({
      where: { id },
      data: { resigned_at, is_active: false },
      include: DETAIL_INCLUDE,
    });
  },

  /** 물리 삭제 — 오등록 취소용. 참조가 하나라도 있으면 거부. */
  async remove(id) {
    const ex = await prisma.employee.findUnique({ where: { id } });
    if (!ex) throw new AppError("직원을 찾을 수 없습니다.", 404, "NOT_FOUND");

    const asHead = await prisma.department.count({ where: { head_employee_id: id } });
    if (asHead > 0) {
      throw new AppError("부서장으로 지정되어 있어 삭제할 수 없습니다.", 400, "IN_USE");
    }
    const linked = await prisma.user.count({ where: { employee_id: id } });
    if (linked > 0) {
      throw new AppError("연결된 로그인 계정이 있어 삭제할 수 없습니다.", 400, "IN_USE");
    }

    // 면허는 onDelete: Cascade 로 함께 지워진다
    await prisma.employee.delete({ where: { id } });
    return { ok: true };
  },
};
