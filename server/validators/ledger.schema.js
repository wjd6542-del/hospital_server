import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  type: z.enum(["PAYMENT", "COLLECTION"]).optional(),
  game_company_id: z.coerce.number().int().positive().optional(),
  vendor_id: z.coerce.number().int().positive().optional(),
  date_from: z.string().trim().optional(),
  date_to: z.string().trim().optional(),
  page: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().optional(),
});

export const saveSchema = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    type: z.enum(["PAYMENT", "COLLECTION"]),
    entry_date: z.coerce.date(),
    amount: z.coerce.number().positive("금액을 입력하세요"),
    game_company_id: z.coerce.number().int().positive().nullable().optional(),
    vendor_id: z.coerce.number().int().positive().nullable().optional(),
    memo: z.string().trim().nullable().optional(),
  })
  .refine(
    (d) => (d.type === "PAYMENT" ? !!d.game_company_id : !!d.vendor_id),
    { message: "지급은 게임사, 회수는 업체를 선택하세요", path: ["type"] },
  );
