import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  only_active: z.boolean().optional(),
});

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  code: z.string().trim().min(1, "코드를 입력하세요").max(20),
  name: z.string().trim().min(1, "명칭을 입력하세요").max(50),
  start_time: z.string().regex(HHMM, "시각은 HH:MM 형식입니다").nullish().or(z.literal("")),
  end_time: z.string().regex(HHMM, "시각은 HH:MM 형식입니다").nullish().or(z.literal("")),
  crosses_midnight: z.boolean().optional(),
  break_minutes: z.coerce.number().int().min(0).optional(),
  is_work: z.boolean().optional(),
  color: z.string().trim().max(20).optional(),
  sort: z.coerce.number().int().optional(),
  is_active: z.boolean().optional(),
});
