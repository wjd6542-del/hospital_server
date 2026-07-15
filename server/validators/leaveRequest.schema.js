import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  department_id: z.coerce.number().int().positive().nullish(),
  employee_id: z.coerce.number().int().positive().nullish(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELED"]).nullish(),
  date_from: z.coerce.date().nullish(),
  date_to: z.coerce.date().nullish(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const createSchema = z
  .object({
    employee_id: z.coerce.number().int().positive(),
    leave_type_id: z.coerce.number().int().positive(),
    start_date: z.coerce.date(),
    end_date: z.coerce.date(),
    days: z.coerce.number().positive().max(366).optional(),
    reason: z.string().trim().max(300).nullish(),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: "종료일은 시작일 이후여야 합니다.",
    path: ["end_date"],
  });

export const rejectSchema = z.object({
  id: z.coerce.number().int().positive(),
  reason: z.string().trim().max(300).nullish(),
});
