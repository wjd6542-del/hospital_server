import { z } from "zod";
export const idSchema = z.object({ id: z.coerce.number().int().positive() });
export const postSchema = z.object({ post_id: z.coerce.number().int().positive() });
export const saveSchema = z.object({
  post_id: z.coerce.number().int().positive(),
  content: z.string().trim().min(1, "댓글을 입력하세요"),
});
