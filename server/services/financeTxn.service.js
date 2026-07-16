import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

/** @db.Date 는 UTC 자정으로 저장한다 */
function toDateOnly(d) {
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

const DETAIL_INCLUDE = {
  account_item: { select: { id: true, type: true, name: true } },
  department: { select: { id: true, name: true } },
  attachments: true,
};

/** Prisma Decimal → number 로 직렬화 (프론트는 number 로 다룬다) */
function serialize(txn) {
  if (!txn) return txn;
  return { ...txn, amount: Number(txn.amount) };
}

/** 목록·집계 공통 where */
function buildWhere({ date_from, date_to, type, account_item_id, department_id, q }) {
  const where = { txn_date: { gte: toDateOnly(date_from), lte: toDateOnly(date_to) } };
  if (type) where.type = type;
  if (account_item_id) where.account_item_id = account_item_id;
  if (department_id) where.department_id = department_id;
  if (q) where.OR = [{ vendor: { contains: q } }, { memo: { contains: q } }];
  return where;
}

export default {
  async list(filter) {
    const where = buildWhere(filter);
    const { page: p, limit: l, skip } = parsePage(filter);
    const [rows, total] = await Promise.all([
      prisma.financeTransaction.findMany({
        where,
        orderBy: [{ txn_date: "desc" }, { id: "desc" }],
        skip,
        take: l,
        include: DETAIL_INCLUDE,
      }),
      prisma.financeTransaction.count({ where }),
    ]);
    return buildPageResult({ rows: rows.map(serialize), total, page: p, limit: l });
  },

  async detail(id) {
    const txn = await prisma.financeTransaction.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    return serialize(txn);
  },

  async save(data) {
    const { id, attachments, ...fields } = data;

    const account = await prisma.accountItem.findUnique({
      where: { id: fields.account_item_id },
    });
    if (!account) throw new AppError("계정과목을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (account.type !== fields.type) {
      throw new AppError("구분이 계정과목과 일치하지 않습니다.", 400, "TYPE_MISMATCH");
    }

    const payload = {
      txn_date: toDateOnly(fields.txn_date),
      type: fields.type,
      account_item_id: fields.account_item_id,
      amount: fields.amount,
      department_id: fields.department_id ?? null,
      vendor: fields.vendor ?? null,
      method: fields.method,
      memo: fields.memo ?? null,
    };

    let txnId;
    if (id) {
      const ex = await prisma.financeTransaction.findUnique({ where: { id } });
      if (!ex) throw new AppError("거래를 찾을 수 없습니다.", 404, "NOT_FOUND");
      await prisma.financeTransaction.update({ where: { id }, data: payload });
      txnId = id;
      // 첨부는 전달된 목록으로 교체 (undefined 면 유지)
      if (attachments !== undefined) {
        await prisma.financeAttachment.deleteMany({ where: { transaction_id: id } });
        if (attachments.length) {
          await prisma.financeAttachment.createMany({
            data: attachments.map((a) => ({ ...a, transaction_id: id })),
          });
        }
      }
    } else {
      const created = await prisma.financeTransaction.create({
        data: {
          ...payload,
          ...(attachments?.length ? { attachments: { create: attachments } } : {}),
        },
      });
      txnId = created.id;
    }

    return this.detail(txnId);
  },

  async remove(id) {
    const ex = await prisma.financeTransaction.findUnique({ where: { id } });
    if (!ex) throw new AppError("거래를 찾을 수 없습니다.", 404, "NOT_FOUND");
    await prisma.financeTransaction.delete({ where: { id } }); // 첨부는 Cascade
    return { ok: true };
  },

  /** 필터 범위의 수입/지출 합계 + 계정과목별 소계 */
  async summary(filter) {
    const where = buildWhere(filter);

    const byType = await prisma.financeTransaction.groupBy({
      by: ["type"],
      where,
      _sum: { amount: true },
    });
    let income_total = 0;
    let expense_total = 0;
    for (const g of byType) {
      const v = Number(g._sum.amount ?? 0);
      if (g.type === "INCOME") income_total = v;
      else if (g.type === "EXPENSE") expense_total = v;
    }

    const grouped = await prisma.financeTransaction.groupBy({
      by: ["account_item_id", "type"],
      where,
      _sum: { amount: true },
      _count: { _all: true },
    });
    const accounts = await prisma.accountItem.findMany({
      where: { id: { in: grouped.map((g) => g.account_item_id) } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(accounts.map((a) => [a.id, a.name]));
    const by_account = grouped
      .map((g) => ({
        account_item_id: g.account_item_id,
        name: nameMap.get(g.account_item_id) ?? "",
        type: g.type,
        total: Number(g._sum.amount ?? 0),
        count: g._count._all,
      }))
      .sort((a, b) => b.total - a.total);

    return { income_total, expense_total, net: income_total - expense_total, by_account };
  },
};
