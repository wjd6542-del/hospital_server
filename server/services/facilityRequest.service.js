import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

function toDateOnly(v) {
  if (!v) return null;
  const dt = new Date(v);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

const DETAIL_INCLUDE = { department: { select: { id: true, name: true } } };

export default {
  async list({ status, priority, department_id, date_from, date_to, q, page, limit }) {
    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (department_id) where.department_id = department_id;
    if (date_from || date_to) {
      where.reported_at = {};
      if (date_from) where.reported_at.gte = toDateOnly(date_from);
      if (date_to) where.reported_at.lte = toDateOnly(date_to);
    }
    if (q) where.OR = [{ title: { contains: q } }, { location: { contains: q } }, { assignee: { contains: q } }];

    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.facilityRequest.findMany({ where, orderBy: [{ reported_at: "desc" }, { id: "desc" }], skip, take: l, include: DETAIL_INCLUDE }),
      prisma.facilityRequest.count({ where }),
    ]);
    return buildPageResult({ rows, total, page: p, limit: l });
  },

  async save(data) {
    const { id, ...fields } = data;
    const payload = {
      title: fields.title,
      location: fields.location ?? null,
      category: fields.category ?? null,
      priority: fields.priority ?? "NORMAL",
      status: fields.status ?? "RECEIVED",
      reported_at: toDateOnly(fields.reported_at),
      resolved_at: toDateOnly(fields.resolved_at),
      department_id: fields.department_id ?? null,
      assignee: fields.assignee ?? null,
      content: fields.content ?? null,
      resolution: fields.resolution ?? null,
    };
    if (id) {
      const ex = await prisma.facilityRequest.findUnique({ where: { id } });
      if (!ex) throw new AppError("요청을 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.facilityRequest.update({ where: { id }, data: payload, include: DETAIL_INCLUDE });
    }
    return prisma.facilityRequest.create({ data: payload, include: DETAIL_INCLUDE });
  },

  async setStatus({ id, status }) {
    const ex = await prisma.facilityRequest.findUnique({ where: { id } });
    if (!ex) throw new AppError("요청을 찾을 수 없습니다.", 404, "NOT_FOUND");
    const data = { status };
    // 완료로 바꿀 때 완료일이 없으면 오늘로 채운다
    if (status === "DONE" && !ex.resolved_at) data.resolved_at = toDateOnly(new Date());
    return prisma.facilityRequest.update({ where: { id }, data, include: DETAIL_INCLUDE });
  },

  async remove(id) {
    const ex = await prisma.facilityRequest.findUnique({ where: { id } });
    if (!ex) throw new AppError("요청을 찾을 수 없습니다.", 404, "NOT_FOUND");
    await prisma.facilityRequest.delete({ where: { id } });
    return { ok: true };
  },

  async summary() {
    const raw = await prisma.facilityRequest.groupBy({ by: ["status"], _count: { _all: true } });
    const byStatus = { RECEIVED: 0, IN_PROGRESS: 0, DONE: 0, CANCELED: 0 };
    for (const g of raw) byStatus[g.status] = g._count._all;
    // 처리 대기(접수+진행)
    const open = byStatus.RECEIVED + byStatus.IN_PROGRESS;
    return { byStatus, open };
  },
};
