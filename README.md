# hospital-server

병원 관리 시스템 백엔드 API 서버. 인사·재무·구매·재고·자산·시설·예약·병동·보험청구·통계를
다루는 병원 운영 ERP.

## 기술 스택

- **Node.js + Fastify 4** (ESM)
- **Prisma 5 + MySQL** (`utf8mb4`)
- **JWT** 인증, **zod** 검증
- `@fastify/multipart` 파일 업로드

## 구조

- `server/index.js` — 앱 진입점 (포트 **3003**)
- `server/routes/*.js` — POST-RPC 라우트. 파일명이 곧 엔드포인트 → `/api/<name>`
- `server/services/*.js` — 비즈니스 로직
- `server/validators/*.schema.js` — zod 요청 스키마
- `prisma/schema.prisma` — 데이터 모델

현재 구현된 코어:

- **인증·권한(RBAC)** — 계정·역할·권한, IP 화이트리스트, 감사 로그, 알림
- **게시판** — 글·댓글·첨부·공지(`board`/`post`/`comment`), 태그
- **FAQ** — 질문·분류
- **다국어** — 언어팩, 자동 번역

병원 도메인은 순차적으로 추가한다. 의존 순서는
`docs/superpowers/specs/2026-07-09-hospital-foundation-design.md` 참고.

## 시작하기

```bash
npm install
cp .env.example .env      # DATABASE_URL, API_KEY, JWT_SECRET, MAIL_KEY
npm run prisma db push
npm run seed              # 기본 관리자 계정 (admin / admin12)
npm run seed:rbac         # 권한 + 관리자 역할
npm run seed:board        # 기본 게시판(공지사항/자유게시판)
npm run dev
```

프론트엔드는 [hospital_frontend](https://github.com/wjd6542-del/hospital_frontend) 참고.
