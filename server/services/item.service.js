import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

/** 품목 마스터 — 현재고는 입출고 이력(StockMovement) 합계로 도출 */
export default {
  async list({ q, only_active, low_only } = {}) {
    const where = {};
    if (only_active) where.is_active = true;
    if (q) where.OR = [{ name: { contains: q } }, { category: { contains: q } }];

    const [items, stocks] = await Promise.all([
      prisma.item.findMany({ where, orderBy: [{ sort: "asc" }, { id: "asc" }] }),
      prisma.stockMovement.groupBy({ by: ["item_id"], _sum: { qty: true } }),
    ]);
    const sMap = new Map(stocks.map((s) => [s.item_id, Number(s._sum.qty || 0)]));

    let rows = items.map((it) => {
      const stock = sMap.get(it.id) ?? 0;
      const safety = Number(it.safety_stock);
      return { ...it, safety_stock: safety, stock, low: stock < safety };
    });
    if (low_only) rows = rows.filter((r) => r.low);
    return rows;
  },

  async save(data) {
    const { id, ...fields } = data;
    if (id) {
      const ex = await prisma.item.findUnique({ where: { id } });
      if (!ex) throw new AppError("품목을 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.item.update({ where: { id }, data: fields });
    }
    return prisma.item.create({ data: fields });
  },

  async remove(id) {
    const ex = await prisma.item.findUnique({ where: { id } });
    if (!ex) throw new AppError("품목을 찾을 수 없습니다.", 404, "NOT_FOUND");

    const used = await prisma.stockMovement.count({ where: { item_id: id } });
    if (used > 0) {
      throw new AppError(`입출고 이력 ${used}건이 있어 삭제할 수 없습니다. 비활성 처리하세요.`, 400, "IN_USE");
    }
    await prisma.item.delete({ where: { id } });
    return { ok: true };
  },
};
