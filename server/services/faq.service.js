import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

export default {
  async list({ category, categories, q, is_active, page, limit } = {}) {
    const where = {};
    if (typeof is_active === "boolean") where.is_active = is_active;
    if (categories?.length) where.category = { in: categories };
    else if (category) where.category = category;
    if (q) where.OR = [{ question: { contains: q } }, { answer: { contains: q } }];
    const { page: p, limit: l, skip } = parsePage({ page, limit }, { defaultLimit: 10 });
    const [rows, total] = await Promise.all([
      prisma.faq.findMany({ where, orderBy: [{ sort: "asc" }, { id: "desc" }], skip, take: l }),
      prisma.faq.count({ where }),
    ]);
    return buildPageResult({ rows, total, page: p, limit: l });
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
