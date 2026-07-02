import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

const INCLUDE = {
  game_company: { select: { id: true, name: true } },
  vendor: { select: { id: true, name: true } },
};

function shape(e) {
  return {
    id: e.id,
    type: e.type,
    entry_date: e.entry_date,
    amount: Number(e.amount),
    game_company_id: e.game_company_id,
    game_company_name: e.game_company?.name || null,
    vendor_id: e.vendor_id,
    vendor_name: e.vendor?.name || null,
    settlement_id: e.settlement_id,
    memo: e.memo,
    created_at: e.created_at,
  };
}

function buildWhere({ type, game_company_id, vendor_id, date_from, date_to }) {
  const where = {};
  if (type) where.type = type;
  if (game_company_id) where.game_company_id = game_company_id;
  if (vendor_id) where.vendor_id = vendor_id;
  if (date_from || date_to) {
    where.entry_date = {};
    if (date_from) where.entry_date.gte = new Date(date_from);
    if (date_to) where.entry_date.lte = new Date(`${date_to}T23:59:59.999`);
  }
  return where;
}

export default {
  async list(params = {}) {
    const where = buildWhere(params);
    const { page, limit, skip } = parsePage(params);
    const [rows, total, agg] = await Promise.all([
      prisma.ledgerEntry.findMany({ where, include: INCLUDE, orderBy: [{ entry_date: "desc" }, { id: "desc" }], skip, take: limit }),
      prisma.ledgerEntry.count({ where }),
      prisma.ledgerEntry.groupBy({ by: ["type"], where, _sum: { amount: true } }),
    ]);
    const totals = { PAYMENT: 0, COLLECTION: 0 };
    for (const g of agg) totals[g.type] = Number(g._sum.amount || 0);
    return {
      ...buildPageResult({ rows: rows.map(shape), total, page, limit }),
      totals, // { PAYMENT: 지급합계, COLLECTION: 회수합계 }
    };
  },

  async save(data, user) {
    const payload = {
      type: data.type,
      entry_date: data.entry_date,
      amount: data.amount,
      game_company_id: data.type === "PAYMENT" ? data.game_company_id : null,
      vendor_id: data.type === "COLLECTION" ? data.vendor_id : null,
      memo: data.memo ?? null,
    };
    if (data.id) {
      const ex = await prisma.ledgerEntry.findUnique({ where: { id: data.id } });
      if (!ex) throw new AppError("장부 항목을 찾을 수 없습니다.", 404, "NOT_FOUND");
      if (ex.settlement_id) throw new AppError("정산에서 생성된 항목은 정산 화면에서 관리하세요.", 400, "FROM_SETTLEMENT");
      return shape(await prisma.ledgerEntry.update({ where: { id: data.id }, data: payload, include: INCLUDE }));
    }
    return shape(
      await prisma.ledgerEntry.create({
        data: { ...payload, created_by: user?.id ?? null },
        include: INCLUDE,
      }),
    );
  },

  async remove(id) {
    const ex = await prisma.ledgerEntry.findUnique({ where: { id } });
    if (!ex) throw new AppError("장부 항목을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (ex.settlement_id) throw new AppError("정산에서 생성된 항목은 삭제할 수 없습니다.", 400, "FROM_SETTLEMENT");
    await prisma.ledgerEntry.delete({ where: { id } });
    return { ok: true };
  },
};
