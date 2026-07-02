import { z } from "zod";

/**
 * 활성/비활성 토글 공용 스키마
 * 모든 마스터 모델의 /setActive 라우트에서 재사용
 */
export const setActiveSchema = z.object({
  id: z.coerce.number().int().positive(),
  is_active: z.coerce.boolean(),
});
