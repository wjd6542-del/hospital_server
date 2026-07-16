import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

const TYPE = z.enum(["IN", "OUT", "ADJUST"]);

export const listSchema = z.object({
  item_id: z.coerce.number().int().positive().nullish(),
  type: TYPE.nullish(),
  date_from: z.coerce.date().nullish(),
  date_to: z.coerce.date().nullish(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const saveSchema = z.object({
  item_id: z.coerce.number().int().positive(),
  type: TYPE,
  qty: z.coerce.number().refine((v) => v !== 0, "수량은 0이 아니어야 합니다"),
  moved_at: z.coerce.date(),
  department_id: z.coerce.number().int().positive().nullish(),
  memo: z.string().trim().max(255).nullish(),
});
