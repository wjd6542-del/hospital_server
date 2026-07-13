import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const emptySchema = z.object({}).passthrough();

export const listSchema = z.object({
  q: z.string().trim().optional(),
  is_active: z.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1, "부서명을 입력하세요"),
  code: z.string().trim().min(1, "부서 코드를 입력하세요"),
  parent_id: z.coerce.number().int().positive().nullish(),
  type_id: z.coerce.number().int().positive().nullish(),
  head_employee_id: z.coerce.number().int().positive().nullish(),
  sort: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
});

/** EntityTree 인라인 추가용 — name 만 받고 code 는 서버가 생성 */
export const quickSaveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1, "부서명을 입력하세요"),
  parent_id: z.coerce.number().int().positive().nullish(),
});

export const reorderSchema = z.object({
  id: z.coerce.number().int().positive(),
  parent_id: z.coerce.number().int().positive().nullish(),
  before_id: z.coerce.number().int().positive().nullish(),
});
