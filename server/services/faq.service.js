import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

export default {
  async list({ category, categories, tag_ids, q, is_active, page, limit } = {}) {
    const where = {};
    if (typeof is_active === "boolean") where.is_active = is_active;
    if (categories?.length) where.category = { in: categories };
    else if (category) where.category = category;
    if (tag_ids?.length) where.tags = { some: { id: { in: tag_ids } } };
    if (q) where.OR = [{ question: { contains: q } }, { answer: { contains: q } }];
    const { page: p, limit: l, skip } = parsePage({ page, limit }, { defaultLimit: 10 });
    const [rows, total] = await Promise.all([
      prisma.faq.findMany({ where, include: { tags: { select: { id: true, name: true, color: true } } }, orderBy: [{ is_pinned: "desc" }, { sort: "asc" }, { id: "desc" }], skip, take: l }),
      prisma.faq.count({ where }),
    ]);
    return buildPageResult({ rows, total, page: p, limit: l });
  },

  /** 인기 FAQ (조회수 상위) */
  async popular({ limit = 10 } = {}) {
    return prisma.faq.findMany({
      where: { is_active: true },
      orderBy: [{ view_count: "desc" }, { id: "desc" }],
      take: Math.min(Math.max(1, Number(limit) || 10), 20),
      select: { id: true, question: true, category: true, view_count: true },
    });
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
    const { id, tag_ids, ...fields } = data;
    const tagIds = Array.isArray(tag_ids) ? tag_ids : null;
    if (id) {
      const ex = await prisma.faq.findUnique({ where: { id } });
      if (!ex) throw new AppError("FAQ를 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.faq.update({
        where: { id },
        data: { ...fields, ...(tagIds ? { tags: { set: tagIds.map((tid) => ({ id: tid })) } } : {}) },
        include: { tags: true },
      });
    }
    return prisma.faq.create({
      data: { ...fields, ...(tagIds ? { tags: { connect: tagIds.map((tid) => ({ id: tid })) } } : {}) },
      include: { tags: true },
    });
  },

  async remove(id) {
    await prisma.faq.delete({ where: { id } });
    return { ok: true };
  },
};
