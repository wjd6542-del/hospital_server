# 부서 · 직원 마스터 설계

작성일: 2026-07-11
대상 리포지토리: `hospital_server`, `hospital_frontend`
선행 사이클: [기반 정리](2026-07-09-hospital-foundation-design.md)

## 배경

병원 관리 시스템의 첫 도메인 사이클이다. 기반 정리에서 CS 도메인을 걷어내고 코어(인증·RBAC·감사·알림·설정·게시판·FAQ·태그·다국어)와 클리니컬 뉴트럴 테마를 확보했다.

부서·직원 마스터는 **거의 모든 후속 도메인의 전제**다. 인사(근태·급여·평가), 재무(부서별 원가), 구매(승인자), 예약(담당의), 병동(담당 간호사), 통계(부서별 집계)가 전부 이 두 모델을 참조한다. 이것 없이 다른 도메인을 시작하면 가짜 외래키로 출발하게 된다.

## 목표

부서 조직도와 직원 명부를 등록·관리하는 마스터를 만든다. 후속 도메인이 참조할 수 있는 안정된 외래키를 제공한다.

## 범위에 포함되지 않는 것

- **급여·평가·교육·근태·교대** — 인사(HR) 도메인의 다음 사이클
- **인적사항**(주민번호·주소·계좌·비상연락망) — 급여 지급 시 필요하지만 민감정보라 암호화·접근제어 설계가 함께 와야 한다. 지금은 과잉이다.
- **조직 개편 이력** — 부서 이동 히스토리. 필요해지면 별도 모델로 추가한다.
- **테스트 인프라** — 기반 정리와 같은 이유. `prisma validate` · `npm run build`(vue-tsc) · 수동 클릭으로 검증한다.

## 핵심 결정

### 1. 직원과 로그인 계정은 분리한다

`Employee`가 독립 마스터이고, `User`가 `employee_id`로 **선택적 1:1** 연결한다.

병원은 간호사·의사 대부분이 시스템 로그인을 하지 않으면서도 급여·근태 대상이다. `User`를 확장하는 방식은 모든 직원에게 로그인 계정을 강제하고, 퇴사 처리가 계정 비활성화와 뒤엉킨다.

분리하면 퇴사 시 **계정만 비활성화하고 인사 기록은 보존**된다. 외부 업체·임시 계정도 직원 등록 없이 만들 수 있다.

`User`에 이미 있는 `name` · `email` · `code` 필드는 그대로 둔다. 계정 표시용이며, 직원과 연결된 계정은 화면에서 직원 정보를 우선 노출한다.

### 2. 부서는 계층 트리

`parent_id` 자기참조로 무제한 깊이. 실제 병원 조직도(진료부 > 내과 > 순환기내과)를 그대로 담고, 통계에서 상위 부서 집계가 가능해진다.

프론트는 삭제했던 `EntityTree.vue`(347줄)를 git에서 복원해 쓴다. `api` 객체로 `tree`/`save`/`remove`/`reorder`를 주입받는 범용 트리이며, 부서에 그대로 적용된다. 복원 출처: `git show b2a6f32^:src/components/base/EntityTree.vue`

`EntityTree`는 `name`만 다루므로 코드·유형·부서장은 우측 상세 패널에서 편집한다.

### 3. 분류값은 Category 공통코드

코어에 `Category` 모델(`text`/`value`/`sort`/`is_active`)이 있으나 **현재 아무도 쓰지 않는다.** 여기에 `group` 필드를 추가해 직급·직종·고용형태·면허종류·부서유형을 담는다.

병원마다 직급 체계가 다르다("전문의/전공의/수련의" vs "1급/2급/3급"). enum으로 박으면 마이그레이션이 필요하지만, Category면 관리자가 화면에서 추가한다. 앞으로 구매·재고 분류도 같은 틀을 쓴다.

## 데이터 모델

### Department

```prisma
model Department {
  id        Int     @id @default(autoincrement())
  name      String  @db.VarChar(100)
  code      String  @unique @db.VarChar(30)  // 부서 코드 (예: DEPT-CARD)

  parent_id Int?
  parent    Department?  @relation("DepartmentTree", fields: [parent_id], references: [id])
  children  Department[] @relation("DepartmentTree")

  type_id Int?       // 부서 유형 (Category: department_type)
  type    Category?  @relation("DepartmentType", fields: [type_id], references: [id])

  head_employee_id Int?       // 부서장 (선택)
  head_employee    Employee?  @relation("DepartmentHead", fields: [head_employee_id], references: [id])

  employees Employee[] @relation("EmployeeDepartment")

  sort       Int      @default(0)
  is_active  Boolean  @default(true)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([parent_id])
  @@index([sort])
}
```

### Employee

```prisma
model Employee {
  id      Int     @id @default(autoincrement())
  emp_no  String  @unique @db.VarChar(30)   // 사번
  name    String  @db.VarChar(100)
  name_en String? @db.VarChar(100)

  department_id Int?
  department    Department? @relation("EmployeeDepartment", fields: [department_id], references: [id])

  position_id        Int?      // 직급 (Category: position)
  position           Category? @relation("EmployeePosition", fields: [position_id], references: [id])
  job_type_id        Int?      // 직종 (Category: job_type)
  job_type           Category? @relation("EmployeeJobType", fields: [job_type_id], references: [id])
  employment_type_id Int?      // 고용형태 (Category: employment_type)
  employment_type    Category? @relation("EmployeeEmploymentType", fields: [employment_type_id], references: [id])

  phone String? @db.VarChar(30)
  email String? @db.VarChar(200)

  hired_at    DateTime  @db.Date
  resigned_at DateTime? @db.Date   // 퇴사일 (있으면 퇴사자)

  licenses     EmployeeLicense[]
  headOfDepts  Department[]      @relation("DepartmentHead")
  user         User?             @relation("UserEmployee")

  is_active  Boolean  @default(true)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([department_id])
  @@index([name])
}
```

### EmployeeLicense

```prisma
model EmployeeLicense {
  id          Int      @id @default(autoincrement())
  employee_id Int
  employee    Employee @relation(fields: [employee_id], references: [id], onDelete: Cascade)

  license_type_id Int       // 면허 종류 (Category: license_type)
  license_type    Category  @relation("LicenseType", fields: [license_type_id], references: [id])

  license_no String    @db.VarChar(60)
  issued_at  DateTime? @db.Date
  expires_at DateTime? @db.Date

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([employee_id])
}
```

### Category 확장

기존 모델에 `group` 필드를 추가한다.

```prisma
model Category {
  id Int @id @default(autoincrement())

  group String @db.VarChar(50)  // 코드 그룹 (department_type, position, job_type, employment_type, license_type)
  text  String @db.VarChar(255) // 표시명
  value String @db.VarChar(255) // 코드값

  is_active Boolean @default(true)
  sort      Int     @default(0)

  created_at DateTime? @default(now())
  updated_at DateTime? @updatedAt

  // 역참조
  departmentTypes       Department[]      @relation("DepartmentType")
  employeePositions     Employee[]        @relation("EmployeePosition")
  employeeJobTypes      Employee[]        @relation("EmployeeJobType")
  employeeEmployTypes   Employee[]        @relation("EmployeeEmploymentType")
  licenses              EmployeeLicense[] @relation("LicenseType")

  @@unique([group, value])
  @@index([group, sort])
}
```

`group`은 `String`이다. enum으로 하면 새 코드 그룹(구매 분류 등)을 추가할 때마다 마이그레이션이 필요하다.

**기존 데이터 확인 완료:** `Category` 테이블은 현재 **0행**이고 코어 서비스 어디에서도 참조하지 않는다. 따라서 `NOT NULL`인 `group` 추가와 `@@unique([group, value])` 제약을 `db push`로 걸어도 안전하다. 기존 행이 있었다면 기본값 채우기가 선행돼야 했을 것이다.

### User 연결

```prisma
model User {
  // ... 기존 필드 유지 ...
  employee_id Int?      @unique
  employee    Employee? @relation("UserEmployee", fields: [employee_id], references: [id])
}
```

## 순환 참조 처리

`Department.head_employee_id` → `Employee`, `Employee.department_id` → `Department`. 서로를 가리킨다.

**둘 다 nullable로 둔다.** 그러면 순서가 풀린다: 부서 생성(부서장 없음) → 직원 등록(부서 지정) → 부서장 지정.

Prisma는 nullable 자기참조 순환을 허용하므로 스키마는 컴파일된다. 시드도 이 순서를 따른다.

## 삭제 정책

**부서** — 하위 부서나 소속 직원이 있으면 삭제를 막는다(`AppError`, 400, `IN_USE`). 코어의 `faqCategory.service.js`가 쓰는 패턴과 같다.

**직원** — 물리 삭제 대신 **퇴사 처리**(`resigned_at` 설정 + `is_active=false`)가 기본이다. 인사 기록은 보존돼야 하고, 후속 도메인(급여·예약 이력)이 이 직원을 참조하게 된다.

물리 삭제(`delete`)는 **오등록 취소용으로만** 남긴다. 참조가 하나라도 있으면(부서장 지정, 연결된 계정) 거부한다.

**Category** — 참조하는 부서·직원·면허가 있으면 삭제를 막는다.

## API

기존 POST-RPC 패턴을 따른다. `server/index.js`가 `routes/` 디렉터리를 스캔하므로 파일명이 곧 엔드포인트다.

### `/api/department`

| 엔드포인트 | 설명 |
| --- | --- |
| `tree` | 계층 전체 (EntityTree용) |
| `list` | 평면 목록 + 페이징 |
| `options` | 셀렉트박스용 (계층 들여쓰기 포함) |
| `get` | 단건 (부서장·유형 조인) |
| `save` | 신규/수정 겸용 |
| `reorder` | 드래그 정렬 (`id`, `parent_id`, `before_id`) |
| `delete` | 삭제 (하위·소속 직원 없을 때만) |

### `/api/employee`

| 엔드포인트 | 설명 |
| --- | --- |
| `list` | 부서·직종·재직여부 필터 + 검색 + 페이징 |
| `options` | 셀렉트박스용 (부서장 지정 등) |
| `get` | 단건 (면허 포함) |
| `save` | 신규/수정. **면허를 중첩 배열로 함께 저장** |
| `resign` | 퇴사 처리 (`resigned_at` + `is_active=false`) |
| `delete` | 물리 삭제 (오등록 취소용, 참조 없을 때만) |

면허는 별도 라우트를 만들지 않는다. 직원과 독립적으로 조회·수정할 일이 없다. `save`가 면허 배열을 받아 `deleteMany` 후 `createMany`로 갈아끼운다.

### `/api/category`

모델은 있으나 라우트가 없다. 새로 만든다.

| 엔드포인트 | 설명 |
| --- | --- |
| `list` | `group` 필터 |
| `save` | 신규/수정 |
| `delete` | 삭제 (참조 없을 때만) |

### 권한

기존 11개에 4개를 추가해 15개가 된다.

- `department.view`, `department.edit` — 부서 관리
- `hr.view`, `hr.edit` — 직원 관리

`Category` 관리는 `permission.menu.view`/`update`(환경설정 권한)를 재사용한다. 별도 권한을 만들면 관리 대상만 늘어난다.

`prisma/seed-rbac.js`의 `PERMS` 배열에 추가하고, 관리자 역할에 자동 부여된다.

## 화면

### 부서 관리 (`/hr/department`)

좌측 트리 + 우측 상세의 2단 구성.

- **좌측**: 복원한 `EntityTree`. 드래그로 계층·순서 변경, 우클릭 없이 인라인 추가/수정/삭제.
- **우측**: 선택한 부서의 상세 — 이름, 코드, 유형(Category 셀렉트), 부서장(직원 셀렉트), 정렬, 활성화. 저장 버튼.

부서를 선택하지 않았으면 우측은 `EmptyState variant="select"`.

### 직원 관리 (`/hr/employee`)

ag-grid 테이블 + 상세 드로어.

- **필터바**: 부서(계층 들여쓰기 셀렉트), 직종, 재직/퇴사/전체, 이름·사번 검색
- **표 열**: 사번, 이름, 부서, 직급, 직종, 입사일, 상태(재직/퇴사 배지)
- **행 클릭** → 우측 드로어에 상세

**드로어 3개 섹션:**
1. 신원 — 사번, 이름, 영문명, 연락처, 이메일
2. 소속 — 부서, 직급, 직종, 고용형태, 입사일
3. 면허 — 행 추가/삭제가 되는 반복 필드 (종류, 번호, 발급일, 만료일)

하단에 저장 / 퇴사 처리 버튼. 퇴사자는 드로어 상단에 퇴사일 배지를 띄우고 편집을 막는다.

### 환경설정 "분류 관리" 탭 추가

`SettingsView.vue`의 탭 배열에 `category`를 추가한다. 좌측에 코드 그룹 목록(부서유형·직급·직종·고용형태·면허종류), 우측에 해당 그룹의 코드 목록. 기존 태그·FAQ 분류 탭과 같은 자리에 놓는다.

### 사이드바

**"인사"** 그룹을 새로 만들고 하위에 부서 관리·직원 관리를 넣는다. 아이콘은 `fa-hospital-user`.

```
대시보드
인사              ← 신규
  부서 관리
  직원 관리
게시판
자주 하는 질문
계정 관리
환경설정
```

## 시드

`prisma/seed-hr.js`를 새로 만든다. `package.json`에 `seed:hr` 스크립트를 추가한다.

**Category 코드** (개발 편의용 기본값):
- `department_type`: 진료과, 간호부, 행정, 진료지원
- `position`: 원장, 부장, 과장, 팀장, 주임, 사원
- `job_type`: 의사, 간호사, 약사, 의료기사, 행정직, 기능직
- `employment_type`: 정규직, 계약직, 파트타임, 파견
- `license_type`: 의사면허, 간호사면허, 약사면허, 의료기사면허

**부서 트리** (3단계 검증용):
```
진료부 (DEPT-MED)
  내과 (DEPT-IM)
    순환기내과 (DEPT-CARD)
  정형외과 (DEPT-OS)
간호부 (DEPT-NUR)
  병동간호팀 (DEPT-WARD)
행정부 (DEPT-ADM)
  원무팀 (DEPT-RECEP)
```

직원은 시드하지 않는다. 화면에서 등록하며 검증한다.

## 검증

테스트 프레임워크가 없다. 기반 정리와 같은 방식으로 간다.

- **백엔드** — `npx prisma validate`, `npx prisma db push`, `npm run seed:hr`, 서버 기동 후 라우트 로드 확인
- **프론트** — `npm run build`가 곧 검증(`vue-tsc`가 삭제·오타 참조를 잡는다)
- **수동 시나리오** — 이 사이클의 핵심 리스크(순환 참조, 소프트 삭제)를 정면으로 찌른다.

1. 부서 트리를 3단계로 만든다 (진료부 > 내과 > 순환기내과)
2. 직원을 등록하고 순환기내과에 배치한다
3. 그 직원을 순환기내과의 **부서장으로 지정**한다 → 순환 참조가 실제로 저장되는지
4. 직원을 **퇴사 처리**한다 → `resigned_at` 설정 + 목록에서 퇴사 배지
5. 하위 부서가 있는 **내과 삭제를 시도**한다 → `IN_USE` 에러로 막히는지
6. 소속 직원이 있는 **순환기내과 삭제를 시도**한다 → 막히는지
7. 참조 중인 **Category(직급) 삭제를 시도**한다 → 막히는지
8. 부서 트리에서 **드래그로 계층을 바꾼다** → `reorder`가 도는지

## 구현 순서

**부서를 끝까지 완성한 뒤 직원을 얹는다.** 직원이 부서를 참조하므로 의존 방향과 일치하고, 부서 화면이 먼저 돌면 직원 등록 시 실제 부서를 골라 테스트할 수 있다.

1. Prisma 스키마 — 모델 3개 + Category 확장 + User 연결, `db push`
2. 권한 4개 추가, `seed-rbac.js` 갱신
3. 백엔드 — `category` 라우트·서비스·검증기
4. 백엔드 — `department` 라우트·서비스·검증기
5. 백엔드 — `employee` 라우트·서비스·검증기 (면허 중첩 저장 포함)
6. 시드 — `seed-hr.js` (Category + 부서 트리)
7. 프론트 — `EntityTree` 복원, `api/hr.ts` 신규
8. 프론트 — 부서 관리 화면
9. 프론트 — 직원 관리 화면 (목록 + 드로어)
10. 프론트 — 환경설정 "분류 관리" 탭, 사이드바 "인사" 그룹, 라우터

각 단계는 그 시점에 빌드가 통과해야 한다.

## 다음 사이클로 넘기는 것

- **인사(HR) 본체** — 근태·교대·급여·평가·교육. 이 마스터 위에 올린다.
- **조직 개편 이력** — 부서 이동 히스토리가 필요해지면.
- **인적사항** — 급여 지급 시. 암호화·접근제어 설계와 함께.
