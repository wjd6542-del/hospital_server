import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  patient_id: z.coerce.number().int().positive().nullish(),
  encounter_id: z.coerce.number().int().positive().nullish(),
  status: z.enum(["UNPAID", "PARTIAL", "PAID", "CANCELED"]).nullish(),
  date_from: z.coerce.date().nullish(),
  date_to: z.coerce.date().nullish(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const itemSchema = z.object({
  category: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(150),
  qty: z.coerce.number().int().min(1).optional(),
  unit_price: z.coerce.number().min(0).max(1_000_000_000).optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  patient_id: z.coerce.number().int().positive(),
  encounter_id: z.coerce.number().int().positive().nullish(),
  department_id: z.coerce.number().int().positive().nullish(),
  billed_at: z.coerce.date(),
  insurance_amount: z.coerce.number().min(0).max(1_000_000_000).optional(),
  memo: z.string().trim().max(255).nullish(),
  items: z.array(itemSchema).optional().default([]),
});

export const paySchema = z.object({
  id: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive().max(1_000_000_000),
  method: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]).optional(),
});

export const suggestSchema = z.object({
  encounter_id: z.coerce.number().int().positive(),
});
