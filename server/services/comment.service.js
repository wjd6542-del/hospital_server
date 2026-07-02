import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  async add(data, user) {
    if (!user) throw new AppError("로그인이 필요합니다.", 401, "UNAUTH");
    const post = await prisma.post.findUnique({ where: { id: data.post_id }, include: { board: true } });
    if (!post) throw new AppError("게시글을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (!post.board.allow_comment) throw new AppError("댓글이 허용되지 않는 게시판입니다.", 400, "NO_COMMENT");
    const c = await prisma.postComment.create({ data: { post_id: data.post_id, user_id: user.id, content: data.content } });
    return prisma.postComment.findUnique({ where: { id: c.id }, include: { user: { select: { name: true, username: true } } } });
  },
  async remove(id, user) {
    if (!user) throw new AppError("로그인이 필요합니다.", 401, "UNAUTH");
    const ex = await prisma.postComment.findUnique({ where: { id } });
    if (!ex) throw new AppError("댓글을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (ex.user_id !== user.id && !user.is_super) throw new AppError("삭제 권한이 없습니다.", 403, "FORBIDDEN");
    await prisma.postComment.delete({ where: { id } });
    return { ok: true };
  },
};
