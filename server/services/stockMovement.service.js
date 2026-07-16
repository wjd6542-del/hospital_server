import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

function toDateOnly(d) {
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

const DETAIL_INCLUDE = {
  item: { select: { id: true, name: true, unit: true } },
  department: { select: { id: true, name: true } },
};

function serialize(m) {
  return m ? { ...m, qty: Number(m.qty) } : m;
}

export default {
  async list({ item_id, type, date_from, date_to, q, page, limit }) {
    const where = {};
    if (item_id) where.item_id = item_id;
    if (type) where.type = type;
    if (date_from || date_to) {
      where.moved_at = {};
      if (date_from) where.moved_at.gte = toDateOnly(date_from);
      if (date_to) where.moved_at.lte = toDateOnly(date_to);
    }
    if (q) where.OR = [{ memo: { contains: q } }, { item: { name: { contains: q } } }];

    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        orderBy: [{ moved_at: "desc" }, { id: "desc" }],
        skip,
        take: l,
        include: DETAIL_INCLUDE,
      }),
      prisma.stockMovement.count({ where }),
    ]);
    return buildPageResult({ rows: rows.map(serialize), total, page: p, limit: l });
  },

  async save(data) {
    const { item_id, type, moved_at, department_id, memo } = data;

    const item = await prisma.item.findUnique({ where: { id: item_id } });
    if (!item) throw new AppError("품목을 찾을 수 없습니다.", 404, "NOT_FOUND");

    // 부호 정규화: 입고 +, 출고 -, 조정은 입력 부호 유지
    const mag = Math.abs(data.qty);
    const qty = type === "OUT" ? -mag : type === "IN" ? mag : data.qty;

    const created = await prisma.stockMovement.create({
      data: { item_id, type, qty, moved_at: toDateOnly(moved_at), department_id: department_id ?? null, memo: memo ?? null },
      include: DETAIL_INCLUDE,
    });
    return serialize(created);
  },

  async remove(id) {
    const ex = await prisma.stockMovement.findUnique({ where: { id } });
    if (!ex) throw new AppError("이력을 찾을 수 없습니다.", 404, "NOT_FOUND");
    await prisma.stockMovement.delete({ where: { id } });
    return { ok: true };
  },
};
