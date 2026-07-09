# 병원 관리 시스템 — 기반 정리 설계

작성일: 2026-07-09
대상 리포지토리: `hospital_server`, `hospital_frontend`

## 배경

`hospital_server`와 `hospital_frontend`는 각각 `cs_server`, `cs_frontend`를 복제한 것이다.
두 리포 모두 git remote가 아직 `cs_*`를 가리키고 있고, `package.json`의 `name`도 `cs-server` /
`cs-frontend` 그대로다. 이 상태로 push하면 운영 중인 CS 프로젝트를 덮어쓴다.

최종 목표는 인사·재무/회계·구매·재고·자산·시설관리·예약·병동·보험/청구·통계 열 개 영역을
갖춘 병원 관리 시스템이다. 이 열 개는 독립적인 서브시스템이므로 하나의 설계 문서로 묶지 않는다.
본 문서는 **첫 번째 사이클: 기반 정리**만 다룬다.

## 목표

CS 도메인을 완전히 제거하고, 재사용 가능한 코어 위에 병원 도메인을 얹을 수 있는 깨끗한
출발점을 만든다. 테마를 병원 업무에 맞는 "클리니컬 뉴트럴"로 재구성한다.

## 범위에 포함되지 않는 것

- 열 개 병원 도메인의 구현. 각각 별도의 스펙 → 계획 → 구현 사이클을 갖는다.
- 마스터 데이터(환자·직원·부서·품목·공급업체·병실) 모델링. 아래 IA 절에 지도만 남긴다.
- 홈 대시보드의 실제 위젯. 보여줄 지표가 아직 없다.
- 테스트 인프라. 지울 코드에 테스트를 붙이는 것은 낭비이며, 다음 사이클에서 첫 실제
  기능과 함께 시작한다.
- 기존 `cs_system` DB. 읽지도 쓰지도 않는다.
- git 히스토리 정리. CS 커밋 히스토리는 그대로 둔다. 필요해지면 나중에
  `git checkout --orphan`으로 한 번에 끊을 수 있다.

## 접근 방식

**제자리 철거(in-place teardown)**를 택한다. 현재 리포에서 CS 파일을 지우고, 스키마를 수술하고,
토큰을 재설계한다.

대안이었던 "백지 이식"(빈 프로젝트에 코어만 복사)은 옮길 파일이 백엔드 약 40개 + 프론트 약 30개고,
`prismaAuditMiddleware` · `auditContext` 같은 암묵적 결합이 조용히 누락되면 런타임에서야 터진다.

제자리 철거가 안전한 근거는 실측으로 확인했다. **남길 서비스 14개(`auth`, `user`, `role`,
`permission`, `auditLog`, `notification`, `settings`, `board`, `post`, `comment`, `tag`,
`langPack`, `faq`, `faqCategory`) 중 삭제 대상 도메인을 참조하는 것은 하나도 없다.**
(`upload`는 라우트만 있고 서비스 파일이 없다.)

결합은 정확히 세 곳에만 있다.

1. `prisma/schema.prisma` — `Tag` 모델이 `tickets SupportTicket[]` 관계를 보유
2. `prisma/schema.prisma` — `Tag.color`의 기본값이 `#7a5cff` (픽셀 팔레트 잔재)
3. `hospital_frontend/src/router/index.ts` — `/settings` 라우트 권한이
   `["gameCompany.view", "vendor.view", "permission.menu.view"]`

## 유지 / 삭제 경계

| 성격 | 모듈 |
| --- | --- |
| 유지 (코어) | `auth`, `user`, `role`, `permission`, `auditLog`, `notification`, `settings`, `upload`, `board` / `post` / `comment`, `tag`, `langPack`, `faq` / `faqCategory` |
| 삭제 (CS 전용) | `gameCompany`, `vendor`, `ledger`, `settlement`, `support`, `supportDesk`, `supportTarget`, `exchangeRate` |

## 백엔드 변경

### 파일 삭제 (18개)

`server/index.js`가 `routes/` 디렉터리를 스캔해 라우트를 자동 등록하므로, 파일을 지우면
엔드포인트가 사라진다. 등록 코드를 손댈 필요가 없다.

- `server/routes/` — `gameCompany.js`, `vendor.js`, `ledger.js`, `settlement.js`,
  `support.js`, `supportDesk.js`, `supportTarget.js`, `exchangeRate.js` (8개)
- `server/services/` — 위와 동일한 8개 `*.service.js`
- `server/validators/` — 위 중 `exchangeRate`를 제외한 7개 `*.schema.js`
- `server/cron/exchangeRate.cron.js` (1개)

`server/index.js`에서 `import { startExchangeRateCron }` 줄과 `startExchangeRateCron()`
호출을 제거한다. `server/cron/` 디렉터리는 비게 된다.

### Prisma 스키마

삭제할 모델 9개: `GameCompany`, `Vendor`, `LedgerEntry`, `Settlement`, `SupportTicket`,
`SupportMessage`, `SupportDesk`, `SupportTarget`, `ExchangeRate`

삭제할 enum 4개: `LedgerType`, `SettlementType`, `SettlementStatus`, `TicketStatus`

`Tag` 모델을 두 군데 고친다.

- `tickets SupportTicket[]` 관계 줄 제거 — 없으면 스키마가 컴파일되지 않는다
- `color`의 기본값을 `#7a5cff`에서 `#64748b`(중성 슬레이트)로 변경

`Faq.category`는 FK가 아니라 `FaqCategory.name`을 가리키는 문자열이므로 손대지 않는다.
스키마는 623줄에서 약 330줄로 줄어든다.

### 권한 카탈로그

`prisma/seed-rbac.js`(15개)와 프론트엔드 라우터·사이드바(`gameCompany.view`,
`permission.menu.view`, `permission.user.view` 3개 추가)를 합쳐, 실제로 쓰이는 권한 코드는
18개다. 9개를 버리고 9개를 남긴다.

- 삭제: `ledger.view`, `ledger.edit`, `settlement.view`, `settlement.edit`,
  `support.view`, `support.edit`, `vendor.view`, `vendor.edit`, `gameCompany.view`
- 유지: `board.view`, `board.write`, `faq.view`, `faq.edit`, `usermanager.view`,
  `usermanager.create`, `usermanager.update`, `permission.menu.view`, `permission.user.view`

병원 도메인 권한(`hr.*`, `inventory.*` 등)은 해당 도메인 사이클에서 그 도메인과 함께 추가한다.
지금 미리 만들면 아무도 쓰지 않는 권한 행이 DB에 쌓인다.

`prisma/seed-rbac.js`를 위 카탈로그에 맞춰 다시 쓴다. 예시 역할 "정산담당"과 "CS담당"은
제거하고, 초기에는 관리자 역할 하나만 시드한다.

### 환경·메타데이터

- `package.json`의 `name` → `hospital-server`
- `README.md` 전면 재작성 (병원 관리 기준)
- `.env` / `.env.example`의 `DATABASE_URL` 스키마명 → `hospital_system`
- git remote → `https://github.com/wjd6542-del/hospital_server.git`

새 DB에 `prisma db push`로 스키마를 심고 시드를 돌린다.

## 프론트엔드 변경

### 파일 삭제

- 페이지 디렉터리 — `pages/exchange/`, `pages/ledger/`, `pages/settlement/`, `pages/support/`
- 설정 페이지 — `pages/settings/GameCompanySettings.vue`, `VendorSettings.vue`,
  `SupportDeskSettings.vue`
- 컴포넌트 — `components/base/BaseTable.vue`, `DaumPostcodeModal.vue` (둘 다 현재
  사용처가 없는 죽은 코드), `EntityTree.vue` (`SupportTarget` 트리 전용이었음)

`pages/faq/`와 `pages/settings/FaqCategorySettings.vue`는 유지한다.

`DatePicker.vue`와 `DateRangePicker.vue`는 철거 후 고아가 되지만 유지한다. 예약·근태·통계
도메인에서 거의 확실히 필요하며, v-calendar 래퍼라 재작성 비용이 적지 않다.

### `api/cs.ts` 분해

`api/cs.ts`(126줄)는 삭제 대상 9개와 유지 대상 4개가 섞여 있어 파일째 지울 수 없다.

- 신규 `api/faq.ts` ← `faqApi`, `faqCategoryApi`
- 신규 `api/settings.ts` ← `tagApi`, `langPackApi`
- 삭제: `gameCompanyApi`, `supportDeskApi`, `supportTargetApi`, `makeTargetTreeApi`,
  `vendorApi`, `ledgerApi`, `settlementApi`, `supportApi`, `exchangeRateApi`
- `api/cs.ts` 파일 삭제

`api/api.ts`, `api/admin.ts`, `api/board.ts`는 그대로 둔다.

### 라우터와 사이드바

`router/index.ts`에서 삭제된 페이지를 가리키는 라우트를 제거한다: `/ledger`,
`/settlement/vendor`, `/settlement/gameco`, `/support/:deskCode`, `/exchange`.

`/settings` 라우트의 `meta.perm`을 `["permission.menu.view"]`로 축소한다.

`components/layout/AppSidebar.vue`에서:

- "정산 관리" 그룹과 "CS 관리" 그룹, "환율 정보" 항목 제거
- `supportDeskApi.list()`로 데스크를 동적 로드하던 코드(`desks` ref 포함) 제거
- **FAQ를 최상위 메뉴로 승격** — 기존에 "CS 관리" 그룹 하위에 있었으므로, 그룹을 지우면
  함께 사라진다
- "환경설정" 항목의 `perm` 배열을 `["permission.menu.view"]`로 축소

철거 후 남는 화면: 로그인, 대시보드(홈), 게시판, FAQ, 알림, 마이페이지, 계정 관리(계정 권한 ·
화이트 아이피), 환경설정(게시판 · FAQ 분류 · 태그 · 다국어 · 역할).

## 테마 재설계

### 방향

**클리니컬 뉴트럴 — Slate + Clinical Blue.** 밝은 청회색 중성 위계에 표준 의료 블루.
고밀도 데이터 테이블 가독성을 우선한다.

다크 모드는 유지한다. 토큰 이름은 그대로 두고 `html.dark`에서 값만 재정의한다.
`stores/theme.ts`는 이미 잘 동작하므로 손대지 않는다.

### 토큰

현재 토큰 이름은 도메인에 오염되어 있다. `--seal`(인장) · `--hanji`(한지)는 족보 시스템
유산이고, `--flow-in` / `--flow-out`은 CS 정산의 "회수/지급" 개념이다. `--font-pixel`과
`--shadow-hard`(블러 없는 오프셋 그림자)는 픽셀 테마 전용이다. 값만 바꾸면 이름이 계속
거짓말을 한다. 따라서 의미 기반으로 재정의한다.

| 역할 | 새 토큰 | 라이트 값 | 폐기되는 옛 토큰 |
| --- | --- | --- | --- |
| 배경 | `--canvas` | `#f8fafc` | `--paper`, `--hanji` |
| 표면 | `--surface`, `--surface-2` | `#ffffff`, `#f1f5f9` | `--hanji-deep` |
| 경계 | `--border`, `--border-strong` | `#e2e8f0`, `#cbd5e1` | `--line`, `--line-strong`, `--line-hard` |
| 본문 | `--text`, `--text-muted`, `--text-subtle` | `#0f172a`, `#475569`, `#64748b` | `--ink`, `--ink-soft`, `--ink-muted`, `--ink-faint` |
| 액센트 | `--accent`, `--accent-hover`, `--accent-soft` | `#2563eb`, `#1d4ed8`, `#eff6ff` | `--seal`, `--seal-deep`, `--seal-grad`, `--gold` |
| 포커스 링 | `--ring` | `0 0 0 3px rgba(37,99,235,.25)` | (동명, 값 교체) |
| 상태 · 정상 | `--positive`, `--positive-soft`, `--positive-line` | `#059669`, `#d1fae5`, `#a7f3d0` | `--flow-in`, `--flow-in-bg` |
| 상태 · 주의 | `--warning`, `--warning-soft`, `--warning-line` | `#d97706`, `#fef3c7`, `#fde68a` | `--flow-out`, `--flow-out-bg` |
| 상태 · 위험 | `--danger`, `--danger-soft`, `--danger-line` | `#dc2626`, `#fee2e2`, `#fecaca` | `--danger` (값 교체) |
| 상태 · 정보 | `--info`, `--info-soft`, `--info-line` | `#2563eb`, `#dbeafe`, `#bfdbfe` | — |
| 형태 | `--radius` | `6px` | `--radius: 3px` |
| 그림자 | `--shadow-sm`, `--shadow-md`, `--shadow-lg` | 부드러운 블러 | `--shadow-hard` |
| 서체 | `--font-sans`, `--font-num` | Pretendard, tabular-nums | `--font-pixel` (Galmuri) |

두 가지 원칙이 있다.

**상태색은 액센트와 독립으로 굴린다.** 액센트를 나중에 바꿔도 "입원중 / 미수납" 같은
의미색은 흔들리지 않아야 한다.

**상태 배지에는 `-line` 토큰으로 테두리를 두른다.** 색을 못 보는 상황(흑백 인쇄, 색각 이상)에서도
상태가 구분된다. 수납·보험청구 서류를 출력하는 병원 업무에서 실질적 이점이 있다.

### 하드코딩 hex 정리

**28개 `.vue` 파일**에 hex 색상이 박혀 있다 (베이스 컴포넌트 11 + 레이아웃 2 + 유지 페이지 15).
`#7a5cff`(아케이드 바이올렛)가 17회, `#ede9ff`가 15회 등장한다. 이를 토큰 참조로 치환한다.

hex를 가진 나머지 7개 파일은 삭제 대상 페이지이므로 자연 소멸한다.

정리하지 않으면 앞으로 도메인을 얹을 때마다 어느 색을 써야 할지 매번 헷갈리고, 화면마다
색이 갈라진다.

### Tailwind 설정

`tailwind.config.js`는 현재 `theme.extend`가 비어 있어 토큰이 유틸리티 클래스로 노출되지 않는다.
`theme.extend.colors`에 CSS 변수를 매핑해 `bg-surface`, `text-muted`, `border-border` 같은
클래스를 쓸 수 있게 한다. `fontFamily`와 `borderRadius`도 함께 매핑한다.

### 메타데이터

- `package.json`의 `name` → `hospital-frontend`
- git remote → `https://github.com/wjd6542-del/hospital_frontend.git`

## 검증

이 프로젝트에는 테스트가 없다. `test/` 디렉터리는 비어 있고 `npm test`는 아무것도 실행하지 않는다.
"테스트가 통과하니 안전하다"는 주장은 여기서 성립하지 않는다.

철거 작업의 실패 양상은 **지운 것을 아직 참조하는 곳이 남아 import가 터지는 것**이다.
이는 타입 체크와 실행으로 잡힌다.

- **백엔드** — `npx prisma validate`로 스키마 컴파일 확인. `npm run dev`로 서버 기동 후
  라우트 로그에 죽은 엔드포인트가 없는지 확인. 새 DB에서 `prisma db push`와 시드 실행.
- **프론트엔드** — `npm run build`가 곧 검증이다. `vue-tsc`가 앞단에 붙어 있어 삭제된
  모듈을 import하는 곳이 남아 있으면 빌드가 실패한다. 현재 가진 가장 강력한 안전망이다.
- **수동 확인** — 로그인 → 대시보드 → 게시판 글쓰기 → FAQ → 환경설정 각 탭을 실제로 클릭한다.
  특히 환경설정은 권한 배열을 수정하므로 진입 자체가 막힐 수 있어 반드시 눈으로 확인한다.

## 실행 순서

각 커밋은 그 시점에 빌드가 통과해야 한다.

1. remote · `package.json` name · README · `.env` DB명 교체 (양쪽 리포, 코드 변경 없음)
2. 백엔드 — 파일 18개 삭제 + `index.js`의 크론 두 줄 제거
3. 백엔드 — Prisma 스키마 정리 (모델 9 + enum 4 삭제, `Tag` 수정), 새 DB에 push
4. 백엔드 — 권한 카탈로그 축소, `seed-rbac.js` 재작성
5. 프론트 — `api/cs.ts` 분해 → `api/faq.ts` + `api/settings.ts`
6. 프론트 — 페이지 7개 + 고아 컴포넌트 3개 삭제, 라우터 · 사이드바 정리
7. 테마 — `tailwind.css` 토큰 재설계 + 다크 짝 + `tailwind.config.js` 매핑
8. 테마 — 28개 파일의 hex를 토큰 참조로 치환

2번과 3번의 순서가 중요하다. 라우트/서비스를 먼저 지우면 서버는 뜨고 죽은 테이블만 남는다.
스키마를 먼저 지우면 서비스가 없는 모델을 참조해 즉시 터진다. **파일 삭제가 스키마 정리보다
앞서야 한다.**

## 정보구조 지도 (코드로 만들지 않음)

다음 사이클에서 무엇을 먼저 지어야 하는지 알기 위한 지도다. 죽은 라우트는 만들지 않는다.

### 공유 마스터 데이터

| 마스터 | 소비하는 도메인 |
| --- | --- |
| 부서 (Department) | 인사, 재무/회계, 구매, 자산, 통계 |
| 직원 (Employee) | 인사, 구매(승인자), 예약(담당의), 병동, 통계 |
| 품목 (Item) | 구매, 재고, 자산 |
| 공급업체 (Supplier) | 구매, 재고, 시설관리(수리) |
| 환자 (Patient) | 예약, 병동, 보험/청구, 통계 |
| 병실 · 병상 (Room / Bed) | 병동, 예약(수술), 통계 |

### 도메인 의존 순서

1. **부서 · 직원 마스터** — 거의 모든 도메인의 전제
2. **인사(HR)** — 직원 마스터 위에 근태 · 교대 · 급여 · 평가 · 교육
3. **품목 · 공급업체 마스터 → 구매 → 재고** — 구매 입고가 재고의 유일한 입력원
4. **자산 → 시설관리** — 장비 마스터 없이는 점검 이력이 붙을 곳이 없음
5. **환자 마스터 → 예약 → 병동** — 예약이 입원의 선행 사건
6. **보험/청구** — 병동(입원 기간) · 예약(진료 내역)이 청구의 근거
7. **재무/회계** — 구매(지출) · 청구(수입)가 회계 전표의 원천
8. **통계** — 나머지 전부가 있어야 의미가 있음

한 사이클에 한 단계씩, 각각 스펙 → 계획 → 구현으로 진행한다.
