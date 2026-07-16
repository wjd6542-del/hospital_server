import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

/** 계정과목(AccountItem) — 수입/지출 분류. 관리형 룩업(ShiftType 패턴). */
export default {
  async list({ type, only_active } = {}) {
    const where = {};
    if (type) where.type = type;
    if (only_active) where.is_active = true;
    return prisma.accountItem.findMany({
      where,
      orderBy: [{ type: "asc" }, { sort: "asc" }, { id: "asc" }],
    });
  },

  async save(data) {
    const { id, ...fields } = data;

    // (type, name) 유니크 — 같은 구분 안에서 이름 중복 금지
    const dup = await prisma.accountItem.findFirst({
      where: { type: fields.type, name: fields.name, ...(id ? { id: { not: id } } : {}) },
    });
    if (dup) throw new AppError("이미 존재하는 계정과목입니다.", 400, "DUPLICATE");

    if (id) {
      const ex = await prisma.accountItem.findUnique({ where: { id } });
      if (!ex) throw new AppError("계정과목을 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.accountItem.update({ where: { id }, data: fields });
    }
    return prisma.accountItem.create({ data: fields });
  },

  async remove(id) {
    const ex = await prisma.accountItem.findUnique({ where: { id } });
    if (!ex) throw new AppError("계정과목을 찾을 수 없습니다.", 404, "NOT_FOUND");

    const used = await prisma.financeTransaction.count({ where: { account_item_id: id } });
    if (used > 0) {
      throw new AppError(
        `거래 ${used}건에서 사용 중이라 삭제할 수 없습니다. 비활성 처리하세요.`,
        400,
        "IN_USE",
      );
    }

    await prisma.accountItem.delete({ where: { id } });
    return { ok: true };
  },
};
