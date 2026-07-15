# 재무(Finance) 도메인 — 수입·지출 장부 MVP 설계

- 작성일: 2026-07-15
- 대상: hospital_server (Fastify + Prisma/MySQL) · hospital_frontend (Vue 3)
- 상태: 승인됨 (사용자 "진행")

## 1. 목표와 범위

병원 관리 시스템에 **재무** 도메인을 신설한다. 첫 슬라이스는 **계정과목 기반 수입·지출 거래 등록/조회 + 월간 집계**(단식부기)다. 병원 수익(수납·보험청구)과 급여는 별도 도메인이므로, 재무는 "내부 회계 장부" 성격으로 한정한다.

기존 HR 도메인과 동일한 아키텍처를 따른다: `prisma model · validator(zod) · service · route` 4종 세트 + 프론트 `api · view · router · sidebar · perm`.

## 2. 데이터 모델 (Prisma, MySQL, `db push`)

신규 모델 3개 + `Department`에 역관계 1줄 추가.

### AccountItem (계정과목)
관리형 룩업(ShiftType/Category 스타일).
- `id Int @id @default(autoincrement())`
- `type String` — `INCOME` | `EXPENSE`
- `name String @db.VarChar(100)` — 표시명
- `is_active Boolean @default(true)`
- `sort Int @default(0)`
- `created_at` / `updated_at`
- 역관계: `transactions FinanceTransaction[]`
- `@@unique([type, name])`, `@@index([type, sort])`

### FinanceTransaction (수입·지출 거래)
- `id`
- `txn_date DateTime @db.Date` — 거래 일자
- `type String` — `INCOME` | `EXPENSE` (account_item.type 와 일치하도록 서버에서 검증)
- `account_item_id Int` → `AccountItem`
- `amount Decimal @db.Decimal(15, 2)` — KRW. API는 number 로 직렬화
- `department_id Int?` → `Department` (비용센터, 선택)
- `vendor String? @db.VarChar(120)` — 거래처(간단 문자열)
- `method String` — `CASH` | `TRANSFER` | `CARD` | `OTHER`
- `memo String? @db.VarChar(255)`
- `created_at` / `updated_at`
- 역관계: `attachments FinanceAttachment[]`
- 인덱스: `@@index([txn_date])`, `@@index([type])`, `@@index([account_item_id])`, `@@index([department_id])`

### FinanceAttachment (영수증/증빙)
PostAttachment 패턴 그대로.
- `id`
- `transaction_id Int` → `FinanceTransaction` (`onDelete: Cascade`)
- `path String` — `/uploads/finance/…`
- `filename String` · `mime_type String?` · `size Int?` · `is_image Boolean @default(false)`
- `created_at DateTime @default(now())`
- `@@index([transaction_id])`

enum류(`type`, `method`)는 문자열 컬럼 + zod enum 검증 (기존 STATUS 관례와 동일).

## 3. 백엔드

라우트는 `/api/<파일명>` 자동 로드. 전 엔드포인트 POST + `permission()` preHandler + `validate(schema, req.body)`.

### financeAccount.js  (`/api/financeAccount`)
- `/list` (perm `finance.view`) — `{ type?, only_active? }`
- `/save` (perm `finance.edit`) — 신규/수정
- `/delete` (perm `finance.edit`) — 거래가 참조 중이면 비활성 처리 유도(삭제 대신 `is_active=false` 권장, 참조 없으면 삭제)

### financeTxn.js  (`/api/financeTxn`)
- `/list` (perm `finance.view`) — 필터: `date_from`, `date_to`, `type?`, `account_item_id?`, `department_id?`, `q?`(vendor/memo) + `page`, `limit`. include: account_item, department, attachments.
- `/save` (perm `finance.edit`) — 신규/수정. `type` 이 account_item.type 과 일치하는지 검증. 첨부 path 배열 연결.
- `/delete` (perm `finance.edit`)
- `/summary` (perm `finance.view`) — 같은 필터 범위에서 `income_total`, `expense_total`, `net`, `by_account[]`(계정과목별 소계) 반환.

service 2개 / validator 2개. 첨부 업로드는 기존 `upload` 모듈 재사용(`/uploads/finance/`).

금액: DB `Decimal(15,2)`, service 출력 시 `Number(amount)` 로 변환해 프론트는 number 로 다룬다.

## 4. 프론트엔드

### 페이지
- **`/finance/transactions` — 수입·지출 내역** (메인)
  - 상단 집계 카드 3: 수입 합계 · 지출 합계 · 순액 (`/summary`)
  - 필터바(공통 28px 컴포넌트): 기간 `DateRangePicker` · 구분 `SearchSelect` · 계정과목 `SearchSelect` · 부서 `SearchSelect` · 검색 `input` · 검색 버튼 · 등록 버튼
  - 표 `.tbl` + 등록/수정 `BaseModal`: 일자 `DatePicker` · 구분 · 계정과목(구분에 따라 옵션 필터) · 금액 · 부서 · 거래처 · 결제수단 · 메모 · 영수증 첨부
  - 페이지네이션 `Pager`
- **계정과목 관리** → **환경설정 탭** `FinanceAccountSettings.vue` (ShiftTypeSettings 패턴): 구분/이름/정렬/활성 CRUD

### 배선
- `src/api/finance.ts` — `accountApi`, `txnApi`
- 사이드바 "재무" 그룹 (icon `fa-won-sign`), child: 수입·지출 내역 (`perm finance.view`)
- router: `/finance/transactions` (perm `finance.view`)
- 환경설정 탭 목록에 계정과목 관리 추가 (perm `finance.edit` 노출 조건은 기존 탭 규칙 따름)

## 5. 권한 (seed-rbac.js, group "재무")
- `finance.view` — 재무 조회
- `finance.edit` — 재무 편집

슈퍼관리자는 자동 전부 보유. seed-rbac 재실행으로 등록.

## 6. 시드
- `seed-finance.js` — 기본 계정과목 예시:
  - 수입: 진료수입, 건강검진수입, 기타수입
  - 지출: 인건비, 의약품비, 소모품비, 임차료, 공과금, 장비구입, 기타지출

## 7. 범위 밖 (YAGNI)
복식부기·분개전표·원장·시산표, 예산/비용센터 통제, 자금대사·결산, 세금계산서, 급여·보험청구·수납 연계, 거래처 마스터(문자열로 대체), 반복거래, 승인 워크플로우, 다통화, 차트/리포트(→ 통계 도메인).

## 8. 검증
- 백엔드: `npx prisma validate` → `npx prisma db push` → 서버 기동 `Route loaded` 에 `/api/financeAccount`·`/api/financeTxn` 확인 → 로그인 후 `/list`·`/save`·`/summary` 스모크.
- 프론트: `npm run build`(vue-tsc+vite) → 시스템 Chrome + puppeteer-core 로 `admin/admin12` 로그인 → `/finance/transactions` 렌더·등록 플로우 확인.
