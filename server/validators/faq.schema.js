import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  category: z.string().trim().optional(),
  categories: z.array(z.string()).optional(),
  tag_ids: z.array(z.coerce.number().int().positive()).optional(),
  q: z.string().trim().optional(),
  is_active: z.boolean().optional(),
  page: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  category: z.string().trim().nullable().optional(),
  question: z.string().trim().min(1, "질문을 입력하세요"),
  answer: z.string().trim().min(1, "답변을 입력하세요"),
  sort: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
  tag_ids: z.array(z.coerce.number().int().positive()).optional(),
});
