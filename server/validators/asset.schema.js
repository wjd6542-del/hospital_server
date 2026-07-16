import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

const STATUS = z.enum(["ACTIVE", "REPAIR", "IDLE", "DISPOSED"]);

export const listSchema = z.object({
  status: STATUS.nullish(),
  category: z.string().trim().optional(),
  department_id: z.coerce.number().int().positive().nullish(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  asset_no: z.string().trim().max(40).nullish(),
  name: z.string().trim().min(1, "자산명을 입력하세요").max(150),
  category: z.string().trim().max(60).nullish(),
  acquired_at: z.coerce.date().nullish().or(z.literal("")),
  acquire_cost: z.coerce.number().nonnegative().optional(),
  status: STATUS.optional(),
  department_id: z.coerce.number().int().positive().nullish(),
  vendor_id: z.coerce.number().int().positive().nullish(),
  memo: z.string().trim().max(255).nullish(),
});
