# 근태 · 교대 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부서별 월간 근무표를 짜고 실제 출퇴근을 기록해, 예정과 실적을 대조해 근태를 판정하고 급여가 참조할 확정된 근무시간 데이터를 남긴다.

**Architecture:** 계산 로직(`attendanceCalc.js`)을 **순수 함수로 먼저** 만들고 테스트로 굳힌다. DB를 모르는 함수라 화면 없이 검증된다. 그 위에 모델 → API → 화면을 의존 방향대로 쌓는다. 근무표 그리드는 2차원 데이터를 한 번에 받아 렌더링한다(셀마다 API를 부르면 30일 × 20명 = 600번).

**Tech Stack:** Node.js + Fastify 4 (ESM), Prisma 5 + MySQL, Vue 3 + Vite + Tailwind 3

## Global Constraints

- 백엔드 리포: `/Users/wjd/프로젝트/hospital_server` · 프론트 리포: `/Users/wjd/프로젝트/hospital_frontend`
- 브랜치: 양쪽 모두 `hr-attendance` (백엔드는 이미 생성됨. 프론트는 Task 8에서 생성)
- DB: `hospital_system` (MySQL)
- **계산 로직에만 테스트를 붙인다.** `package.json`에 `"test": "node --test test/"`가 이미 있고 Node 18은 `--test`를 지원한다. **다른 곳에는 테스트를 만들지 마세요** — 나머지 검증은 `prisma validate` · `npm run build`(vue-tsc) · curl · 수동 클릭이다.
- 새 권한 2개: `attendance.view`, `attendance.edit` (기존 21 → 23)
- 라우트는 `permission()` preHandler로 권한을 강제한다. 단 `shiftType/list`는 근무표 팔레트 공급원이라 **인증만** 요구한다 (`server/routes/category.js`의 `ensureAuth` 패턴).
- **나이트 근무는 시작일 귀속.** 1일 22시 → 2일 07시면 `work_date = 1일`.
- **판정 결과와 판정 기준을 모두 저장한다.** `status`·`work_minutes`·`overtime_minutes`·`late_minutes`·`early_leave_minutes`·`shift_type_id`(스냅샷).
- 커밋 메시지는 한국어. 본문 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- macOS zsh 주의: `grep`은 **ugrep**이라 GNU식 `--include="*.vue"`가 무시된다(`find`로 파일 목록을 만들 것). 따옴표 없는 변수는 단어 분리되지 않으므로 `while IFS= read -r`을 쓸 것. **`timeout` 명령이 없다.**
- 서버 기동 확인:
  ```bash
  (node server/index.js > /tmp/boot.log 2>&1 &) ; sleep 6; pkill -f "node server/index.js"; sleep 1
  grep -c "Route loaded" /tmp/boot.log
  ```
  `EADDRINUSE`는 무시(라우트 등록은 listen 이전에 끝남). 반드시 `pkill`로 정리할 것.
- MySQL이 꺼져 있을 수 있다: `/opt/homebrew/opt/mysql@8.0/bin/mysql -u root -h 127.0.0.1 -e "SELECT 1;" > /dev/null 2>&1 || brew services start mysql@8.0`
- 포트 3013, API 키 `cs-dev-api-key`, 관리자 `admin` / `admin12`

## 확정된 프론트 컴포넌트 시그니처

제가 실제 파일을 읽어 확인했습니다 — **추측하지 마세요.**

- **토스트**: `import { useToast } from "vue-toastification";` → `const toast = useToast();` → `toast.success/error/warning(msg)`
- **SearchSelect**: props `{modelValue, options, labelKey="label", valueKey="value", placeholder, colorKey="color", creatable}`. options는 `{value, label}[]`. **클리어 시 `null`을 emit한다**(앞 사이클에서 고침).
- **BaseToggle**: props `{modelValue, size="md"|"sm", disabled}`. `v-model`로 boolean.
- **Pager**: props `{page, totalPages, total, window}`. **`limit`이 아니라 `totalPages`.**
- **EmptyState**: props `{variant, icon, title, desc, compact}`. `icon`은 Font Awesome 클래스(`fa-calendar` 등). **`hint` prop 없음.**
- **테이블**: `<table class="tbl">` 하나면 끝. **셀에 `class="th"`/`class="td"`를 붙이지 않는다** — 전역 `.tbl th`/`.tbl td`가 먹는다.
- **필터바**: `.filterbar > div`가 170px로 고정된다. `SearchSelect`를 넣으면 자동으로 맞는다.

## File Structure

**백엔드 (`hospital_server`)**

| 파일 | 책임 |
| --- | --- |
| `prisma/schema.prisma` | 모델 3개 + enum 1개 + `Employee` 역참조 |
| `prisma/seed-rbac.js` | 권한 21 → 23 |
| `prisma/seed-hr.js` | 근무유형 6개 추가 |
| `server/lib/attendanceCalc.js` | **순수 함수** — 근태 판정 |
| `test/attendanceCalc.test.js` | 계산 로직 테스트 |
| `server/routes/shiftType.js` + service + validator | `/api/shiftType` |
| `server/routes/shiftSchedule.js` + service + validator | `/api/shiftSchedule` (grid·saveCell·saveBulk·copyMonth) |
| `server/routes/attendance.js` + service + validator | `/api/attendance` (save가 계산기 호출) |

**프론트 (`hospital_frontend`)**

| 파일 | 책임 |
| --- | --- |
| `src/api/attendance.ts` | `shiftTypeApi`, `shiftScheduleApi`, `attendanceApi` |
| `src/pages/settings/ShiftTypeSettings.vue` | 근무유형 관리 탭 |
| `src/pages/hr/ScheduleView.vue` | 근무표 그리드 |
| `src/pages/hr/AttendanceView.vue` | 출퇴근 |
| `src/pages/settings/SettingsView.vue` | 탭 추가 |
| `src/components/layout/AppSidebar.vue` | "인사" 그룹에 2개 추가 |
| `src/router/index.ts` | 라우트 2개 추가 |

---

### Task 1: Prisma 스키마

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: 기존 `Employee` 모델
- Produces: `prisma.shiftType`, `prisma.shiftSchedule`, `prisma.attendance`, enum `AttendanceStatus`. Task 3~7이 쓴다.

- [ ] **Step 1: 파일 끝에 enum + 모델 3개 추가**

```prisma
//////////////////////////////////////////////////////////////
// 근태 · 교대
//////////////////////////////////////////////////////////////

/// 근태 상태 — 판정 우선순위: ABSENT > LATE > EARLY_LEAVE > NORMAL
enum AttendanceStatus {
  NORMAL      // 정상
  LATE        // 지각
  EARLY_LEAVE // 조퇴
  ABSENT      // 결근
  LEAVE       // 휴가 (is_work=false 유형)
}

/// 근무유형 (데이/이브닝/나이트/비번/연차/병가)
model ShiftType {
  id   Int    @id @default(autoincrement())
  code String @unique @db.VarChar(20) // D, E, N, OFF, ANNUAL, SICK
  name String @db.VarChar(50)         // 데이, 이브닝, 나이트, 비번, 연차, 병가

  // 벽시계 시각을 문자열로 둔다. MySQL TIME 을 Prisma 가 DateTime 으로 매핑해
  // 날짜가 딸려오고 타임존 변환에 휘말리는 것을 피한다. is_work=false 면 null.
  start_time String? @db.VarChar(5) // "08:00"
  end_time   String? @db.VarChar(5) // "17:00"

  crosses_midnight Boolean @default(false) // 나이트처럼 종료가 다음날이면 true
  break_minutes    Int     @default(0)     // 휴게시간 — 근무시간 계산에서 뺀다
  is_work          Boolean @default(true)  // 비번·연차·병가는 false

  color String @default("#64748b") @db.VarChar(20) // 그리드 셀 색

  schedules   ShiftSchedule[]
  attendances Attendance[] // 판정 기준 스냅샷 역참조

  sort       Int      @default(0)
  is_active  Boolean  @default(true)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([sort])
}

/// 근무표 — 직원 × 날짜 = 근무유형
model ShiftSchedule {
  id          Int      @id @default(autoincrement())
  employee_id Int
  employee    Employee @relation(fields: [employee_id], references: [id], onDelete: Cascade)

  work_date DateTime @db.Date

  shift_type_id Int
  shift_type    ShiftType @relation(fields: [shift_type_id], references: [id])

  memo String? @db.VarChar(200)

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@unique([employee_id, work_date]) // 하루에 근무 하나
  @@index([work_date])
}

/// 실제 출퇴근 — work_date 는 시작일 기준(나이트도 마찬가지)
model Attendance {
  id          Int      @id @default(autoincrement())
  employee_id Int
  employee    Employee @relation(fields: [employee_id], references: [id], onDelete: Cascade)

  work_date DateTime @db.Date // 나이트 근무도 시작일

  check_in  DateTime? // null 이면 결근
  check_out DateTime? // null 이면 퇴근 미기록

  // 판정 기준 스냅샷 — 근무표가 나중에 바뀌어도 판정 근거는 남아야 한다.
  // null 이면 근무표에 없는 날 출근한 것.
  shift_type_id Int?
  shift_type    ShiftType? @relation(fields: [shift_type_id], references: [id])

  // 계산 결과를 저장한다 — 조회할 때마다 재계산하지 않는다
  status              AttendanceStatus @default(NORMAL)
  work_minutes        Int              @default(0) // 실근무 (휴게 제외)
  overtime_minutes    Int              @default(0)
  late_minutes        Int              @default(0)
  early_leave_minutes Int              @default(0)

  memo String? @db.VarChar(200)

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@unique([employee_id, work_date])
  @@index([work_date])
  @@index([status])
}
```

`late_minutes`와 `early_leave_minutes`를 **둘 다** 둔 이유: `status`는 하나인데 지각과 조퇴가 동시에 날 수 있다. 우선순위로 `status`는 `LATE`가 되지만, 조퇴 시간을 잃으면 급여에서 공제를 놓친다.

- [ ] **Step 2: `Employee` 모델에 역참조 추가**

`model Employee` 안의 `licenses    EmployeeLicense[]` 아래에 두 줄을 추가한다.

```prisma
  schedules   ShiftSchedule[]
  attendances Attendance[]
```

- [ ] **Step 3: 스키마 검증**

```bash
cd /Users/wjd/프로젝트/hospital_server
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: 모델·enum 개수 확인**

```bash
echo "model: $(grep -cE '^model ' prisma/schema.prisma) / enum: $(grep -cE '^enum ' prisma/schema.prisma)"
```

Expected: `model: 23 / enum: 5` (기존 20 모델 + 3, 기존 4 enum + 1)

- [ ] **Step 5: DB 반영**

```bash
grep DATABASE_URL .env   # /hospital_system 인지 확인
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 6: 서버 기동 확인**

```bash
(node server/index.js > /tmp/boot1.log 2>&1 &) ; sleep 6; pkill -f "node server/index.js"; sleep 1
grep -c "Route loaded" /tmp/boot1.log
grep -i "error" /tmp/boot1.log | grep -v EADDRINUSE || echo "에러 없음"
```

Expected: 라우트 `18`개 (아직 새 라우트를 안 만들었으므로), 에러 없음.

- [ ] **Step 7: 커밋**

```bash
git add prisma/schema.prisma
git commit -m "$(cat <<'EOF'
근태: Prisma 모델 3개 추가 (ShiftType, ShiftSchedule, Attendance)

ShiftType 의 시각을 String("08:00")으로 둔다. MySQL TIME 을 Prisma 가
DateTime 으로 매핑해 날짜가 딸려오고 타임존 변환에 휘말리는 것을 피한다.
근무유형의 시각은 벽시계 시각이지 특정 시점이 아니다.

Attendance 는 판정 결과(status, *_minutes)와 판정 기준(shift_type_id
스냅샷)을 모두 저장한다. 근무표가 나중에 바뀌어도 확정된 근태와 그 근거는
남아야 한다.

late_minutes 와 early_leave_minutes 를 둘 다 둔다 — status 는 하나인데
지각과 조퇴가 동시에 날 수 있고, 조퇴 시간을 잃으면 급여에서 공제를 놓친다.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 권한 2개 추가

**Files:**
- Modify: `prisma/seed-rbac.js`

**Interfaces:**
- Consumes: 없음
- Produces: 권한 코드 `attendance.view`, `attendance.edit`. Task 4~6의 라우트가 쓴다.

- [ ] **Step 1: `PERMS` 배열에 2개 추가**

`prisma/seed-rbac.js`의 `PERMS` 배열에서 `// 인사` 그룹을 찾아, `["hr.edit", "직원 편집", "인사"],` 아래에 추가한다.

```javascript
  ["attendance.view", "근태 조회", "인사"],
  ["attendance.edit", "근태 편집", "인사"],
```

**주의:** 이 시드는 카탈로그 밖 권한 행을 `deleteMany`로 지운다. 라우트가 요구하는 코드가 카탈로그에 없으면 **비-super 사용자가 영구 403**이 된다. 앞 사이클에서 실제로 겪은 결함이다.

- [ ] **Step 2: 시드 실행**

```bash
cd /Users/wjd/프로젝트/hospital_server
/opt/homebrew/opt/mysql@8.0/bin/mysql -u root -h 127.0.0.1 -e "SELECT 1;" > /dev/null 2>&1 || brew services start mysql@8.0
npm run seed:rbac
```

Expected: `✅ rbac seed done: 23 perms (removed 0 stale), role 관리자`

- [ ] **Step 3: 라우트 요구 권한 vs 카탈로그 대조**

```bash
grep -rhoE 'permission\("[a-zA-Z.]+"\)' server/routes/ | sed 's/permission("//;s/")//' | sort -u > /tmp/req.txt
grep -oE '\["[a-zA-Z.]+"' prisma/seed-rbac.js | tr -d '["' | sort -u > /tmp/cat.txt
comm -23 /tmp/req.txt /tmp/cat.txt && echo "누락 없음"
```

Expected: `누락 없음` (빈 결과 + 그 메시지)

- [ ] **Step 4: 커밋**

```bash
git add prisma/seed-rbac.js
git commit -m "$(cat <<'EOF'
근태: 권한 2개 추가 (21 → 23)

attendance.view (근무표·출퇴근 조회), attendance.edit (편집).
근무표와 출퇴근을 같은 권한으로 묶는다 — 실무에서 같은 사람(수간호사·인사팀)이
둘 다 본다.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 계산 로직 + 테스트 ★ 이 사이클의 심장

**Files:**
- Create: `server/lib/attendanceCalc.js`
- Create: `test/attendanceCalc.test.js`

**Interfaces:**
- Consumes: 없음 (순수 함수, DB를 모른다)
- Produces:
  ```javascript
  calcAttendance({ shiftType, checkIn, checkOut, workDate })
  → { status, workMinutes, overtimeMinutes, lateMinutes, earlyLeaveMinutes }
  ```
  `shiftType`: `{ start_time, end_time, crosses_midnight, break_minutes, is_work }`
  `checkIn`/`checkOut`: `Date | null`
  `workDate`: `Date` (근무 시작일)
  `status`: `"NORMAL" | "LATE" | "EARLY_LEAVE" | "ABSENT" | "LEAVE"`

  Task 6의 `attendance.service.js`가 이걸 호출한다.

**이 태스크만 TDD를 따릅니다.** 테스트를 먼저 쓰고, 실패를 확인하고, 구현합니다.

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`test/attendanceCalc.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcAttendance } from "../server/lib/attendanceCalc.js";

// 근무유형 픽스처
const DAY = { start_time: "07:00", end_time: "15:00", crosses_midnight: false, break_minutes: 30, is_work: true };
const NIGHT = { start_time: "22:00", end_time: "07:00", crosses_midnight: true, break_minutes: 60, is_work: true };
const OFF = { start_time: null, end_time: null, crosses_midnight: false, break_minutes: 0, is_work: false };
const NO_TIME = { start_time: null, end_time: null, crosses_midnight: false, break_minutes: 0, is_work: true };

const d = (s) => new Date(s);
const WORK_DATE = d("2026-08-03T00:00:00");

test("정상 출퇴근 — 휴게시간이 빠진다", () => {
  const r = calcAttendance({
    shiftType: DAY,
    checkIn: d("2026-08-03T07:00:00"),
    checkOut: d("2026-08-03T15:00:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "NORMAL");
  assert.equal(r.workMinutes, 450); // 8시간(480) - 휴게 30
  assert.equal(r.overtimeMinutes, 0);
  assert.equal(r.lateMinutes, 0);
  assert.equal(r.earlyLeaveMinutes, 0);
});

test("지각", () => {
  const r = calcAttendance({
    shiftType: DAY,
    checkIn: d("2026-08-03T07:20:00"),
    checkOut: d("2026-08-03T15:00:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "LATE");
  assert.equal(r.lateMinutes, 20);
  assert.equal(r.earlyLeaveMinutes, 0);
  assert.equal(r.workMinutes, 430); // 7시간40분(460) - 휴게 30
});

test("조퇴", () => {
  const r = calcAttendance({
    shiftType: DAY,
    checkIn: d("2026-08-03T07:00:00"),
    checkOut: d("2026-08-03T14:30:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "EARLY_LEAVE");
  assert.equal(r.earlyLeaveMinutes, 30);
  assert.equal(r.lateMinutes, 0);
});

test("지각 + 조퇴 동시 — status 는 LATE, 두 분(minutes) 다 남는다", () => {
  const r = calcAttendance({
    shiftType: DAY,
    checkIn: d("2026-08-03T07:15:00"),
    checkOut: d("2026-08-03T14:40:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "LATE"); // 우선순위: LATE > EARLY_LEAVE
  assert.equal(r.lateMinutes, 15);
  assert.equal(r.earlyLeaveMinutes, 20); // 잃어버리면 급여 공제를 놓친다
});

test("연장근무", () => {
  const r = calcAttendance({
    shiftType: DAY,
    checkIn: d("2026-08-03T07:00:00"),
    checkOut: d("2026-08-03T17:30:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "NORMAL");
  assert.equal(r.overtimeMinutes, 150); // 15:00 → 17:30
  assert.equal(r.workMinutes, 600); // 10시간30분(630) - 휴게 30
});

test("나이트 — 자정을 넘어 9시간, 휴게 60분 빼고 8시간", () => {
  const r = calcAttendance({
    shiftType: NIGHT,
    checkIn: d("2026-08-03T22:00:00"),
    checkOut: d("2026-08-04T07:00:00"), // 다음날
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "NORMAL");
  assert.equal(r.workMinutes, 480); // 9시간(540) - 휴게 60
  assert.equal(r.overtimeMinutes, 0);
  assert.equal(r.lateMinutes, 0);
});

test("나이트 조기 퇴근 — 다음날 05:00 이면 조퇴 120분", () => {
  const r = calcAttendance({
    shiftType: NIGHT,
    checkIn: d("2026-08-03T22:00:00"),
    checkOut: d("2026-08-04T05:00:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "EARLY_LEAVE");
  assert.equal(r.earlyLeaveMinutes, 120); // 예정 07:00 - 실제 05:00
});

test("나이트 연장 — 다음날 09:00 이면 연장 120분", () => {
  const r = calcAttendance({
    shiftType: NIGHT,
    checkIn: d("2026-08-03T22:00:00"),
    checkOut: d("2026-08-04T09:00:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.overtimeMinutes, 120);
  assert.equal(r.workMinutes, 600); // 11시간(660) - 휴게 60
});

test("출근 없음 → 결근", () => {
  const r = calcAttendance({
    shiftType: DAY,
    checkIn: null,
    checkOut: null,
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "ABSENT");
  assert.equal(r.workMinutes, 0);
  assert.equal(r.lateMinutes, 0);
});

test("퇴근 미기록 — 지각은 판정하되 근무시간은 0", () => {
  const r = calcAttendance({
    shiftType: DAY,
    checkIn: d("2026-08-03T07:10:00"),
    checkOut: null,
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "LATE");
  assert.equal(r.lateMinutes, 10);
  assert.equal(r.workMinutes, 0);
  assert.equal(r.overtimeMinutes, 0);
  assert.equal(r.earlyLeaveMinutes, 0);
});

test("비근무 유형(연차) → LEAVE, 시각을 넣어도 무시", () => {
  const r = calcAttendance({
    shiftType: OFF,
    checkIn: d("2026-08-03T09:00:00"), // 넣어도
    checkOut: d("2026-08-03T18:00:00"), // 무시된다
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "LEAVE");
  assert.equal(r.workMinutes, 0);
  assert.equal(r.overtimeMinutes, 0);
  assert.equal(r.lateMinutes, 0);
  assert.equal(r.earlyLeaveMinutes, 0);
});

test("시각 없는 근무유형 — 실측만 계산, 판정 기준이 없으므로 나머지 0", () => {
  const r = calcAttendance({
    shiftType: NO_TIME,
    checkIn: d("2026-08-03T09:00:00"),
    checkOut: d("2026-08-03T18:00:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "NORMAL");
  assert.equal(r.workMinutes, 540); // 9시간, 휴게 0
  assert.equal(r.lateMinutes, 0);
  assert.equal(r.earlyLeaveMinutes, 0);
  assert.equal(r.overtimeMinutes, 0);
});

test("근무유형이 없음(근무표에 없는 날) — 실측만", () => {
  const r = calcAttendance({
    shiftType: null,
    checkIn: d("2026-08-03T09:00:00"),
    checkOut: d("2026-08-03T18:00:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.status, "NORMAL");
  assert.equal(r.workMinutes, 540);
  assert.equal(r.lateMinutes, 0);
});

test("정시 출근·정시 퇴근은 지각도 조퇴도 아니다", () => {
  const r = calcAttendance({
    shiftType: DAY,
    checkIn: d("2026-08-03T07:00:00"),
    checkOut: d("2026-08-03T15:00:00"),
    workDate: WORK_DATE,
  });
  assert.equal(r.lateMinutes, 0);
  assert.equal(r.earlyLeaveMinutes, 0);
  assert.equal(r.overtimeMinutes, 0);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd /Users/wjd/프로젝트/hospital_server
npm test
```

Expected: 실패. `Cannot find module '../server/lib/attendanceCalc.js'` 또는 그에 준하는 에러. **아직 구현이 없으므로 실패해야 정상입니다.**

- [ ] **Step 3: `server/lib/attendanceCalc.js` 구현**

```javascript
/**
 * 근태 판정 — 순수 함수. DB를 모른다.
 *
 * 나이트 근무는 시작일에 귀속된다. 1일 22시 출근 → 2일 07시 퇴근이면
 * workDate = 1일이고, crosses_midnight=true 이므로 예정 퇴근을 다음날로 해석한다.
 */

const MINUTE = 60 * 1000;

/** "08:00" + 기준일 → Date. addDays 만큼 날짜를 민다. */
function atTime(baseDate, hhmm, addDays = 0) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + addDays);
  d.setHours(h, m, 0, 0);
  return d;
}

/** 음수는 0으로 — 지각/조퇴/연장은 모두 "초과분"이라 음수가 될 수 없다 */
function diffMinutes(later, earlier) {
  return Math.max(0, Math.round((later.getTime() - earlier.getTime()) / MINUTE));
}

/**
 * @param {object} args
 * @param {object|null} args.shiftType  { start_time, end_time, crosses_midnight, break_minutes, is_work }
 *   null 이면 근무표에 없는 날 출근한 것 — 실측만 계산한다.
 * @param {Date|null} args.checkIn
 * @param {Date|null} args.checkOut
 * @param {Date} args.workDate  근무 시작일
 * @returns {{status: string, workMinutes: number, overtimeMinutes: number, lateMinutes: number, earlyLeaveMinutes: number}}
 */
export function calcAttendance({ shiftType, checkIn, checkOut, workDate }) {
  const zero = { workMinutes: 0, overtimeMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0 };

  // 1) 비근무 유형(비번·연차·병가) — 시각을 넣어도 무시한다
  if (shiftType && shiftType.is_work === false) {
    return { status: "LEAVE", ...zero };
  }

  // 2) 출근 기록이 없으면 결근
  if (!checkIn) {
    return { status: "ABSENT", ...zero };
  }

  const breakMinutes = shiftType?.break_minutes ?? 0;

  // 3) 실근무 시간 — 퇴근이 없으면 0
  const workMinutes = checkOut ? Math.max(0, diffMinutes(checkOut, checkIn) - breakMinutes) : 0;

  // 4) 판정 기준(예정 시각)이 없으면 실측만 낸다.
  //    - shiftType 이 null (근무표에 없는 날)
  //    - shiftType 은 있는데 시각이 없음 (데이터 오류)
  if (!shiftType?.start_time || !shiftType?.end_time) {
    return { status: "NORMAL", ...zero, workMinutes };
  }

  const plannedIn = atTime(workDate, shiftType.start_time);
  const plannedOut = atTime(workDate, shiftType.end_time, shiftType.crosses_midnight ? 1 : 0);

  const lateMinutes = diffMinutes(checkIn, plannedIn);

  let earlyLeaveMinutes = 0;
  let overtimeMinutes = 0;
  if (checkOut) {
    earlyLeaveMinutes = diffMinutes(plannedOut, checkOut);
    overtimeMinutes = diffMinutes(checkOut, plannedOut);
  }

  // 5) status 우선순위: ABSENT > LATE > EARLY_LEAVE > NORMAL
  //    지각과 조퇴가 동시에 나면 status 는 LATE 지만 두 분(minutes)은 둘 다 남긴다.
  let status = "NORMAL";
  if (lateMinutes > 0) status = "LATE";
  else if (earlyLeaveMinutes > 0) status = "EARLY_LEAVE";

  return { status, workMinutes, overtimeMinutes, lateMinutes, earlyLeaveMinutes };
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

```bash
npm test
```

Expected: 전부 통과. `# pass 14` `# fail 0` 형태의 요약이 나온다.

하나라도 실패하면 **구현을 고치세요, 테스트를 고치지 마세요.** 테스트가 스펙입니다.

- [ ] **Step 5: 커밋**

```bash
git add server/lib/attendanceCalc.js test/attendanceCalc.test.js
git commit -m "$(cat <<'EOF'
근태: 판정 계산기 (순수 함수 + 테스트 14개)

이 사이클의 심장. DB를 모르는 순수 함수라 화면 없이 검증된다.
여기가 틀리면 급여가 틀린다.

검증한 경계 사례:
- 나이트 자정 넘김 — 1일 22시 → 2일 07시가 9시간으로 계산되는지
- 나이트 조기퇴근/연장 — 다음날 05시/09시
- 지각 + 조퇴 동시 — status 는 LATE 지만 두 분(minutes)이 둘 다 남는지
  (조퇴 시간을 잃으면 급여에서 공제를 놓친다)
- 퇴근 미기록 — 지각은 판정하되 근무시간은 0
- 비근무 유형(연차) — 시각을 넣어도 무시하고 LEAVE
- 시각 없는 근무유형·근무표에 없는 날 — 실측만, 판정 기준이 없으므로 나머지 0

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 근무유형 API

**Files:**
- Create: `server/validators/shiftType.schema.js`
- Create: `server/services/shiftType.service.js`
- Create: `server/routes/shiftType.js`

**Interfaces:**
- Consumes: Task 1의 `prisma.shiftType`
- Produces:
  - `/api/shiftType/list` `{only_active?}` → `ShiftType[]` (**인증만** 요구)
  - `/api/shiftType/save` `{id?, code, name, start_time?, end_time?, crosses_midnight?, break_minutes?, is_work?, color?, sort?, is_active?}` → `ShiftType`
  - `/api/shiftType/delete` `{id}` → `{ok: true}`
  - Task 5·6이 참조 무결성에 쓰고, Task 8·9가 팔레트로 쓴다.

- [ ] **Step 1: `server/validators/shiftType.schema.js`**

```javascript
import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  only_active: z.boolean().optional(),
});

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  code: z.string().trim().min(1, "코드를 입력하세요").max(20),
  name: z.string().trim().min(1, "명칭을 입력하세요").max(50),
  start_time: z.string().regex(HHMM, "시각은 HH:MM 형식입니다").nullish().or(z.literal("")),
  end_time: z.string().regex(HHMM, "시각은 HH:MM 형식입니다").nullish().or(z.literal("")),
  crosses_midnight: z.boolean().optional(),
  break_minutes: z.coerce.number().int().min(0).optional(),
  is_work: z.boolean().optional(),
  color: z.string().trim().max(20).optional(),
  sort: z.coerce.number().int().optional(),
  is_active: z.boolean().optional(),
});
```

`.optional()`을 쓰고 `.default()`를 쓰지 않는다. 부분 수정 시 Zod가 기본값을 채워 기존 값을 덮어쓰는 것을 막는다(앞 사이클에서 겪은 결함).

빈 문자열 `""`를 허용하는 이유: `<input>`을 비우면 `""`가 온다. 서비스에서 `null`로 정규화한다.

- [ ] **Step 2: `server/services/shiftType.service.js`**

```javascript
import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

/** "" 를 null 로 — 입력을 비우면 빈 문자열이 온다 */
function normTime(v) {
  return v === "" || v === undefined ? null : v;
}

export default {
  async list({ only_active } = {}) {
    const where = only_active ? { is_active: true } : {};
    return prisma.shiftType.findMany({
      where,
      orderBy: [{ sort: "asc" }, { id: "asc" }],
    });
  },

  async save(data) {
    const { id, ...fields } = data;

    if (fields.start_time !== undefined) fields.start_time = normTime(fields.start_time);
    if (fields.end_time !== undefined) fields.end_time = normTime(fields.end_time);

    const dup = await prisma.shiftType.findFirst({
      where: { code: fields.code, ...(id ? { id: { not: id } } : {}) },
    });
    if (dup) throw new AppError("이미 존재하는 근무유형 코드입니다.", 400, "DUPLICATE");

    if (id) {
      const ex = await prisma.shiftType.findUnique({ where: { id } });
      if (!ex) throw new AppError("근무유형을 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.shiftType.update({ where: { id }, data: fields });
    }
    return prisma.shiftType.create({ data: fields });
  },

  async remove(id) {
    const ex = await prisma.shiftType.findUnique({ where: { id } });
    if (!ex) throw new AppError("근무유형을 찾을 수 없습니다.", 404, "NOT_FOUND");

    const [schedules, attendances] = await Promise.all([
      prisma.shiftSchedule.count({ where: { shift_type_id: id } }),
      prisma.attendance.count({ where: { shift_type_id: id } }),
    ]);
    const used = schedules + attendances;
    if (used > 0) {
      throw new AppError(
        `근무표·근태에서 ${used}건 사용 중이라 삭제할 수 없습니다. 비활성 처리하세요.`,
        400,
        "IN_USE",
      );
    }

    await prisma.shiftType.delete({ where: { id } });
    return { ok: true };
  },
};
```

- [ ] **Step 3: `server/routes/shiftType.js`**

```javascript
import service from "../services/shiftType.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/shiftType.schema.js";
import { permission } from "../middleware/permission.js";

function ensureAuth(user) {
  if (!user?.id) {
    const e = new Error("로그인이 필요합니다."); e.statusCode = 401; e.code = "UNAUTH"; e.isOperational = true; throw e;
  }
}

/**
 * 근무유형 (/api/shiftType) — 데이/이브닝/나이트/비번/연차/병가
 * /list 는 근무표 화면의 팔레트 공급원이라 인증만 요구한다. 권한을 걸면
 * 근태 담당자가 근무표를 못 짠다. (category/list 와 같은 이유)
 * 쓰기는 환경설정 권한을 유지한다.
 */
export default async function shiftTypeRoutes(app) {
  app.post("/list", async (req) => { ensureAuth(req.user); return service.list(validate(listSchema, req.body || {})); });
  app.post("/save", { preHandler: permission("permission.menu.update") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/delete", { preHandler: permission("permission.menu.update") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
```

- [ ] **Step 4: 라우트 로드 확인**

```bash
cd /Users/wjd/프로젝트/hospital_server
(node server/index.js > /tmp/boot4.log 2>&1 &) ; sleep 6; pkill -f "node server/index.js"; sleep 1
grep -c "Route loaded" /tmp/boot4.log
grep "Route loaded" /tmp/boot4.log | grep shiftType
```

Expected: 라우트 `19`개, `/api/shiftType` 포함.

- [ ] **Step 5: 커밋**

```bash
git add server/routes/shiftType.js server/services/shiftType.service.js server/validators/shiftType.schema.js
git commit -m "$(cat <<'EOF'
근태: 근무유형 API

/list 는 인증만 요구한다 — 근무표 팔레트의 공급원이라 권한을 걸면 근태
담당자가 근무표를 못 짠다. category/list 와 같은 이유.

삭제는 근무표·근태에서 쓰이면 IN_USE 로 거부.

검증기는 .default() 대신 .optional() 을 쓴다. 부분 수정 시 Zod 가 기본값을
채워 기존 값을 덮어쓰는 것을 막는다.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 근무표 API (grid · saveCell · saveBulk · copyMonth)

**Files:**
- Create: `server/validators/shiftSchedule.schema.js`
- Create: `server/services/shiftSchedule.service.js`
- Create: `server/routes/shiftSchedule.js`

**Interfaces:**
- Consumes: Task 1의 `prisma.shiftSchedule`, Task 2의 권한
- Produces:
  - `/api/shiftSchedule/grid` `{department_id, year, month}` → `{employees, days, cells, counts}` (아래 형태 참조)
  - `/api/shiftSchedule/saveCell` `{employee_id, work_date, shift_type_id, memo?}` → `ShiftSchedule`
  - `/api/shiftSchedule/saveBulk` `{cells: [{employee_id, work_date, shift_type_id}]}` → `{saved: number}`
  - `/api/shiftSchedule/copyMonth` `{department_id, from_year, from_month, to_year, to_month}` → `{copied, skipped}`
  - `/api/shiftSchedule/deleteCell` `{employee_id, work_date}` → `{ok: true}`
  - Task 6(attendance)이 `shiftSchedule`을 읽어 판정 기준을 찾고, Task 9(그리드)가 소비한다.

- [ ] **Step 1: `server/validators/shiftSchedule.schema.js`**

```javascript
import { z } from "zod";

const cellSchema = z.object({
  employee_id: z.coerce.number().int().positive(),
  work_date: z.coerce.date(),
  shift_type_id: z.coerce.number().int().positive(),
  memo: z.string().trim().max(200).nullish(),
});

export const gridSchema = z.object({
  department_id: z.coerce.number().int().positive(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const saveCellSchema = cellSchema;

export const saveBulkSchema = z.object({
  cells: z.array(cellSchema).min(1, "저장할 셀이 없습니다"),
});

export const copyMonthSchema = z.object({
  department_id: z.coerce.number().int().positive(),
  from_year: z.coerce.number().int().min(2000).max(2100),
  from_month: z.coerce.number().int().min(1).max(12),
  to_year: z.coerce.number().int().min(2000).max(2100),
  to_month: z.coerce.number().int().min(1).max(12),
});

export const deleteCellSchema = z.object({
  employee_id: z.coerce.number().int().positive(),
  work_date: z.coerce.date(),
});
```

- [ ] **Step 2: `server/services/shiftSchedule.service.js`**

```javascript
import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

/** Date → "2026-08-03" (로컬 기준). DB 의 @db.Date 는 UTC 자정으로 오므로 UTC 로 읽는다. */
function ymd(d) {
  const dt = new Date(d);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "2026-08-03" → Date (UTC 자정). @db.Date 컬럼에 넣을 값. */
function toDate(s) {
  return new Date(`${ymd(s)}T00:00:00.000Z`);
}

/** 그 달의 1일 ~ 말일 (UTC 자정) */
function monthRange(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // 다음달 0일 = 이번달 말일
  return { start, end, lastDay: end.getUTCDate() };
}

export default {
  /** 직원 × 날짜 2차원. 셀마다 API 를 부르면 30일 × 20명 = 600번이 된다. */
  async grid({ department_id, year, month }) {
    const { start, end, lastDay } = monthRange(year, month);

    const employees = await prisma.employee.findMany({
      where: { department_id, resigned_at: null },
      orderBy: [{ emp_no: "asc" }],
      select: {
        id: true,
        emp_no: true,
        name: true,
        position: { select: { text: true } },
        job_type: { select: { text: true } },
      },
    });

    const rows = await prisma.shiftSchedule.findMany({
      where: {
        employee_id: { in: employees.map((e) => e.id) },
        work_date: { gte: start, lte: end },
      },
      include: { shift_type: { select: { id: true, code: true, name: true, color: true } } },
    });

    // cells: "employeeId:YYYY-MM-DD" → { shift_type_id, code, color, memo }
    const cells = {};
    // counts: "YYYY-MM-DD" → { D: 5, E: 3, ... }
    const counts = {};

    for (const r of rows) {
      const key = ymd(r.work_date);
      cells[`${r.employee_id}:${key}`] = {
        shift_type_id: r.shift_type_id,
        code: r.shift_type.code,
        color: r.shift_type.color,
        memo: r.memo,
      };
      if (!counts[key]) counts[key] = {};
      counts[key][r.shift_type.code] = (counts[key][r.shift_type.code] ?? 0) + 1;
    }

    const days = [];
    for (let d = 1; d <= lastDay; d++) {
      const dt = new Date(Date.UTC(year, month - 1, d));
      days.push({
        date: ymd(dt),
        day: d,
        weekday: dt.getUTCDay(), // 0=일 … 6=토
      });
    }

    return {
      employees: employees.map((e) => ({
        id: e.id,
        emp_no: e.emp_no,
        name: e.name,
        position: e.position?.text ?? null,
        job_type: e.job_type?.text ?? null,
      })),
      days,
      cells,
      counts,
    };
  },

  async saveCell({ employee_id, work_date, shift_type_id, memo }) {
    const wd = toDate(work_date);
    return prisma.shiftSchedule.upsert({
      where: { employee_id_work_date: { employee_id, work_date: wd } },
      update: { shift_type_id, memo: memo ?? null },
      create: { employee_id, work_date: wd, shift_type_id, memo: memo ?? null },
    });
  },

  /** 드래그로 여러 칸을 한 번에 칠할 때 */
  async saveBulk({ cells }) {
    await prisma.$transaction(
      cells.map((c) =>
        prisma.shiftSchedule.upsert({
          where: {
            employee_id_work_date: { employee_id: c.employee_id, work_date: toDate(c.work_date) },
          },
          update: { shift_type_id: c.shift_type_id, memo: c.memo ?? null },
          create: {
            employee_id: c.employee_id,
            work_date: toDate(c.work_date),
            shift_type_id: c.shift_type_id,
            memo: c.memo ?? null,
          },
        }),
      ),
    );
    return { saved: cells.length };
  },

  /**
   * 지난달 근무표 복사. 수간호사가 매달 처음부터 짜지 않도록.
   * 대상 월에 이미 근무가 있는 칸은 건너뛴다 — 실수로 짜둔 근무표를 날리면 안 된다.
   */
  async copyMonth({ department_id, from_year, from_month, to_year, to_month }) {
    const from = monthRange(from_year, from_month);
    const to = monthRange(to_year, to_month);

    const employees = await prisma.employee.findMany({
      where: { department_id, resigned_at: null },
      select: { id: true },
    });
    const empIds = employees.map((e) => e.id);
    if (!empIds.length) return { copied: 0, skipped: 0 };

    const [source, existing] = await Promise.all([
      prisma.shiftSchedule.findMany({
        where: { employee_id: { in: empIds }, work_date: { gte: from.start, lte: from.end } },
        select: { employee_id: true, work_date: true, shift_type_id: true },
      }),
      prisma.shiftSchedule.findMany({
        where: { employee_id: { in: empIds }, work_date: { gte: to.start, lte: to.end } },
        select: { employee_id: true, work_date: true },
      }),
    ]);

    const taken = new Set(existing.map((e) => `${e.employee_id}:${ymd(e.work_date)}`));

    const toCreate = [];
    let skipped = 0;
    for (const s of source) {
      const day = new Date(s.work_date).getUTCDate();
      if (day > to.lastDay) { skipped++; continue; } // 31일 → 30일뿐인 달

      const target = new Date(Date.UTC(to_year, to_month - 1, day));
      const key = `${s.employee_id}:${ymd(target)}`;
      if (taken.has(key)) { skipped++; continue; }

      toCreate.push({
        employee_id: s.employee_id,
        work_date: target,
        shift_type_id: s.shift_type_id,
      });
    }

    if (toCreate.length) {
      await prisma.shiftSchedule.createMany({ data: toCreate });
    }
    return { copied: toCreate.length, skipped };
  },

  async removeCell({ employee_id, work_date }) {
    const wd = toDate(work_date);
    const ex = await prisma.shiftSchedule.findUnique({
      where: { employee_id_work_date: { employee_id, work_date: wd } },
    });
    if (!ex) throw new AppError("근무를 찾을 수 없습니다.", 404, "NOT_FOUND");
    await prisma.shiftSchedule.delete({ where: { id: ex.id } });
    return { ok: true };
  },
};
```

`employee_id_work_date`는 Task 1의 `@@unique([employee_id, work_date])`가 만드는 복합 유니크 키 이름이다.

- [ ] **Step 3: `server/routes/shiftSchedule.js`**

```javascript
import service from "../services/shiftSchedule.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  gridSchema,
  saveCellSchema,
  saveBulkSchema,
  copyMonthSchema,
  deleteCellSchema,
} from "../validators/shiftSchedule.schema.js";
import { permission } from "../middleware/permission.js";

/** 근무표 (/api/shiftSchedule) — 직원 × 날짜 그리드 */
export default async function shiftScheduleRoutes(app) {
  app.post("/grid", { preHandler: permission("attendance.view") }, async (req) => service.grid(validate(gridSchema, req.body)));
  app.post("/saveCell", { preHandler: permission("attendance.edit") }, async (req) => service.saveCell(validate(saveCellSchema, req.body)));
  app.post("/saveBulk", { preHandler: permission("attendance.edit") }, async (req) => service.saveBulk(validate(saveBulkSchema, req.body)));
  app.post("/copyMonth", { preHandler: permission("attendance.edit") }, async (req) => service.copyMonth(validate(copyMonthSchema, req.body)));
  app.post("/deleteCell", { preHandler: permission("attendance.edit") }, async (req) => service.removeCell(validate(deleteCellSchema, req.body)));
}
```

- [ ] **Step 4: 라우트 로드 확인**

```bash
cd /Users/wjd/프로젝트/hospital_server
(node server/index.js > /tmp/boot5.log 2>&1 &) ; sleep 6; pkill -f "node server/index.js"; sleep 1
grep -c "Route loaded" /tmp/boot5.log
grep "Route loaded" /tmp/boot5.log | grep shiftSchedule
```

Expected: 라우트 `20`개, `/api/shiftSchedule` 포함.

- [ ] **Step 5: 커밋**

```bash
git add server/routes/shiftSchedule.js server/services/shiftSchedule.service.js server/validators/shiftSchedule.schema.js
git commit -m "$(cat <<'EOF'
근태: 근무표 API (grid · saveCell · saveBulk · copyMonth)

grid 가 직원 × 날짜 2차원을 한 번에 반환한다. 셀마다 API 를 부르면
30일 × 20명 = 600번이 된다. 일자별 인원 집계(counts)도 서버가 계산해
내려준다 — 결원(그날 나이트가 1명뿐)을 한눈에 잡기 위한 것.

copyMonth 는 덮어쓰지 않는다. 대상 월에 이미 근무가 있는 칸은 건너뛰고
{copied, skipped} 를 반환한다. 실수로 짜둔 근무표를 날리면 안 된다.
31일 → 30일뿐인 달로 복사할 때도 건너뛴다.

@db.Date 는 UTC 자정으로 저장되므로 날짜 키를 만들 때 getUTC* 로 읽는다.
로컬 시간대로 읽으면 타임존에 따라 하루가 밀린다.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 출퇴근 API (save가 계산기를 호출해 판정)

**Files:**
- Create: `server/validators/attendance.schema.js`
- Create: `server/services/attendance.service.js`
- Create: `server/routes/attendance.js`

**Interfaces:**
- Consumes: Task 3의 `calcAttendance()`, Task 1의 `prisma.attendance`, Task 5의 `prisma.shiftSchedule`
- Produces:
  - `/api/attendance/list` `{department_id?, employee_id?, date_from, date_to, status?, page?, limit?}` → `{rows, total, page, limit, totalPages}`
  - `/api/attendance/save` `{id?, employee_id, work_date, check_in?, check_out?, memo?}` → `Attendance` (**서버가 판정**)
  - `/api/attendance/bulkGenerate` `{department_id, work_date}` → `{created, skipped}`
  - `/api/attendance/summary` `{department_id, year, month}` → 직원별 집계
  - `/api/attendance/delete` `{id}` → `{ok: true}`
  - Task 10(출퇴근 화면)이 소비한다.

- [ ] **Step 1: `server/validators/attendance.schema.js`**

```javascript
import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  department_id: z.coerce.number().int().positive().nullish(),
  employee_id: z.coerce.number().int().positive().nullish(),
  date_from: z.coerce.date(),
  date_to: z.coerce.date(),
  status: z.enum(["NORMAL", "LATE", "EARLY_LEAVE", "ABSENT", "LEAVE"]).nullish(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  employee_id: z.coerce.number().int().positive(),
  work_date: z.coerce.date(),
  check_in: z.coerce.date().nullish().or(z.literal("")),
  check_out: z.coerce.date().nullish().or(z.literal("")),
  memo: z.string().trim().max(200).nullish(),
});

export const bulkGenerateSchema = z.object({
  department_id: z.coerce.number().int().positive(),
  work_date: z.coerce.date(),
});

export const summarySchema = z.object({
  department_id: z.coerce.number().int().positive(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});
```

`check_in`/`check_out`이 `""`를 허용하는 이유: `<input type="datetime-local">`을 비우면 `""`가 온다. 서비스에서 `null`로 정규화한다. 앞 사이클에서 이걸 놓쳐 저장이 전부 실패했다.

- [ ] **Step 2: `server/services/attendance.service.js`**

```javascript
import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";
import { calcAttendance } from "../lib/attendanceCalc.js";

/** "" 를 null 로 — 입력을 비우면 빈 문자열이 온다 */
function normDate(v) {
  return v === "" || v === undefined ? null : v;
}

/** @db.Date 는 UTC 자정으로 저장된다 */
function toDateOnly(d) {
  const dt = new Date(d);
  return new Date(
    Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()),
  );
}

function monthRange(year, month) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0)),
  };
}

const DETAIL_INCLUDE = {
  employee: {
    select: {
      id: true,
      emp_no: true,
      name: true,
      department: { select: { id: true, name: true } },
    },
  },
  shift_type: { select: { id: true, code: true, name: true, color: true } },
};

export default {
  async list({ department_id, employee_id, date_from, date_to, status, q, page, limit }) {
    const where = {
      work_date: { gte: toDateOnly(date_from), lte: toDateOnly(date_to) },
    };
    if (employee_id) where.employee_id = employee_id;
    if (status) where.status = status;
    if (department_id || q) {
      where.employee = {};
      if (department_id) where.employee.department_id = department_id;
      if (q) where.employee.OR = [{ name: { contains: q } }, { emp_no: { contains: q } }];
    }

    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        orderBy: [{ work_date: "desc" }, { employee_id: "asc" }],
        skip,
        take: l,
        include: DETAIL_INCLUDE,
      }),
      prisma.attendance.count({ where }),
    ]);
    return buildPageResult({ rows, total, page: p, limit: l });
  },

  /**
   * 저장 시 서버가 판정한다.
   * 1) 근무표에서 그 직원·그 날짜의 예정 근무유형을 찾는다
   * 2) 없으면 shift_type_id = null (근무표에 없는 날 출근)
   * 3) calcAttendance() 에 넘겨 판정
   * 4) 결과와 판정 기준(shift_type_id 스냅샷)을 저장
   */
  async save(data) {
    const { id, employee_id, work_date, memo } = data;
    const checkIn = normDate(data.check_in);
    const checkOut = normDate(data.check_out);
    const wd = toDateOnly(work_date);

    const emp = await prisma.employee.findUnique({ where: { id: employee_id } });
    if (!emp) throw new AppError("직원을 찾을 수 없습니다.", 404, "NOT_FOUND");

    const schedule = await prisma.shiftSchedule.findUnique({
      where: { employee_id_work_date: { employee_id, work_date: wd } },
      include: { shift_type: true },
    });
    const shiftType = schedule?.shift_type ?? null;

    const calc = calcAttendance({
      shiftType,
      checkIn: checkIn ? new Date(checkIn) : null,
      checkOut: checkOut ? new Date(checkOut) : null,
      workDate: wd,
    });

    const payload = {
      employee_id,
      work_date: wd,
      check_in: checkIn ? new Date(checkIn) : null,
      check_out: checkOut ? new Date(checkOut) : null,
      shift_type_id: shiftType?.id ?? null, // 판정 기준 스냅샷
      status: calc.status,
      work_minutes: calc.workMinutes,
      overtime_minutes: calc.overtimeMinutes,
      late_minutes: calc.lateMinutes,
      early_leave_minutes: calc.earlyLeaveMinutes,
      memo: memo ?? null,
    };

    return prisma.attendance.upsert({
      where: { employee_id_work_date: { employee_id, work_date: wd } },
      update: payload,
      create: payload,
      include: DETAIL_INCLUDE,
    });
  },

  /**
   * 그날 근무표에 있는 직원의 빈 출퇴근 행을 만든다.
   * 관리자가 시각만 채우면 되도록. 이미 있는 행은 건드리지 않는다.
   */
  async bulkGenerate({ department_id, work_date }) {
    const wd = toDateOnly(work_date);

    const employees = await prisma.employee.findMany({
      where: { department_id, resigned_at: null },
      select: { id: true },
    });
    const empIds = employees.map((e) => e.id);
    if (!empIds.length) return { created: 0, skipped: 0 };

    const [schedules, existing] = await Promise.all([
      prisma.shiftSchedule.findMany({
        where: { employee_id: { in: empIds }, work_date: wd },
        include: { shift_type: true },
      }),
      prisma.attendance.findMany({
        where: { employee_id: { in: empIds }, work_date: wd },
        select: { employee_id: true },
      }),
    ]);

    const taken = new Set(existing.map((e) => e.employee_id));

    const toCreate = [];
    let skipped = 0;
    for (const s of schedules) {
      if (taken.has(s.employee_id)) { skipped++; continue; }

      // 시각이 비어 있으므로 판정은 ABSENT(출근 없음) 또는 LEAVE(비근무 유형)
      const calc = calcAttendance({
        shiftType: s.shift_type,
        checkIn: null,
        checkOut: null,
        workDate: wd,
      });

      toCreate.push({
        employee_id: s.employee_id,
        work_date: wd,
        shift_type_id: s.shift_type_id,
        status: calc.status,
        work_minutes: 0,
        overtime_minutes: 0,
        late_minutes: 0,
        early_leave_minutes: 0,
      });
    }

    if (toCreate.length) {
      await prisma.attendance.createMany({ data: toCreate });
    }
    return { created: toCreate.length, skipped };
  },

  /** 직원별 월간 집계 */
  async summary({ department_id, year, month }) {
    const { start, end } = monthRange(year, month);

    const employees = await prisma.employee.findMany({
      where: { department_id, resigned_at: null },
      orderBy: [{ emp_no: "asc" }],
      select: { id: true, emp_no: true, name: true },
    });
    const empIds = employees.map((e) => e.id);
    if (!empIds.length) return [];

    const rows = await prisma.attendance.findMany({
      where: { employee_id: { in: empIds }, work_date: { gte: start, lte: end } },
      select: {
        employee_id: true,
        status: true,
        work_minutes: true,
        overtime_minutes: true,
        late_minutes: true,
      },
    });

    const byEmp = new Map();
    for (const e of employees) {
      byEmp.set(e.id, {
        employee_id: e.id,
        emp_no: e.emp_no,
        name: e.name,
        work_days: 0,
        work_minutes: 0,
        overtime_minutes: 0,
        late_count: 0,
        absent_count: 0,
        leave_count: 0,
      });
    }

    for (const r of rows) {
      const s = byEmp.get(r.employee_id);
      if (!s) continue;
      if (r.status === "ABSENT") s.absent_count++;
      else if (r.status === "LEAVE") s.leave_count++;
      else {
        s.work_days++;
        s.work_minutes += r.work_minutes;
        s.overtime_minutes += r.overtime_minutes;
        if (r.status === "LATE") s.late_count++;
      }
    }

    return [...byEmp.values()];
  },

  async remove(id) {
    const ex = await prisma.attendance.findUnique({ where: { id } });
    if (!ex) throw new AppError("근태를 찾을 수 없습니다.", 404, "NOT_FOUND");
    await prisma.attendance.delete({ where: { id } });
    return { ok: true };
  },
};
```

- [ ] **Step 3: `server/routes/attendance.js`**

```javascript
import service from "../services/attendance.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idSchema,
  listSchema,
  saveSchema,
  bulkGenerateSchema,
  summarySchema,
} from "../validators/attendance.schema.js";
import { permission } from "../middleware/permission.js";

/** 출퇴근 (/api/attendance) — save 가 근무표와 대조해 서버에서 판정한다 */
export default async function attendanceRoutes(app) {
  app.post("/list", { preHandler: permission("attendance.view") }, async (req) => service.list(validate(listSchema, req.body)));
  app.post("/save", { preHandler: permission("attendance.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/bulkGenerate", { preHandler: permission("attendance.edit") }, async (req) => service.bulkGenerate(validate(bulkGenerateSchema, req.body)));
  app.post("/summary", { preHandler: permission("attendance.view") }, async (req) => service.summary(validate(summarySchema, req.body)));
  app.post("/delete", { preHandler: permission("attendance.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
```

- [ ] **Step 4: 라우트 로드 확인**

```bash
cd /Users/wjd/프로젝트/hospital_server
(node server/index.js > /tmp/boot6.log 2>&1 &) ; sleep 6; pkill -f "node server/index.js"; sleep 1
grep -c "Route loaded" /tmp/boot6.log
grep "Route loaded" /tmp/boot6.log | grep -E "shiftType|shiftSchedule|attendance"
```

Expected: 라우트 `21`개, 셋 다 로드.

- [ ] **Step 5: 커밋**

```bash
git add server/routes/attendance.js server/services/attendance.service.js server/validators/attendance.schema.js
git commit -m "$(cat <<'EOF'
근태: 출퇴근 API (save 가 근무표와 대조해 서버에서 판정)

save 흐름:
1. 근무표에서 그 직원·그 날짜의 예정 근무유형을 찾는다
2. 없으면 shift_type_id = null (근무표에 없는 날 출근)
3. calcAttendance() 에 넘겨 판정
4. 결과와 판정 기준(shift_type_id 스냅샷)을 저장

판정을 클라이언트에 맡기지 않는다. 급여가 이 값을 참조하므로 서버가
단일 진실 원천이어야 한다.

bulkGenerate 는 그날 근무표에 있는 직원의 빈 행을 만든다. 관리자가 시각만
채우면 되도록. 이미 있는 행은 건드리지 않는다.

check_in/check_out 검증기가 "" 를 허용한다. <input type="datetime-local">
을 비우면 빈 문자열이 오고, z.coerce.date() 가 Invalid Date 로 터진다.
앞 사이클에서 이걸 놓쳐 저장이 전부 실패했다.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 시드 — 근무유형 6개

**Files:**
- Modify: `prisma/seed-hr.js`

**Interfaces:**
- Consumes: Task 1의 `prisma.shiftType`
- Produces: 근무유형 6개 (`D`/`E`/`N`/`OFF`/`ANNUAL`/`SICK`). Task 8·9의 화면 검증이 쓴다.

- [ ] **Step 1: `prisma/seed-hr.js`에 근무유형 배열 추가**

`DEPARTMENTS` 배열 아래에 추가한다.

```javascript
// [code, name, start, end, crosses_midnight, break_minutes, is_work, color]
const SHIFT_TYPES = [
  ["D", "데이", "07:00", "15:00", false, 30, true, "#2563eb"],
  ["E", "이브닝", "15:00", "23:00", false, 30, true, "#d97706"],
  ["N", "나이트", "22:00", "07:00", true, 60, true, "#4338ca"],
  ["OFF", "비번", null, null, false, 0, false, "#94a3b8"],
  ["ANNUAL", "연차", null, null, false, 0, false, "#059669"],
  ["SICK", "병가", null, null, false, 0, false, "#dc2626"],
];
```

`N`의 22:00~07:00은 9시간이고 휴게 60분을 빼면 실근무 8시간이다. Task 3의 테스트가 이 값을 검증한다.

- [ ] **Step 2: `main()`에 시드 로직 추가**

부서 트리 시드 아래, `console.log` 위에 추가한다.

```javascript
  // 3) 근무유형
  let ssort = 0;
  for (const [code, name, start_time, end_time, crosses_midnight, break_minutes, is_work, color] of SHIFT_TYPES) {
    await prisma.shiftType.upsert({
      where: { code },
      update: { name, start_time, end_time, crosses_midnight, break_minutes, is_work, color, sort: ssort },
      create: { code, name, start_time, end_time, crosses_midnight, break_minutes, is_work, color, sort: ssort },
    });
    ssort++;
  }
```

`console.log`도 고친다.

```javascript
  console.log(
    `✅ hr seed done: ${CODES.length} codes, ${DEPARTMENTS.length} departments, ${SHIFT_TYPES.length} shift types`,
  );
```

- [ ] **Step 3: 시드 실행 (두 번 — 멱등성 확인)**

```bash
cd /Users/wjd/프로젝트/hospital_server
npm run seed:hr
npm run seed:hr
```

Expected (두 번 다): `✅ hr seed done: 24 codes, 8 departments, 6 shift types`

- [ ] **Step 4: DB 확인**

```bash
M=/opt/homebrew/opt/mysql@8.0/bin/mysql
$M -u root -h 127.0.0.1 hospital_system -e "SELECT code, name, start_time, end_time, crosses_midnight, break_minutes, is_work FROM ShiftType ORDER BY sort;"
```

Expected: 6행. `N`의 `crosses_midnight`이 `1`, `break_minutes`가 `60`. `OFF`/`ANNUAL`/`SICK`의 `is_work`가 `0`이고 시각이 `NULL`.

두 번 돌려도 6행이어야 한다(멱등성).

- [ ] **Step 5: 커밋**

```bash
git add prisma/seed-hr.js
git commit -m "$(cat <<'EOF'
근태: 근무유형 6개 시드 (D/E/N/OFF/ANNUAL/SICK)

N(나이트)은 22:00~07:00, crosses_midnight=true, 휴게 60분.
9시간 - 휴게 60분 = 실근무 8시간. attendanceCalc 테스트가 이 값을 검증한다.

OFF/ANNUAL/SICK 은 is_work=false 라 시각이 없고 근태 판정에서 LEAVE 가 된다.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 프론트 — API 모듈 + 근무유형 관리 탭

**Files:**
- Create: `src/api/attendance.ts`
- Create: `src/pages/settings/ShiftTypeSettings.vue`
- Modify: `src/pages/settings/SettingsView.vue`

**Interfaces:**
- Consumes: Task 4·5·6의 API
- Produces:
  - `src/api/attendance.ts` → `shiftTypeApi { list, save, remove }`, `shiftScheduleApi { grid, saveCell, saveBulk, copyMonth, deleteCell }`, `attendanceApi { list, save, bulkGenerate, summary, remove }`
  - 환경설정의 `shifttype` 탭
  - Task 9·10이 API 모듈을 쓴다.

- [ ] **Step 1: 프론트 브랜치 생성**

```bash
cd /Users/wjd/프로젝트/hospital_frontend
git checkout -b hr-attendance
git branch --show-current
```

Expected: `hr-attendance`

- [ ] **Step 2: `src/api/attendance.ts` 생성**

```typescript
// @ts-nocheck
import api from "@/api/api";

// 근무유형 (D/E/N/OFF/ANNUAL/SICK)
export const shiftTypeApi = {
  list: (body = {}) => api.post("/shiftType/list", body).then((r) => r.data),
  save: (body) => api.post("/shiftType/save", body).then((r) => r.data),
  remove: (id) => api.post("/shiftType/delete", { id }).then((r) => r.data),
};

// 근무표 (직원 × 날짜 그리드)
export const shiftScheduleApi = {
  grid: (department_id, year, month) =>
    api.post("/shiftSchedule/grid", { department_id, year, month }).then((r) => r.data),
  saveCell: (body) => api.post("/shiftSchedule/saveCell", body).then((r) => r.data),
  saveBulk: (cells) => api.post("/shiftSchedule/saveBulk", { cells }).then((r) => r.data),
  copyMonth: (body) => api.post("/shiftSchedule/copyMonth", body).then((r) => r.data),
  deleteCell: (employee_id, work_date) =>
    api.post("/shiftSchedule/deleteCell", { employee_id, work_date }).then((r) => r.data),
};

// 출퇴근
export const attendanceApi = {
  list: (body) => api.post("/attendance/list", body).then((r) => r.data),
  save: (body) => api.post("/attendance/save", body).then((r) => r.data),
  bulkGenerate: (department_id, work_date) =>
    api.post("/attendance/bulkGenerate", { department_id, work_date }).then((r) => r.data),
  summary: (department_id, year, month) =>
    api.post("/attendance/summary", { department_id, year, month }).then((r) => r.data),
  remove: (id) => api.post("/attendance/delete", { id }).then((r) => r.data),
};
```

- [ ] **Step 3: `src/pages/settings/ShiftTypeSettings.vue` 생성**

```vue
<template>
  <div class="st">
    <p class="desc">{{ $t("근무유형을 등록합니다. 근무표 그리드의 팔레트가 됩니다.") }}</p>

    <table class="tbl">
      <thead>
        <tr>
          <th style="width: 90px">{{ $t("코드") }}</th>
          <th style="width: 120px">{{ $t("명칭") }}</th>
          <th style="width: 100px">{{ $t("시작") }}</th>
          <th style="width: 100px">{{ $t("종료") }}</th>
          <th style="width: 90px">{{ $t("자정넘김") }}</th>
          <th style="width: 90px">{{ $t("휴게(분)") }}</th>
          <th style="width: 80px">{{ $t("근무") }}</th>
          <th style="width: 80px">{{ $t("색상") }}</th>
          <th style="width: 90px"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!rows.length">
          <td colspan="9">
            <EmptyState icon="fa-clock" :title="$t('근무유형이 없습니다')" :desc="$t('아래에서 추가하세요.')" compact />
          </td>
        </tr>
        <tr v-for="r in rows" :key="r.id">
          <td><input v-model="r.code" class="cell-input" @change="update(r)" /></td>
          <td><input v-model="r.name" class="cell-input" @change="update(r)" /></td>
          <td><input v-model="r.start_time" class="cell-input" placeholder="07:00" :disabled="!r.is_work" @change="update(r)" /></td>
          <td><input v-model="r.end_time" class="cell-input" placeholder="15:00" :disabled="!r.is_work" @change="update(r)" /></td>
          <td><BaseToggle v-model="r.crosses_midnight" size="sm" :disabled="!r.is_work" @update:modelValue="update(r)" /></td>
          <td><input v-model.number="r.break_minutes" type="number" min="0" class="cell-input" :disabled="!r.is_work" @change="update(r)" /></td>
          <td><BaseToggle v-model="r.is_work" size="sm" @update:modelValue="onWorkToggle(r)" /></td>
          <td><input v-model="r.color" type="color" class="colorin" @change="update(r)" /></td>
          <td><button class="btn btn-xs btn-ghost" @click="remove(r)">{{ $t("삭제") }}</button></td>
        </tr>
      </tbody>
    </table>

    <div class="addrow">
      <input v-model="draft.code" class="field field-xs" style="width: 90px" :placeholder="$t('코드')" />
      <input v-model="draft.name" class="field field-xs" style="width: 120px" :placeholder="$t('명칭')" />
      <input v-model="draft.start_time" class="field field-xs" style="width: 100px" placeholder="07:00" />
      <input v-model="draft.end_time" class="field field-xs" style="width: 100px" placeholder="15:00" />
      <button class="btn btn-xs btn-primary" @click="add">＋ {{ $t("추가") }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, reactive, onMounted } from "vue";
import BaseToggle from "@/components/base/BaseToggle.vue";
import EmptyState from "@/components/base/EmptyState.vue";
import { shiftTypeApi } from "@/api/attendance";
import { useToast } from "vue-toastification";

const toast = useToast();
const rows = ref([]);
const draft = reactive({ code: "", name: "", start_time: "", end_time: "" });

async function load() {
  rows.value = await shiftTypeApi.list({});
}

/** 비근무(OFF/연차)로 바꾸면 시각·휴게·자정넘김을 비운다 — 의미가 없다 */
function onWorkToggle(r) {
  if (!r.is_work) {
    r.start_time = "";
    r.end_time = "";
    r.crosses_midnight = false;
    r.break_minutes = 0;
  }
  update(r);
}

async function update(r) {
  try {
    await shiftTypeApi.save({
      id: r.id,
      code: r.code,
      name: r.name,
      start_time: r.start_time || "",
      end_time: r.end_time || "",
      crosses_midnight: r.crosses_midnight,
      break_minutes: r.break_minutes ?? 0,
      is_work: r.is_work,
      color: r.color,
      sort: r.sort,
      is_active: r.is_active,
    });
  } catch (e) {
    toast.error(e?.message || "수정에 실패했습니다.");
    await load();
  }
}

async function add() {
  if (!draft.code.trim() || !draft.name.trim()) {
    toast.warning("코드와 명칭을 입력하세요.");
    return;
  }
  try {
    await shiftTypeApi.save({
      code: draft.code.trim().toUpperCase(),
      name: draft.name.trim(),
      start_time: draft.start_time || "",
      end_time: draft.end_time || "",
      sort: rows.value.length,
    });
    draft.code = "";
    draft.name = "";
    draft.start_time = "";
    draft.end_time = "";
    await load();
  } catch (e) {
    toast.error(e?.message || "추가에 실패했습니다.");
  }
}

async function remove(r) {
  try {
    await shiftTypeApi.remove(r.id);
    await load();
  } catch (e) {
    toast.error(e?.message || "삭제에 실패했습니다.");
  }
}

onMounted(load);
</script>

<style scoped>
.st { min-width: 0; }
.desc { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem; }
.tbl { width: 100%; }
.colorin { width: 44px; height: 28px; border: 1px solid var(--border-strong); border-radius: var(--radius); cursor: pointer; background: none; padding: 2px; }
.addrow { display: flex; gap: 0.4rem; margin-top: 0.9rem; }
</style>
```

- [ ] **Step 4: `SettingsView.vue`에 탭 추가**

import를 추가한다.

```typescript
import ShiftTypeSettings from "@/pages/settings/ShiftTypeSettings.vue";
```

`tabs` 배열의 **`category` 탭 아래**에 넣는다.

```javascript
  { key: "shifttype", label: "근무유형", icon: "fa-clock", superOnly: true, comp: markRaw(ShiftTypeSettings), desc: "데이·이브닝·나이트 등 근무유형을 등록합니다. 근무표 그리드의 팔레트가 됩니다." },
```

- [ ] **Step 5: 빌드 검증**

```bash
cd /Users/wjd/프로젝트/hospital_frontend
npm run build
```

Expected: 성공.

- [ ] **Step 6: 커밋**

```bash
git add src/api/attendance.ts src/pages/settings/ShiftTypeSettings.vue src/pages/settings/SettingsView.vue
git commit -m "$(cat <<'EOF'
근태: API 모듈 + 근무유형 관리 탭

비근무(OFF/연차)로 토글하면 시각·휴게·자정넘김을 비운다 — 의미가 없는
필드가 남아 있으면 계산기가 헷갈린다.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: 프론트 — 근무표 그리드 ★ 이 사이클의 얼굴

**Files:**
- Create: `src/pages/hr/ScheduleView.vue`

**Interfaces:**
- Consumes: Task 8의 `shiftScheduleApi`·`shiftTypeApi`, 기존 `departmentApi.options()`
- Produces: `/hr/schedule` 라우트가 렌더링할 컴포넌트. Task 11이 라우터에 등록한다.

- [ ] **Step 1: `src/pages/hr/ScheduleView.vue` 생성**

```vue
<template>
  <div class="sch">
    <header class="phead">
      <h1 class="ttl">{{ $t("근무표") }}</h1>
    </header>

    <div class="filterbar">
      <span class="f-label">{{ $t("부서") }}</span>
      <SearchSelect v-model="deptId" :options="deptOptions" :placeholder="$t('부서 선택')" @change="load" />
      <select v-model.number="year" class="field field-xs" style="width: 100px" @change="load">
        <option v-for="y in years" :key="y" :value="y">{{ y }}년</option>
      </select>
      <select v-model.number="month" class="field field-xs" style="width: 90px" @change="load">
        <option v-for="m in 12" :key="m" :value="m">{{ m }}월</option>
      </select>
      <button class="btn btn-xs" :disabled="!deptId || copying" @click="copyLastMonth">
        {{ copying ? $t("복사 중…") : $t("지난달 복사") }}
      </button>
    </div>

    <!-- 팔레트 -->
    <div v-if="deptId" class="palette">
      <span class="plabel">{{ $t("근무유형") }}</span>
      <button
        v-for="t in shiftTypes"
        :key="t.id"
        class="pchip"
        :class="{ on: brush?.id === t.id }"
        :style="{ background: t.color, color: '#fff' }"
        @click="brush = brush?.id === t.id ? null : t"
      >
        {{ t.code }}
      </button>
      <button class="pchip erase" :class="{ on: brush === 'ERASE' }" @click="brush = brush === 'ERASE' ? null : 'ERASE'">
        {{ $t("지우기") }}
      </button>
      <span class="phint">{{ brush ? $t("셀을 클릭하거나 드래그하세요") : $t("유형을 먼저 고르세요") }}</span>
    </div>

    <EmptyState v-if="!deptId" icon="fa-calendar-days" :title="$t('부서를 선택하세요')" :desc="$t('부서를 고르면 그 달의 근무표가 표시됩니다.')" />

    <div v-else-if="!grid.employees.length" class="pcard">
      <EmptyState icon="fa-user" :title="$t('재직 중인 직원이 없습니다')" :desc="$t('직원 관리에서 등록하세요.')" compact />
    </div>

    <div v-else class="pcard gridwrap">
      <table class="gtbl" @mouseleave="endDrag">
        <thead>
          <tr>
            <th class="namecol">{{ $t("직원") }}</th>
            <th
              v-for="d in grid.days"
              :key="d.date"
              class="daycol"
              :class="{ sun: d.weekday === 0, sat: d.weekday === 6 }"
            >
              <div class="dnum">{{ d.day }}</div>
              <div class="dwk">{{ WEEK[d.weekday] }}</div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in grid.employees" :key="e.id">
            <td class="namecol">
              <div class="ename">{{ e.name }}</div>
              <div class="emeta">{{ e.emp_no }} · {{ e.job_type || "-" }}</div>
            </td>
            <td
              v-for="d in grid.days"
              :key="d.date"
              class="cell"
              :class="{ sun: d.weekday === 0, sat: d.weekday === 6 }"
              @mousedown="startDrag(e.id, d.date)"
              @mouseenter="dragOver(e.id, d.date)"
              @mouseup="endDrag"
            >
              <span
                v-if="cellOf(e.id, d.date)"
                class="chip"
                :style="{ background: cellOf(e.id, d.date).color }"
              >
                {{ cellOf(e.id, d.date).code }}
              </span>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr v-for="t in workTypes" :key="t.id" class="cntrow">
            <td class="namecol cntlabel">{{ t.code }}</td>
            <td v-for="d in grid.days" :key="d.date" class="cell cnt">
              {{ grid.counts[d.date]?.[t.code] || "" }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, reactive, computed, onMounted } from "vue";
import SearchSelect from "@/components/base/SearchSelect.vue";
import EmptyState from "@/components/base/EmptyState.vue";
import { shiftScheduleApi, shiftTypeApi } from "@/api/attendance";
import { departmentApi } from "@/api/hr";
import { useToast } from "vue-toastification";

const toast = useToast();
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

const now = new Date();
const deptId = ref(null);
const year = ref(now.getFullYear());
const month = ref(now.getMonth() + 1);
const years = computed(() => {
  const y = now.getFullYear();
  return [y - 1, y, y + 1];
});

const deptOptions = ref([]);
const shiftTypes = ref([]);
const workTypes = computed(() => shiftTypes.value.filter((t) => t.is_work));

const grid = reactive({ employees: [], days: [], cells: {}, counts: {} });
const brush = ref(null); // ShiftType 객체 | "ERASE" | null
const copying = ref(false);

const cellOf = (empId, date) => grid.cells[`${empId}:${date}`];

async function load() {
  if (!deptId.value) return;
  const g = await shiftScheduleApi.grid(deptId.value, year.value, month.value);
  grid.employees = g.employees;
  grid.days = g.days;
  grid.cells = g.cells;
  grid.counts = g.counts;
}

// ── 드래그로 여러 칸 칠하기 ──
let dragging = false;
let painted = [];

function startDrag(empId, date) {
  if (!brush.value) {
    toast.warning("근무유형을 먼저 고르세요.");
    return;
  }
  dragging = true;
  painted = [];
  paint(empId, date);
}

function dragOver(empId, date) {
  if (dragging) paint(empId, date);
}

function paint(empId, date) {
  const key = `${empId}:${date}`;
  if (painted.includes(key)) return;
  painted.push(key);

  if (brush.value === "ERASE") {
    delete grid.cells[key];
  } else {
    grid.cells[key] = {
      shift_type_id: brush.value.id,
      code: brush.value.code,
      color: brush.value.color,
      memo: null,
    };
  }
}

async function endDrag() {
  if (!dragging) return;
  dragging = false;
  if (!painted.length) return;

  const cells = painted.map((k) => {
    const [employee_id, work_date] = k.split(":");
    return { employee_id: Number(employee_id), work_date, key: k };
  });
  painted = [];

  try {
    if (brush.value === "ERASE") {
      for (const c of cells) {
        await shiftScheduleApi.deleteCell(c.employee_id, c.work_date).catch(() => {});
      }
    } else {
      await shiftScheduleApi.saveBulk(
        cells.map((c) => ({
          employee_id: c.employee_id,
          work_date: c.work_date,
          shift_type_id: brush.value.id,
        })),
      );
    }
    await load(); // counts 를 서버에서 다시 받는다
  } catch (e) {
    toast.error(e?.message || "저장에 실패했습니다.");
    await load();
  }
}

async function copyLastMonth() {
  const from = month.value === 1
    ? { y: year.value - 1, m: 12 }
    : { y: year.value, m: month.value - 1 };

  copying.value = true;
  try {
    const r = await shiftScheduleApi.copyMonth({
      department_id: deptId.value,
      from_year: from.y,
      from_month: from.m,
      to_year: year.value,
      to_month: month.value,
    });
    toast.success(`${r.copied}건 복사, ${r.skipped}건 건너뜀 (이미 있는 근무는 덮어쓰지 않습니다)`);
    await load();
  } catch (e) {
    toast.error(e?.message || "복사에 실패했습니다.");
  } finally {
    copying.value = false;
  }
}

onMounted(async () => {
  const [depts, types] = await Promise.all([
    departmentApi.options(),
    shiftTypeApi.list({ only_active: true }),
  ]);
  deptOptions.value = depts.map((d) => ({
    value: d.id,
    label: `${"　".repeat(d.depth)}${d.name}`,
  }));
  shiftTypes.value = types;
});
</script>

<style scoped>
.sch { max-width: 100%; }
.phead { margin-bottom: 1.1rem; }
.ttl { font-size: 1.5rem; font-weight: 700; color: var(--text); }

.palette { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
.plabel { font-size: 0.72rem; color: var(--text-subtle); margin-right: 0.2rem; }
.pchip {
  min-width: 42px; padding: 0.3rem 0.6rem; border-radius: var(--radius);
  font-size: 0.75rem; font-weight: 700; border: 2px solid transparent;
  transition: border-color 0.12s, transform 0.08s;
}
.pchip.on { border-color: var(--text); transform: translateY(-1px); }
.pchip.erase { background: var(--surface-2); color: var(--text-muted); }
.phint { font-size: 0.72rem; color: var(--text-subtle); margin-left: 0.4rem; }

.gridwrap { overflow-x: auto; padding: 0; }
.gtbl { border-collapse: collapse; user-select: none; }

.namecol {
  position: sticky; left: 0; z-index: 2;
  width: 150px; min-width: 150px;
  background: var(--surface);
  border-right: 1px solid var(--border-strong);
  text-align: left; padding: 0.4rem 0.7rem;
}
thead .namecol { background: var(--surface-2); }
.ename { font-size: 0.82rem; font-weight: 600; color: var(--text); }
.emeta { font-size: 0.66rem; color: var(--text-subtle); }

.daycol {
  width: 34px; min-width: 34px;
  padding: 0.3rem 0; text-align: center;
  background: var(--surface-2);
  border-bottom: 1px solid var(--border-strong);
}
.dnum { font-size: 0.74rem; font-weight: 600; color: var(--text-muted); }
.dwk { font-size: 0.6rem; color: var(--text-subtle); }
.daycol.sun .dnum, .daycol.sun .dwk { color: var(--danger); }
.daycol.sat .dnum, .daycol.sat .dwk { color: var(--info); }

.cell {
  width: 34px; height: 34px; padding: 2px;
  text-align: center; vertical-align: middle;
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
  cursor: pointer;
}
.cell:hover { background: var(--accent-soft); }
.cell.sun, .cell.sat { background: color-mix(in srgb, var(--surface-2) 60%, transparent); }
.chip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 24px; border-radius: 4px;
  font-size: 0.66rem; font-weight: 700; color: #fff;
}

.cntrow { background: var(--surface-2); }
.cntlabel { font-size: 0.7rem; font-weight: 700; color: var(--text-muted); }
.cnt { font-size: 0.72rem; color: var(--text-muted); cursor: default; }
.cnt:hover { background: none; }
</style>
```

- [ ] **Step 2: 빌드 검증**

```bash
cd /Users/wjd/프로젝트/hospital_frontend
npm run build
```

Expected: 성공.

- [ ] **Step 3: 커밋**

```bash
git add src/pages/hr/ScheduleView.vue
git commit -m "$(cat <<'EOF'
근태: 근무표 그리드 (직원 × 날짜)

이 사이클의 얼굴. 팔레트에서 근무유형을 고르고 셀을 클릭하거나 드래그해
칠한다. 드래그가 끝나면 saveBulk 로 한 번에 저장하고, 서버가 다시 계산한
일자별 인원 집계(counts)를 받아 하단에 표시한다 — 결원을 한눈에 잡기 위한 것.

첫 열은 sticky. 31일을 가로 스크롤해도 이름이 보여야 한다.
주말 열은 배경과 글자색을 달리한다.

"지난달 복사"는 덮어쓰지 않는다. 결과 토스트에 복사/건너뜀 건수를 알린다.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: 프론트 — 출퇴근 화면

**Files:**
- Create: `src/pages/hr/AttendanceView.vue`

**Interfaces:**
- Consumes: Task 8의 `attendanceApi`, 기존 `departmentApi.options()`
- Produces: `/hr/attendance` 라우트가 렌더링할 컴포넌트. Task 11이 라우터에 등록한다.

- [ ] **Step 1: `src/pages/hr/AttendanceView.vue` 생성**

```vue
<template>
  <div class="att">
    <header class="phead">
      <h1 class="ttl">{{ $t("출퇴근") }}</h1>
    </header>

    <div class="filterbar">
      <span class="f-label">{{ $t("부서") }}</span>
      <SearchSelect v-model="filter.department_id" :options="deptOptions" :placeholder="$t('전체')" />
      <input v-model="filter.date_from" type="date" class="field field-xs" style="width: 140px" />
      <span class="f-label">~</span>
      <input v-model="filter.date_to" type="date" class="field field-xs" style="width: 140px" />
      <select v-model="filter.status" class="field field-xs" style="width: 110px">
        <option :value="undefined">{{ $t("전체") }}</option>
        <option value="NORMAL">{{ $t("정상") }}</option>
        <option value="LATE">{{ $t("지각") }}</option>
        <option value="EARLY_LEAVE">{{ $t("조퇴") }}</option>
        <option value="ABSENT">{{ $t("결근") }}</option>
        <option value="LEAVE">{{ $t("휴가") }}</option>
      </select>
      <input v-model="filter.q" class="field field-xs" style="width: 150px" :placeholder="$t('이름 · 사번')" @keyup.enter="load(1)" />
      <button class="btn btn-xs" @click="load(1)">{{ $t("검색") }}</button>
      <button class="btn btn-xs btn-primary" style="margin-left: auto" :disabled="!filter.department_id || generating" @click="generate">
        {{ generating ? $t("생성 중…") : $t("근무자 불러오기") }}
      </button>
    </div>

    <!-- 월별 요약 — 부서를 골랐을 때만 -->
    <div v-if="filter.department_id && summary.length" class="sumwrap">
      <div v-for="s in summary" :key="s.employee_id" class="sumcard">
        <div class="sname">{{ s.name }}</div>
        <div class="srow"><span>{{ $t("근무") }}</span><b>{{ s.work_days }}{{ $t("일") }}</b></div>
        <div class="srow"><span>{{ $t("연장") }}</span><b>{{ hm(s.overtime_minutes) }}</b></div>
        <div class="srow"><span>{{ $t("지각") }}</span><b :class="{ warn: s.late_count }">{{ s.late_count }}</b></div>
        <div class="srow"><span>{{ $t("결근") }}</span><b :class="{ bad: s.absent_count }">{{ s.absent_count }}</b></div>
      </div>
    </div>

    <div class="pcard">
      <table class="tbl">
        <thead>
          <tr>
            <th>{{ $t("날짜") }}</th>
            <th>{{ $t("사번") }}</th>
            <th>{{ $t("이름") }}</th>
            <th>{{ $t("예정") }}</th>
            <th>{{ $t("출근") }}</th>
            <th>{{ $t("퇴근") }}</th>
            <th>{{ $t("상태") }}</th>
            <th class="right">{{ $t("근무") }}</th>
            <th class="right">{{ $t("연장") }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length">
            <td colspan="10">
              <EmptyState icon="fa-clock" :title="$t('근태 기록이 없습니다')" :desc="$t('부서와 날짜를 고르고 근무자 불러오기를 누르세요.')" compact />
            </td>
          </tr>
          <tr v-for="r in rows" :key="r.id">
            <td class="num">{{ ymd(r.work_date) }}</td>
            <td class="num">{{ r.employee.emp_no }}</td>
            <td>{{ r.employee.name }}</td>
            <td>
              <span v-if="r.shift_type" class="chip" :style="{ background: r.shift_type.color }">{{ r.shift_type.code }}</span>
              <span v-else class="muted">-</span>
            </td>
            <td>
              <input
                :value="toLocal(r.check_in)"
                type="datetime-local"
                class="cell-input"
                :disabled="saving === r.id"
                @change="onTime(r, 'check_in', $event.target.value)"
              />
            </td>
            <td>
              <input
                :value="toLocal(r.check_out)"
                type="datetime-local"
                class="cell-input"
                :disabled="saving === r.id"
                @change="onTime(r, 'check_out', $event.target.value)"
              />
            </td>
            <td><span class="badge" :class="STATUS[r.status].cls">{{ $t(STATUS[r.status].label) }}</span></td>
            <td class="num right">{{ hm(r.work_minutes) }}</td>
            <td class="num right">{{ r.overtime_minutes ? hm(r.overtime_minutes) : "-" }}</td>
            <td><button class="btn btn-xs btn-ghost" @click="remove(r)">{{ $t("삭제") }}</button></td>
          </tr>
        </tbody>
      </table>
      <Pager v-if="totalPages > 1" :page="page" :total="total" :total-pages="totalPages" @change="load" />
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, reactive, onMounted } from "vue";
import SearchSelect from "@/components/base/SearchSelect.vue";
import EmptyState from "@/components/base/EmptyState.vue";
import Pager from "@/components/base/Pager.vue";
import { attendanceApi } from "@/api/attendance";
import { departmentApi } from "@/api/hr";
import { useToast } from "vue-toastification";

const toast = useToast();

const STATUS = {
  NORMAL: { label: "정상", cls: "badge-success" },
  LATE: { label: "지각", cls: "badge-warning" },
  EARLY_LEAVE: { label: "조퇴", cls: "badge-warning" },
  ABSENT: { label: "결근", cls: "badge-error" },
  LEAVE: { label: "휴가", cls: "badge-neutral" },
};

const today = new Date().toISOString().slice(0, 10);
const rows = ref([]);
const total = ref(0);
const totalPages = ref(0);
const page = ref(1);
const limit = ref(30);
const saving = ref(null);
const generating = ref(false);
const deptOptions = ref([]);
const summary = ref([]);

const filter = reactive({
  department_id: null,
  date_from: today,
  date_to: today,
  status: undefined,
  q: "",
});

/** ISO → "2026-08-03" */
const ymd = (v) => (v ? String(v).slice(0, 10) : "-");

/** ISO → "2026-08-03T22:00" (datetime-local 이 요구하는 형식) */
const toLocal = (v) => (v ? String(v).slice(0, 16) : "");

/** 분 → "8h 30m" */
const hm = (m) => (m ? `${Math.floor(m / 60)}h ${m % 60}m` : "-");

async function load(p = page.value) {
  page.value = p;
  const res = await attendanceApi.list({
    department_id: filter.department_id || null,
    date_from: filter.date_from,
    date_to: filter.date_to,
    status: filter.status || null,
    q: filter.q || undefined,
    page: p,
    limit: limit.value,
  });
  rows.value = res.rows || [];
  total.value = res.total || 0;
  totalPages.value = res.totalPages || 0;
  await loadSummary();
}

/** 월별 요약 — date_from 이 속한 달 기준 */
async function loadSummary() {
  if (!filter.department_id) {
    summary.value = [];
    return;
  }
  const d = new Date(filter.date_from);
  try {
    summary.value = await attendanceApi.summary(
      filter.department_id,
      d.getFullYear(),
      d.getMonth() + 1,
    );
  } catch (e) {
    summary.value = [];
  }
}

/** 시각을 고치면 즉시 저장 — 서버가 근무표와 대조해 상태를 판정한다 */
async function onTime(r, field, value) {
  saving.value = r.id;
  try {
    const updated = await attendanceApi.save({
      employee_id: r.employee.id,
      work_date: ymd(r.work_date),
      check_in: field === "check_in" ? value : toLocal(r.check_in),
      check_out: field === "check_out" ? value : toLocal(r.check_out),
      memo: r.memo,
    });
    Object.assign(r, updated);
  } catch (e) {
    toast.error(e?.message || "저장에 실패했습니다.");
    await load();
  } finally {
    saving.value = null;
  }
}

async function generate() {
  generating.value = true;
  try {
    const res = await attendanceApi.bulkGenerate(filter.department_id, filter.date_from);
    toast.success(`${res.created}건 생성, ${res.skipped}건 건너뜀`);
    filter.date_to = filter.date_from;
    await load(1);
  } catch (e) {
    toast.error(e?.message || "생성에 실패했습니다.");
  } finally {
    generating.value = false;
  }
}

async function remove(r) {
  try {
    await attendanceApi.remove(r.id);
    await load();
  } catch (e) {
    toast.error(e?.message || "삭제에 실패했습니다.");
  }
}

onMounted(async () => {
  const depts = await departmentApi.options();
  deptOptions.value = depts.map((d) => ({
    value: d.id,
    label: `${"　".repeat(d.depth)}${d.name}`,
  }));
  await load(1);
});
</script>

<style scoped>
.att { max-width: 1300px; margin: 0 auto; }
.phead { margin-bottom: 1.1rem; }
.ttl { font-size: 1.5rem; font-weight: 700; color: var(--text); }
.muted { color: var(--text-subtle); }
.chip {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 30px; height: 22px; padding: 0 6px; border-radius: 4px;
  font-size: 0.68rem; font-weight: 700; color: #fff;
}

.sumwrap { display: flex; gap: 0.6rem; overflow-x: auto; margin-bottom: 0.9rem; padding-bottom: 0.2rem; }
.sumcard {
  flex: 0 0 auto; min-width: 130px; padding: 0.6rem 0.8rem;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);
}
.sname { font-size: 0.82rem; font-weight: 600; color: var(--text); margin-bottom: 0.4rem; }
.srow { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-subtle); line-height: 1.7; }
.srow b { color: var(--text); font-variant-numeric: tabular-nums; }
.srow b.warn { color: var(--warning); }
.srow b.bad { color: var(--danger); }
</style>
```

요약 카드는 `date_from`이 속한 달 기준이다. 직원별 근무일수·연장시간·지각·결근을 한 줄로 보여준다. 부서를 안 골랐으면 표시하지 않는다(집계 대상이 없다).

**`onTime`이 `work_date`를 `ymd()`로 잘라 보내는 이유:** 백엔드 `saveSchema`의 `work_date`는 `z.coerce.date()`인데, ISO 문자열 전체를 보내면 시각이 딸려간다. 날짜만 보내야 `@db.Date`에 맞는다.

- [ ] **Step 2: 빌드 검증**

```bash
cd /Users/wjd/프로젝트/hospital_frontend
npm run build
```

Expected: 성공.

- [ ] **Step 3: 커밋**

```bash
git add src/pages/hr/AttendanceView.vue
git commit -m "$(cat <<'EOF'
근태: 출퇴근 화면 (인라인 시각 입력 → 서버가 판정)

시각을 고치면 즉시 저장하고, 서버가 근무표와 대조해 상태·근무시간·연장을
판정해 돌려준다. 판정을 클라이언트에서 하지 않는다 — 급여가 이 값을
참조하므로 서버가 단일 진실 원천이어야 한다.

"근무자 불러오기"는 그날 근무표에 있는 직원의 빈 행을 만든다. 관리자가
시각만 채우면 되도록.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: 프론트 — 라우터 · 사이드바 연결

**Files:**
- Modify: `src/router/index.ts`
- Modify: `src/components/layout/AppSidebar.vue`

**Interfaces:**
- Consumes: Task 9의 `ScheduleView`, Task 10의 `AttendanceView`, Task 2의 권한 코드
- Produces: `/hr/schedule`, `/hr/attendance` 라우트와 사이드바 항목. 이 태스크가 끝나면 화면에 도달할 수 있다.

- [ ] **Step 1: `src/router/index.ts`에 import 추가**

`import EmployeeView from "@/pages/hr/EmployeeView.vue";` 아래에 추가한다.

```typescript
import ScheduleView from "@/pages/hr/ScheduleView.vue";
import AttendanceView from "@/pages/hr/AttendanceView.vue";
```

- [ ] **Step 2: 라우트 2개 추가**

`{ path: "hr/employee", ... }` 아래에 넣는다.

```typescript
            { path: "hr/schedule", component: ScheduleView, meta: { auth: true, title: "근무표", perm: "attendance.view" } },
            { path: "hr/attendance", component: AttendanceView, meta: { auth: true, title: "출퇴근", perm: "attendance.view" } },
```

**catch-all(`{ path: "/:pathMatch(.*)*", redirect: "/" }`)을 건드리지 마세요.** 최상위 `routes` 배열의 마지막 원소여야 합니다. 없는 경로가 빈 화면이 되는 버그를 막는 장치입니다.

- [ ] **Step 3: `AppSidebar.vue`의 "인사" 그룹에 2개 추가**

`menus` computed의 "인사" 그룹 `children` 배열에서, `{ label: "직원 관리", ... }` 아래에 넣는다.

```javascript
      { label: "근무표", to: "/hr/schedule", perm: "attendance.view" },
      { label: "출퇴근", to: "/hr/attendance", perm: "attendance.view" },
```

`expanded` reactive 객체는 이미 `{ 인사: true, 게시판: false }`이므로 건드리지 않는다.

- [ ] **Step 4: 빌드 검증**

```bash
cd /Users/wjd/프로젝트/hospital_frontend
npm run build

grep -n "hr/schedule\|hr/attendance" src/router/index.ts
grep -n "근무표\|출퇴근" src/components/layout/AppSidebar.vue
grep -n "pathMatch" src/router/index.ts
```

Expected: 빌드 성공, 라우트 2개 등록, 사이드바 2개 항목, catch-all 여전히 존재.

- [ ] **Step 5: 커밋**

```bash
git add src/router/index.ts src/components/layout/AppSidebar.vue
git commit -m "$(cat <<'EOF'
근태: 라우터 · 사이드바 연결

/hr/schedule (근무표), /hr/attendance (출퇴근). 둘 다 attendance.view.
사이드바 "인사" 그룹에 추가.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## 완료 조건

- [ ] 백엔드: `npm test` — 계산기 테스트 14개 전부 통과
- [ ] 백엔드: `npx prisma validate` 통과, 모델 23개 / enum 5개
- [ ] 백엔드: 라우트 21개 (`shiftType`, `shiftSchedule`, `attendance` 포함)
- [ ] 백엔드: 권한 23개, 근무유형 6개 시드
- [ ] 백엔드: 라우트 요구 권한 vs 카탈로그 대조 → 누락 없음
- [ ] 프론트: `npm run build` 통과
- [ ] 수동 시나리오 10개 (아래)

## 수동 검증 시나리오

**핵심 리스크는 나이트 자정 넘김과 권한입니다.** 정면으로 찌릅니다.

1. **근무유형 6개** — 환경설정 "근무유형" 탭에 D/E/N/OFF/ANNUAL/SICK이 보이는가. N의 자정넘김이 켜져 있고 휴게가 60분인가.
2. **근무표 그리드** — 부서(순환기내과)를 고르면 직원 × 날짜 그리드가 뜨는가. 첫 열이 sticky인가.
3. **셀 클릭** — 팔레트에서 D를 고르고 셀을 클릭하면 파란 배지가 찍히는가.
4. **드래그** — 여러 칸을 드래그하면 한 번에 칠해지는가.
5. **인원 집계** — 하단에 일자별 D/E/N 인원이 맞게 나오는가.
6. **지난달 복사** — 누르면 복사되고, **이미 근무가 있는 칸은 안 덮어쓰는지**(토스트의 skipped 건수 확인).
7. **근무자 불러오기** — 출퇴근 화면에서 부서·날짜를 고르고 누르면 빈 행이 생기는가.
8. **★ 나이트 자정 넘김** — 나이트 근무자의 출근 `22:00` / 퇴근 **다음날** `07:00`을 입력 → **근무 8h 0m**(9시간 − 휴게 60분)으로 나오는가. 상태가 `정상`인가.
9. **지각** — 데이 근무자의 출근을 `07:20`으로 입력 → 상태가 `지각`으로 바뀌고 근무시간이 줄어드는가.
10. **★ 비-super 권한** — `attendance.view`만 가진 계정으로 근무표 조회는 되고(`200`), 셀 저장은 `403`인가.

**10번을 빠뜨리면 안 됩니다.** 앞 사이클에서 `is_super` 계정으로만 테스트해 권한 결함(비-super 사용자가 설정·알림에 영구 403)을 놓쳤습니다. `permission()`이 `is_super`를 먼저 우회하므로 구조적으로 안 보입니다.

## 다음 사이클로 넘기는 것

- **급여** — 이 사이클이 만든 `work_minutes`·`overtime_minutes`를 돈으로 환산한다
- **연차 잔여 관리** — 법정 연차 발생·사용·잔여
- **평가·교육** — 독립 도메인
