import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  /** 설정 전체 리스트 */
  async getAllList(data) {
    return prisma.settings.findMany({
      orderBy: { sort: "asc" },
    });
  },

  /** 설정 리스트 (key/keys 필터) */
  async getList(data) {
    const where = {};
    if (data?.key) {
      where.key = data.key;
    }

    // 키 배열 검색
    if (data?.keys?.length) {
      where.key = {
        in: data.keys,
      };
    }

    return prisma.settings.findMany({
      where,
      orderBy: { sort: "asc" },
    });
  },

  /** 설정 키 기준 그룹핑 */
  async getKeyGroup() {
    const res = await prisma.settings.groupBy({
      by: ["key"],
    });
    return res;
  },

  /** UI용 축약 설정 리스트 (id/text/value) — 드롭다운 공급용 */
  async getViewList(data) {
    const where = {};
    if (data?.key) {
      where.key = data.key;
    }

    return prisma.settings.findMany({
      where,
      orderBy: { sort: "asc" },
      select: {
        id: true,
        text: true,
        value: true,
      },
    });
  },

  /** 설정 단건 조회 */
  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.settings.findUnique({ where: { id } });
    if (!item) {
      throw new AppError("존재하지 않는 설정 입니다.", 404, "NOT_FOUND");
    }
    return item;
  },

  /** 설정 단건 삭제 */
  async deleteById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    return prisma.settings.delete({ where: { id } });
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
   * 설정 생성/수정 (id 없거나 0 → create, 아니면 update)
   * @param {Prisma.TransactionClient} [tx=prisma]
   */
  async save(data, tx = prisma) {
    if (!data.id || data.id === 0) {
      const createData = { ...data };
      delete createData.id;

      return tx.settings.create({ data: createData });
    }

    return tx.settings.update({
      where: { id: data.id },
      data,
    });
  },
};
