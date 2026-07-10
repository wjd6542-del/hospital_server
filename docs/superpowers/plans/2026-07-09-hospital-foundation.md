# 병원 관리 시스템 기반 정리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CS 도메인을 두 리포에서 완전히 제거하고, 클리니컬 뉴트럴 테마 위에 병원 도메인을 얹을 수 있는 깨끗한 코어를 남긴다.

**Architecture:** 제자리 철거(in-place teardown). 백엔드는 `routes/` 디렉터리 자동 스캔 구조라 파일 삭제만으로 엔드포인트가 사라진다. 프론트엔드는 삭제 → 참조 정리 → 테마 토큰 재설계 → 일괄 치환 순으로 진행한다. 각 커밋은 그 시점에 빌드가 통과해야 한다.

**Tech Stack:** Node.js + Fastify 4 (ESM), Prisma 5 + MySQL, Vue 3 + Vite + Tailwind 3, ag-grid, echarts, Pinia

## Global Constraints

- 브랜치: `hospital-foundation` (양쪽 리포 모두)
- 백엔드 리포: `/Users/wjd/프로젝트/hospital_server`
- 프론트 리포: `/Users/wjd/프로젝트/hospital_frontend`
- 기존 `cs_system` DB는 읽지도 쓰지도 않는다. 새 DB는 `hospital_system`.
- 테스트 프레임워크가 없다. 검증은 `npx prisma validate`, `npm run dev`, `npm run build`(vue-tsc 포함), 수동 클릭으로 한다.
- 새 팔레트 액센트: `#2563eb`. 캔버스: `#f8fafc`. 본문: `#0f172a`.
- 상태색은 액센트와 독립으로 정의한다. 배지에는 `-line` 토큰으로 테두리를 두른다.
- 병원 도메인 권한(`hr.*`, `inventory.*` 등)은 이번 계획에서 추가하지 않는다.
- 커밋 메시지는 한국어. 본문 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## File Structure

**백엔드 (`hospital_server`)**

| 파일 | 처리 |
| --- | --- |
| `server/routes/{gameCompany,vendor,ledger,settlement,support,supportDesk,supportTarget,exchangeRate}.js` | 삭제 (8) |
| `server/services/{동일 8개}.service.js` | 삭제 (8) |
| `server/validators/{gameCompany,vendor,ledger,settlement,support,supportDesk,supportTarget}.schema.js` | 삭제 (7) |
| `server/cron/exchangeRate.cron.js` | 삭제 (1) |
| `server/index.js` | 크론 import·호출 2줄 제거 |
| `prisma/schema.prisma` | 모델 9 + enum 4 삭제, `Tag` 수정 |
| `prisma/seed-rbac.js` | 재작성 (권한 21 → 11, 역할 1개) |
| `package.json`, `README.md`, `.env`, `.env.example` | 메타데이터 |

**프론트 (`hospital_frontend`)**

| 파일 | 처리 |
| --- | --- |
| `src/pages/{exchange,ledger,settlement,support,alerts}/` | 삭제 (디렉터리 5) |
| `src/pages/settings/{GameCompanySettings,VendorSettings,SupportDeskSettings}.vue` | 삭제 (3) |
| `src/stores/alerts.ts` | 삭제 |
| `src/components/base/{BaseTable,DaumPostcodeModal,EntityTree}.vue` | 삭제 (3) |
| `src/api/cs.ts` | 삭제 (분해 후) |
| `src/api/faq.ts` | 신규 — `faqApi`, `faqCategoryApi` |
| `src/api/settings.ts` | 신규 — `tagApi`, `langPackApi` |
| `src/router/index.ts` | 라우트 6개 제거, `/settings` 권한 축소 |
| `src/components/layout/AppSidebar.vue` | 그룹 2개 + 항목 1개 제거, FAQ 승격 |
| `src/components/layout/AppHeader.vue` | 종 아이콘·드롭다운 제거 |
| `src/App.vue` | alerts 폴링 제거 |
| `src/pages/home/HomePage.vue` | 재작성 (440줄 → 게시판 위젯만) |
| `src/pages/settings/SettingsView.vue` | 탭 3개 제거, 기본 탭 변경 |
| `src/assets/tailwind.css` | 토큰 재설계, 죽은 CSS 제거 |
| `tailwind.config.js` | 토큰 → 유틸리티 매핑 |
| 생존 `.vue` 28개 | 옛 토큰·hex 치환 |

---

### Task 1: 리포 메타데이터 교체

remote가 아직 `cs_*`를 가리킨다. 코드를 건드리기 전에 먼저 끊는다. 코드 변경이 없으므로 빌드 검증이 필요 없다.

**Files:**
- Modify: `hospital_server/package.json:2`
- Modify: `hospital_server/.env`, `hospital_server/.env.example`
- Modify: `hospital_server/README.md` (전면 재작성)
- Modify: `hospital_frontend/package.json:2`

**Interfaces:**
- Consumes: 없음
- Produces: DB 스키마명 `hospital_system` — Task 3이 `prisma db push` 대상으로 사용

- [ ] **Step 1: 백엔드 remote 교체**

```bash
cd /Users/wjd/프로젝트/hospital_server
git remote set-url origin https://github.com/wjd6542-del/hospital_server.git
git remote -v
```

Expected: `origin  https://github.com/wjd6542-del/hospital_server.git (fetch)` 와 `(push)` 두 줄.

- [ ] **Step 2: 프론트 remote 교체 + 브랜치 생성**

```bash
cd /Users/wjd/프로젝트/hospital_frontend
git remote set-url origin https://github.com/wjd6542-del/hospital_frontend.git
git checkout -b hospital-foundation
git remote -v && git branch --show-current
```

Expected: remote 두 줄이 `hospital_frontend.git`, 브랜치는 `hospital-foundation`.

- [ ] **Step 3: package.json name 변경 (양쪽)**

`hospital_server/package.json` 2번째 줄:

```json
  "name": "hospital-server",
```

`hospital_frontend/package.json` 2번째 줄:

```json
  "name": "hospital-frontend",
```

- [ ] **Step 4: DB 스키마명 변경**

`hospital_server/.env`와 `.env.example`의 `DATABASE_URL`에서 경로 부분 `/cs_system`을 `/hospital_system`으로 바꾼다. 나머지(호스트·포트·계정·쿼리스트링)는 그대로 둔다.

확인:

```bash
cd /Users/wjd/프로젝트/hospital_server
grep -o '/[a-z_]*?' .env .env.example
```

Expected: 두 파일 모두 `/hospital_system?`

- [ ] **Step 5: 새 DB 생성**

```bash
mysql -u root -h 127.0.0.1 -e "CREATE DATABASE IF NOT EXISTS hospital_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -h 127.0.0.1 -e "SHOW DATABASES LIKE 'hospital_system';"
```

Expected: `hospital_system` 한 줄 출력.

- [ ] **Step 6: README 재작성**

`hospital_server/README.md` 전체를 아래로 교체한다.

````markdown
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
````

- [ ] **Step 7: 커밋 (양쪽)**

```bash
cd /Users/wjd/프로젝트/hospital_server
git add package.json README.md .env.example
git commit -m "$(cat <<'EOF'
메타데이터: cs-server → hospital-server, DB 스키마 hospital_system

git remote를 hospital_server.git으로 교체. README를 병원 관리 기준으로 재작성.
.env는 gitignore 대상이라 .env.example만 커밋.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"

cd /Users/wjd/프로젝트/hospital_frontend
git add package.json
git commit -m "$(cat <<'EOF'
메타데이터: cs-frontend → hospital-frontend

git remote를 hospital_frontend.git으로 교체.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 백엔드 CS 파일 삭제

`server/index.js`가 `routes/`를 디렉터리 스캔해 자동 등록하므로 파일 삭제만으로 엔드포인트가 사라진다. 스키마는 아직 건드리지 않는다 — 순서를 뒤집으면 서비스가 없는 모델을 참조해 즉시 터진다.

**Files:**
- Delete: `server/routes/` 8개, `server/services/` 8개, `server/validators/` 7개, `server/cron/exchangeRate.cron.js`
- Modify: `server/index.js` (크론 2줄 제거)

**Interfaces:**
- Consumes: 없음
- Produces: `/api/{gameCompany,vendor,ledger,settlement,support,supportDesk,supportTarget,exchangeRate}` 엔드포인트 소멸

- [ ] **Step 1: 삭제 전 라우트 로그 기록**

```bash
cd /Users/wjd/프로젝트/hospital_server
npm run dev 2>&1 | grep "Route loaded" | wc -l
```

Expected: `23` (현재 라우트 파일 개수). 확인 후 `Ctrl+C`.

- [ ] **Step 2: 파일 삭제**

```bash
cd /Users/wjd/프로젝트/hospital_server
git rm server/routes/{gameCompany,vendor,ledger,settlement,support,supportDesk,supportTarget,exchangeRate}.js
git rm server/services/{gameCompany,vendor,ledger,settlement,support,supportDesk,supportTarget,exchangeRate}.service.js
git rm server/validators/{gameCompany,vendor,ledger,settlement,support,supportDesk,supportTarget}.schema.js
git rm server/cron/exchangeRate.cron.js
```

- [ ] **Step 3: `server/index.js`에서 크론 제거**

파일 끝부분의 아래 두 곳을 지운다.

```javascript
import { startExchangeRateCron } from "./cron/exchangeRate.cron.js";
```

```javascript
// 환율 일일 자동 수집 크론
startExchangeRateCron();
```

남는 끝부분은 이렇다.

```javascript
await app.ready();
app.listen({ port: Number(process.env.PORT) || 3003, host: "0.0.0.0" });
```

- [ ] **Step 4: 남은 코드가 삭제된 모듈을 참조하지 않는지 확인**

```bash
cd /Users/wjd/프로젝트/hospital_server
grep -rn "exchangeRate\|supportDesk\|supportTarget\|gameCompany\|/vendor\|ledger.service\|settlement.service" server/ || echo "참조 없음"
```

Expected: `참조 없음`

- [ ] **Step 5: 서버 기동 확인**

```bash
npm run dev 2>&1 | grep -E "Route loaded|Error" | head -20
```

Expected: `Route loaded` 15줄. `gameCompany`, `vendor`, `ledger`, `settlement`, `support*`, `exchangeRate`는 없어야 한다. 에러 없음. 확인 후 `Ctrl+C`.

이 시점에 스키마엔 아직 모델이 남아 있으므로 Prisma 클라이언트는 정상 생성된다.

- [ ] **Step 6: 커밋**

```bash
git add -A server/
git commit -m "$(cat <<'EOF'
백엔드: CS 도메인 라우트·서비스·검증기·크론 삭제

gameCompany/vendor/ledger/settlement/support/supportDesk/supportTarget/exchangeRate
24개 파일 제거. index.js는 routes/ 디렉터리를 자동 스캔하므로 등록 코드 수정 불필요.
환율 크론 import·호출만 제거. Prisma 스키마는 다음 커밋에서 정리.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Prisma 스키마 정리

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: Task 2에서 서비스가 사라진 상태
- Produces: `Tag` 모델(관계 필드 `tickets` 없음, `color` 기본값 `#64748b`) — Task 4의 시드가 의존

- [ ] **Step 1: enum 4개 삭제**

`prisma/schema.prisma`에서 아래 enum 블록을 통째로 지운다: `LedgerType`, `SettlementType`, `SettlementStatus`, `TicketStatus`.

- [ ] **Step 2: 모델 9개 삭제**

아래 모델 블록을 통째로 지운다: `GameCompany`, `Vendor`, `SupportDesk`, `SupportTarget`, `LedgerEntry`, `Settlement`, `SupportTicket`, `SupportMessage`, `ExchangeRate`.

"CS ERP 도메인" 섹션 주석 배너도 함께 지운다.

- [ ] **Step 3: `Tag` 모델 수정**

기존:

```prisma
/// 태그 (CS 관리 공통 — 응대/FAQ 다중 태그, 환경설정에서 관리)
model Tag {
  id         Int      @id @default(autoincrement())
  name       String   @unique // 태그명
  color      String   @default("#7a5cff") // 칩 색상(hex)
  sort       Int      @default(0)
  is_active  Boolean  @default(true)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  tickets SupportTicket[]
  faqs    Faq[]

  @@index([sort])
}
```

교체:

```prisma
/// 태그 (FAQ 다중 태그, 환경설정에서 관리)
model Tag {
  id         Int      @id @default(autoincrement())
  name       String   @unique // 태그명
  color      String   @default("#64748b") // 칩 색상(hex)
  sort       Int      @default(0)
  is_active  Boolean  @default(true)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  faqs Faq[]

  @@index([sort])
}
```

- [ ] **Step 4: 스키마 컴파일 검증**

```bash
cd /Users/wjd/프로젝트/hospital_server
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`

만약 `Type "SupportTicket" is neither a built-in type, nor refers to another model` 류의 에러가 나오면 Step 2에서 지우지 못한 관계 필드가 남아 있다는 뜻이다. 에러가 가리키는 줄을 확인한다.

- [ ] **Step 5: 모델 개수 확인**

```bash
grep -cE "^model " prisma/schema.prisma
```

Expected: `17` — 삭제 전 26개에서 9개를 뺀 값.

남는 17개: `Role`, `User`, `Permission`, `RolePermission`, `UserIpWhitelist`, `AuditLog`,
`Notification`, `Settings`, `Category`, `Faq`, `FaqCategory`, `Tag`, `Board`, `Post`,
`PostComment`, `PostAttachment`, `LangPack`.

실제 값이 다르면 삭제 목록을 다시 확인한다.

- [ ] **Step 6: 새 DB에 스키마 반영**

```bash
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.` 및 `Generated Prisma Client`

- [ ] **Step 7: 서버 기동 확인**

```bash
npm run dev 2>&1 | grep -E "Route loaded|Error" | head -20
```

Expected: 15개 라우트, 에러 없음. `Ctrl+C`.

- [ ] **Step 8: 커밋**

```bash
git add prisma/schema.prisma
git commit -m "$(cat <<'EOF'
백엔드: Prisma 스키마에서 CS 모델 9개·enum 4개 제거

GameCompany/Vendor/LedgerEntry/Settlement/SupportTicket/SupportMessage/
SupportDesk/SupportTarget/ExchangeRate 삭제.
Tag는 tickets 관계 제거(없으면 컴파일 실패), color 기본값을 픽셀 팔레트
#7a5cff에서 중성 슬레이트 #64748b로 교체.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 권한 카탈로그 축소와 시드 재작성

현재 `seed-rbac.js`는 권한 21개와 예시 역할 2개("정산담당", "CS담당")를 시드한다. 권한 10개를 버리고 11개를 남기며, 역할은 관리자 하나만 둔다.

**Files:**
- Modify: `prisma/seed-rbac.js` (전면 교체)

**Interfaces:**
- Consumes: Task 3의 정리된 스키마
- Produces: 권한 코드 11개 — 프론트 `router/index.ts`·`AppSidebar.vue`·`SettingsView.vue`가 Task 6에서 참조

- [ ] **Step 1: `prisma/seed-rbac.js` 전면 교체**

```javascript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// [code, name, group] — group 은 UI 권한 편집 화면의 묶음
// 병원 도메인 권한(hr.*, inventory.* 등)은 각 도메인 사이클에서 추가한다.
const PERMS = [
  // 게시판
  ["board.view", "게시판 조회", "게시판"],
  ["board.write", "게시판 작성", "게시판"],
  // FAQ
  ["faq.view", "FAQ 조회", "FAQ"],
  ["faq.edit", "FAQ 편집", "FAQ"],
  // 환경설정
  ["usermanager.view", "계정 조회", "환경설정"],
  ["usermanager.create", "계정 생성", "환경설정"],
  ["usermanager.update", "계정 수정", "환경설정"],
  ["permission.user.view", "역할 조회", "환경설정"],
  ["permission.user.update", "역할 수정", "환경설정"],
  ["permission.menu.view", "권한 조회", "환경설정"],
  ["permission.menu.update", "권한 수정", "환경설정"],
];

async function main() {
  let sort = 0;
  const idByCode = {};
  for (const [code, name, group] of PERMS) {
    const p = await prisma.permission.upsert({
      where: { code },
      update: { name, group, sort },
      create: { code, name, group, sort },
    });
    idByCode[code] = p.id;
    sort++;
  }

  // 카탈로그에서 빠진 권한 행 정리 (CS 도메인 잔재)
  const removed = await prisma.permission.deleteMany({
    where: { code: { notIn: PERMS.map(([code]) => code) } },
  });

  const admin = await prisma.role.upsert({
    where: { name: "관리자" },
    update: {},
    create: { name: "관리자", description: "전체 권한", sort: 1 },
  });

  await prisma.rolePermission.deleteMany({ where: { role_id: admin.id } });
  await prisma.rolePermission.createMany({
    data: PERMS.map(([code]) => ({ role_id: admin.id, permission_id: idByCode[code] })),
  });

  console.log(
    `✅ rbac seed done: ${PERMS.length} perms (removed ${removed.count} stale), role 관리자`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

`deleteMany`가 카탈로그 밖 권한을 지운다. `RolePermission`은 스키마에서 `onDelete: Cascade`인지 확인하고, 아니라면 `rolePermission.deleteMany`를 먼저 호출해야 한다.

- [ ] **Step 2: 캐스케이드 확인**

```bash
cd /Users/wjd/프로젝트/hospital_server
grep -A6 "^model RolePermission" prisma/schema.prisma | grep "permission"
```

Expected: `permission Permission @relation(fields: [permission_id], references: [id], onDelete: Cascade)`

`onDelete: Cascade`가 없으면 Step 1의 `deleteMany` 앞에 아래를 넣는다.

```javascript
  await prisma.rolePermission.deleteMany({
    where: { permission: { code: { notIn: PERMS.map(([code]) => code) } } },
  });
```

- [ ] **Step 3: 시드 실행**

```bash
npm run seed
npm run seed:rbac
npm run seed:board
```

Expected 마지막 줄들:
- `✅ rbac seed done: 11 perms (removed 0 stale), role 관리자`
- `✅ board seed: 공지사항, 자유게시판`

새 DB이므로 `removed 0`이 정상이다.

- [ ] **Step 4: DB에서 권한 개수 확인**

```bash
mysql -u root -h 127.0.0.1 hospital_system -e "SELECT COUNT(*) AS perms FROM Permission; SELECT code FROM Permission ORDER BY sort;"
```

Expected: `perms = 11`, 코드 목록에 `ledger.*`, `settlement.*`, `support.*`, `vendor.*`, `gameCompany.*`가 하나도 없어야 한다.

- [ ] **Step 5: 커밋**

```bash
git add prisma/seed-rbac.js
git commit -m "$(cat <<'EOF'
백엔드: 권한 카탈로그 21 → 11, 시드 역할을 관리자 하나로

ledger/settlement/support/vendor/gameCompany 권한 10개 제거.
faq.* 그룹을 "CS 관리"에서 "FAQ"로 변경. 예시 역할 정산담당/CS담당 제거.
카탈로그 밖 권한 행을 deleteMany로 정리하도록 시드 보강.
병원 도메인 권한은 각 도메인 사이클에서 추가.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `api/cs.ts` 분해

`api/cs.ts`(126줄)는 삭제 대상 9개와 생존 4개가 섞여 있다. 먼저 생존 API를 새 파일로 옮기고 import를 바꾼다. **이 시점에 `cs.ts`는 아직 지우지 않는다** — 삭제 대상 페이지들이 여전히 import하므로 지우면 빌드가 깨진다.

**Files:**
- Create: `src/api/faq.ts`
- Create: `src/api/settings.ts`
- Modify: `src/pages/faq/FaqView.vue:128`
- Modify: `src/pages/settings/FaqCategorySettings.vue:51`
- Modify: `src/pages/settings/TagSettings.vue:53`
- Modify: `src/pages/settings/LangPackSettings.vue:48`
- Modify: `src/components/base/TagSelect.vue:39`
- Modify: `src/stores/i18n.ts:3`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `src/api/faq.ts` → `faqApi { list, popular, categories, get, save, remove }`, `faqCategoryApi { list, save, remove }`
  - `src/api/settings.ts` → `tagApi { list, save, remove }`, `langPackApi { list, save, batchSave, batchDelete, remove, translateText }`

- [ ] **Step 1: `src/api/faq.ts` 생성**

```typescript
// @ts-nocheck
import api from "@/api/api";

// FAQ
export const faqApi = {
  list: (body = {}) => api.post("/faq/list", body).then((r) => r.data),
  popular: (body = {}) => api.post("/faq/popular", body).then((r) => r.data),
  categories: () => api.post("/faq/categories", {}).then((r) => r.data),
  get: (id) => api.post("/faq/get", { id }).then((r) => r.data),
  save: (body) => api.post("/faq/save", body).then((r) => r.data),
  remove: (id) => api.post("/faq/delete", { id }).then((r) => r.data),
};

// FAQ 분류 (환경설정)
export const faqCategoryApi = {
  list: (body = {}) => api.post("/faqCategory/list", body).then((r) => r.data),
  save: (body) => api.post("/faqCategory/save", body).then((r) => r.data),
  remove: (id) => api.post("/faqCategory/delete", { id }).then((r) => r.data),
};
```

- [ ] **Step 2: `src/api/settings.ts` 생성**

```typescript
// @ts-nocheck
import api from "@/api/api";

// 태그 (FAQ 공통)
export const tagApi = {
  list: (body = {}) => api.post("/tag/list", body).then((r) => r.data),
  save: (body) => api.post("/tag/save", body).then((r) => r.data),
  remove: (id) => api.post("/tag/delete", { id }).then((r) => r.data),
};

// 다국어 번역팩
export const langPackApi = {
  list: (body = {}) => api.post("/langPack/list", body).then((r) => r.data),
  save: (body) => api.post("/langPack/save", body).then((r) => r.data),
  batchSave: (rows) => api.post("/langPack/batchSave", rows).then((r) => r.data),
  batchDelete: (rows) => api.post("/langPack/batchDelete", rows).then((r) => r.data),
  remove: (id) => api.post("/langPack/delete", { id }).then((r) => r.data),
  translateText: (text) => api.post("/langPack/translateText", { text }).then((r) => r.data),
};
```

- [ ] **Step 3: import 6곳 교체**

| 파일 | 기존 | 변경 |
| --- | --- | --- |
| `src/pages/faq/FaqView.vue:128` | `import { faqApi, faqCategoryApi } from "@/api/cs";` | `import { faqApi, faqCategoryApi } from "@/api/faq";` |
| `src/pages/settings/FaqCategorySettings.vue:51` | `import { faqCategoryApi } from "@/api/cs";` | `import { faqCategoryApi } from "@/api/faq";` |
| `src/pages/settings/TagSettings.vue:53` | `import { tagApi } from "@/api/cs";` | `import { tagApi } from "@/api/settings";` |
| `src/pages/settings/LangPackSettings.vue:48` | `import { langPackApi } from "@/api/cs";` | `import { langPackApi } from "@/api/settings";` |
| `src/components/base/TagSelect.vue:39` | `import { tagApi } from "@/api/cs";` | `import { tagApi } from "@/api/settings";` |
| `src/stores/i18n.ts:3` | `import { langPackApi } from "@/api/cs";` | `import { langPackApi } from "@/api/settings";` |

- [ ] **Step 4: `cs.ts`에서 옮긴 4개 제거**

`src/api/cs.ts`에서 `faqApi`, `faqCategoryApi`, `langPackApi`, `tagApi` 블록을 지운다. `exchangeRateApi`는 아직 `ExchangeRateView.vue`가 쓰므로 남긴다.

- [ ] **Step 5: 빌드 검증**

```bash
cd /Users/wjd/프로젝트/hospital_frontend
npm run build
```

Expected: 성공. `vue-tsc`가 통과하면 import가 모두 해소된 것이다.

실패하면 놓친 import가 있다는 뜻이다. 확인:

```bash
grep -rn "faqApi\|faqCategoryApi\|tagApi\|langPackApi" src | grep "api/cs"
```

Expected: 결과 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/api/faq.ts src/api/settings.ts src/api/cs.ts src/pages/faq/FaqView.vue src/pages/settings/FaqCategorySettings.vue src/pages/settings/TagSettings.vue src/pages/settings/LangPackSettings.vue src/components/base/TagSelect.vue src/stores/i18n.ts
git commit -m "$(cat <<'EOF'
프론트: api/cs.ts에서 생존 API를 faq.ts·settings.ts로 분리

cs.ts는 삭제 대상 9개와 생존 4개가 섞인 잡동사니였음.
faqApi/faqCategoryApi → api/faq.ts, tagApi/langPackApi → api/settings.ts.
import 6곳 교체. cs.ts 파일 자체는 삭제 대상 페이지들이 아직 참조하므로
다음 커밋에서 함께 제거.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 프론트엔드 CS 전면 제거

이 태스크는 크다. 쪼갤 수 없기 때문이다. `AppHeader`가 `stores/alerts.ts`를, `alerts.ts`가 `api/cs.ts`를, `HomePage`가 `ledgerApi`를 import하므로 **어느 하나만 지우면 빌드가 깨진다.** 중간 상태가 존재하지 않는다.

**핵심 사실:** 프론트의 "알림"은 백엔드 `notification` 모듈이 아니다. `stores/alerts.ts`는 `supportApi.alerts()`를 호출해 미해결 CS 응대 티켓을 가져온다. 프론트는 `/notification/*`를 한 번도 호출하지 않는다. 따라서 알림 UI 전체를 지운다. 백엔드 모듈은 남으며, 실제 알림 화면은 다음 사이클 과제다.

**Files:**
- Delete: `src/pages/{exchange,ledger,settlement,support,alerts}/` (디렉터리 5)
- Delete: `src/pages/settings/{GameCompanySettings,VendorSettings,SupportDeskSettings}.vue`
- Delete: `src/stores/alerts.ts`
- Delete: `src/components/base/{BaseTable,DaumPostcodeModal,EntityTree}.vue`
- Delete: `src/api/cs.ts`
- Modify: `src/router/index.ts`
- Modify: `src/components/layout/AppSidebar.vue`
- Modify: `src/components/layout/AppHeader.vue`
- Modify: `src/App.vue`
- Modify: `src/pages/settings/SettingsView.vue`
- Rewrite: `src/pages/home/HomePage.vue`

**Interfaces:**
- Consumes: Task 4의 권한 코드 11개, Task 5의 `api/faq.ts`·`api/settings.ts`
- Produces: 생존 라우트 — `/`, `/board/:slug`, `/board/:slug/write`, `/post/:id`, `/post/:id/edit`, `/faq`, `/mypage`, `/account/roles`, `/account/whiteip`, `/settings`

- [ ] **Step 1: 파일·디렉터리 삭제**

```bash
cd /Users/wjd/프로젝트/hospital_frontend
git rm -r src/pages/exchange src/pages/ledger src/pages/settlement src/pages/support src/pages/alerts
git rm src/pages/settings/GameCompanySettings.vue src/pages/settings/VendorSettings.vue src/pages/settings/SupportDeskSettings.vue
git rm src/stores/alerts.ts
git rm src/components/base/BaseTable.vue src/components/base/DaumPostcodeModal.vue src/components/base/EntityTree.vue
git rm src/api/cs.ts
```

- [ ] **Step 2: `src/router/index.ts` 교체**

```typescript
// @ts-nocheck
import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

import RootLayout from "@/layouts/RootLayout.vue";
import AuthLayout from "@/layouts/AuthLayout.vue";
import MainLayout from "@/layouts/MainLayout.vue";

import LoginPage from "@/pages/auth/LoginPage.vue";
import HomePage from "@/pages/home/HomePage.vue";

import BoardView from "@/pages/board/BoardView.vue";
import PostDetailView from "@/pages/board/PostDetailView.vue";
import PostEditView from "@/pages/board/PostEditView.vue";

import FaqView from "@/pages/faq/FaqView.vue";

import MyPage from "@/pages/mypage/MyPage.vue";
import SettingsView from "@/pages/settings/SettingsView.vue";
import AccountSettings from "@/pages/settings/AccountSettings.vue";
import WhiteIpSettings from "@/pages/settings/WhiteIpSettings.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: RootLayout,
      children: [
        {
          path: "login",
          component: AuthLayout,
          children: [{ path: "", component: LoginPage }],
        },
        {
          path: "",
          component: MainLayout,
          children: [
            { path: "", component: HomePage, meta: { auth: true, title: "대시보드" } },

            { path: "faq", component: FaqView, meta: { auth: true, title: "자주 하는 질문", perm: "faq.view" } },

            // 게시판
            { path: "board/:slug", component: BoardView, meta: { auth: true, title: "게시판", perm: "board.view" } },
            { path: "board/:slug/write", component: PostEditView, meta: { auth: true, title: "글쓰기", perm: "board.write" } },
            { path: "post/:id", component: PostDetailView, meta: { auth: true, title: "게시글", perm: "board.view" } },
            { path: "post/:id/edit", component: PostEditView, meta: { auth: true, title: "글 수정", perm: "board.write" } },

            { path: "mypage", component: MyPage, meta: { auth: true, title: "마이페이지" } },
            { path: "account/roles", component: AccountSettings, meta: { auth: true, title: "계정 권한", perm: ["usermanager.view", "permission.user.view"] } },
            { path: "account/whiteip", component: WhiteIpSettings, meta: { auth: true, title: "화이트 아이피", perm: "usermanager.view" } },
            { path: "settings", component: SettingsView, meta: { auth: true, title: "환경설정", perm: ["permission.menu.view"] } },
          ],
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!auth.isLoaded) return true;
  if (to.path === "/login") return true;
  if (to.meta.auth && !auth.user) return "/login";
  // 권한 체크: meta.perm(문자열 또는 배열) 중 하나라도 보유해야 접근 (super는 항상 통과)
  const perm = to.meta.perm as string | string[] | undefined;
  if (perm && auth.user) {
    const codes = Array.isArray(perm) ? perm : [perm];
    if (!codes.some((c) => auth.hasPermission(c))) return "/";
  }
  return true;
});

export default router;
```

- [ ] **Step 3: `AppSidebar.vue`의 `<script setup>` 상단부 교체**

`import { supportDeskApi } from "@/api/cs";` 줄을 삭제하고, `desks` ref·`menus`·`expanded`·`load`를 아래로 바꾼다.

```typescript
const boards = ref([]);
const expanded = reactive({ 게시판: false });

const menus = computed(() => [
  { label: "대시보드", to: "/", icon: "fa-gauge-high", exact: true },
  { label: "게시판", icon: "fa-clipboard-list", perm: "board.view", children: boards.value.map((b) => ({ label: b.name, to: `/board/${b.slug}` })) },
  { label: "자주 하는 질문", to: "/faq", icon: "fa-circle-question", perm: "faq.view" },
  {
    label: "계정 관리",
    icon: "fa-users-gear",
    children: [
      { label: "계정 권한", to: "/account/roles", perm: ["usermanager.view", "permission.user.view"] },
      { label: "화이트 아이피", to: "/account/whiteip", perm: "usermanager.view" },
    ],
  },
  { label: "환경설정", to: "/settings", icon: "fa-gear", perm: ["permission.menu.view"] },
]);
```

`load()`에서 desks 줄을 지운다.

```typescript
async function load() {
  try { boards.value = await boardApi.list(); } catch (e) { boards.value = []; }
}
```

FAQ가 "CS 관리" 그룹 하위에 있었으므로, 그룹을 지우면서 최상위로 승격했다.

- [ ] **Step 4: `AppHeader.vue`에서 종 제거**

템플릿에서 `<div ref="bellWrap" class="bell-wrap">` 요소 전체(내부 `<button class="bell">`과 `<div v-if="bellOpen" class="dropdown">` 포함)를 지운다.

스크립트에서 아래를 지운다.

```typescript
import { useAlertsStore } from "@/stores/alerts";
```
```typescript
const alerts = useAlertsStore();
```
```typescript
const bellOpen = ref(false);
const bellWrap = ref(null);
```
```typescript
function toggleBell() { bellOpen.value = !bellOpen.value; acctOpen.value = false; if (bellOpen.value) alerts.fetch(); }
```

그리고 `toggleLang()`·`toggleAcct()`·바깥 클릭 핸들러·`onMounted`·`watch`에 남은 `bellOpen`·`alerts` 참조를 제거한다. `openTicket()` 함수도 지운다.

`bell` / `bell-wrap` / `dropdown` / `dt` / `dall` / `dnone` / `drow` 관련 `<style scoped>` 규칙도 함께 지운다.

- [ ] **Step 5: `App.vue`에서 폴링 제거**

아래 세 곳을 지운다.

```typescript
import { useAlertsStore } from "@/stores/alerts";
```
```typescript
const alerts = useAlertsStore();
```
```typescript
  (t) => { if (t) alerts.startPolling(30000); else alerts.stopPolling(); },
```

세 번째는 `watch(...)` 콜백이므로, 해당 `watch` 블록이 alerts 전용이면 블록째 지운다. 다른 일도 한다면 alerts 줄만 지운다. 실제 코드를 열어 확인한다.

- [ ] **Step 6: `SettingsView.vue` 탭 정리**

import 3줄을 지운다.

```typescript
import GameCompanySettings from "@/pages/settings/GameCompanySettings.vue";
import VendorSettings from "@/pages/settings/VendorSettings.vue";
import SupportDeskSettings from "@/pages/settings/SupportDeskSettings.vue";
```

`tabs` 배열을 교체한다.

```typescript
const tabs = [
  { key: "board", label: "게시판", icon: "fa-clipboard-list", superOnly: true, comp: markRaw(BoardSettings), desc: "게시판을 만들고 권한(읽기/쓰기)·댓글·첨부 허용을 설정합니다." },
  { key: "faqcat", label: "FAQ 분류", icon: "fa-tags", perm: "faq.view", comp: markRaw(FaqCategorySettings), desc: "자주 하는 질문의 분류를 등록·관리합니다. FAQ 작성 시 이 분류를 선택합니다." },
  { key: "tag", label: "태그", icon: "fa-tag", perm: "faq.view", comp: markRaw(TagSettings), desc: "FAQ에 붙이는 공통 태그를 등록·관리합니다. 검색 중 없으면 즉시 만들 수도 있습니다." },
  { key: "lang", label: "다국어", icon: "fa-language", superOnly: true, comp: markRaw(LangPackSettings), desc: "화면 문구의 다국어 번역팩을 등록·관리합니다. 한국어를 키로 사용합니다." },
];
```

기본 활성 탭을 바꾼다.

```typescript
const active = ref(visibleTabs.value[0]?.key || "board");
```

`tag` 탭의 `perm`이 `["support.view", "faq.view"]`였는데 `support.view`가 사라졌으므로 `"faq.view"` 단일 문자열로 축소했다.

- [ ] **Step 7: `HomePage.vue` 재작성**

기존 440줄은 `ledgerApi`·`settlementApi`·`supportApi`·`supportDeskApi` 위젯이 대부분이다. 살아남는 것은 게시판 최근 글뿐이므로 전체를 아래로 교체한다. 지표 위젯은 넣지 않는다 — 보여줄 데이터가 없다.

```vue
<template>
  <div class="home">
    <header class="phead">
      <h1 class="ttl">{{ $t("대시보드") }}</h1>
      <p class="sub">{{ auth.user?.name || auth.user?.username }}{{ $t("님, 환영합니다.") }}</p>
    </header>

    <div v-if="canBoard" class="grid">
      <section v-for="b in widgets" :key="b.slug" class="pcard widget">
        <header class="whead">
          <h2 class="wttl">{{ b.name }}</h2>
          <RouterLink :to="`/board/${b.slug}`" class="wmore">{{ $t("더보기 ›") }}</RouterLink>
        </header>

        <ul v-if="b.posts.length" class="wlist">
          <li v-for="p in b.posts" :key="p.id">
            <RouterLink :to="`/post/${p.id}`" class="wrow">
              <span class="wtitle">{{ p.title }}</span>
              <span class="wdate">{{ fmt(p.created_at) }}</span>
            </RouterLink>
          </li>
        </ul>
        <EmptyState v-else :message="$t('게시글이 없습니다.')" />
      </section>
    </div>

    <EmptyState v-else :message="$t('표시할 항목이 없습니다.')" />
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, computed, onMounted } from "vue";
import EmptyState from "@/components/base/EmptyState.vue";
import { useAuthStore } from "@/stores/auth";
import { boardApi } from "@/api/board";
import { formatDateDot as fmt } from "@/utils/date";

const auth = useAuthStore();
const canBoard = computed(() => auth.hasPermission("board.view"));

// 대시보드에 요약을 띄울 게시판 slug (seed-board 기준)
const SLUGS = ["notice", "free"];
const widgets = ref([]);

async function loadBoard(slug) {
  const board = await boardApi.get(slug);
  const res = await boardApi.postList(board.id, 1, 5);
  return {
    slug,
    name: board.name,
    posts: [...(res.notices || []), ...(res.rows || [])].slice(0, 5),
  };
}

onMounted(async () => {
  if (!canBoard.value) return;
  const loaded = [];
  for (const slug of SLUGS) {
    try {
      loaded.push(await loadBoard(slug));
    } catch (e) {
      /* 게시판이 없으면 위젯을 건너뛴다 */
    }
  }
  widgets.value = loaded;
});
</script>

<style scoped>
.home { max-width: 1000px; margin: 0 auto; }
.phead { margin-bottom: 1.1rem; }
.ttl { font-size: 1.5rem; font-weight: 800; color: var(--text); }
.sub { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem; }

.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; }
.widget { padding: 1rem 1.1rem; }
.whead { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 0.75rem; }
.wttl { font-size: 1rem; font-weight: 700; color: var(--text); }
.wmore { font-size: 0.78rem; color: var(--accent); }
.wmore:hover { color: var(--accent-hover); }

.wlist { display: flex; flex-direction: column; }
.wrow { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.5rem 0; border-bottom: 1px solid var(--border); }
.wlist li:last-child .wrow { border-bottom: none; }
.wtitle { font-size: 0.85rem; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wrow:hover .wtitle { color: var(--accent); }
.wdate { font-size: 0.72rem; color: var(--text-subtle); flex-shrink: 0; font-variant-numeric: tabular-nums; }
</style>
```

이 파일은 새 토큰(`--text`, `--accent`, `--border`)을 미리 쓴다. Task 7에서 정의되므로 그전까지는 색이 빠져 보인다. 레이아웃은 정상이다.

- [ ] **Step 8: 잔여 참조 확인**

```bash
cd /Users/wjd/프로젝트/hospital_frontend
grep -rn "api/cs\|stores/alerts\|EntityTree\|BaseTable\|DaumPostcodeModal\|supportApi\|ledgerApi\|settlementApi\|gameCompanyApi\|vendorApi\|exchangeRateApi\|supportDeskApi" src || echo "참조 없음"
```

Expected: `참조 없음`

- [ ] **Step 9: 빌드 검증**

```bash
npm run build
```

Expected: 성공. `vue-tsc`가 삭제된 모듈 참조를 전부 잡아낸다. 실패하면 에러가 가리키는 파일의 import를 확인한다.

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
프론트: CS 도메인 전면 제거 (페이지·스토어·알림 UI·고아 컴포넌트)

프론트의 "알림"은 백엔드 notification이 아니라 CS 응대 대시보드였음.
stores/alerts.ts가 supportApi.alerts()를 호출하고 AppHeader 종·App.vue 폴링·
HomePage 위젯이 모두 여기 의존. 프론트는 /notification 을 한 번도 호출하지 않음.
따라서 알림 UI 전체 삭제(백엔드 모듈은 유지, 실제 알림 화면은 다음 사이클).

- 페이지 삭제: exchange/ledger/settlement/support/alerts + 설정 탭 3개
- 컴포넌트 삭제: BaseTable·DaumPostcodeModal(죽은 코드), EntityTree(SupportTarget 전용)
- api/cs.ts 삭제, 라우터 6개 라우트 제거, /settings 권한 축소
- 사이드바: 정산·CS 그룹과 환율 제거, FAQ를 최상위로 승격
- HomePage 440줄 → 게시판 위젯만 남기고 재작성

한 커밋으로 묶은 이유: AppHeader→alerts.ts→api/cs.ts→HomePage 의존이
사슬로 엮여 있어 부분 삭제 시 빌드가 통과하지 않음.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 테마 토큰 재설계

**Files:**
- Modify: `src/assets/tailwind.css` (전면 교체)
- Modify: `tailwind.config.js`

**Interfaces:**
- Consumes: 없음
- Produces: CSS 변수 — `--canvas`, `--surface`, `--surface-2`, `--border`, `--border-strong`, `--text`, `--text-muted`, `--text-subtle`, `--accent`, `--accent-hover`, `--accent-soft`, `--accent-fg`, `--ring`, `--positive{,-soft,-line}`, `--warning{,-soft,-line}`, `--danger{,-soft,-line}`, `--info{,-soft,-line}`, `--font-sans`, `--font-num`, `--radius`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`. Task 8의 sed 매핑이 이 이름들에 의존한다.

- [ ] **Step 1: `src/assets/tailwind.css` 전면 교체**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* 표면 */
    --canvas: #f8fafc;
    --surface: #ffffff;
    --surface-2: #f1f5f9;

    /* 경계 */
    --border: #e2e8f0;
    --border-strong: #cbd5e1;

    /* 본문 */
    --text: #0f172a;
    --text-muted: #475569;
    --text-subtle: #64748b;

    /* 액센트 — 강조/활성/링크 */
    --accent: #2563eb;
    --accent-hover: #1d4ed8;
    --accent-soft: #eff6ff;
    --accent-fg: #ffffff;
    --ring: 0 0 0 3px rgba(37, 99, 235, 0.25);

    /* 상태 — 액센트와 독립. -line 은 배지 테두리(흑백 인쇄·색각 대응) */
    --positive: #059669;
    --positive-soft: #d1fae5;
    --positive-line: #a7f3d0;
    --warning: #d97706;
    --warning-soft: #fef3c7;
    --warning-line: #fde68a;
    --danger: #dc2626;
    --danger-soft: #fee2e2;
    --danger-line: #fecaca;
    --info: #2563eb;
    --info-soft: #dbeafe;
    --info-line: #bfdbfe;

    /* 서체 */
    --font-sans: "Pretendard", ui-sans-serif, system-ui, -apple-system, sans-serif;
    --font-num: "Pretendard", ui-monospace, SFMono-Regular, monospace;

    /* 형태 — 부드러운 블러 그림자 */
    --radius: 6px;
    --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
    --shadow-md: 0 4px 12px rgba(15, 23, 42, 0.08);
    --shadow-lg: 0 12px 28px rgba(15, 23, 42, 0.12);
  }

  /* ── 다크 모드 : 토큰 값만 재정의 (이름 동일) ── */
  html.dark {
    --canvas: #0b1220;
    --surface: #111a2c;
    --surface-2: #1a2436;

    --border: #243044;
    --border-strong: #33415a;

    --text: #e2e8f0;
    --text-muted: #94a3b8;
    --text-subtle: #64748b;

    --accent: #3b82f6;
    --accent-hover: #60a5fa;
    --accent-soft: #172554;
    --accent-fg: #ffffff;
    --ring: 0 0 0 3px rgba(59, 130, 246, 0.32);

    --positive: #34d399;
    --positive-soft: #052e23;
    --positive-line: #065f46;
    --warning: #fbbf24;
    --warning-soft: #3a2a06;
    --warning-line: #78500a;
    --danger: #f87171;
    --danger-soft: #3b0d0d;
    --danger-line: #7f1d1d;
    --info: #60a5fa;
    --info-soft: #0d2547;
    --info-line: #1e40af;

    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.45);
    --shadow-lg: 0 12px 28px rgba(0, 0, 0, 0.5);
    color-scheme: dark;
  }

  /* Tailwind bg-white 유틸 전역 다크 보정 (모달·달력 등 공용 컨테이너) */
  html.dark .bg-white { background-color: var(--surface); }
  html.dark input,
  html.dark textarea,
  html.dark select { color: var(--text); }
  html.dark input::placeholder,
  html.dark textarea::placeholder { color: var(--text-subtle); }

  html,
  body {
    font-family: var(--font-sans);
    color: var(--text);
  }

  body { background-color: var(--canvas); }

  h1, h2, h3, h4 {
    font-family: var(--font-sans);
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  ::selection {
    background: var(--accent-soft);
    color: var(--text);
  }

  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  * {
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
  }
  *::-webkit-scrollbar { width: 10px; height: 10px; }
  *::-webkit-scrollbar-thumb { background: var(--border-strong); border: 2px solid transparent; background-clip: padding-box; border-radius: 6px; }
  *::-webkit-scrollbar-thumb:hover { background: var(--text-subtle); background-clip: padding-box; }
  *::-webkit-scrollbar-track { background: transparent; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
    }
  }
}

@layer components {
  /* 공통 폼 필드 */
  .field {
    @apply w-full h-[34px] px-2.5 text-xs rounded-[6px]
           bg-[color:var(--surface)] border border-[color:var(--border-strong)]
           transition outline-none text-[color:var(--text)]
           focus:border-[color:var(--accent)]
           disabled:bg-[color:var(--surface-2)] disabled:cursor-not-allowed;
  }
  .field:focus { box-shadow: var(--ring); }
  .field-auto {
    @apply w-full min-h-[34px] px-2.5 py-1.5 text-xs rounded-[6px]
           bg-[color:var(--surface)] border border-[color:var(--border-strong)]
           transition outline-none text-[color:var(--text)]
           focus:border-[color:var(--accent)]
           disabled:bg-[color:var(--surface-2)] disabled:cursor-not-allowed;
  }
  .field-auto:focus { box-shadow: var(--ring); }
  .field-xs { @apply h-[28px] px-2 text-[11px]; }

  .cell-input {
    @apply w-full px-2 py-1 text-xs rounded-[6px]
           bg-[color:var(--surface)] border border-[color:var(--border-strong)]
           outline-none transition focus:border-[color:var(--accent)]
           placeholder:text-[color:var(--text-subtle)];
  }

  /* 버튼 */
  .btn {
    @apply inline-flex items-center justify-center gap-1.5 px-3 h-[34px] text-xs
           font-semibold rounded-[6px] border border-[color:var(--border-strong)]
           bg-[color:var(--surface)] text-[color:var(--text)]
           transition-all duration-100
           hover:bg-[color:var(--surface-2)]
           disabled:opacity-50 disabled:cursor-not-allowed;
    box-shadow: var(--shadow-sm);
  }
  .btn:active { transform: translateY(1px); }
  .btn-xs { @apply px-2 h-[26px] text-[11px] gap-1; }

  .btn-primary {
    @apply border-transparent;
    background: var(--accent);
    color: var(--accent-fg);
  }
  .btn-primary:hover { background: var(--accent-hover); }
  .btn-danger {
    @apply border-transparent text-white;
    background: var(--danger);
  }
  .btn-ghost {
    @apply bg-transparent border-transparent text-[color:var(--text-muted)]
           hover:bg-[color:var(--surface-2)];
    box-shadow: none;
  }

  .form-label { @apply block text-[11px] font-semibold text-[color:var(--text-muted)] mb-1; }

  /* 테이블 셀 */
  .th {
    @apply px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide
           text-[color:var(--text-subtle)]
           border-b border-[color:var(--border-strong)] bg-[color:var(--surface-2)];
  }
  .td { @apply px-2 py-1 align-middle border-b border-[color:var(--border)]; }

  /* 카드 (컨테이너) */
  .pcard {
    @apply rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)];
    box-shadow: var(--shadow-sm);
  }

  /* 검색/필터 바 */
  .filterbar {
    @apply flex items-center gap-2 flex-wrap rounded-[8px] px-3 py-2.5 mb-3
           border border-[color:var(--border)] bg-[color:var(--surface)];
    box-shadow: var(--shadow-sm);
  }
  .filterbar::before {
    content: "검색";
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-subtle);
    margin-right: 0.35rem;
    padding-right: 0.55rem;
    border-right: 1px solid var(--border);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .filterbar .f-label {
    font-size: 0.68rem;
    color: var(--text-subtle);
    white-space: nowrap;
  }

  /* 숫자 (금액 등) — 고정폭, 우측 정렬은 사용처에서 */
  .num { font-family: var(--font-num); font-variant-numeric: tabular-nums; }

  /* 상태 배지 — 테두리로 색 없이도 구분 */
  .badge {
    @apply inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]
           font-semibold whitespace-nowrap border;
  }
  .badge-icon { @apply text-[10px]; }
  .badge-success { background: var(--positive-soft); color: var(--positive); border-color: var(--positive-line); }
  .badge-error   { background: var(--danger-soft);   color: var(--danger);   border-color: var(--danger-line); }
  .badge-warning { background: var(--warning-soft);  color: var(--warning);  border-color: var(--warning-line); }
  .badge-info    { background: var(--info-soft);     color: var(--info);     border-color: var(--info-line); }
  /* BoardView 의 "공지" 배지가 쓰는 별칭 */
  .badge-indigo  { background: var(--info-soft);     color: var(--info);     border-color: var(--info-line); }
  .badge-neutral { @apply bg-[color:var(--surface-2)] text-[color:var(--text-muted)] border-[color:var(--border)]; }
  .badge-muted   { @apply text-[color:var(--text-subtle)] font-normal border-transparent; }
}

/* ── 전역 퀄리티 폴리시 ── */

@keyframes overlay-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes panel-in {
  from { opacity: 0; transform: translateY(10px) scale(0.985); }
  to { opacity: 1; transform: none; }
}
.drawer, .pmodal { animation: overlay-in 0.14s ease; backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); }
.drawer > .panel,
.drawer > .cmodal,
.pmodal > .pbox {
  animation: panel-in 0.2s cubic-bezier(0.2, 0.85, 0.25, 1);
}

.tbl tbody tr { transition: background-color 0.12s ease; }
.pcard { transition: box-shadow 0.12s ease; }

/* 폼 컨트롤은 border+ring 으로 포커스를 표시하므로 outline 중복 제거 */
.field:focus-visible, .field-auto:focus-visible, .cell-input:focus-visible { outline: none; }

@media print {
  html, body { height: auto !important; overflow: visible !important; background: white !important; }
  .no-print { display: none !important; }
}
```

옛 파일 대비 달라진 점: 픽셀 하드 그림자·각진 3px 보더·Galmuri 폰트 제거, `--seal`/`--hanji`/`--flow-*` 토큰 폐기, 배지에 `-line` 테두리 추가, `.badge-in`/`.badge-out` 삭제(삭제 페이지 전용이었음), `#voucher-print-clone` 인쇄 블록 삭제(DOM에 존재하지 않는 죽은 CSS), 본문 도트 격자 배경 제거.

- [ ] **Step 2: `tailwind.config.js` 교체**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
        },
        line: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        ink: {
          DEFAULT: "var(--text)",
          muted: "var(--text-muted)",
          subtle: "var(--text-subtle)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)",
          fg: "var(--accent-fg)",
        },
        positive: { DEFAULT: "var(--positive)", soft: "var(--positive-soft)", line: "var(--positive-line)" },
        warning: { DEFAULT: "var(--warning)", soft: "var(--warning-soft)", line: "var(--warning-line)" },
        danger: { DEFAULT: "var(--danger)", soft: "var(--danger-soft)", line: "var(--danger-line)" },
        info: { DEFAULT: "var(--info)", soft: "var(--info-soft)", line: "var(--info-line)" },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        num: ["var(--font-num)"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
    },
  },
  plugins: [],
};
```

Tailwind 유틸리티 이름을 `bg-canvas`, `text-ink-muted`, `border-line`, `bg-accent`처럼 쓸 수 있게 된다. 색 키를 `border`로 두면 Tailwind의 `border` 유틸리티(테두리 두께)와 충돌하므로 `line`으로 이름 붙였다.

`darkMode: "class"`를 추가했다. `stores/theme.ts`가 `documentElement`에 `dark` 클래스를 토글하므로 이 설정이 있어야 `dark:` 접두사가 동작한다.

- [ ] **Step 3: 빌드 검증**

```bash
cd /Users/wjd/프로젝트/hospital_frontend
npm run build
```

Expected: 성공. 이 시점에 화면은 색이 깨져 보인다 — 생존 파일들이 아직 옛 토큰 이름을 참조하기 때문이다. Task 8이 이를 고친다.

- [ ] **Step 4: 커밋**

```bash
git add src/assets/tailwind.css tailwind.config.js
git commit -m "$(cat <<'EOF'
테마: 클리니컬 뉴트럴 토큰 재설계 (Slate + Clinical Blue)

도메인에 오염된 토큰 이름을 의미 기반으로 교체.
--seal(인장)/--hanji(한지)는 족보 시스템 유산, --flow-in/out은 CS 정산의
회수/지급 개념이었음. --font-pixel(Galmuri)·--shadow-hard(오프셋 그림자) 제거.

- 상태색을 액센트와 독립으로 정의 (액센트 교체가 의미색을 흔들지 않도록)
- 배지에 -line 테두리 추가 (흑백 인쇄·색각 이상 대응)
- 죽은 CSS 제거: #voucher-print-clone 인쇄 블록(DOM에 없음), badge-in/out
- tailwind.config.js에 토큰 매핑 + darkMode: "class"

생존 파일들은 아직 옛 토큰을 참조하므로 다음 커밋 전까지 색이 깨져 보인다.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 옛 토큰·hex 일괄 치환

생존 파일이 폐기된 토큰을 약 839회 참조한다. 대부분 1:1 기계적 치환이므로 스크립트로 처리한 뒤 눈으로 검수한다.

**Files:**
- Modify: 생존 `.vue` 28개 (`src/components/base/` 11, `src/components/layout/` 2, `src/pages/` 15)
- Modify: `src/pages/settings/SettingsView.vue`, `src/layouts/*.vue` (토큰 참조가 있는 경우)

**Interfaces:**
- Consumes: Task 7이 정의한 새 토큰 이름
- Produces: 옛 토큰 참조 0건

- [ ] **Step 1: 치환 전 개수 기록**

```bash
cd /Users/wjd/프로젝트/hospital_frontend
grep -rhoE -- "--(ink|paper|surface-2|surface|hanji|line|seal|gold|flow|font-pixel|font-body|shadow-hard)[a-z0-9-]*" src --include="*.vue" | wc -l
```

Expected: 800 이상. 이 값을 기록해 둔다.

- [ ] **Step 2: 토큰 매핑 sed 스크립트 실행**

긴 이름을 먼저 치환해야 한다. `--ink`를 먼저 바꾸면 `--ink-soft`가 `--text-soft`가 되어 깨진다.

**주의:** zsh는 따옴표 없는 변수를 단어 분리하지 않는다. `for f in $FILES`로 쓰면 파일 목록
전체가 하나의 존재하지 않는 경로가 되고, `sed`가 조용히 아무것도 바꾸지 않는다.
반드시 아래처럼 `while read`로 한 줄씩 받는다.

```bash
cd /Users/wjd/프로젝트/hospital_frontend

grep -rlE -- "--(ink|paper|hanji|line|seal|gold|flow|font-pixel|font-body|shadow-hard)" \
  src --include="*.vue" --include="*.css" > /tmp/theme-files.txt
echo "치환 대상 파일 수: $(wc -l < /tmp/theme-files.txt)"

while IFS= read -r f; do
  sed -i '' \
    -e 's/--ink-faint/--text-subtle/g' \
    -e 's/--ink-muted/--text-muted/g' \
    -e 's/--ink-soft/--text/g' \
    -e 's/--ink/--text/g' \
    -e 's/--hanji-deep/--surface-2/g' \
    -e 's/--hanji/--canvas/g' \
    -e 's/--paper/--canvas/g' \
    -e 's/--line-strong/--border-strong/g' \
    -e 's/--line-hard/--border-strong/g' \
    -e 's/--line/--border/g' \
    -e 's/--seal-grad/--accent/g' \
    -e 's/--seal-deep/--accent-hover/g' \
    -e 's/--seal/--accent/g' \
    -e 's/--gold/--warning/g' \
    -e 's/--flow-in-bg/--positive-soft/g' \
    -e 's/--flow-out-bg/--warning-soft/g' \
    -e 's/--flow-in/--positive/g' \
    -e 's/--flow-out/--warning/g' \
    -e 's/--font-pixel/--font-sans/g' \
    -e 's/--font-body/--font-sans/g' \
    -e 's/--shadow-hard/--shadow-sm/g' \
    "$f"
done < /tmp/theme-files.txt

echo "치환 완료"
```

macOS의 `sed -i ''`는 백업 없이 제자리 수정한다. Linux라면 `sed -i`로 바꾼다.

Step 1에서 기록한 참조 개수(800 이상)와 `치환 대상 파일 수`가 둘 다 0이 아닌지 확인한다.
파일 수가 0이면 `grep`이 아무것도 못 읽은 것이므로 경로를 다시 확인한다.

- [ ] **Step 3: 옛 토큰 잔존 확인**

```bash
grep -rnE -- "--(ink|paper|hanji|line-|line\)|seal|gold|flow-|font-pixel|font-body|shadow-hard)" src --include="*.vue" --include="*.css" || echo "옛 토큰 없음"
```

Expected: `옛 토큰 없음`

`--line` 단독은 위 정규식으로 잡히지 않을 수 있다. 추가 확인:

```bash
grep -rn -- "var(--line" src || echo "--line 없음"
```

Expected: `--line 없음`

- [ ] **Step 4: 하드코딩 hex 치환**

가장 많이 쓰인 두 색부터 처리한다.

```bash
cd /Users/wjd/프로젝트/hospital_frontend
grep -rn "#7a5cff\|#5f3fe0\|#8a6bff" src --include="*.vue"
```

각 결과를 열어 문맥에 맞는 토큰으로 바꾼다.

| 옛 hex | 의미 | 새 값 |
| --- | --- | --- |
| `#7a5cff`, `#8a6bff` | 브랜드 액센트 | `var(--accent)` |
| `#5f3fe0` | 액센트 진한 톤 | `var(--accent-hover)` |
| `#ede9ff`, `#c3b7ff` | 액센트 연한 배경 | `var(--accent-soft)` |
| `#0d0e1a`, `#1b1d2e`, `#16182a` | 본문·사이드바 배경 | `var(--text)` 또는 `var(--surface)` — 문맥 확인 |
| `#8b90b8`, `#64748b` | 흐린 글자 | `var(--text-subtle)` |
| `#cbd5e1`, `#d1d5db` | 경계 | `var(--border-strong)` |
| `#dc2626`, `#e23b46` | 위험 | `var(--danger)` |
| `#0ea88f`, `#047857`, `#2e7d43` | 정상/성공 | `var(--positive)` |
| `#e07d16`, `#b45309`, `#f59e0b`, `#ffb25e` | 주의 | `var(--warning)` |
| `#d1fae5` | 성공 배경 | `var(--positive-soft)` |
| `#fef3c7` | 주의 배경 | `var(--warning-soft)` |
| `#f1f5f9` | 보조 표면 | `var(--surface-2)` |
| `#fff`, `#ffffff` | 흰색 | 문맥 확인 — 버튼 글자는 `var(--accent-fg)`, 배경은 `var(--surface)` |

`AppSidebar.vue`의 `.side { background: #16182a; }`는 어두운 사이드바를 만들던 것이다. 클리니컬 뉴트럴에서는 밝은 사이드바를 쓴다.

```css
.side {
  background: var(--surface);
  border-right: 1px solid var(--border);
  color: var(--text-muted);
}
```

활성 메뉴 항목은 `background: var(--accent-soft); color: var(--accent);`로 바꾼다.

- [ ] **Step 5: hex 잔존 확인**

```bash
grep -rhoE "#[0-9a-fA-F]{3,8}\b" src --include="*.vue" | sort | uniq -c | sort -rn | head -20
```

Expected: 남는 hex는 의미가 명확한 것뿐이어야 한다 (예: `TagChips.vue`가 DB에 저장된 태그 색을 인라인 스타일로 렌더링하는 경우). 액센트 계열(`#7a5cff`, `#ede9ff`, `#5f3fe0`)은 0건이어야 한다.

```bash
grep -rn "#7a5cff\|#ede9ff\|#5f3fe0" src || echo "픽셀 팔레트 없음"
```

Expected: `픽셀 팔레트 없음`

- [ ] **Step 6: 빌드 검증**

```bash
npm run build
```

Expected: 성공.

- [ ] **Step 7: 실행 후 눈으로 확인**

```bash
npm run dev
```

브라우저에서 확인한다.

1. 로그인 화면 — 액센트가 파랑인지
2. 로그인 후 대시보드 — 사이드바가 밝은 표면, 활성 메뉴가 연한 파랑 배경인지
3. 게시판 진입 → 글쓰기 → 목록 — "공지" 배지에 테두리가 있는지
4. FAQ 진입 — 태그 칩·검색 필터바 정상인지
5. 환경설정 진입 — **탭 4개(게시판·FAQ 분류·태그·다국어)만 보이는지.** 권한 배열을 수정했으므로 진입 자체가 막힐 수 있다. 막히면 `router/index.ts`의 `/settings` `meta.perm`과 로그인 계정의 권한을 대조한다.
6. 헤더의 다크 모드 토글 — 라이트/다크 양쪽에서 대비가 유지되는지. 특히 배지·버튼·입력창.
7. 헤더에 **종 아이콘이 없는지**

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
테마: 생존 파일의 옛 토큰 참조와 하드코딩 hex를 새 토큰으로 치환

--line-hard 165회, --seal 102회, --font-pixel 92회, --ink 91회 등 약 839회.
sed 매핑으로 일괄 치환 후 문맥이 필요한 hex는 수동 교체.
AppSidebar는 어두운 배경(#16182a)에서 밝은 표면으로 전환.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## 완료 조건

- [ ] 백엔드: `npx prisma validate` 통과, `npm run dev`로 라우트 15개 로드, 에러 없음
- [ ] 백엔드: `hospital_system` DB에 모델 14개, 권한 11개, 역할 "관리자" 1개
- [ ] 백엔드: `grep -rn "gameCompany\|vendor\|ledger\|settlement\|support\|exchangeRate" server/ prisma/schema.prisma` → 결과 없음
- [ ] 프론트: `npm run build` 통과
- [ ] 프론트: `grep -rn "api/cs\|stores/alerts" src` → 결과 없음
- [ ] 프론트: `grep -rn "#7a5cff\|--seal\|--font-pixel" src` → 결과 없음
- [ ] 수동: 로그인 → 대시보드 → 게시판 글쓰기 → FAQ → 환경설정 4개 탭 전부 동작
- [ ] 수동: 다크 모드 토글이 양쪽에서 정상
- [ ] 양쪽 리포 remote가 `hospital_*`을 가리킴

## 다음 사이클로 넘기는 것

- **알림 UI** — 백엔드 `notification` 모듈은 살아 있으나 프론트 소비자가 없다. `/notification/list`, `/notification/count` 등을 소비하는 화면을 새로 만든다.
- **`notification.service.js`의 `countByType`** — `INBOUND`/`OUTBOUND`/`MATERIAL`/`RETURNORDER`/`PURCHASEORDER` 키를 반환하는데, `NotificationType` enum에는 `SYSTEM`만 있다. material-server에서 포팅된 잔재이며 현재 항상 0을 반환한다. 알림 UI를 만들 때 함께 정리한다.
- **테스트 인프라** — 첫 실제 도메인 기능과 함께 시작한다.
- **부서·직원 마스터** — 스펙의 "정보구조 지도" 참고. 거의 모든 도메인의 전제다.
