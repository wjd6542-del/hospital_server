import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

/** @db.Date 는 UTC 자정 저장 */
function toDateOnly(d) {
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

const DETAIL_INCLUDE = {
  vendor: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  items: true,
};

/** Decimal → number, 총액 계산 */
function serialize(order) {
  if (!order) return order;
  const items = (order.items || []).map((it) => {
    const qty = Number(it.qty);
    const unit_price = Number(it.unit_price);
    return { ...it, qty, unit_price, amount: qty * unit_price };
  });
  const total = items.reduce((s, it) => s + it.amount, 0);
  return { ...order, items, total };
}

export default {
  async list({ date_from, date_to, status, vendor_id, department_id, q, page, limit }) {
    const where = {};
    if (date_from || date_to) {
      where.order_date = {};
      if (date_from) where.order_date.gte = toDateOnly(date_from);
      if (date_to) where.order_date.lte = toDateOnly(date_to);
    }
    if (status) where.status = status;
    if (vendor_id) where.vendor_id = vendor_id;
    if (department_id) where.department_id = department_id;
    if (q) where.OR = [{ memo: { contains: q } }, { vendor: { name: { contains: q } } }, { items: { some: { name: { contains: q } } } }];

    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        orderBy: [{ order_date: "desc" }, { id: "desc" }],
        skip,
        take: l,
        include: DETAIL_INCLUDE,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);
    return buildPageResult({ rows: rows.map(serialize), total, page: p, limit: l });
  },

  async detail(id) {
    const order = await prisma.purchaseOrder.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    return serialize(order);
  },

  async save(data) {
    const { id, items, ...fields } = data;

    const vendor = await prisma.vendor.findUnique({ where: { id: fields.vendor_id } });
    if (!vendor) throw new AppError("거래처를 찾을 수 없습니다.", 404, "NOT_FOUND");

    const payload = {
      vendor_id: fields.vendor_id,
      order_date: toDateOnly(fields.order_date),
      status: fields.status ?? "DRAFT",
      department_id: fields.department_id ?? null,
      memo: fields.memo ?? null,
    };
    const itemData = items.map((it) => ({
      name: it.name,
      qty: it.qty,
      unit: it.unit ?? null,
      unit_price: it.unit_price,
    }));

    let orderId;
    if (id) {
      const ex = await prisma.purchaseOrder.findUnique({ where: { id } });
      if (!ex) throw new AppError("발주를 찾을 수 없습니다.", 404, "NOT_FOUND");
      // 헤더 갱신 + 품목 교체를 원자적으로 (부분 실패 시 품목 유실 방지)
      await prisma.$transaction([
        prisma.purchaseOrder.update({ where: { id }, data: payload }),
        prisma.purchaseOrderItem.deleteMany({ where: { order_id: id } }),
        prisma.purchaseOrderItem.createMany({ data: itemData.map((it) => ({ ...it, order_id: id })) }),
      ]);
      orderId = id;
    } else {
      const created = await prisma.purchaseOrder.create({
        data: { ...payload, items: { create: itemData } },
      });
      orderId = created.id;
    }
    return this.detail(orderId);
  },

  async setStatus({ id, status }) {
    const ex = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!ex) throw new AppError("발주를 찾을 수 없습니다.", 404, "NOT_FOUND");
    await prisma.purchaseOrder.update({ where: { id }, data: { status } });
    return this.detail(id);
  },

  async remove(id) {
    const ex = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!ex) throw new AppError("발주를 찾을 수 없습니다.", 404, "NOT_FOUND");
    await prisma.purchaseOrder.delete({ where: { id } }); // items Cascade
    return { ok: true };
  },
};
