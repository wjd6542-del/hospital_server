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

  /** 연도 대시보드: 월별 추이 + 계정과목별 + 부서별 + 합계 */
  async dashboard({ year, department_id }) {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    const where = { txn_date: { gte: start, lte: end } };
    if (department_id) where.department_id = department_id;

    const txns = await prisma.financeTransaction.findMany({
      where,
      select: {
        txn_date: true,
        type: true,
        amount: true,
        account_item: { select: { name: true } },
        department: { select: { name: true } },
      },
    });

    const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 }));
    const accMap = new Map(); // "name|type" → total
    const deptMap = new Map(); // name → { income, expense }
    let income = 0;
    let expense = 0;

    for (const t of txns) {
      const amt = Number(t.amount);
      const mo = new Date(t.txn_date).getUTCMonth(); // @db.Date 는 UTC 자정 저장
      const isIncome = t.type === "INCOME";
      if (isIncome) { monthly[mo].income += amt; income += amt; }
      else { monthly[mo].expense += amt; expense += amt; }

      const ak = `${t.account_item?.name ?? "-"}|${t.type}`;
      accMap.set(ak, (accMap.get(ak) || 0) + amt);

      const dn = t.department?.name || "미지정";
      if (!deptMap.has(dn)) deptMap.set(dn, { income: 0, expense: 0 });
      deptMap.get(dn)[isIncome ? "income" : "expense"] += amt;
    }

    const by_account = [...accMap.entries()]
      .map(([k, total]) => { const i = k.lastIndexOf("|"); return { name: k.slice(0, i), type: k.slice(i + 1), total }; })
      .sort((a, b) => b.total - a.total);
    const by_department = [...deptMap.entries()]
      .map(([name, v]) => ({ name, income: v.income, expense: v.expense }))
      .sort((a, b) => b.income + b.expense - (a.income + a.expense));

    return { monthly, by_account, by_department, totals: { income, expense, net: income - expense } };
  },

  /** 기간 비교: 이번달 vs 지난달 vs 전년동월 */
  async compare({ year, month }) {
    const agg = async (y, m) => {
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 0, 23, 59, 59));
      const g = await prisma.financeTransaction.groupBy({
        by: ["type"],
        where: { txn_date: { gte: start, lte: end } },
        _sum: { amount: true },
      });
      let income = 0;
      let expense = 0;
      for (const r of g) {
        const v = Number(r._sum.amount || 0);
        if (r.type === "INCOME") income = v;
        else if (r.type === "EXPENSE") expense = v;
      }
      return { income, expense, net: income - expense };
    };

    const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
    const [current, prevMonth, prevYear] = await Promise.all([
      agg(year, month),
      agg(pm.y, pm.m),
      agg(year - 1, month),
    ]);
    return { current, prevMonth, prevYear };
  },
};
