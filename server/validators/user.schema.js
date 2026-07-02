import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const idPermissionSchema = z.object({
  user_id: z.coerce.number().int().positive(),
  role_id: z.coerce.number().int().positive(),
});

// 신규 등록처리
export const createSchema = z
  .object({
    name: z.string().min(1, "이름을 입력하세요"),

    username: z
      .string()
      .min(1, "아이디를 입력하세요")
      .regex(/^[A-Za-z0-9]+$/, "아이디는 영문과 숫자만 가능합니다"),

    email: z
      .string()
      .min(1, "이메일을 입력하세요")
      .email("올바른 이메일 형식이 아닙니다"),

    password: z
      .string()
      .min(6, "비밀번호는 6자리 이상입니다")
      .regex(/^[A-Za-z0-9]+$/, "비밀번호는 영문과 숫자만 가능합니다")
      .refine((val) => /[A-Za-z]/.test(val) && /\d/.test(val), {
        message: "비밀번호는 영문 + 숫자 조합이어야 합니다",
      }),
    passwordConfirm: z.string().min(6, "비밀번호 확인을 입력하세요"),

    // ✅ 권한 (number)
    role_id: z.coerce.number().min(1, "권한을 선택하세요"),

    // ✅ 활성 여부 (boolean)
    is_active: z.coerce.boolean(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["passwordConfirm"],
  });

// 수정처리
export const updateSchema = z.object({
  id: z.coerce.number().min(1, "아이디가 누락되었습니다"),

  name: z.string().min(1, "이름을 입력하세요"),

  username: z
    .string()
    .min(1, "아이디를 입력하세요")
    .regex(/^[A-Za-z0-9]+$/, "아이디는 영문과 숫자만 가능합니다"),

  email: z
    .string()
    .min(1, "이메일을 입력하세요")
    .email("올바른 이메일 형식이 아닙니다"),

  // ✅ 권한 (number)
  role_id: z.coerce.number().min(1, "권한을 선택하세요"),

  // ✅ 활성 여부 (boolean)
  is_active: z.coerce.boolean(),
});

export const saveSchema = z.object({
  id: z.coerce
    .number()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val < 0 ? 0 : val;
    }),
  code: z.string().trim(),
  name: z.string().trim(),
  location: z.string().trim(),
  memo: z.string().trim(),
  sort: z.coerce.number().optional(),
});

export const batchSaveSchema = z
  .array(saveSchema)
  .min(1, "저장할 데이터가 없습니다.");

export const batchDeleteSchema = z
  .array(saveSchema)
  .min(1, "삭제할 데이터가 없습니다.");
