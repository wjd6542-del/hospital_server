import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

const PRIORITY = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);
const STATUS = z.enum(["RECEIVED", "IN_PROGRESS", "DONE", "CANCELED"]);

export const listSchema = z.object({
  status: STATUS.nullish(),
  priority: PRIORITY.nullish(),
  department_id: z.coerce.number().int().positive().nullish(),
  date_from: z.coerce.date().nullish(),
  date_to: z.coerce.date().nullish(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(1, "제목을 입력하세요").max(150),
  location: z.string().trim().max(120).nullish(),
  category: z.string().trim().max(60).nullish(),
  priority: PRIORITY.optional(),
  status: STATUS.optional(),
  reported_at: z.coerce.date(),
  resolved_at: z.coerce.date().nullish().or(z.literal("")),
  department_id: z.coerce.number().int().positive().nullish(),
  assignee: z.string().trim().max(60).nullish(),
  content: z.string().trim().max(500).nullish(),
  resolution: z.string().trim().max(500).nullish(),
});

export const setStatusSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: STATUS,
});
