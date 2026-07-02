import { z } from "zod";
const level = z.enum(["ALL", "MEMBER", "ADMIN"]);
export const idSchema = z.object({ id: z.coerce.number().int().positive() });
export const slugSchema = z.object({ slug: z.string().trim().min(1) });
export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1, "게시판명을 입력하세요"),
  slug: z.string().trim().min(1, "슬러그를 입력하세요").regex(/^[a-z0-9-]+$/, "영문 소문자·숫자·하이픈"),
  description: z.string().trim().nullable().optional(),
  read_level: level.default("ALL"),
  write_level: level.default("MEMBER"),
  allow_comment: z.boolean().default(true),
  allow_upload: z.boolean().default(true),
  sort: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
});
