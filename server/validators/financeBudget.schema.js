import { z } from "zod";

export const listSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

export const saveSchema = z.object({
  account_item_id: z.coerce.number().int().positive(),
  year: z.coerce.number().int().min(2000).max(2100),
  amount: z.coerce.number().nonnegative(),
});
