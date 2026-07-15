import { z } from "zod";

const cellSchema = z.object({
  employee_id: z.coerce.number().int().positive(),
  work_date: z.coerce.date(),
  shift_type_id: z.coerce.number().int().positive(),
  memo: z.string().trim().max(200).nullish(),
});

export const gridSchema = z.object({
  department_id: z.coerce.number().int().positive(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const saveCellSchema = cellSchema;

export const saveBulkSchema = z.object({
  cells: z.array(cellSchema).min(1, "저장할 셀이 없습니다"),
});

export const copyMonthSchema = z.object({
  department_id: z.coerce.number().int().positive(),
  from_year: z.coerce.number().int().min(2000).max(2100),
  from_month: z.coerce.number().int().min(1).max(12),
  to_year: z.coerce.number().int().min(2000).max(2100),
  to_month: z.coerce.number().int().min(1).max(12),
});

export const deleteCellSchema = z.object({
  employee_id: z.coerce.number().int().positive(),
  work_date: z.coerce.date(),
});
