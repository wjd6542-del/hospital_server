import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  /**
   * 알림 리스트 (id/type/action 필터, user 조인, 최신순)
   */
  async getList(data, user) {
    const where = {};

    if (data?.id) {
      where.id = Number(data.id);
    }

    // 타입별 리스트 출력
    if (data?.type) {
      where.type = data.type;
    }

    if (data?.action) {
      where.action = data.action;
    }

    return prisma.notification.findMany({
      where,
      include: {
        user: true,
      },
      orderBy: { created_at: "desc" },
    });
  },

  /**
   * 알림 단건 읽음 처리 (is_read=true, read_at=now)
   * 본인 소유 알림만 수정 가능 — 타인 알림 ID 주입 시 0건 매칭으로 404
   */
  async read(data, user) {
    if (!user?.id) {
      throw new AppError("로그인이 필요합니다.", 401, "UNAUTHORIZED");
    }
    if (!data?.id) {
      throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    }

    const result = await prisma.notification.updateMany({
      where: { id: Number(data.id), user_id: user.id },
      data: { is_read: true, read_at: new Date() },
    });

    if (result.count === 0) {
      throw new AppError("알림을 찾을 수 없습니다.", 404, "NOT_FOUND");
    }
    return { success: true };
  },

  /** 현재 사용자의 미읽음 알림을 모두 읽음 처리 */
  async readAll(data, user) {
    return await prisma.notification.updateMany({
      where: { user_id: user.id, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });
  },

  /** 현재 사용자의 미읽음 알림 건수 (헤더 배지용) */
  async count(data, user) {
    return prisma.notification.count({
      where: {
        user_id: user.id,
        is_read: false,
      },
    });
  },

  /**
   * 미읽음 알림을 NotificationType 별로 집계
   * (고정 키 INBOUND/OUTBOUND/MATERIAL/RETURNORDER/PURCHASEORDER 초기값 0 보장)
   */
  async countByType(data, user) {
    const rows = await prisma.notification.groupBy({
      by: ["type"],
      where: {
        is_read: false,
      },
      _count: {
        type: true,
      },
    });

    const result = {
      INBOUND: 0,
      OUTBOUND: 0,
      MATERIAL: 0,
      RETURNORDER: 0,
      PURCHASEORDER: 0,
    };

    rows.forEach((r) => {
      result[r.type] = r._count.type;
    });

    return result;
  },

  /**
   * 알림 단건 삭제 (본인 소유만)
   */
  async deleteById(id, user) {
    if (!user?.id) {
      throw new AppError("로그인이 필요합니다.", 401, "UNAUTHORIZED");
    }
    if (!id) {
      throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    }

    const result = await prisma.notification.deleteMany({
      where: { id: Number(id), user_id: user.id },
    });

    if (result.count === 0) {
      throw new AppError("알림을 찾을 수 없습니다.", 404, "NOT_FOUND");
    }
    return { success: true };
  },

  /** 알림 일괄 삭제 (본인 소유만) */
  async batchDelete(data = [], user) {
    if (!user?.id) {
      throw new AppError("로그인이 필요합니다.", 401, "UNAUTHORIZED");
    }
    if (!data.length) {
      throw new AppError("요청데이터가 없습니다.", 400, "NOT_FOUND_DATA");
    }

    const ids = data.map((row) => Number(row.id)).filter((v) => v > 0);
    if (!ids.length) {
      throw new AppError("유효한 ID가 없습니다.", 400, "INVALID_PARAMS");
    }

    const result = await prisma.notification.deleteMany({
      where: { id: { in: ids }, user_id: user.id },
    });

    return { count: result.count };
  },

  /** 알림 일괄 읽음 처리 (본인 소유만) */
  async batchRead(data = [], user) {
    if (!user?.id) {
      throw new AppError("로그인이 필요합니다.", 401, "UNAUTHORIZED");
    }
    if (!data.length) {
      throw new AppError("요청데이터가 없습니다.", 400, "NOT_FOUND_DATA");
    }

    const ids = data.map((row) => Number(row.id)).filter((v) => v > 0);
    if (!ids.length) {
      throw new AppError("유효한 ID가 없습니다.", 400, "INVALID_PARAMS");
    }

    const result = await prisma.notification.updateMany({
      where: { id: { in: ids }, user_id: user.id },
      data: { is_read: true, read_at: new Date() },
    });

    return { count: result.count };
  },
};
