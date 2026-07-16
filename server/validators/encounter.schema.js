import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

// 빈 문자열/undefined 는 null 로 — 바이탈 입력을 비우면 "" 가 온다.
// z.coerce.number() 는 "" 를 0 으로 만들므로 반드시 먼저 걸러야 한다.
const emptyToNull = (schema) => z.preprocess((v) => (v === "" || v === undefined ? null : v), schema.nullable());
const intField = emptyToNull(z.coerce.number().int());
const floatField = emptyToNull(z.coerce.number());

export const listSchema = z.object({
  patient_id: z.coerce.number().int().positive().nullish(),
  department_id: z.coerce.number().int().positive().nullish(),
  doctor_id: z.coerce.number().int().positive().nullish(),
  status: z.enum(["OPEN", "CLOSED"]).nullish(),
  date_from: z.coerce.date().nullish(),
  date_to: z.coerce.date().nullish(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const diagnosisSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(200),
  is_primary: z.coerce.boolean().optional(),
  note: z.string().trim().max(255).nullish(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  patient_id: z.coerce.number().int().positive(),
  department_id: z.coerce.number().int().positive().nullish(),
  doctor_id: z.coerce.number().int().positive().nullish(),
  appointment_id: z.coerce.number().int().positive().nullish(),
  encounter_date: z.coerce.date(),
  chief_complaint: z.string().trim().max(255).nullish(),
  subjective: z.string().trim().nullish(),
  objective: z.string().trim().nullish(),
  assessment: z.string().trim().nullish(),
  plan: z.string().trim().nullish(),
  bp_systolic: intField,
  bp_diastolic: intField,
  pulse: intField,
  temp: floatField,
  resp: intField,
  spo2: intField,
  height: floatField,
  weight: floatField,
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  memo: z.string().trim().max(255).nullish(),
  diagnoses: z.array(diagnosisSchema).optional().default([]),
});
