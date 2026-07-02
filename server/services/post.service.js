import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

function canWrite(board, user) {
  if (!user) return false;
  if (board.write_level === "ADMIN") return !!user.is_super;
  return true; // MEMBER / ALL → 로그인 회원
}

const LIST_INCLUDE = {
  user: { select: { name: true, username: true } },
  _count: { select: { comments: true } },
  attachments: { where: { is_image: true }, take: 1, orderBy: { id: "asc" } },
};

function shape(p) {
  return {
    id: p.id, board_id: p.board_id, title: p.title, is_notice: p.is_notice,
    view_count: p.view_count, created_at: p.created_at,
    author: p.user?.name || p.user?.username || "-",
    comment_count: p._count?.comments ?? 0,
    thumb: p.attachments?.[0]?.path || null,
  };
}

export default {
  /** 무한 스크롤: 공지는 첫 로드(cursor 없음)에만, 일반글은 id desc 커서 */
  async list({ board_id, cursor, take = 20 }) {
    const posts = await prisma.post.findMany({
      where: { board_id, is_notice: false },
      include: LIST_INCLUDE,
      orderBy: { id: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = posts.length > take;
    const rows = hasMore ? posts.slice(0, take) : posts;
    let notices = [];
    if (!cursor) {
      notices = await prisma.post.findMany({
        where: { board_id, is_notice: true }, include: LIST_INCLUDE, orderBy: { id: "desc" },
      });
    }
    return {
      notices: notices.map(shape),
      rows: rows.map(shape),
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
    };
  },

  async get(id) {
    try {
      return await prisma.post.update({
        where: { id },
        data: { view_count: { increment: 1 } },
        include: {
          user: { select: { name: true, username: true } },
          board: true,
          attachments: { orderBy: { id: "asc" } },
          comments: { include: { user: { select: { name: true, username: true } } }, orderBy: { id: "asc" } },
        },
      });
    } catch {
      throw new AppError("게시글을 찾을 수 없습니다.", 404, "NOT_FOUND");
    }
  },

  async save(data, user) {
    if (!user) throw new AppError("로그인이 필요합니다.", 401, "UNAUTH");
    const board = await prisma.board.findUnique({ where: { id: data.board_id } });
    if (!board) throw new AppError("게시판을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (!canWrite(board, user)) throw new AppError("작성 권한이 없습니다.", 403, "FORBIDDEN");
    const isNotice = !!data.is_notice && !!user.is_super; // 공지 고정은 관리자만

    if (data.id) {
      const ex = await prisma.post.findUnique({ where: { id: data.id } });
      if (!ex) throw new AppError("게시글을 찾을 수 없습니다.", 404, "NOT_FOUND");
      if (ex.user_id !== user.id && !user.is_super) throw new AppError("수정 권한이 없습니다.", 403, "FORBIDDEN");
      const updated = await prisma.post.update({
        where: { id: data.id }, data: { title: data.title, content: data.content, is_notice: isNotice },
      });
      if (data.attachments?.length) {
        await prisma.postAttachment.createMany({ data: data.attachments.map((a) => ({ post_id: data.id, path: a.path, filename: a.filename, mime_type: a.mime_type, size: a.size, is_image: a.is_image })) });
      }
      return updated;
    }
    const created = await prisma.post.create({
      data: { board_id: data.board_id, user_id: user.id, title: data.title, content: data.content, is_notice: isNotice },
    });
    if (data.attachments?.length) {
      await prisma.postAttachment.createMany({ data: data.attachments.map((a) => ({ post_id: created.id, path: a.path, filename: a.filename, mime_type: a.mime_type, size: a.size, is_image: a.is_image })) });
    }
    return created;
  },

  async remove(id, user) {
    if (!user) throw new AppError("로그인이 필요합니다.", 401, "UNAUTH");
    const ex = await prisma.post.findUnique({ where: { id } });
    if (!ex) throw new AppError("게시글을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (ex.user_id !== user.id && !user.is_super) throw new AppError("삭제 권한이 없습니다.", 403, "FORBIDDEN");
    await prisma.post.delete({ where: { id } });
    return { ok: true };
  },
};
