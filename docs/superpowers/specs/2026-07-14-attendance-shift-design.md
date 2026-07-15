# 근태 · 교대 설계

작성일: 2026-07-14
대상 리포지토리: `hospital_server`, `hospital_frontend`
선행 사이클: [부서·직원 마스터](2026-07-11-department-employee-master-design.md)

## 배경

병원 관리 시스템의 두 번째 도메인 사이클이다. 앞 사이클에서 부서 조직도(계층 트리)와 직원 명부(면허 포함)를 확보했다.

"인사(HR) 본체"는 근태·교대·급여·평가·교육 다섯 개의 독립 서브시스템이다. 하나의 스펙으로 묶으면 뭉개진다. 이 문서는 그중 **근태 + 교대**만 다룬다.

**근태와 교대를 함께 묶는 이유:** 병원에서 이 둘은 사실상 한 몸이다. 3교대(데이·이브닝·나이트) 간호사가 인력의 절반이고, "이 사람이 오늘 나이트 근무인가"를 모르면 지각·조퇴·초과근무를 판정할 수 없다. 교대 스케줄이 근태의 **예정**을 만들고, 출퇴근 기록이 **실적**이 된다. 예정 없이 실적만으로는 결근과 비번을 구분할 수 없다.

## 목표

부서별 월간 근무표를 짜고, 실제 출퇴근을 기록해, 예정과 실적을 대조해 근태 상태를 판정한다. 급여 계산이 참조할 확정된 근무시간·연장근무 데이터를 남긴다.

## 범위에 포함되지 않는 것

- **급여** — 근태를 돈으로 환산하는 것. 세금·4대보험·수당 규정이 얽혀 별도 사이클이 필요하다. 이 사이클이 급여의 입력을 만든다.
- **평가·교육** — 직원 마스터만 있으면 되는 독립 도메인. 순서상 뒤로 미룬다.
- **연차 잔여 관리** — 법정 연차 규정(1년 미만 월 1일, 1년 이상 15일 + 가산)이 얽힌다. 이번엔 근무표에 "연차"를 **찍을 수만** 있게 하고, 발생·사용·잔여 계산은 다음 사이클로.
- **휴가 신청·승인 워크플로** — 직원 계정이 없는 간호사·의사가 대부분이라 신청 주체가 애매하다.
- **단말기 연동** — 카드리더·지문인식. 이번엔 관리자 수기입력만.

## 핵심 결정

### 1. 출퇴근은 관리자 수기입력

화면에서 출근·퇴근 시각을 직접 입력·수정한다.

병원 현실이 이렇다. 간호사·의사 대부분은 시스템 로그인 계정이 없다(앞 사이클에서 `Employee`와 `User`를 분리한 이유). 셀프 체크인은 계정 있는 직원에게만 의미가 있는데, 지금 그런 직원이 몇 명인지도 모른다.

게다가 어떤 경로로 기록되든 **최종 확정은 관리자가 한다.** 단말기를 붙이든 셀프 체크인을 얹든 이 화면은 그대로 쓴다. 지금 만들어도 낭비가 아니다.

### 2. 나이트 근무는 시작일에 귀속된다

1일 22시 출근 → 2일 07시 퇴근이면 `work_date = 1일`이다. 퇴근이 2일 새벽이어도 그 근무는 **1일 것**이다.

병원 실무가 이렇다. 근무표에 "1일 나이트"라고 적혀 있으면 그 근무는 1일 것이다. 이 규칙을 어기면 근무일수·야간수당·초과근무가 전부 틀어진다.

`ShiftType.crosses_midnight`이 `true`면 계산기가 `check_out`을 다음날로 해석한다.

### 3. 판정 결과를 저장한다

`Attendance.status`(정상/지각/조퇴/결근/휴가)와 `work_minutes`·`overtime_minutes`를 **컬럼에 저장한다.** 조회할 때마다 다시 계산하지 않는다.

근무표가 나중에 바뀌어도 이미 확정된 근태는 그대로 남아야 한다. 그리고 급여가 이 값을 참조하게 된다 — 급여 명세서를 뽑은 뒤 근무표를 고쳤다고 급여가 소급해 바뀌면 안 된다.

### 4. 근무유형은 전용 모델

`ShiftType`에 코드·명칭·시작시각·종료시각·자정넘김·휴게시간·색상을 담는다.

`Category` 공통코드를 재사용하는 방법도 있었으나, `Category`에는 `text`/`value`밖에 없어 시각·자정넘김을 담을 칸이 없다. 그러면 근무시간 계산을 사람이 손으로 해야 한다.

enum으로 박는 방법도 있었으나, 병원마다·병동마다 교대 체계가 다르다(응급실은 12시간 2교대). 전용 모델이면 화면에서 추가할 수 있다.

## 데이터 모델

### ShiftType

```prisma
/// 근무유형 (데이/이브닝/나이트/비번/연차/병가)
model ShiftType {
  id   Int    @id @default(autoincrement())
  code String @unique @db.VarChar(20) // D, E, N, OFF, ANNUAL, SICK
  name String @db.VarChar(50)         // 데이, 이브닝, 나이트, 비번, 연차, 병가

  // 근무 시간대. is_work=false 인 유형(비번·연차·병가)은 null.
  start_time String? @db.VarChar(5) // "08:00"
  end_time   String? @db.VarChar(5) // "17:00"

  crosses_midnight Boolean @default(false) // 나이트처럼 종료가 다음날이면 true
  break_minutes    Int     @default(0)     // 휴게시간 — 근무시간 계산에서 뺀다
  is_work          Boolean @default(true)  // 비번·연차·병가는 false

  color String @default("#64748b") @db.VarChar(20) // 그리드 셀 색

  schedules   ShiftSchedule[]
  attendances Attendance[]   // 판정 기준 스냅샷 역참조

  sort       Int      @default(0)
  is_active  Boolean  @default(true)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([sort])
}
```

시각을 `String @db.VarChar(5)`("08:00")로 둔 것은 의도적이다. MySQL `TIME` 타입을 Prisma가 `DateTime`으로 매핑해 날짜 부분이 딸려오고, 타임존 변환에 휘말린다. 근무유형의 시각은 **벽시계 시각**이지 특정 시점이 아니다. 문자열로 두면 계산기가 명시적으로 파싱한다.

### ShiftSchedule

```prisma
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
```

### Attendance

```prisma
/// 근태 상태 — 판정 우선순위: 결근 > 지각 > 조퇴 > 정상
enum AttendanceStatus {
  NORMAL     // 정상
  LATE       // 지각
  EARLY_LEAVE // 조퇴
  ABSENT     // 결근
  LEAVE      // 휴가 (연차·병가 등 is_work=false 유형)
}

/// 실제 출퇴근 — work_date 는 시작일 기준(나이트도 마찬가지)
model Attendance {
  id          Int      @id @default(autoincrement())
  employee_id Int
  employee    Employee @relation(fields: [employee_id], references: [id], onDelete: Cascade)

  work_date DateTime @db.Date // 나이트 근무도 시작일

  check_in  DateTime? // null 이면 결근
  check_out DateTime? // null 이면 퇴근 미기록

  // 판정 기준 스냅샷 — 이 근태가 어떤 근무유형으로 판정됐는지.
  // 근무표가 나중에 바뀌어도 판정 근거는 남아야 한다.
  // null 이면 근무표에 없는 날 출근한 것(예정 없음).
  shift_type_id Int?
  shift_type    ShiftType? @relation(fields: [shift_type_id], references: [id])

  // 계산 결과를 저장한다 — 근무표가 바뀌어도 확정된 근태는 남는다
  status            AttendanceStatus @default(NORMAL)
  work_minutes      Int              @default(0) // 실근무 (휴게 제외)
  overtime_minutes  Int              @default(0)
  late_minutes      Int              @default(0)
  early_leave_minutes Int            @default(0)

  memo String? @db.VarChar(200)

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@unique([employee_id, work_date])
  @@index([work_date])
  @@index([status])
}
```

`late_minutes`와 `early_leave_minutes`를 **둘 다** 컬럼으로 둔 이유: `status`는 하나인데 지각과 조퇴가 동시에 날 수 있다. 우선순위로 `status`는 `LATE`가 되지만, 조퇴 시간을 잃으면 급여 계산에서 공제를 놓친다.

### Employee 역참조

`Employee` 모델에 두 줄을 추가한다.

```prisma
  schedules   ShiftSchedule[]
  attendances Attendance[]
```

## 계산 로직

**이 사이클의 심장이다.** `server/lib/attendanceCalc.js`에 **순수 함수**로 분리한다. DB를 모르고, 입력만 받아 결과를 낸다.

```javascript
/**
 * @param {object} args
 * @param {object} args.shiftType  { start_time, end_time, crosses_midnight, break_minutes, is_work }
 * @param {Date|null} args.checkIn
 * @param {Date|null} args.checkOut
 * @param {Date} args.workDate  근무 시작일 (날짜만)
 * @returns {{ status, workMinutes, overtimeMinutes, lateMinutes, earlyLeaveMinutes }}
 */
export function calcAttendance({ shiftType, checkIn, checkOut, workDate })
```

### 규칙

1. 근무유형이 `is_work: false`(비번·연차·병가) → `status = LEAVE`, 모든 분(minutes) = 0. 시각 입력이 있어도 무시한다.
2. `checkIn`이 없음 → `status = ABSENT`, 모든 분 = 0.
3. 예정 출근(`workDate` + `start_time`)보다 늦게 왔음 → `lateMinutes = checkIn - 예정출근`
4. 예정 퇴근보다 일찍 갔음 → `earlyLeaveMinutes = 예정퇴근 - checkOut`
5. 예정 퇴근을 넘겨 일했음 → `overtimeMinutes = checkOut - 예정퇴근`
6. `crosses_midnight`이면 예정 퇴근 = `workDate + 1일` + `end_time`
7. `workMinutes = (checkOut - checkIn) - break_minutes`. `checkOut`이 없으면 0.
8. `status` 우선순위: `ABSENT` > `LATE` > `EARLY_LEAVE` > `NORMAL`

### 경계 사례

- **`checkOut`이 없음** (퇴근 미기록): `workMinutes = 0`, `overtimeMinutes = 0`, `earlyLeaveMinutes = 0`. 지각은 판정한다(`checkIn`이 있으므로). `status`는 지각이면 `LATE`, 아니면 `NORMAL`.
- **지각 + 조퇴 동시**: `status = LATE`(우선순위), `lateMinutes`와 `earlyLeaveMinutes` **둘 다** 채운다.
- **나이트 조기 퇴근**: 1일 22시 출근 예정, 2일 07시 퇴근 예정. 실제 2일 05시 퇴근 → `earlyLeaveMinutes = 120`.
- **근무유형에 시각이 없는데 `is_work: true`**: 데이터 오류다. `workMinutes`만 실측으로 계산하고 지각·조퇴·연장은 0으로 둔다(판정 기준이 없으므로).

## API

기존 POST-RPC 패턴. `server/index.js`가 `routes/`를 스캔해 자동 등록한다.

### `/api/shiftType`

| 엔드포인트 | 권한 | 설명 |
| --- | --- | --- |
| `list` | 인증만 | 근무유형 목록 (그리드 팔레트가 쓴다) |
| `save` | `permission.menu.update` | 신규/수정 |
| `delete` | `permission.menu.update` | 삭제 (근무표에서 쓰이면 `IN_USE` 거부) |

`list`를 인증만으로 여는 이유는 앞 사이클의 `category/list`와 같다 — 근무표 화면의 팔레트 공급원이라, 권한을 걸면 근태 담당자가 근무표를 못 짠다.

구현은 `server/routes/category.js`의 패턴을 그대로 따른다. `permission()` preHandler 대신 `ensureAuth(req.user)`를 호출한다.

```javascript
app.post("/list", async (req) => { ensureAuth(req.user); return service.list(...); });
app.post("/save", { preHandler: permission("permission.menu.update") }, async (req) => ...);
```

### `/api/shiftSchedule`

| 엔드포인트 | 권한 | 설명 |
| --- | --- | --- |
| `grid` | `attendance.view` | `{department_id, year, month}` → 직원 × 날짜 2차원 |
| `saveCell` | `attendance.edit` | `{employee_id, work_date, shift_type_id}` upsert |
| `saveBulk` | `attendance.edit` | `{cells: [...]}` 여러 칸 한 번에 |
| `copyMonth` | `attendance.edit` | `{department_id, from_year, from_month, to_year, to_month}` |
| `deleteCell` | `attendance.edit` | `{employee_id, work_date}` 근무 지우기 |

**`grid`가 2차원을 한 번에 반환하는 이유:** 셀마다 API를 부르면 30일 × 20명 = 600번이다.

응답 형태:
```javascript
{
  employees: [{ id, emp_no, name, position, job_type }],
  days: [{ date: "2026-08-01", weekday: 6, is_holiday: false }],
  cells: { "3:2026-08-01": { shift_type_id: 1, memo: null } },  // "employeeId:date"
  counts: { "2026-08-01": { "D": 5, "E": 3, "N": 2, "OFF": 4 } } // 일자별 인원
}
```

`counts`는 서버가 계산해 내려준다. 결원(그날 나이트가 1명뿐)을 한눈에 잡기 위한 것이다.

**`copyMonth`는 덮어쓰지 않는다.** 대상 월에 이미 근무가 있는 칸은 건너뛴다. 실수로 짜둔 근무표를 날리면 안 된다. 결과로 `{ copied, skipped }`를 반환한다.

### `/api/attendance`

| 엔드포인트 | 권한 | 설명 |
| --- | --- | --- |
| `list` | `attendance.view` | 부서·기간·상태 필터 + 페이징 |
| `save` | `attendance.edit` | **저장 시 서버가 판정한다** |
| `bulkGenerate` | `attendance.edit` | `{department_id, work_date}` → 그날 근무표에 있는 직원의 빈 행 생성 |
| `summary` | `attendance.view` | `{department_id, year, month}` → 직원별 집계 |
| `delete` | `attendance.edit` | 오등록 취소 |

**`save`가 판정하는 흐름:**
1. `ShiftSchedule`에서 그 직원·그 날짜의 예정 근무유형을 찾는다
2. 없으면 → 근무표에 없는 날 출근한 것. `shift_type_id = null`, `status = NORMAL`, 실측 시간만 계산하고 지각·조퇴는 0.
3. 있으면 → `calcAttendance()`에 넘겨 판정
4. 결과를 컬럼에 저장하고, **`shift_type_id`에 판정 기준을 스냅샷으로 남긴다**

4번이 중요하다. 근무표가 나중에 바뀌어도 "이 근태가 무엇을 기준으로 지각 판정됐는지"를 되짚을 수 있어야 한다. 판정 결과만 저장하고 기준을 안 남기면 감사(audit)가 불가능하다.

**`bulkGenerate`는 이미 있는 행을 건드리지 않는다.** `{ created, skipped }`를 반환한다.

### 권한

기존 21개에 2개를 추가해 **23개**가 된다.

- `attendance.view` — 근무표·출퇴근 조회
- `attendance.edit` — 근무표 편집, 출퇴근 입력

근무표와 출퇴근을 같은 권한으로 묶는다. 실무에서 같은 사람(수간호사·인사팀)이 둘 다 본다. 권한을 쪼개면 관리 대상만 늘어난다.

`prisma/seed-rbac.js`의 `PERMS`에 추가한다. **주의:** 이 시드는 카탈로그 밖 권한 행을 삭제한다. 라우트가 요구하는 코드가 카탈로그에 없으면 비-super 사용자가 영구 403이 된다(앞 사이클에서 실제로 겪은 결함).

## 화면

### 근무유형 관리

환경설정에 탭을 추가한다. 표 형태 — 코드·명칭·시작·종료·자정넘김·휴게(분)·근무여부·색상·정렬.

색상은 컬러 피커. 그리드 셀 배경으로 쓰인다.

### 근무표 (`/hr/schedule`)

**이 사이클의 얼굴이다.**

- **상단:** 부서 선택(계층 들여쓰기) + 연월 선택 + "지난달 복사" 버튼
- **본문:** 직원(행) × 날짜(열) 그리드
  - 첫 열은 고정(sticky) — 가로 스크롤해도 이름이 보여야 한다
  - 셀에 근무유형 코드가 `ShiftType.color` 배경의 배지로 표시
  - 주말·공휴일 열은 배경을 달리한다
- **셀 클릭** → 근무유형 팝오버 → 선택하면 즉시 저장 (`saveCell`)
- **드래그** → 여러 칸 선택 → 팔레트에서 유형 고르면 한 번에 (`saveBulk`)
- **하단:** 일자별 인원 집계 행 — "D 5 / E 3 / N 2" 형태. 결원을 잡는다.

한 달 31일 × 직원 20명이면 620칸이다. 가상 스크롤은 넣지 않는다 — 부서 하나가 20명을 넘는 경우가 드물고, 넘으면 그때 넣는다.

### 출퇴근 (`/hr/attendance`)

표 + 인라인 편집.

- **필터:** 부서·기간(from~to)·상태·직원 검색
- **"근무자 불러오기"** 버튼 → 날짜를 고르면 그날 근무표에 있는 직원의 빈 행을 생성 (`bulkGenerate`)
- **각 행:** 사번·이름·날짜·예정근무(배지)·출근·퇴근·상태(배지)·근무시간·연장·메모
- 출근·퇴근 시각을 인라인으로 입력하면 **저장 시 서버가 판정**해 상태·시간을 채운다
- **상태 배지:** 정상(초록) / 지각(노랑) / 조퇴(노랑) / 결근(빨강) / 휴가(회색)

**월별 집계**는 같은 화면 상단에 요약 카드로. 직원별 근무일수·연장시간·결근일수.

### 사이드바

"인사" 그룹에 두 항목을 추가한다.

```
인사
  부서 관리
  직원 관리
  근무표      ← 신규
  출퇴근      ← 신규
```

## 검증

### 계산 로직에는 테스트를 붙인다

**이번 사이클은 앞선 사이클들과 다르다.**

`attendanceCalc.js`는 순수 함수고, 여기가 틀리면 급여가 틀린다. 나이트 근무의 자정 넘김, 지각+조퇴 동시 발생, 휴게시간 차감, 퇴근 미기록 — 이건 화면을 클릭해서 검증하기 어렵다. 경계 사례를 눈으로 확인하려면 매번 데이터를 만들어야 한다.

`package.json`에 `"test": "node --test test/"`가 이미 있고 Node 18은 `--test`를 지원한다. **인프라 추가가 없다.**

`test/attendanceCalc.test.js`에 아래를 검증한다.

- 정상 출퇴근 → `NORMAL`, `workMinutes` = 근무시간 − 휴게
- 지각 → `LATE`, `lateMinutes` 정확
- 조퇴 → `EARLY_LEAVE`, `earlyLeaveMinutes` 정확
- **지각 + 조퇴 동시** → `status = LATE`, 두 분(minutes) **둘 다** 채워짐
- 연장근무 → `overtimeMinutes` 정확
- **나이트(자정 넘김)** → 1일 22시 → 2일 07시가 9시간으로 계산됨
- **나이트 조기 퇴근** → 2일 05시 퇴근이 `earlyLeaveMinutes = 120`
- `checkIn` 없음 → `ABSENT`
- `checkOut` 없음 → 지각은 판정, `workMinutes = 0`
- `is_work: false`(연차) → `LEAVE`, 모든 분 = 0
- 시각 없는 근무유형 → `workMinutes`만 실측, 나머지 0

### 나머지는 기존 방식

- **백엔드** — `npx prisma validate`, `npx prisma db push`, 서버 기동 후 라우트 로드 확인, curl
- **프론트** — `npm run build`(vue-tsc)
- **수동 시나리오**
  1. 근무유형 6개를 시드하고 환경설정에서 보이는지
  2. 부서를 골라 근무표 그리드를 열고, 셀을 클릭해 근무유형을 찍는다
  3. 드래그로 여러 칸을 한 번에 칠한다
  4. 하단 인원 집계가 맞는지
  5. "지난달 복사"를 누르고, **이미 근무가 있는 칸은 안 덮어쓰는지**
  6. 출퇴근 화면에서 "근무자 불러오기" → 빈 행이 생기는지
  7. 나이트 근무자의 출근 22:00 / 퇴근(다음날) 07:00을 입력 → **9시간으로 계산되는지**
  8. 지각 입력 → 상태가 `LATE`로 바뀌고 `late_minutes`가 맞는지
  9. 근무유형을 삭제 시도 → 근무표에서 쓰이면 `IN_USE`로 막히는지
  10. **비-super 계정**(`attendance.view`만)으로 근무표 조회는 되고 편집은 403인지

10번을 빠뜨리면 안 된다. 앞 사이클에서 `is_super` 계정으로만 테스트해 권한 결함을 놓쳤다.

## 시드

`prisma/seed-hr.js`에 근무유형을 추가한다. 별도 파일을 만들지 않는다 — 같은 인사 도메인이다.

| code | name | start | end | 자정넘김 | 휴게 | 근무 | 색상 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `D` | 데이 | 07:00 | 15:00 | false | 30 | true | `#2563eb` |
| `E` | 이브닝 | 15:00 | 23:00 | false | 30 | true | `#d97706` |
| `N` | 나이트 | 22:00 | 07:00 | **true** | 60 | true | `#4338ca` |
| `OFF` | 비번 | — | — | false | 0 | **false** | `#94a3b8` |
| `ANNUAL` | 연차 | — | — | false | 0 | **false** | `#059669` |
| `SICK` | 병가 | — | — | false | 0 | **false** | `#dc2626` |

`N`의 22:00~07:00은 9시간이고 휴게 60분을 빼면 실근무 8시간이다. 계산기 테스트가 이 값을 검증한다.

근무표와 출퇴근은 시드하지 않는다. 화면에서 만들며 검증한다.

## 구현 순서

의존 방향대로 쌓는다. 각 단계는 그 시점에 빌드가 통과해야 한다.

1. Prisma — 모델 3개 + enum 1개 + `Employee` 역참조, `db push`
2. 권한 2개 추가(21 → 23), `seed-rbac.js` 갱신
3. **`attendanceCalc.js` + 테스트** — 계산 로직을 먼저. DB 없이 순수 함수로 검증한다.
4. 백엔드 — `shiftType` 라우트·서비스·검증기
5. 백엔드 — `shiftSchedule` (grid·saveCell·saveBulk·copyMonth)
6. 백엔드 — `attendance` (save가 계산기를 호출해 판정)
7. 시드 — `seed-hr.js`에 근무유형 6개 추가
8. 프론트 — `api/attendance.ts`, 근무유형 관리 탭
9. 프론트 — 근무표 그리드
10. 프론트 — 출퇴근 화면
11. 프론트 — 라우터·사이드바

3번을 먼저 하는 이유: 계산 로직이 이 사이클의 심장이고, DB 없이 테스트할 수 있다. 여기가 확정되면 나머지는 그걸 부르기만 한다.

## 다음 사이클로 넘기는 것

- **급여** — 이 사이클이 만든 `work_minutes`·`overtime_minutes`를 돈으로 환산한다
- **연차 잔여 관리** — 법정 연차 발생·사용·잔여
- **휴가 신청·승인 워크플로**
- **평가·교육** — 독립 도메인
- **단말기 연동** — 카드리더·지문인식. 이 화면은 그대로 쓴다.
