import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  department_id: z.coerce.number().int().positive().nullish(),
  year: z.coerce.number().int().min(2000).max(2100),
  q: z.string().trim().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  employee_id: z.coerce.number().int().positive(),
  year: z.coerce.number().int().min(2000).max(2100),
  granted_days: z.coerce.number().min(0).max(366),
  note: z.string().trim().max(200).nullish(),
});

export const suggestSchema = z.object({
  department_id: z.coerce.number().int().positive().nullish(),
  year: z.coerce.number().int().min(2000).max(2100),
});
