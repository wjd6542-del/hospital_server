import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  async list({ q, category, is_active } = {}) {
    const where = {};
    if (is_active !== undefined) where.is_active = is_active;
    if (category) where.category = category;
    if (q) where.OR = [{ name: { contains: q } }, { code: { contains: q } }];
    return prisma.labTest.findMany({ where, orderBy: [{ sort: "asc" }, { id: "asc" }] });
  },

  async save(data) {
    const { id, code } = data;
    const payload = {
      code,
      name: data.name,
      category: data.category ?? null,
      specimen: data.specimen ?? null,
      unit: data.unit ?? null,
      ref_low: data.ref_low ?? null,
      ref_high: data.ref_high ?? null,
      ref_text: data.ref_text ?? null,
      sort: data.sort ?? 0,
      is_active: data.is_active ?? true,
    };

    const dup = await prisma.labTest.findUnique({ where: { code } });
    if (dup && dup.id !== id) throw new AppError("이미 사용 중인 코드입니다.", 409, "DUPLICATE");

    if (id) {
      return prisma.labTest.update({ where: { id }, data: payload });
    }
    return prisma.labTest.create({ data: payload });
  },

  async remove(id) {
    const ex = await prisma.labTest.findUnique({
      where: { id },
      include: { _count: { select: { orderItems: true } } },
    });
    if (!ex) throw new AppError("검사 항목을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (ex._count.orderItems > 0) {
      throw new AppError("오더 이력이 있어 삭제할 수 없습니다. 비활성화하세요.", 409, "IN_USE");
    }
    await prisma.labTest.delete({ where: { id } });
    return { ok: true };
  },
};
