import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  q: z.string().trim().optional(),
  department_id: z.coerce.number().int().positive().nullish(),
  job_type_id: z.coerce.number().int().positive().nullish(),
  status: z.enum(["active", "resigned"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const licenseSchema = z.object({
  license_type_id: z.coerce.number().int().positive(),
  license_no: z.string().trim().min(1, "면허번호를 입력하세요"),
  issued_at: z.coerce.date().nullish(),
  expires_at: z.coerce.date().nullish(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  emp_no: z.string().trim().min(1, "사번을 입력하세요"),
  name: z.string().trim().min(1, "이름을 입력하세요"),
  name_en: z.string().trim().nullish(),
  department_id: z.coerce.number().int().positive().nullish(),
  position_id: z.coerce.number().int().positive().nullish(),
  job_type_id: z.coerce.number().int().positive().nullish(),
  employment_type_id: z.coerce.number().int().positive().nullish(),
  phone: z.string().trim().nullish(),
  email: z.string().trim().email("이메일 형식이 아닙니다").nullish().or(z.literal("")),
  hired_at: z.coerce.date({ message: "입사일을 입력하세요" }),
  // .default() 대신 .optional() — 클라이언트가 안 보내면 undefined 로 남겨 update 시 기존 값을 보존한다.
  // (신규 생성 시엔 Prisma 스키마의 @default 가 채운다. licenses 는 undefined 면 service.save() 가
  // deleteMany/createMany 를 건너뛰고, 명시적으로 [] 를 보낸 경우에만 면허를 전부 지운다.)
  is_active: z.boolean().optional(),
  licenses: z.array(licenseSchema).optional(),
});

export const resignSchema = z.object({
  id: z.coerce.number().int().positive(),
  resigned_at: z.coerce.date({ message: "퇴사일을 입력하세요" }),
});
