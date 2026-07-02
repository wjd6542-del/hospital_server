# cs-server

고객센터 관리용 ERP **cs** 의 백엔드 API 서버. 회사는 **중간 판매자**로서 게임사에 사용료를 지급하고, 업체로부터 사용대금을 회수한다. (족보 시스템 `generation-server` 기반으로 포팅)

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

주요 도메인:

- **인증·권한(RBAC)** — 계정·역할·권한, IP 화이트리스트, 감사 로그, 알림
- **환경설정** — 게임사(`gameCompany`), 업체(`vendor`), 계정·권한 관리
- **지급/회수** — 장부(`ledger`, 지급 PAYMENT / 회수 COLLECTION), 정산(`settlement`, 업체 VENDOR / 게임사 GAME_COMPANY)
- **CS 관리** — 응대(`support`, 업체/게임사 티켓·메시지), 자주 하는 질문(`faq`)
- **게시판** — 글·댓글·첨부·공지(`board`/`post`/`comment`)

## 시작하기

```bash
# 1) 의존성
npm install

# 2) 환경변수
cp .env.example .env      # 값 채우기 (DATABASE_URL, API_KEY, JWT_SECRET, MAIL_KEY)

# 3) DB 스키마 반영
npm run prisma db push

# 4) 시드(선택)
npm run seed              # 기본 관리자 계정 (admin / admin12)
npm run seed:rbac         # 권한·예시 역할(정산담당/CS담당)
npm run seed:board        # 기본 게시판(공지사항/자유게시판)

# 5) 실행
npm run dev               # node server/index.js
npm run dev:watch         # 파일 변경 자동 재시작
```

프론트엔드는 [cs_frontend](https://github.com/wjd6542-del/cs_frontend) 참고.

## 환경변수

| 키 | 설명 |
|---|---|
| `DATABASE_URL` | MySQL 접속 URL |
| `API_KEY` | 모든 `/api/*` 요청의 `x-api-key` (프론트 `VITE_API_KEY`와 동일) |
| `JWT_SECRET` | JWT 서명 시크릿 |
| `MAIL_KEY` | Resend 이메일 API 키 (비밀번호 재설정 메일) |

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 서버 실행 |
| `npm run dev:watch` | 자동 재시작 실행 |
| `npm run seed` / `seed:rbac` / `seed:board` | 시드 |
| `npm test` | `node --test` 테스트 |
