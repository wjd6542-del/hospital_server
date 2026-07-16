import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

const STATUS = z.enum(["DRAFT", "ORDERED", "RECEIVED", "CANCELED"]);

const itemSchema = z.object({
  name: z.string().trim().min(1, "품목명을 입력하세요").max(150),
  qty: z.coerce.number().positive("수량을 입력하세요"),
  unit: z.string().trim().max(20).nullish(),
  unit_price: z.coerce.number().nonnegative(),
});

export const listSchema = z.object({
  date_from: z.coerce.date().nullish(),
  date_to: z.coerce.date().nullish(),
  status: STATUS.nullish(),
  vendor_id: z.coerce.number().int().positive().nullish(),
  department_id: z.coerce.number().int().positive().nullish(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  vendor_id: z.coerce.number().int().positive(),
  order_date: z.coerce.date(),
  status: STATUS.optional(),
  department_id: z.coerce.number().int().positive().nullish(),
  memo: z.string().trim().max(255).nullish(),
  items: z.array(itemSchema).min(1, "품목을 1개 이상 입력하세요"),
});

export const setStatusSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: STATUS,
});
