import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  only_active: z.boolean().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1, "태그명을 입력하세요"),
  color: z.string().trim().default("#7a5cff"),
  sort: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
});
