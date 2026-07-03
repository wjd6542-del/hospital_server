import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1, "유형명을 입력하세요"),
  code: z.string().trim().min(1, "코드를 입력하세요").regex(/^[a-z0-9_-]+$/i, "코드는 영문·숫자만 가능합니다"),
  icon: z.string().trim().nullable().optional(),
  sort: z.coerce.number().int().default(0),
  is_active: z.coerce.boolean().default(true),
});
