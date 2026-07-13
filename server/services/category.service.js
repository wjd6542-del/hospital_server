import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  async list({ group, only_active } = {}) {
    const where = {};
    if (group) where.group = group;
    if (only_active) where.is_active = true;
    return prisma.category.findMany({
      where,
      orderBy: [{ group: "asc" }, { sort: "asc" }, { id: "asc" }],
    });
  },

  async save(data) {
    const { id, ...fields } = data;
    const dup = await prisma.category.findFirst({
      where: {
        group: fields.group,
        value: fields.value,
        ...(id ? { id: { not: id } } : {}),
      },
    });
    if (dup) throw new AppError("같은 그룹에 동일한 코드값이 있습니다.", 400, "DUPLICATE");

    if (id) {
      const ex = await prisma.category.findUnique({ where: { id } });
      if (!ex) throw new AppError("코드를 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.category.update({ where: { id }, data: fields });
    }
    return prisma.category.create({ data: fields });
  },

  async remove(id) {
    const ex = await prisma.category.findUnique({ where: { id } });
    if (!ex) throw new AppError("코드를 찾을 수 없습니다.", 404, "NOT_FOUND");

    // 참조 무결성 — 쓰이는 곳이 하나라도 있으면 거부
    const [depts, pos, job, emp, lic] = await Promise.all([
      prisma.department.count({ where: { type_id: id } }),
      prisma.employee.count({ where: { position_id: id } }),
      prisma.employee.count({ where: { job_type_id: id } }),
      prisma.employee.count({ where: { employment_type_id: id } }),
      prisma.employeeLicense.count({ where: { license_type_id: id } }),
    ]);
    const used = depts + pos + job + emp + lic;
    if (used > 0) {
      throw new AppError(
        `이 코드를 사용하는 항목이 ${used}건 있어 삭제할 수 없습니다. 비활성 처리하세요.`,
        400,
        "IN_USE",
      );
    }

    await prisma.category.delete({ where: { id } });
    return { ok: true };
  },
};
