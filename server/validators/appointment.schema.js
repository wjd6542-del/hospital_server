import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

const STATUS = z.enum(["BOOKED", "VISITED", "NOSHOW", "CANCELED"]);

export const listSchema = z.object({
  date_from: z.coerce.date().nullish(),
  date_to: z.coerce.date().nullish(),
  status: STATUS.nullish(),
  department_id: z.coerce.number().int().positive().nullish(),
  doctor_id: z.coerce.number().int().positive().nullish(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  patient_name: z.string().trim().min(1, "환자명을 입력하세요").max(60),
  patient_phone: z.string().trim().max(30).nullish(),
  department_id: z.coerce.number().int().positive().nullish(),
  doctor_id: z.coerce.number().int().positive().nullish(),
  reserved_at: z.coerce.date({ message: "예약 일시를 입력하세요" }),
  status: STATUS.optional(),
  memo: z.string().trim().max(255).nullish(),
});

export const setStatusSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: STATUS,
});
