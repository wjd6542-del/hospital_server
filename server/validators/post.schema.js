import { z } from "zod";
export const idSchema = z.object({ id: z.coerce.number().int().positive() });
export const listSchema = z.object({
  board_id: z.coerce.number().int().positive(),
  cursor: z.coerce.number().int().positive().nullable().optional(),
  take: z.coerce.number().int().min(1).max(50).default(20),
});
const attachment = z.object({
  path: z.string(),
  filename: z.string(),
  mime_type: z.string().nullable().optional(),
  size: z.coerce.number().int().nullable().optional(),
  is_image: z.boolean().default(false),
});
export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  board_id: z.coerce.number().int().positive(),
  title: z.string().trim().min(1, "제목을 입력하세요"),
  content: z.string().default(""),
  is_notice: z.boolean().default(false),
  attachments: z.array(attachment).default([]),
});
