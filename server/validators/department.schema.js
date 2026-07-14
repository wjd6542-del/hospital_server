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
  // .default() 대신 .optional() — 안 보낸 필드는 undefined 로 남아 update 에서 기존 값을 건드리지 않는다.
  // 신규 생성 시엔 Prisma 스키마의 @default 가 채운다.
  sort: z.coerce.number().int().optional(),
  is_active: z.boolean().optional(),
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
