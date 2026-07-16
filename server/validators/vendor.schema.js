import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  q: z.string().trim().optional(),
  only_active: z.boolean().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1, "상호를 입력하세요").max(120),
  business_no: z.string().trim().max(20).nullish(),
  contact: z.string().trim().max(60).nullish(),
  phone: z.string().trim().max(30).nullish(),
  email: z.string().trim().email("이메일 형식이 아닙니다").max(120).nullish().or(z.literal("")),
  memo: z.string().trim().max(255).nullish(),
  sort: z.coerce.number().int().optional(),
  is_active: z.boolean().optional(),
});
