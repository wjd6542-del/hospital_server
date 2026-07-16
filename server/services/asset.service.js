import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

function toDateOnly(v) {
  if (!v) return null;
  const dt = new Date(v);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

const DETAIL_INCLUDE = {
  department: { select: { id: true, name: true } },
  vendor: { select: { id: true, name: true } },
};

function serialize(a) {
  return a ? { ...a, acquire_cost: Number(a.acquire_cost) } : a;
}

export default {
  async list({ status, category, department_id, q, page, limit }) {
    const where = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (department_id) where.department_id = department_id;
    if (q) where.OR = [{ name: { contains: q } }, { asset_no: { contains: q } }];

    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.asset.findMany({ where, orderBy: [{ acquired_at: "desc" }, { id: "desc" }], skip, take: l, include: DETAIL_INCLUDE }),
      prisma.asset.count({ where }),
    ]);
    return buildPageResult({ rows: rows.map(serialize), total, page: p, limit: l });
  },

  async save(data) {
    const { id, ...fields } = data;
    const payload = {
      asset_no: fields.asset_no ?? null,
      name: fields.name,
      category: fields.category ?? null,
      acquired_at: toDateOnly(fields.acquired_at),
      acquire_cost: fields.acquire_cost ?? 0,
      status: fields.status ?? "ACTIVE",
      department_id: fields.department_id ?? null,
      vendor_id: fields.vendor_id ?? null,
      memo: fields.memo ?? null,
    };
    if (id) {
      const ex = await prisma.asset.findUnique({ where: { id } });
      if (!ex) throw new AppError("자산을 찾을 수 없습니다.", 404, "NOT_FOUND");
      await prisma.asset.update({ where: { id }, data: payload });
      return serialize(await prisma.asset.findUnique({ where: { id }, include: DETAIL_INCLUDE }));
    }
    const created = await prisma.asset.create({ data: payload, include: DETAIL_INCLUDE });
    return serialize(created);
  },

  async remove(id) {
    const ex = await prisma.asset.findUnique({ where: { id } });
    if (!ex) throw new AppError("자산을 찾을 수 없습니다.", 404, "NOT_FOUND");
    await prisma.asset.delete({ where: { id } });
    return { ok: true };
  },

  /** 상태별 집계 + 총 취득가 */
  async summary() {
    const [byStatusRaw, agg] = await Promise.all([
      prisma.asset.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.asset.aggregate({ _sum: { acquire_cost: true }, _count: { _all: true } }),
    ]);
    const byStatus = { ACTIVE: 0, REPAIR: 0, IDLE: 0, DISPOSED: 0 };
    for (const g of byStatusRaw) byStatus[g.status] = g._count._all;
    return { byStatus, total_count: agg._count._all, total_cost: Number(agg._sum.acquire_cost || 0) };
  },
};
