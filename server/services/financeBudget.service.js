import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

/** 연간 예산(계정과목별) — 예산 편성 + 실적 대비 집행률 */
export default {
  async list({ year }) {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    const [items, budgets, actuals] = await Promise.all([
      prisma.accountItem.findMany({
        where: { is_active: true },
        orderBy: [{ type: "asc" }, { sort: "asc" }, { id: "asc" }],
      }),
      prisma.financeBudget.findMany({ where: { year } }),
      prisma.financeTransaction.groupBy({
        by: ["account_item_id"],
        where: { txn_date: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
    ]);

    const bMap = new Map(budgets.map((b) => [b.account_item_id, Number(b.amount)]));
    const aMap = new Map(actuals.map((a) => [a.account_item_id, Number(a._sum.amount || 0)]));

    return items.map((it) => {
      const budget = bMap.get(it.id) ?? 0;
      const actual = aMap.get(it.id) ?? 0;
      return {
        account_item_id: it.id,
        name: it.name,
        type: it.type,
        budget,
        actual,
        remain: budget - actual,
        rate: budget > 0 ? Math.round((actual / budget) * 1000) / 10 : null, // 집행률 %
      };
    });
  },

  async save({ account_item_id, year, amount }) {
    const item = await prisma.accountItem.findUnique({ where: { id: account_item_id } });
    if (!item) throw new AppError("계정과목을 찾을 수 없습니다.", 404, "NOT_FOUND");

    return prisma.financeBudget.upsert({
      where: { account_item_id_year: { account_item_id, year } },
      update: { amount },
      create: { account_item_id, year, amount },
    });
  },
};
