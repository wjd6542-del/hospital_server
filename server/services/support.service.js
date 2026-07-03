import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

const INCLUDE = {
  desk: { select: { id: true, name: true, code: true } },
  target: { select: { id: true, name: true } },
  tags: { select: { id: true, name: true, color: true } },
  _count: { select: { messages: true } },
};

function shape(t) {
  return {
    id: t.id,
    desk_id: t.desk_id,
    desk_code: t.desk?.code || null,
    desk_name: t.desk?.name || null,
    target_id: t.target_id,
    target_name: t.target?.name || null,
    title: t.title,
    category: t.category,
    status: t.status,
    priority: t.priority,
    assignee_id: t.assignee_id,
    created_by: t.created_by,
    tags: t.tags || [],
    message_count: t._count?.messages ?? 0,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

export default {
  async list(params = {}) {
    const where = {};
    if (params.desk_id) where.desk_id = params.desk_id;
    if (params.target_id) where.target_id = params.target_id;
    if (params.status) where.status = params.status;
    if (params.tag_ids?.length) where.tags = { some: { id: { in: params.tag_ids } } };
    if (params.q) where.title = { contains: params.q };
    if (params.date_from || params.date_to) {
      where.created_at = {};
      if (params.date_from) where.created_at.gte = new Date(`${params.date_from}T00:00:00`);
      if (params.date_to) where.created_at.lte = new Date(`${params.date_to}T23:59:59.999`);
    }
    const { page, limit, skip } = parsePage(params);
    const [rows, total] = await Promise.all([
      prisma.supportTicket.findMany({ where, include: INCLUDE, orderBy: [{ status: "asc" }, { priority: "desc" }, { id: "desc" }], skip, take: limit }),
      prisma.supportTicket.count({ where }),
    ]);
    return buildPageResult({ rows: rows.map(shape), total, page, limit });
  },

  /** 미해결(접수/처리중) 응대 알림 — 유형(desk)별 카운트 */
  async alerts({ limit = 20 } = {}) {
    const where = { status: { in: ["OPEN", "IN_PROGRESS"] } };
    const [rows, total, byDesk] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ priority: "desc" }, { updated_at: "desc" }],
        take: limit,
      }),
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.groupBy({ by: ["desk_id"], where, _count: { _all: true } }),
    ]);
    const counts = {};
    for (const g of byDesk) counts[g.desk_id] = g._count._all;
    return { rows: rows.map(shape), total, counts };
  },

  async get(id) {
    const t = await prisma.supportTicket.findUnique({
      where: { id },
      include: { ...INCLUDE, messages: { orderBy: { id: "asc" } } },
    });
    if (!t) throw new AppError("응대 건을 찾을 수 없습니다.", 404, "NOT_FOUND");
    return { ...shape(t), messages: t.messages };
  },

  async save(data, user) {
    if (!data.desk_id) throw new AppError("응대 유형을 선택하세요.", 400, "INVALID_DESK");
    const payload = {
      desk_id: data.desk_id,
      target_id: data.target_id ?? null,
      title: data.title,
      category: data.category ?? null,
      status: data.status,
      priority: data.priority,
      assignee_id: data.assignee_id ?? null,
    };
    const tagIds = Array.isArray(data.tag_ids) ? data.tag_ids : null;
    if (data.id) {
      const ex = await prisma.supportTicket.findUnique({ where: { id: data.id } });
      if (!ex) throw new AppError("응대 건을 찾을 수 없습니다.", 404, "NOT_FOUND");
      return shape(await prisma.supportTicket.update({
        where: { id: data.id },
        data: { ...payload, ...(tagIds ? { tags: { set: tagIds.map((id) => ({ id })) } } : {}) },
        include: INCLUDE,
      }));
    }
    return shape(
      await prisma.supportTicket.create({
        data: { ...payload, created_by: user?.id ?? null, ...(tagIds ? { tags: { connect: tagIds.map((id) => ({ id })) } } : {}) },
        include: INCLUDE,
      }),
    );
  },

  async setStatus({ id, status }) {
    const ex = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ex) throw new AppError("응대 건을 찾을 수 없습니다.", 404, "NOT_FOUND");
    return shape(await prisma.supportTicket.update({ where: { id }, data: { status }, include: INCLUDE }));
  },

  async bulkStatus({ ids, status }) {
    if (!ids?.length) return { ok: true, count: 0 };
    const res = await prisma.supportTicket.updateMany({ where: { id: { in: ids } }, data: { status } });
    return { ok: true, count: res.count };
  },

  async addMessage(data, user) {
    const t = await prisma.supportTicket.findUnique({ where: { id: data.ticket_id } });
    if (!t) throw new AppError("응대 건을 찾을 수 없습니다.", 404, "NOT_FOUND");
    const msg = await prisma.supportMessage.create({
      data: {
        ticket_id: data.ticket_id,
        user_id: user?.id ?? null,
        content: data.content,
        is_internal: data.is_internal,
      },
    });
    if (t.status === "CLOSED" || t.status === "RESOLVED") {
      await prisma.supportTicket.update({ where: { id: t.id }, data: { status: "IN_PROGRESS" } });
    } else {
      await prisma.supportTicket.update({ where: { id: t.id }, data: { updated_at: new Date() } });
    }
    return msg;
  },

  async remove(id) {
    await prisma.supportTicket.delete({ where: { id } });
    return { ok: true };
  },
};
