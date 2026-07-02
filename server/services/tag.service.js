import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  async list({ only_active } = {}) {
    const where = only_active ? { is_active: true } : {};
    return prisma.tag.findMany({ where, orderBy: [{ sort: "asc" }, { id: "asc" }] });
  },

  async save(data) {
    const { id, ...fields } = data;
    const dup = await prisma.tag.findFirst({
      where: { name: fields.name, ...(id ? { id: { not: id } } : {}) },
    });
    if (dup) throw new AppError("이미 존재하는 태그명입니다.", 400, "DUPLICATE");
    if (id) {
      const ex = await prisma.tag.findUnique({ where: { id } });
      if (!ex) throw new AppError("태그를 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.tag.update({ where: { id }, data: fields });
    }
    return prisma.tag.create({ data: fields });
  },

  async remove(id) {
    // 암시적 m2m 조인은 태그 삭제 시 자동 해제된다.
    await prisma.tag.delete({ where: { id } });
    return { ok: true };
  },
};
