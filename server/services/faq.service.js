import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  async list({ category, q, is_active } = {}) {
    const where = {};
    if (typeof is_active === "boolean") where.is_active = is_active;
    if (category) where.category = category;
    if (q) where.OR = [{ question: { contains: q } }, { answer: { contains: q } }];
    return prisma.faq.findMany({ where, orderBy: [{ sort: "asc" }, { id: "desc" }] });
  },

  /** 카테고리 목록(중복 제거) */
  async categories() {
    const rows = await prisma.faq.groupBy({ by: ["category"], where: { category: { not: null } } });
    return rows.map((r) => r.category).filter(Boolean);
  },

  async get(id) {
    const f = await prisma.faq.update({ where: { id }, data: { view_count: { increment: 1 } } }).catch(() => null);
    if (!f) throw new AppError("FAQ를 찾을 수 없습니다.", 404, "NOT_FOUND");
    return f;
  },

  async save(data) {
    const { id, ...fields } = data;
    if (id) {
      const ex = await prisma.faq.findUnique({ where: { id } });
      if (!ex) throw new AppError("FAQ를 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.faq.update({ where: { id }, data: fields });
    }
    return prisma.faq.create({ data: fields });
  },

  async remove(id) {
    await prisma.faq.delete({ where: { id } });
    return { ok: true };
  },
};
