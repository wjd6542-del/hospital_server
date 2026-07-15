import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  department_id: z.coerce.number().int().positive().nullish(),
  employee_id: z.coerce.number().int().positive().nullish(),
  date_from: z.coerce.date(),
  date_to: z.coerce.date(),
  status: z.enum(["NORMAL", "LATE", "EARLY_LEAVE", "ABSENT", "LEAVE"]).nullish(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  employee_id: z.coerce.number().int().positive(),
  work_date: z.coerce.date(),
  check_in: z.coerce.date().nullish().or(z.literal("")),
  check_out: z.coerce.date().nullish().or(z.literal("")),
  memo: z.string().trim().max(200).nullish(),
});

export const bulkGenerateSchema = z.object({
  department_id: z.coerce.number().int().positive(),
  work_date: z.coerce.date(),
});

export const summarySchema = z.object({
  department_id: z.coerce.number().int().positive(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});
