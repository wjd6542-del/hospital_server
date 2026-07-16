import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

const TYPE = z.enum(["INCOME", "EXPENSE"]);

export const listSchema = z.object({
  type: TYPE.nullish(),
  only_active: z.boolean().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  type: TYPE,
  name: z.string().trim().min(1, "계정과목명을 입력하세요").max(100),
  sort: z.coerce.number().int().optional(),
  is_active: z.boolean().optional(),
});
