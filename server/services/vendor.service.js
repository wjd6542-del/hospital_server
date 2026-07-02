import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

export default {
  async list({ q, is_active, page, limit } = {}) {
    const where = {};
    if (typeof is_active === "boolean") where.is_active = is_active;
    if (q)
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { contact_name: { contains: q } },
      ];
    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.vendor.findMany({ where, orderBy: [{ sort: "asc" }, { id: "desc" }], skip, take: l }),
      prisma.vendor.count({ where }),
    ]);
    return buildPageResult({ rows, total, page: p, limit: l });
  },

  /** 드롭다운용 활성 업체 목록 */
  async options() {
    return prisma.vendor.findMany({
      where: { is_active: true },
      orderBy: [{ sort: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true },
    });
  },

  async get(id) {
    const v = await prisma.vendor.findUnique({ where: { id } });
    if (!v) throw new AppError("업체를 찾을 수 없습니다.", 404, "NOT_FOUND");
    return v;
  },

  async save(data) {
    const { id, ...fields } = data;
    if (fields.code) {
      const dup = await prisma.vendor.findFirst({
        where: { code: fields.code, ...(id ? { id: { not: id } } : {}) },
      });
      if (dup) throw new AppError("이미 존재하는 코드입니다.", 400, "DUPLICATE");
    }
    if (id) {
      const ex = await prisma.vendor.findUnique({ where: { id } });
      if (!ex) throw new AppError("업체를 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.vendor.update({ where: { id }, data: fields });
    }
    return prisma.vendor.create({ data: fields });
  },

  async remove(id) {
    const [ledger, settlement, ticket] = await Promise.all([
      prisma.ledgerEntry.count({ where: { vendor_id: id } }),
      prisma.settlement.count({ where: { vendor_id: id } }),
      prisma.supportTicket.count({ where: { vendor_id: id } }),
    ]);
    if (ledger || settlement || ticket)
      throw new AppError("장부·정산·응대 이력이 있어 삭제할 수 없습니다. 비활성 처리하세요.", 400, "IN_USE");
    await prisma.vendor.delete({ where: { id } });
    return { ok: true };
  },
};
