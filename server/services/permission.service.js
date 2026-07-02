import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  /** 권한 전체 리스트 — 기본 활성만 */
  async getAllList(data) {
    const where = {};
    if (!data?.includeInactive) where.is_active = true;
    return prisma.permission.findMany({
      where,
      orderBy: { sort: "asc" },
    });
  },

  /** 권한 리스트 (key/keys 필터) */
  async getList(data) {
    const where = {};
    if (!data?.includeInactive) where.is_active = true;
    if (data?.key) {
      where.key = data.key;
    }

    // 키 배열 검색
    if (data?.keys?.length) {
      where.key = {
        in: data.keys,
      };
    }

    return prisma.permission.findMany({
      where,
      orderBy: { sort: "asc" },
    });
  },

  /** 드롭다운 표시용 축약 리스트 (id/text/value, 기본 활성만) */
  async getViewList(data) {
    const where = {};
    if (!data?.includeInactive) where.is_active = true;
    if (data?.key) {
      where.key = data.key;
    }

    return prisma.permission.findMany({
      where,
      orderBy: { sort: "asc" },
      select: {
        id: true,
        text: true,
        value: true,
      },
    });
  },

  /** 권한 활성/비활성 토글 */
  async setActive(data, user) {
    if (!data?.id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    if (typeof data.is_active !== "boolean") {
      throw new AppError("is_active 값이 필요합니다.", 400, "INVALID_PARAMS");
    }
    return prisma.permission.update({
      where: { id: Number(data.id) },
      data: { is_active: data.is_active },
    });
  },

  /** 권한 단건 조회 */
  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.permission.findUnique({ where: { id } });
    if (!item) {
      throw new AppError("존재하지 않는 권한 입니다.", 404, "NOT_FOUND");
    }
    return item;
  },

  /** 권한 단건 삭제 (트랜잭션 보장 + 존재 검증) */
  async deleteById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    return prisma.$transaction(async (tx) => {
      const exists = await tx.permission.findUnique({ where: { id } });
      if (!exists) {
        throw new AppError("존재하지 않는 권한 입니다.", 404, "NOT_FOUND");
      }
      await tx.permission.delete({ where: { id } });
      return true;
    });
  },

  /**
   * 일괄 삭제
   * @param {*} data
   */
  async batchDelete(data = []) {
    if (!data.length) {
      throw new AppError("요청데이터가 없습니다.", 400, "NOT_FOUND_DATA");
    }

    const results = await Promise.all(
      data.map((row, idx) =>
        this.deleteById(row.id).catch(() => {
          throw new AppError(
            `${idx + 1} 번째 데이터 삭제 실패`,
            400,
            "BATCH_DELETE_FAILED",
          );
        }),
      ),
    );
    return results;
  },

  /**
   * 일괄 저장
   * @param {*} data
   */
  async batchSave(data = []) {
    if (!data.length) {
      throw new AppError("요청데이터가 없습니다.", 400, "NOT_FOUND_DATA");
    }

    const results = await Promise.all(
      data.map((row, idx) =>
        this.save(row).catch(() => {
          throw new AppError(
            `${idx + 1}번째 데이터 저장 실패`,
            400,
            "BATCH_SAVE_FAILED",
          );
        }),
      ),
    );

    return results;
  },

  /**
   * 권한 생성/수정 (id 없거나 0 → create)
   * @param {Prisma.TransactionClient} [tx=prisma]
   */
  async save(data, tx = prisma) {
    if (!data.id || data.id === 0) {
      const createData = { ...data };
      delete createData.id;

      return tx.permission.create({ data: createData });
    }

    return tx.permission.update({
      where: { id: data.id },
      data,
    });
  },
};
