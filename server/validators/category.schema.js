import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  group: z.string().trim().min(1).optional(),
  only_active: z.boolean().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  group: z.string().trim().min(1, "코드 그룹을 입력하세요"),
  text: z.string().trim().min(1, "표시명을 입력하세요"),
  value: z.string().trim().min(1, "코드값을 입력하세요"),
  sort: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
});
