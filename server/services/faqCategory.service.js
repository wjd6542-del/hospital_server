import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  async list({ only_active } = {}) {
    const where = only_active ? { is_active: true } : {};
    return prisma.faqCategory.findMany({ where, orderBy: [{ sort: "asc" }, { id: "asc" }] });
  },

  async save(data) {
    const { id, ...fields } = data;
    const dup = await prisma.faqCategory.findFirst({
      where: { name: fields.name, ...(id ? { id: { not: id } } : {}) },
    });
    if (dup) throw new AppError("이미 존재하는 분류명입니다.", 400, "DUPLICATE");
    if (id) {
      const ex = await prisma.faqCategory.findUnique({ where: { id } });
      if (!ex) throw new AppError("분류를 찾을 수 없습니다.", 404, "NOT_FOUND");
      // 이름 변경 시 기존 FAQ 의 category 문자열도 함께 갱신
      if (fields.name && fields.name !== ex.name) {
        await prisma.faq.updateMany({ where: { category: ex.name }, data: { category: fields.name } });
      }
      return prisma.faqCategory.update({ where: { id }, data: fields });
    }
    return prisma.faqCategory.create({ data: fields });
  },

  async remove(id) {
    const ex = await prisma.faqCategory.findUnique({ where: { id } });
    if (!ex) throw new AppError("분류를 찾을 수 없습니다.", 404, "NOT_FOUND");
    const cnt = await prisma.faq.count({ where: { category: ex.name } });
    if (cnt > 0) throw new AppError("이 분류를 사용하는 FAQ가 있어 삭제할 수 없습니다.", 400, "IN_USE");
    await prisma.faqCategory.delete({ where: { id } });
    return { ok: true };
  },
};
