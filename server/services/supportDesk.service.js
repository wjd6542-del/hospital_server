import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

function shape(d) {
  return {
    id: d.id,
    name: d.name,
    code: d.code,
    icon: d.icon,
    sort: d.sort,
    is_active: d.is_active,
    open_count: d.open_count ?? 0,
    progress_count: d.progress_count ?? 0,
  };
}

async function withCounts(rows) {
  const ids = rows.map((r) => r.id);
  if (!ids.length) return rows.map(shape);
  const counts = await prisma.supportTicket.groupBy({
    by: ["desk_id", "status"],
    where: { desk_id: { in: ids }, status: { in: ["OPEN", "IN_PROGRESS"] } },
    _count: { _all: true },
  });
  const map = {};
  for (const c of counts) {
    (map[c.desk_id] ||= { open_count: 0, progress_count: 0 });
    if (c.status === "OPEN") map[c.desk_id].open_count = c._count._all;
    else if (c.status === "IN_PROGRESS") map[c.desk_id].progress_count = c._count._all;
  }
  return rows.map((r) => shape({ ...r, ...(map[r.id] || {}) }));
}

export default {
  /** 활성 유형 (사이드/네비) — 카운트 포함 */
  async list() {
    const rows = await prisma.supportDesk.findMany({ where: { is_active: true }, orderBy: [{ sort: "asc" }, { id: "asc" }] });
    return withCounts(rows);
  },
  /** 전체 유형 (설정) */
  async listAll() {
    const rows = await prisma.supportDesk.findMany({ orderBy: [{ sort: "asc" }, { id: "asc" }] });
    return rows.map(shape);
  },
  async get(id) {
    const d = await prisma.supportDesk.findUnique({ where: { id } });
    if (!d) throw new AppError("응대 유형을 찾을 수 없습니다.", 404, "NOT_FOUND");
    return shape(d);
  },
  async getByCode(code) {
    const d = await prisma.supportDesk.findUnique({ where: { code } });
    if (!d) throw new AppError("응대 유형을 찾을 수 없습니다.", 404, "NOT_FOUND");
    return shape(d);
  },
  async save(data) {
    const payload = { name: data.name, code: data.code, icon: data.icon ?? null, sort: data.sort ?? 0, is_active: data.is_active ?? true };
    const dup = await prisma.supportDesk.findFirst({ where: { code: payload.code, ...(data.id ? { id: { not: data.id } } : {}) } });
    if (dup) throw new AppError("이미 존재하는 코드입니다.", 400, "DUPLICATE");
    if (data.id) {
      const ex = await prisma.supportDesk.findUnique({ where: { id: data.id } });
      if (!ex) throw new AppError("응대 유형을 찾을 수 없습니다.", 404, "NOT_FOUND");
      return shape(await prisma.supportDesk.update({ where: { id: data.id }, data: payload }));
    }
    return shape(await prisma.supportDesk.create({ data: payload }));
  },
  async remove(id) {
    const tickets = await prisma.supportTicket.count({ where: { desk_id: id } });
    if (tickets) throw new AppError("응대 이력이 있어 삭제할 수 없습니다. 비활성 처리하세요.", 400, "IN_USE");
    await prisma.supportDesk.delete({ where: { id } }); // targets cascade
    return { ok: true };
  },
};
