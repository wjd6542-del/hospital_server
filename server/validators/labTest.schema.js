import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

const emptyToNull = (schema) => z.preprocess((v) => (v === "" || v === undefined ? null : v), schema.nullable());
const floatField = emptyToNull(z.coerce.number());

export const listSchema = z.object({
  q: z.string().trim().optional(),
  category: z.string().trim().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().max(30).nullish(),
  specimen: z.string().trim().max(40).nullish(),
  unit: z.string().trim().max(20).nullish(),
  ref_low: floatField,
  ref_high: floatField,
  ref_text: z.string().trim().max(100).nullish(),
  sort: z.coerce.number().int().optional(),
  is_active: z.coerce.boolean().optional(),
});
