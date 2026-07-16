import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

function toDateOnly(v) {
  if (!v) return null;
  const dt = new Date(v);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

const DETAIL_INCLUDE = { department: { select: { id: true, name: true } } };

function serialize(c) {
  return c ? { ...c, total_amount: Number(c.total_amount), claim_amount: Number(c.claim_amount) } : c;
}

export default {
  async list({ status, insurer, department_id, date_from, date_to, q, page, limit }) {
    const where = {};
    if (status) where.status = status;
    if (insurer) where.insurer = insurer;
    if (department_id) where.department_id = department_id;
    if (date_from || date_to) {
      where.claim_date = {};
      if (date_from) where.claim_date.gte = toDateOnly(date_from);
      if (date_to) where.claim_date.lte = toDateOnly(date_to);
    }
    if (q) where.OR = [{ patient_name: { contains: q } }, { claim_no: { contains: q } }];

    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.insuranceClaim.findMany({ where, orderBy: [{ claim_date: "desc" }, { id: "desc" }], skip, take: l, include: DETAIL_INCLUDE }),
      prisma.insuranceClaim.count({ where }),
    ]);
    return buildPageResult({ rows: rows.map(serialize), total, page: p, limit: l });
  },

  async save(data) {
    const { id, ...fields } = data;
    const payload = {
      claim_no: fields.claim_no ?? null,
      patient_name: fields.patient_name,
      department_id: fields.department_id ?? null,
      insurer: fields.insurer,
      claim_date: toDateOnly(fields.claim_date),
      total_amount: fields.total_amount ?? 0,
      claim_amount: fields.claim_amount ?? 0,
      status: fields.status ?? "DRAFT",
      memo: fields.memo ?? null,
    };
    if (id) {
      const ex = await prisma.insuranceClaim.findUnique({ where: { id } });
      if (!ex) throw new AppError("청구를 찾을 수 없습니다.", 404, "NOT_FOUND");
      return serialize(await prisma.insuranceClaim.update({ where: { id }, data: payload, include: DETAIL_INCLUDE }));
    }
    return serialize(await prisma.insuranceClaim.create({ data: payload, include: DETAIL_INCLUDE }));
  },

  async setStatus({ id, status }) {
    const ex = await prisma.insuranceClaim.findUnique({ where: { id } });
    if (!ex) throw new AppError("청구를 찾을 수 없습니다.", 404, "NOT_FOUND");
    return serialize(await prisma.insuranceClaim.update({ where: { id }, data: { status }, include: DETAIL_INCLUDE }));
  },

  async remove(id) {
    const ex = await prisma.insuranceClaim.findUnique({ where: { id } });
    if (!ex) throw new AppError("청구를 찾을 수 없습니다.", 404, "NOT_FOUND");
    await prisma.insuranceClaim.delete({ where: { id } });
    return { ok: true };
  },

  /** 상태별 건수 + 청구액/지급액 합계 */
  async summary() {
    const [byStatusRaw, claimAgg, paidAgg] = await Promise.all([
      prisma.insuranceClaim.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.insuranceClaim.aggregate({ _sum: { claim_amount: true }, _count: { _all: true } }),
      prisma.insuranceClaim.aggregate({ _sum: { claim_amount: true }, where: { status: "PAID" } }),
    ]);
    const byStatus = { DRAFT: 0, CLAIMED: 0, APPROVED: 0, PAID: 0, REJECTED: 0 };
    for (const g of byStatusRaw) byStatus[g.status] = g._count._all;
    return {
      byStatus,
      count: claimAgg._count._all,
      total_claim: Number(claimAgg._sum.claim_amount || 0),
      total_paid: Number(paidAgg._sum.claim_amount || 0),
    };
  },
};
