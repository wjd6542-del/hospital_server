import prisma from "../lib/prisma.js";
import itemService from "./item.service.js";

/** 전 도메인 KPI 집계 (읽기 전용) */
export default {
  async overview() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    // 이번달(재무·예약) — UTC 월 경계
    const monthStart = new Date(Date.UTC(y, m, 1));
    const monthEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59));
    // 오늘(예약) — 로컬 하루 경계
    const dayStart = new Date(y, m, now.getDate(), 0, 0, 0);
    const dayEnd = new Date(y, m, now.getDate(), 23, 59, 59);
    // 올해(월별 트렌드)
    const yearStart = new Date(Date.UTC(y, 0, 1));
    const yearEnd = new Date(Date.UTC(y, 11, 31, 23, 59, 59));

    const [emp, finMonth, apptToday, apptMonth, admitted, unpaidAgg, assetAgg, facilityOpen, lowItems, finYear] = await Promise.all([
      prisma.employee.count({ where: { resigned_at: null } }),
      prisma.financeTransaction.groupBy({ by: ["type"], where: { txn_date: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }),
      prisma.appointment.count({ where: { reserved_at: { gte: dayStart, lte: dayEnd } } }),
      prisma.appointment.count({ where: { reserved_at: { gte: new Date(y, m, 1), lte: new Date(y, m + 1, 0, 23, 59, 59) } } }),
      prisma.admission.count({ where: { status: "ADMITTED" } }),
      prisma.insuranceClaim.aggregate({ _sum: { claim_amount: true }, where: { status: { in: ["CLAIMED", "APPROVED"] } } }),
      prisma.asset.aggregate({ _sum: { acquire_cost: true }, _count: { _all: true } }),
      prisma.facilityRequest.count({ where: { status: { in: ["RECEIVED", "IN_PROGRESS"] } } }),
      itemService.list({ low_only: true }),
      prisma.financeTransaction.findMany({ where: { txn_date: { gte: yearStart, lte: yearEnd } }, select: { txn_date: true, type: true, amount: true } }),
    ]);

    let income = 0;
    let expense = 0;
    for (const g of finMonth) {
      const v = Number(g._sum.amount || 0);
      if (g.type === "INCOME") income = v;
      else if (g.type === "EXPENSE") expense = v;
    }

    const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 }));
    for (const t of finYear) {
      const mo = new Date(t.txn_date).getUTCMonth();
      const v = Number(t.amount);
      if (t.type === "INCOME") monthly[mo].income += v;
      else if (t.type === "EXPENSE") monthly[mo].expense += v;
    }

    return {
      hr: { employees: emp },
      finance: { income, expense, net: income - expense },
      reservation: { today: apptToday, month: apptMonth },
      ward: { admitted },
      insurance: { unpaid: Number(unpaidAgg._sum.claim_amount || 0) },
      asset: { count: assetAgg._count._all, cost: Number(assetAgg._sum.acquire_cost || 0) },
      facility: { open: facilityOpen },
      inventory: { low: lowItems.length },
      monthly,
    };
  },
};
