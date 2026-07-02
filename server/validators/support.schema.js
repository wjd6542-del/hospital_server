import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  party: z.enum(["VENDOR", "GAME_COMPANY"]).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  vendor_id: z.coerce.number().int().positive().optional(),
  game_company_id: z.coerce.number().int().positive().optional(),
  tag_ids: z.array(z.coerce.number().int().positive()).optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().optional(),
});

export const saveSchema = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    party: z.enum(["VENDOR", "GAME_COMPANY"]),
    vendor_id: z.coerce.number().int().positive().nullable().optional(),
    game_company_id: z.coerce.number().int().positive().nullable().optional(),
    title: z.string().trim().min(1, "제목을 입력하세요"),
    category: z.string().trim().nullable().optional(),
    status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).default("OPEN"),
    priority: z.coerce.number().int().min(0).max(2).default(0),
    assignee_id: z.coerce.number().int().positive().nullable().optional(),
    tag_ids: z.array(z.coerce.number().int().positive()).optional(),
  })
  .refine(
    (d) => (d.party === "VENDOR" ? !!d.vendor_id : !!d.game_company_id),
    { message: "업체 응대는 업체, 게임사 응대는 게임사를 선택하세요", path: ["party"] },
  );

export const statusSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
});

export const messageSchema = z.object({
  ticket_id: z.coerce.number().int().positive(),
  content: z.string().trim().min(1, "내용을 입력하세요"),
  is_internal: z.boolean().default(false),
});
