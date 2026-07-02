import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// 로그인 인증
export const loginSchema = z.object({
  username: z.string().min(1, "아이디를 입력하세요"),
  password: z
    .string()
    .min(6, "비밀번호는 6자리 이상입니다")
    .regex(/^[A-Za-z0-9]+$/, "비밀번호는 영문과 숫자만 가능합니다")
    .refine((val) => /[A-Za-z]/.test(val) && /\d/.test(val), {
      message: "비밀번호는 영문 + 숫자 조합이어야 합니다",
    }),
});

// 신규 계정 생성 / 수정
export const saveSchema = z
  .object({
    name: z.string().min(1, "이름을 입력하세요"),

    username: z.string().min(1, "아이디를 입력하세요"),

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
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["passwordConfirm"],
  });

// 비밀번호 변경
export const changePassword = z
  .object({
    old_password: z
      .string()
      .min(6, "기존 비밀번호는 6자리 이상입니다")
      .regex(/^[A-Za-z0-9]+$/, "비밀번호는 영문과 숫자만 가능합니다")
      .refine((val) => /[A-Za-z]/.test(val) && /\d/.test(val), {
        message: "비밀번호는 영문 + 숫자 조합이어야 합니다",
      }),
    new_password: z
      .string()
      .min(6, "신규 비밀번호는 6자리 이상입니다")
      .regex(/^[A-Za-z0-9]+$/, "비밀번호는 영문과 숫자만 가능합니다")
      .refine((val) => /[A-Za-z]/.test(val) && /\d/.test(val), {
        message: "비밀번호는 영문 + 숫자 조합이어야 합니다",
      }),
    new_confirm_password: z
      .string()
      .min(6, "비밀번호 확인은 6자리 이상입니다")
      .regex(/^[A-Za-z0-9]+$/, "비밀번호는 영문과 숫자만 가능합니다")
      .refine((val) => /[A-Za-z]/.test(val) && /\d/.test(val), {
        message: "비밀번호는 영문 + 숫자 조합이어야 합니다",
      }),
  })
  .refine((data) => data.new_password === data.new_confirm_password, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["new_confirm_password"],
  });

// 비밀번호 찾기
export const sendCodeSchema = z.object({
  email: z
    .string()
    .min(1, "이메일을 입력하세요")
    .email("올바른 이메일 형식이 아닙니다"),
});

// 인증코드 비밀번호 변경처리
export const codePasswordChangeSchema = z
  .object({
    code: z.string().min(1, "코드를 입력하세요"),

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
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["passwordConfirm"],
  });
