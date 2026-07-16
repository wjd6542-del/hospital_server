import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

const STATUS = z.enum(["ADMITTED", "DISCHARGED"]);

export const listSchema = z.object({
  status: STATUS.nullish(),
  department_id: z.coerce.number().int().positive().nullish(),
  doctor_id: z.coerce.number().int().positive().nullish(),
  date_from: z.coerce.date().nullish(),
  date_to: z.coerce.date().nullish(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  patient_name: z.string().trim().min(1, "환자명을 입력하세요").max(60),
  patient_phone: z.string().trim().max(30).nullish(),
  room: z.string().trim().max(40).nullish(),
  department_id: z.coerce.number().int().positive().nullish(),
  doctor_id: z.coerce.number().int().positive().nullish(),
  admitted_at: z.coerce.date({ message: "입원일을 입력하세요" }),
  discharged_at: z.coerce.date().nullish().or(z.literal("")),
  status: STATUS.optional(),
  diagnosis: z.string().trim().max(200).nullish(),
  memo: z.string().trim().max(255).nullish(),
});

export const dischargeSchema = z.object({
  id: z.coerce.number().int().positive(),
  discharged_at: z.coerce.date().nullish().or(z.literal("")),
});
