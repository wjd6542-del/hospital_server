import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  q: z.string().trim().optional(),
  only_active: z.boolean().optional(),
  low_only: z.boolean().optional(), // 안전재고 미달만
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1, "품목명을 입력하세요").max(150),
  category: z.string().trim().max(60).nullish(),
  unit: z.string().trim().max(20).nullish(),
  safety_stock: z.coerce.number().nonnegative().optional(),
  sort: z.coerce.number().int().optional(),
  is_active: z.boolean().optional(),
});
