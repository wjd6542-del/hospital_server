import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const batchIdsSchema = z
  .array(idParamSchema)
  .min(1, "요청 데이터가 없습니다.");
