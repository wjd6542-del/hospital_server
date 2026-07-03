import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

export default {
  async list({ desk_id, q, is_active, page, limit } = {}) {
    const where = {};
    if (desk_id) where.desk_id = desk_id;
    if (typeof is_active === "boolean") where.is_active = is_active;
    if (q) where.OR = [{ name: { contains: q } }, { code: { contains: q } }];
    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.supportTarget.findMany({ where, orderBy: [{ sort: "asc" }, { id: "desc" }], skip, take: l }),
      prisma.supportTarget.count({ where }),
    ]);
    return buildPageResult({ rows, total, page: p, limit: l });
  },

  async options({ desk_id } = {}) {
    return prisma.supportTarget.findMany({
      where: { desk_id, is_active: true },
      orderBy: [{ sort: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true },
    });
  },

  /** 유형(desk)별 대상 트리 + 미해결 카운트 */
  async tree({ desk_id } = {}) {
    if (!desk_id) return [];
    const rows = await prisma.supportTarget.findMany({
      where: { desk_id },
      orderBy: [{ sort: "asc" }, { id: "asc" }],
      select: { id: true, name: true, code: true, parent_id: true, is_active: true },
    });
    const byId = new Map();
    rows.forEach((r) => byId.set(r.id, { ...r, children: [], open_count: 0, progress_count: 0 }));
    const counts = await prisma.supportTicket.groupBy({
      by: ["target_id", "status"],
      where: { desk_id, status: { in: ["OPEN", "IN_PROGRESS"] }, target_id: { not: null } },
      _count: { _all: true },
    });
    for (const c of counts) {
      const n = byId.get(c.target_id);
      if (!n) continue;
      if (c.status === "OPEN") n.open_count = c._count._all;
      else if (c.status === "IN_PROGRESS") n.progress_count = c._count._all;
    }
    const roots = [];
    for (const node of byId.values()) {
      if (node.parent_id && byId.has(node.parent_id)) byId.get(node.parent_id).children.push(node);
      else roots.push(node);
    }
    return roots;
  },

  async get(id) {
    const t = await prisma.supportTarget.findUnique({ where: { id } });
    if (!t) throw new AppError("대상을 찾을 수 없습니다.", 404, "NOT_FOUND");
    return t;
  },

  async save(data) {
    const { id, desk_id, ...fields } = data;
    if (fields.parent_id) {
      if (fields.parent_id === id) throw new AppError("자기 자신을 상위로 지정할 수 없습니다.", 400, "INVALID_PARENT");
      if (id) {
        let cur = await prisma.supportTarget.findUnique({ where: { id: fields.parent_id }, select: { parent_id: true } });
        while (cur?.parent_id) {
          if (cur.parent_id === id) throw new AppError("하위 대상을 상위로 지정할 수 없습니다.", 400, "CYCLE");
          cur = await prisma.supportTarget.findUnique({ where: { id: cur.parent_id }, select: { parent_id: true } });
        }
      }
    }
    if (id) {
      const ex = await prisma.supportTarget.findUnique({ where: { id } });
      if (!ex) throw new AppError("대상을 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.supportTarget.update({ where: { id }, data: fields });
    }
    if (!desk_id) throw new AppError("응대 유형이 필요합니다.", 400, "INVALID_DESK");
    return prisma.supportTarget.create({ data: { ...fields, desk_id } });
  },

  /** 드래그 순서/상위 변경 (같은 desk 내) */
  async reorder({ id, parent_id, before_id }) {
    const self = await prisma.supportTarget.findUnique({ where: { id }, select: { desk_id: true } });
    if (!self) throw new AppError("대상을 찾을 수 없습니다.", 404, "NOT_FOUND");
    const pid = parent_id ?? null;
    if (pid) {
      if (pid === id) throw new AppError("자기 자신을 상위로 지정할 수 없습니다.", 400, "INVALID_PARENT");
      let cur = await prisma.supportTarget.findUnique({ where: { id: pid }, select: { parent_id: true } });
      while (cur?.parent_id) {
        if (cur.parent_id === id) throw new AppError("하위 대상을 상위로 지정할 수 없습니다.", 400, "CYCLE");
        cur = await prisma.supportTarget.findUnique({ where: { id: cur.parent_id }, select: { parent_id: true } });
      }
    }
    await prisma.supportTarget.update({ where: { id }, data: { parent_id: pid } });
    const sibs = await prisma.supportTarget.findMany({
      where: { desk_id: self.desk_id, parent_id: pid, id: { not: id } },
      orderBy: [{ sort: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const orderIds = [];
    let inserted = false;
    for (const s of sibs) {
      if (before_id && s.id === before_id) { orderIds.push(id); inserted = true; }
      orderIds.push(s.id);
    }
    if (!inserted) orderIds.push(id);
    await prisma.$transaction(orderIds.map((sid, i) => prisma.supportTarget.update({ where: { id: sid }, data: { sort: i } })));
    return { ok: true };
  },

  async remove(id) {
    const kids = await prisma.supportTarget.count({ where: { parent_id: id } });
    if (kids > 0) throw new AppError("하위 대상이 있어 삭제할 수 없습니다.", 400, "HAS_CHILDREN");
    const tickets = await prisma.supportTicket.count({ where: { target_id: id } });
    if (tickets) throw new AppError("응대 이력이 있어 삭제할 수 없습니다. 비활성 처리하세요.", 400, "IN_USE");
    await prisma.supportTarget.delete({ where: { id } });
    return { ok: true };
  },
};
