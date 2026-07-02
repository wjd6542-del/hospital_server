import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// 계정에 메뉴 권한설정
export const permissionSaveSchema = z.object({
  role_id: z.coerce.number().int().positive(),
  permission_ids: z.array(z.number().int()).default([]),
});

export const saveSchema = z.object({
  id: z.coerce
    .number()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val < 0 ? 0 : val;
    }),
  name: z.string().trim(),
  description: z.string().trim(),
  sort: z.coerce.number().optional(),
});

export const batchSaveSchema = z
  .array(saveSchema)
  .min(1, "저장할 데이터가 없습니다.");

export const batchDeleteSchema = z
  .array(saveSchema)
  .min(1, "삭제할 데이터가 없습니다.");
