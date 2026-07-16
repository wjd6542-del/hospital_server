import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

/** 거래처(공급업체) — 발주가 참조하는 마스터 */
export default {
  async list({ q, only_active } = {}) {
    const where = {};
    if (only_active) where.is_active = true;
    if (q) where.OR = [{ name: { contains: q } }, { contact: { contains: q } }, { business_no: { contains: q } }];
    return prisma.vendor.findMany({ where, orderBy: [{ sort: "asc" }, { id: "asc" }] });
  },

  async save(data) {
    const { id, ...fields } = data;
    if (fields.email === "") fields.email = null;

    if (id) {
      const ex = await prisma.vendor.findUnique({ where: { id } });
      if (!ex) throw new AppError("거래처를 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.vendor.update({ where: { id }, data: fields });
    }
    return prisma.vendor.create({ data: fields });
  },

  async remove(id) {
    const ex = await prisma.vendor.findUnique({ where: { id } });
    if (!ex) throw new AppError("거래처를 찾을 수 없습니다.", 404, "NOT_FOUND");

    const used = await prisma.purchaseOrder.count({ where: { vendor_id: id } });
    if (used > 0) {
      throw new AppError(`발주 ${used}건에서 사용 중이라 삭제할 수 없습니다. 비활성 처리하세요.`, 400, "IN_USE");
    }

    await prisma.vendor.delete({ where: { id } });
    return { ok: true };
  },
};
