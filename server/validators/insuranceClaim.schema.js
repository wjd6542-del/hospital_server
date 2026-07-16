import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

const INSURER = z.enum(["HEALTH", "MEDICAID", "AUTO", "PRIVATE", "OTHER"]);
const STATUS = z.enum(["DRAFT", "CLAIMED", "APPROVED", "PAID", "REJECTED"]);

export const listSchema = z.object({
  status: STATUS.nullish(),
  insurer: INSURER.nullish(),
  department_id: z.coerce.number().int().positive().nullish(),
  date_from: z.coerce.date().nullish(),
  date_to: z.coerce.date().nullish(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  claim_no: z.string().trim().max(40).nullish(),
  patient_name: z.string().trim().min(1, "환자명을 입력하세요").max(60),
  department_id: z.coerce.number().int().positive().nullish(),
  insurer: INSURER,
  claim_date: z.coerce.date({ message: "청구일을 입력하세요" }),
  total_amount: z.coerce.number().nonnegative().optional(),
  claim_amount: z.coerce.number().nonnegative().optional(),
  status: STATUS.optional(),
  memo: z.string().trim().max(255).nullish(),
});

export const setStatusSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: STATUS,
});
