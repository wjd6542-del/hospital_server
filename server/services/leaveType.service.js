import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

const INCLUDE = {
  shift_type: { select: { id: true, code: true, name: true, color: true } },
};

export default {
  async list({ is_active } = {}) {
    const where = {};
    if (is_active !== undefined) where.is_active = is_active;
    return prisma.leaveType.findMany({
      where,
      orderBy: [{ sort: "asc" }, { id: "asc" }],
      include: INCLUDE,
    });
  },

  async save(data) {
    const { id, code, ...rest } = data;
    const payload = {
      code,
      name: rest.name,
      is_paid: rest.is_paid ?? true,
      deduct_annual: rest.deduct_annual ?? false,
      requires_approval: rest.requires_approval ?? true,
      shift_type_id: rest.shift_type_id ?? null,
      color: rest.color ?? "#64748b",
      sort: rest.sort ?? 0,
      is_active: rest.is_active ?? true,
    };

    // code 중복 검사 — 다른 레코드가 같은 code 를 쓰면 막는다
    const dup = await prisma.leaveType.findUnique({ where: { code } });
    if (dup && dup.id !== id) {
      throw new AppError("이미 사용 중인 코드입니다.", 409, "DUPLICATE");
    }

    if (id) {
      return prisma.leaveType.update({ where: { id }, data: payload, include: INCLUDE });
    }
    return prisma.leaveType.create({ data: payload, include: INCLUDE });
  },

  async remove(id) {
    const ex = await prisma.leaveType.findUnique({
      where: { id },
      include: { _count: { select: { requests: true } } },
    });
    if (!ex) throw new AppError("휴가유형을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (ex._count.requests > 0) {
      throw new AppError("신청 이력이 있어 삭제할 수 없습니다. 비활성화하세요.", 409, "IN_USE");
    }
    await prisma.leaveType.delete({ where: { id } });
    return { ok: true };
  },
};
