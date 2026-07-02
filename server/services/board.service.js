import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  async list() {
    return prisma.board.findMany({ where: { is_active: true }, orderBy: [{ sort: "asc" }, { id: "asc" }] });
  },
  async listAll() {
    return prisma.board.findMany({ orderBy: [{ sort: "asc" }, { id: "asc" }] });
  },
  async getBySlug(slug) {
    const b = await prisma.board.findUnique({ where: { slug } });
    if (!b) throw new AppError("게시판을 찾을 수 없습니다.", 404, "NOT_FOUND");
    return b;
  },
  async save(data) {
    const { id, ...fields } = data;
    if (id) {
      const ex = await prisma.board.findUnique({ where: { id } });
      if (!ex) throw new AppError("게시판을 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.board.update({ where: { id }, data: fields });
    }
    const dup = await prisma.board.findUnique({ where: { slug: fields.slug } });
    if (dup) throw new AppError("이미 존재하는 슬러그입니다.", 400, "DUPLICATE");
    return prisma.board.create({ data: fields });
  },
  async remove(id) {
    const cnt = await prisma.post.count({ where: { board_id: id } });
    if (cnt > 0) throw new AppError("게시글이 있는 게시판은 삭제할 수 없습니다.", 400, "HAS_POSTS");
    await prisma.board.delete({ where: { id } });
    return { ok: true };
  },
};
