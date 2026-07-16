import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  patient_id: z.coerce.number().int().positive().nullish(),
  encounter_id: z.coerce.number().int().positive().nullish(),
  doctor_id: z.coerce.number().int().positive().nullish(),
  status: z.enum(["ORDERED", "RESULTED", "CANCELED"]).nullish(),
  priority: z.enum(["ROUTINE", "STAT"]).nullish(),
  date_from: z.coerce.date().nullish(),
  date_to: z.coerce.date().nullish(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const itemSchema = z.object({
  lab_test_id: z.coerce.number().int().positive().nullish(),
  test_name: z.string().trim().min(1).max(100),
  unit: z.string().trim().max(20).nullish(),
  ref_range: z.string().trim().max(100).nullish(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  patient_id: z.coerce.number().int().positive(),
  encounter_id: z.coerce.number().int().positive().nullish(),
  doctor_id: z.coerce.number().int().positive().nullish(),
  ordered_at: z.coerce.date(),
  priority: z.enum(["ROUTINE", "STAT"]).optional(),
  memo: z.string().trim().max(255).nullish(),
  items: z.array(itemSchema).optional().default([]),
});

// 결과 입력 — 항목별 결과값(+선택적 수동 플래그)
export const resultSchema = z.object({
  id: z.coerce.number().int().positive(),
  results: z
    .array(
      z.object({
        item_id: z.coerce.number().int().positive(),
        result_value: z.string().trim().max(100).nullish(),
        flag: z.enum(["NORMAL", "HIGH", "LOW", "ABNORMAL"]).nullish(),
      }),
    )
    .default([]),
});
