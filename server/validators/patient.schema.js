import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  q: z.string().trim().optional(),
  is_active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  patient_no: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(60),
  birth_date: z.coerce.date().nullish().or(z.literal("")),
  sex: z.enum(["M", "F", "OTHER"]).nullish(),
  phone: z.string().trim().max(30).nullish(),
  address: z.string().trim().max(200).nullish(),
  blood_type: z.string().trim().max(6).nullish(),
  allergies: z.string().trim().max(2000).nullish(),
  memo: z.string().trim().max(255).nullish(),
  is_active: z.coerce.boolean().optional(),
});
