import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  is_active: z.coerce.boolean().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(50),
  is_paid: z.coerce.boolean().optional(),
  deduct_annual: z.coerce.boolean().optional(),
  requires_approval: z.coerce.boolean().optional(),
  shift_type_id: z.coerce.number().int().positive().nullish(),
  color: z.string().trim().max(20).optional(),
  sort: z.coerce.number().int().optional(),
  is_active: z.coerce.boolean().optional(),
});
