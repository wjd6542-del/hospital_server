import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

// 빈 문자열 → null (z.coerce.number 는 "" 를 0 으로 만들므로 먼저 거른다)
const emptyToNull = (schema) => z.preprocess((v) => (v === "" || v === undefined ? null : v), schema.nullable());
const intField = emptyToNull(z.coerce.number().int());

export const listSchema = z.object({
  patient_id: z.coerce.number().int().positive().nullish(),
  encounter_id: z.coerce.number().int().positive().nullish(),
  doctor_id: z.coerce.number().int().positive().nullish(),
  status: z.enum(["DRAFT", "ISSUED", "DISPENSED", "CANCELED"]).nullish(),
  type: z.enum(["INTERNAL", "EXTERNAL"]).nullish(),
  date_from: z.coerce.date().nullish(),
  date_to: z.coerce.date().nullish(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const itemSchema = z.object({
  item_id: z.coerce.number().int().positive().nullish(),
  drug_name: z.string().trim().min(1).max(150),
  dosage: z.string().trim().max(40).nullish(),
  frequency: z.string().trim().max(40).nullish(),
  duration_days: intField,
  route: z.string().trim().max(20).nullish(),
  qty: z.coerce.number().min(0).max(1000000).optional(),
  instruction: z.string().trim().max(255).nullish(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  patient_id: z.coerce.number().int().positive(),
  encounter_id: z.coerce.number().int().positive().nullish(),
  doctor_id: z.coerce.number().int().positive().nullish(),
  prescribed_at: z.coerce.date(),
  type: z.enum(["INTERNAL", "EXTERNAL"]).optional(),
  // 조제/취소는 별도 액션 — save 에서 상태 직접 지정은 DRAFT/ISSUED 만 허용
  status: z.enum(["DRAFT", "ISSUED"]).optional(),
  memo: z.string().trim().max(255).nullish(),
  items: z.array(itemSchema).optional().default([]),
});
