import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  /** 역할 전체 리스트 — 기본 활성만 */
  async getAllList(data) {
    const where = {};
    if (!data?.includeInactive) where.is_active = true;
    return prisma.role.findMany({
      where,
      orderBy: { sort: "asc" },
    });
  },

  /** 역할 리스트 (key/keys 필터, permissions 포함) */
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

    return prisma.role.findMany({
      where,
      include: {
        permissions: true,
      },
      orderBy: { sort: "asc" },
    });
  },

  /** 역할 활성/비활성 토글 */
  async setActive(data, user) {
    if (!data?.id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    if (typeof data.is_active !== "boolean") {
      throw new AppError("is_active 값이 필요합니다.", 400, "INVALID_PARAMS");
    }
    return prisma.role.update({
      where: { id: Number(data.id) },
      data: { is_active: data.is_active },
    });
  },

  /** 역할 단건 조회 (permissions 포함) */
  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: true,
      },
    });
    if (!item) {
      throw new AppError("존재하지 않는 역할 입니다.", 404, "NOT_FOUND");
    }
    return item;
  },

  /** 역할 단건 삭제 */
  async deleteById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    return prisma.role.delete({ where: { id } });
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
   * 역할 생성/수정 (id 없거나 0 → create, 아니면 update)
   * @param {Prisma.TransactionClient} [tx=prisma]
   */
  async save(data, tx = prisma) {
    if (!data.id || data.id === 0) {
      const createData = { ...data };
      delete createData.id;

      return tx.role.create({ data: createData });
    }

    return tx.role.update({
      where: { id: data.id },
      data,
    });
  },

  /**
   * 역할-권한 매핑 동기화 (트랜잭션)
   * 기존 RolePermission 전부 삭제 후 permission_ids 로 재생성
   * @param {{role_id:number, permission_ids:number[]}} data
   */
  async permissionSave(data) {
    const { role_id, permission_ids } = data;

    return await prisma.$transaction(async (tx) => {
      // 1. 기존 전부 삭제
      await tx.rolePermission.deleteMany({
        where: { role_id },
      });

      // 2. 최신 권한만 다시 생성
      if (permission_ids.length) {
        await tx.rolePermission.createMany({
          data: permission_ids.map((permission_id) => ({
            role_id,
            permission_id,
          })),
        });
      }

      return true;
    });
  },
};
