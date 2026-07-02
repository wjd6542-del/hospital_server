import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const saveSchema = z.object({
  id: z.coerce
    .number()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val < 0 ? 0 : val;
    }),
  key: z.string().trim().min(1, "key는 1자 이상 입력해주세요"),
  text: z.string().trim().min(1, "text는 1자 이상 입력해주세요"),
  value: z.string().trim().min(1, "value는 1자 이상 입력해주세요"),
  sort: z.coerce.number().optional(),
  is_active: z.enum([true, false]),
});

export const batchSaveSchema = z
  .array(saveSchema)
  .min(1, "저장할 데이터가 없습니다.");

export const batchDeleteSchema = z
  .array(saveSchema)
  .min(1, "삭제할 데이터가 없습니다.");
