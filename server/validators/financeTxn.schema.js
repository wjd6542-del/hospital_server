import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

const TYPE = z.enum(["INCOME", "EXPENSE"]);
const METHOD = z.enum(["CASH", "TRANSFER", "CARD", "OTHER"]);

const attachmentSchema = z.object({
  path: z.string().trim().min(1),
  filename: z.string().trim().min(1),
  mime_type: z.string().trim().nullish(),
  size: z.coerce.number().int().nonnegative().nullish(),
  is_image: z.boolean().optional(),
});

// 목록·집계 공통 필터
const filterShape = {
  date_from: z.coerce.date(),
  date_to: z.coerce.date(),
  type: TYPE.nullish(),
  account_item_id: z.coerce.number().int().positive().nullish(),
  department_id: z.coerce.number().int().positive().nullish(),
  q: z.string().trim().optional(),
};

export const listSchema = z.object({
  ...filterShape,
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const summarySchema = z.object(filterShape);

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  txn_date: z.coerce.date(),
  type: TYPE,
  account_item_id: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive("금액을 입력하세요"),
  department_id: z.coerce.number().int().positive().nullish(),
  vendor: z.string().trim().max(120).nullish(),
  method: METHOD,
  memo: z.string().trim().max(255).nullish(),
  attachments: z.array(attachmentSchema).optional(),
});
