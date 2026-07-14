# 부서 · 직원 마스터 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부서 조직도(계층 트리)와 직원 명부(면허 포함)를 등록·관리하는 마스터를 만들어, 후속 도메인이 참조할 안정된 외래키를 제공한다.

**Architecture:** 부서를 끝까지 완성(모델→API→화면)한 뒤 직원을 얹는다. 직원이 부서를 참조하므로 의존 방향과 일치하고, 부서 화면이 먼저 돌면 직원 등록 시 실제 부서를 골라 검증할 수 있다. 기존 POST-RPC 패턴(`routes/` 자동 스캔, zod 검증, 서비스에서 `AppError`)을 그대로 따른다.

**Tech Stack:** Node.js + Fastify 4 (ESM), Prisma 5 + MySQL, Vue 3 + Vite + Tailwind 3, Pinia

## Global Constraints

- 백엔드 리포: `/Users/wjd/프로젝트/hospital_server` · 프론트 리포: `/Users/wjd/프로젝트/hospital_frontend`
- 브랜치: 양쪽 모두 `hospital-foundation` (기반 정리 브랜치를 이어서 씀)
- DB: `hospital_system` (MySQL). 기존 `cs_system`은 읽지도 쓰지도 않는다.
- **테스트 프레임워크가 없다.** `test/`는 비어 있고 `npm test`는 아무것도 실행하지 않는다. 테스트를 새로 만들지 마세요. 검증은 `npx prisma validate` · `npm run build`(vue-tsc) · `grep` · 수동 클릭이다.
- **`ag-grid`를 쓰지 않는다.** `package.json`에 있으나 코드베이스 미사용. 기존 화면은 순수 `<table>` + `.tbl`/`.th`/`.td` 클래스. 표본: `src/pages/settings/UserAdmin.vue`
- 새 권한 4개: `department.view`, `department.edit`, `hr.view`, `hr.edit` (기존 11 → 15)
- **권한을 라우트에서 강제한다.** `server/middleware/permission.js`의 `permission(code)` preHandler를 쓴다. 코어의 `user.js` · `role.js` · `settings.js` · `permission.js` · `auditLog.js` · `notification.js`가 이미 쓰는 패턴이다. `ensureAuth`(로그인 확인)만으로는 부족하다 — 그러면 로그인한 아무나 인사 데이터를 고칠 수 있고 권한 4개가 장식이 된다.

```javascript
import { permission } from "../middleware/permission.js";

app.post("/list", { preHandler: permission("department.view") }, async (req) => ...);
app.post("/save", { preHandler: permission("department.edit") }, async (req) => ...);
```

  `permission()`은 JWT의 `is_super`면 무조건 통과시키고, 아니면 `decoded.permissions`에 코드가 있는지 본다. `req.user`도 세팅하므로 `ensureAuth`를 따로 부를 필요가 없다.

  라우트별 권한 매핑:
  - `department`: 조회(`list`/`tree`/`options`/`get`) → `department.view`, 변경(`save`/`reorder`/`delete`) → `department.edit`
  - `employee`: 조회(`list`/`options`/`get`) → `hr.view`, 변경(`save`/`resign`/`delete`) → `hr.edit`
  - `category`: 조회(`list`) → `permission.menu.view`, 변경(`save`/`delete`) → `permission.menu.update`
- Category 코드 그룹: `department_type`, `position`, `job_type`, `employment_type`, `license_type`
- 커밋 메시지는 한국어. 본문 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- macOS zsh 주의: `grep`은 **ugrep**이라 GNU식 `--include="*.vue"`가 파일명으로 해석돼 무시된다. `find`로 파일 목록을 만들 것. 따옴표 없는 변수는 단어 분리되지 않으므로 `while IFS= read -r`을 쓸 것. `timeout` 명령이 없다.
- 서버 기동 확인: `(node server/index.js > /tmp/boot.log 2>&1 &) ; sleep 6; pkill -f "node server/index.js"` — `EADDRINUSE`는 무시(라우트 등록은 listen 이전에 끝남). 반드시 `pkill`로 정리할 것.

## File Structure

**백엔드 (`hospital_server`)**

| 파일 | 책임 |
| --- | --- |
| `prisma/schema.prisma` | 모델 3개 추가 + Category 확장 + User 연결 |
| `prisma/seed-rbac.js` | 권한 11 → 15 |
| `prisma/seed-hr.js` | 신규 — Category 코드 + 부서 트리 |
| `server/routes/category.js` | `/api/category` |
| `server/services/category.service.js` | 공통코드 CRUD |
| `server/validators/category.schema.js` | zod |
| `server/routes/department.js` | `/api/department` |
| `server/services/department.service.js` | 트리·순환방지·reorder·참조무결성 |
| `server/validators/department.schema.js` | zod |
| `server/routes/employee.js` | `/api/employee` |
| `server/services/employee.service.js` | 목록·면허 중첩저장·퇴사처리 |
| `server/validators/employee.schema.js` | zod |

**프론트 (`hospital_frontend`)**

| 파일 | 책임 |
| --- | --- |
| `src/components/base/EntityTree.vue` | git에서 복원 (347줄) |
| `src/api/hr.ts` | 신규 — `departmentApi`, `employeeApi`, `categoryApi` |
| `src/pages/hr/DepartmentView.vue` | 트리 + 상세 2단 |
| `src/pages/hr/EmployeeView.vue` | 표 + 드로어 |
| `src/pages/settings/CategorySettings.vue` | 분류 관리 탭 |
| `src/pages/settings/SettingsView.vue` | 탭 추가 |
| `src/components/layout/AppSidebar.vue` | "인사" 그룹 추가 |
| `src/router/index.ts` | 라우트 2개 추가 |

---

### Task 1: Prisma 스키마 — 모델 3개 + Category 확장 + User 연결

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: 없음
- Produces: Prisma 모델 `Department`, `Employee`, `EmployeeLicense`, 확장된 `Category`(+`group`), `User.employee_id`. Task 2~5의 서비스가 `prisma.department` / `prisma.employee` / `prisma.employeeLicense` / `prisma.category`로 접근한다.

- [ ] **Step 1: `Category` 모델 교체**

`prisma/schema.prisma`에서 기존 `Category` 모델을 찾아 아래로 교체한다.

```prisma
/// 공통 코드 (직급·직종·고용형태·면허종류·부서유형 등)
model Category {
  id Int @id @default(autoincrement())

  group String @db.VarChar(50)  // 코드 그룹 (department_type, position, job_type, employment_type, license_type)
  text  String @db.VarChar(255) // 표시명
  value String @db.VarChar(255) // 코드값

  is_active Boolean @default(true)
  sort      Int     @default(0)

  created_at DateTime? @default(now())
  updated_at DateTime? @updatedAt

  departmentTypes     Department[]      @relation("DepartmentType")
  employeePositions   Employee[]        @relation("EmployeePosition")
  employeeJobTypes    Employee[]        @relation("EmployeeJobType")
  employeeEmployTypes Employee[]        @relation("EmployeeEmploymentType")
  licenses            EmployeeLicense[] @relation("LicenseType")

  @@unique([group, value])
  @@index([group, sort])
}
```

`Category` 테이블은 현재 **0행**이고 코어 서비스 어디에서도 참조하지 않는다. 따라서 `NOT NULL`인 `group` 추가와 유니크 제약이 `db push`로 안전하게 걸린다.

- [ ] **Step 2: 파일 끝에 모델 3개 추가**

```prisma
//////////////////////////////////////////////////////////////
// 인사 마스터 (부서 · 직원)
//////////////////////////////////////////////////////////////

/// 부서 (계층 트리)
model Department {
  id   Int    @id @default(autoincrement())
  name String @db.VarChar(100)
  code String @unique @db.VarChar(30) // 부서 코드 (예: DEPT-CARD)

  parent_id Int?
  parent    Department?  @relation("DepartmentTree", fields: [parent_id], references: [id])
  children  Department[] @relation("DepartmentTree")

  type_id Int? // 부서 유형 (Category: department_type)
  type    Category? @relation("DepartmentType", fields: [type_id], references: [id])

  // 부서장 — Employee.department_id 와 순환. 둘 다 nullable 로 둬서 풀린다.
  head_employee_id Int?
  head_employee    Employee? @relation("DepartmentHead", fields: [head_employee_id], references: [id])

  employees Employee[] @relation("EmployeeDepartment")

  sort       Int      @default(0)
  is_active  Boolean  @default(true)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([parent_id])
  @@index([sort])
}

/// 직원 마스터 — 로그인 계정(User)과 분리, 선택적 1:1 연결
model Employee {
  id      Int     @id @default(autoincrement())
  emp_no  String  @unique @db.VarChar(30) // 사번
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
  resigned_at DateTime? @db.Date // 있으면 퇴사자

  licenses    EmployeeLicense[]
  headOfDepts Department[]      @relation("DepartmentHead")
  user        User?             @relation("UserEmployee")

  is_active  Boolean  @default(true)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([department_id])
  @@index([name])
}

/// 직원 면허 (1직원 : N면허)
model EmployeeLicense {
  id          Int      @id @default(autoincrement())
  employee_id Int
  employee    Employee @relation(fields: [employee_id], references: [id], onDelete: Cascade)

  license_type_id Int      // 면허 종류 (Category: license_type)
  license_type    Category @relation("LicenseType", fields: [license_type_id], references: [id])

  license_no String    @db.VarChar(60)
  issued_at  DateTime? @db.Date
  expires_at DateTime? @db.Date

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([employee_id])
}
```

- [ ] **Step 3: `User` 모델에 employee 연결 추가**

`model User` 안의 마지막 역참조 블록(`postComments PostComment[]` 아래)에 두 줄을 추가한다.

```prisma
  employee_id Int?      @unique
  employee    Employee? @relation("UserEmployee", fields: [employee_id], references: [id])
```

- [ ] **Step 4: 스키마 검증**

```bash
cd /Users/wjd/프로젝트/hospital_server
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`

순환 참조 에러(`Error validating: ... ambiguous relation`)가 나오면 `@relation` 이름(`"DepartmentHead"`, `"EmployeeDepartment"`)이 양쪽에 정확히 같은지 확인한다.

- [ ] **Step 5: 모델 개수 확인**

```bash
grep -cE "^model " prisma/schema.prisma
```

Expected: `20` (기존 17 + 신규 3)

- [ ] **Step 6: DB 반영**

```bash
grep DATABASE_URL .env   # /hospital_system 인지 반드시 확인
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.` 및 `Generated Prisma Client`

`cs_system`이 보이면 **즉시 중단하고 보고**하세요.

- [ ] **Step 7: 서버 기동 확인**

```bash
(node server/index.js > /tmp/boot1.log 2>&1 &) ; sleep 6; pkill -f "node server/index.js"; sleep 1
grep -c "Route loaded" /tmp/boot1.log
grep -i "error" /tmp/boot1.log | grep -v EADDRINUSE || echo "에러 없음"
```

Expected: 라우트 `15`개 (아직 새 라우트를 안 만들었으므로), 에러 없음.

- [ ] **Step 8: 커밋**

```bash
git add prisma/schema.prisma
git commit -m "$(cat <<'EOF'
인사: Prisma 모델 3개 추가 (Department 트리, Employee, EmployeeLicense)

Category에 group 필드 추가 — 직급·직종·고용형태·면허종류·부서유형을 담는
공통코드로 활용. 현재 0행·미사용이라 NOT NULL 추가와 @@unique([group,value])가
안전함을 확인.

Department.head_employee_id ↔ Employee.department_id 순환 참조는 둘 다
nullable로 두고 부서 생성 → 직원 등록 → 부서장 지정 순으로 풂.

User.employee_id로 로그인 계정과 직원을 선택적 1:1 연결. 로그인하지 않는
직원(간호사·의사 대부분)도 급여·근태 대상이 되고, 퇴사 시 계정만 비활성화하고
인사 기록은 보존된다.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 권한 4개 추가 + Category API

**Files:**
- Modify: `prisma/seed-rbac.js`
- Create: `server/validators/category.schema.js`
- Create: `server/services/category.service.js`
- Create: `server/routes/category.js`

**Interfaces:**
- Consumes: Task 1의 `prisma.category`
- Produces:
  - 권한 코드 `department.view`, `department.edit`, `hr.view`, `hr.edit`
  - `/api/category/list` `{group?, only_active?}` → `Category[]`
  - `/api/category/save` `{id?, group, text, value, sort?, is_active?}` → `Category`
  - `/api/category/delete` `{id}` → `{ok: true}`
  - Task 3·4의 서비스가 Category를 참조 무결성 체크에 쓴다.

- [ ] **Step 1: `prisma/seed-rbac.js`의 PERMS 배열에 4개 추가**

기존 `PERMS` 배열의 `// 환경설정` 그룹 **앞에** 아래 블록을 넣는다.

```javascript
  // 인사
  ["department.view", "부서 조회", "인사"],
  ["department.edit", "부서 편집", "인사"],
  ["hr.view", "직원 조회", "인사"],
  ["hr.edit", "직원 편집", "인사"],
```

`PERMS`는 11개에서 15개가 된다. 시드의 `deleteMany`(카탈로그 밖 권한 정리)와 관리자 역할 자동 부여는 그대로 동작한다.

- [ ] **Step 2: `server/validators/category.schema.js` 생성**

```javascript
import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  group: z.string().trim().min(1).optional(),
  only_active: z.boolean().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  group: z.string().trim().min(1, "코드 그룹을 입력하세요"),
  text: z.string().trim().min(1, "표시명을 입력하세요"),
  value: z.string().trim().min(1, "코드값을 입력하세요"),
  sort: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
});
```

- [ ] **Step 3: `server/services/category.service.js` 생성**

```javascript
import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  async list({ group, only_active } = {}) {
    const where = {};
    if (group) where.group = group;
    if (only_active) where.is_active = true;
    return prisma.category.findMany({
      where,
      orderBy: [{ group: "asc" }, { sort: "asc" }, { id: "asc" }],
    });
  },

  async save(data) {
    const { id, ...fields } = data;
    const dup = await prisma.category.findFirst({
      where: {
        group: fields.group,
        value: fields.value,
        ...(id ? { id: { not: id } } : {}),
      },
    });
    if (dup) throw new AppError("같은 그룹에 동일한 코드값이 있습니다.", 400, "DUPLICATE");

    if (id) {
      const ex = await prisma.category.findUnique({ where: { id } });
      if (!ex) throw new AppError("코드를 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.category.update({ where: { id }, data: fields });
    }
    return prisma.category.create({ data: fields });
  },

  async remove(id) {
    const ex = await prisma.category.findUnique({ where: { id } });
    if (!ex) throw new AppError("코드를 찾을 수 없습니다.", 404, "NOT_FOUND");

    // 참조 무결성 — 쓰이는 곳이 하나라도 있으면 거부
    const [depts, pos, job, emp, lic] = await Promise.all([
      prisma.department.count({ where: { type_id: id } }),
      prisma.employee.count({ where: { position_id: id } }),
      prisma.employee.count({ where: { job_type_id: id } }),
      prisma.employee.count({ where: { employment_type_id: id } }),
      prisma.employeeLicense.count({ where: { license_type_id: id } }),
    ]);
    const used = depts + pos + job + emp + lic;
    if (used > 0) {
      throw new AppError(
        `이 코드를 사용하는 항목이 ${used}건 있어 삭제할 수 없습니다. 비활성 처리하세요.`,
        400,
        "IN_USE",
      );
    }

    await prisma.category.delete({ where: { id } });
    return { ok: true };
  },
};
```

- [ ] **Step 4: `server/routes/category.js` 생성**

```javascript
import service from "../services/category.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/category.schema.js";

function ensureAuth(user) {
  if (!user?.id) {
    const e = new Error("로그인이 필요합니다."); e.statusCode = 401; e.code = "UNAUTH"; e.isOperational = true; throw e;
  }
}

/** 공통 코드 (/api/category) — 직급·직종·고용형태·면허종류·부서유형 */
export default async function categoryRoutes(app) {
  app.post("/list", async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/save", async (req) => { ensureAuth(req.user); return service.save(validate(saveSchema, req.body)); });
  app.post("/delete", async (req) => { ensureAuth(req.user); const { id } = validate(idSchema, req.body); return service.remove(id); });
}
```

- [ ] **Step 5: 시드 실행 후 권한 확인**

```bash
cd /Users/wjd/프로젝트/hospital_server
npm run seed:rbac
```

Expected 마지막 줄: `✅ rbac seed done: 15 perms (removed 0 stale), role 관리자`

```bash
/opt/homebrew/opt/mysql@8.0/bin/mysql -u root -h 127.0.0.1 hospital_system -N -e "SELECT code FROM Permission ORDER BY sort;" | tr '\n' ' '
```

Expected: 15개 코드에 `department.view`, `department.edit`, `hr.view`, `hr.edit`가 포함.

- [ ] **Step 6: 라우트 로드 확인**

```bash
(node server/index.js > /tmp/boot2.log 2>&1 &) ; sleep 6; pkill -f "node server/index.js"; sleep 1
grep -c "Route loaded" /tmp/boot2.log
grep "Route loaded" /tmp/boot2.log | grep category
```

Expected: 라우트 `16`개, `/api/category` 포함.

- [ ] **Step 7: 커밋**

```bash
git add prisma/seed-rbac.js server/routes/category.js server/services/category.service.js server/validators/category.schema.js
git commit -m "$(cat <<'EOF'
인사: 권한 4개 추가(11→15), 공통코드 API

department.view/edit, hr.view/edit 추가. Category 관리는 별도 권한 없이
환경설정 권한(permission.menu.*)을 재사용 — 권한만 늘리지 않는다.

/api/category — 직급·직종·고용형태·면허종류·부서유형을 group으로 묶어 관리.
삭제 시 부서·직원·면허 참조를 전부 세어 하나라도 있으면 거부.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 부서 API (트리 · 순환방지 · reorder)

**Files:**
- Create: `server/validators/department.schema.js`
- Create: `server/services/department.service.js`
- Create: `server/routes/department.js`

**Interfaces:**
- Consumes: Task 1의 `prisma.department`, Task 2의 Category
- Produces:
  - `/api/department/tree` `{}` → `Node[]` (각 노드: `{id, name, code, parent_id, is_active, children[]}`)
  - `/api/department/list` `{q?, is_active?, page?, limit?}` → `{rows, total, page, limit, totalPages}`
  - `/api/department/options` `{}` → `{id, name, code, depth}[]` (계층 들여쓰기용 `depth` 포함)
  - `/api/department/get` `{id}` → `Department` (type·head_employee 조인)
  - `/api/department/save` `{id?, name, code, parent_id?, type_id?, head_employee_id?, sort?, is_active?}` → `Department`
  - `/api/department/reorder` `{id, parent_id?, before_id?}` → `{ok: true}`
  - `/api/department/delete` `{id}` → `{ok: true}`
  - Task 4(직원)가 `department_id`로 참조하고, Task 7·8(프론트)이 `tree`/`options`를 소비한다.

- [ ] **Step 1: `server/validators/department.schema.js` 생성**

```javascript
import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const emptySchema = z.object({}).passthrough();

export const listSchema = z.object({
  q: z.string().trim().optional(),
  is_active: z.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1, "부서명을 입력하세요"),
  code: z.string().trim().min(1, "부서 코드를 입력하세요"),
  parent_id: z.coerce.number().int().positive().nullish(),
  type_id: z.coerce.number().int().positive().nullish(),
  head_employee_id: z.coerce.number().int().positive().nullish(),
  sort: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
});

export const reorderSchema = z.object({
  id: z.coerce.number().int().positive(),
  parent_id: z.coerce.number().int().positive().nullish(),
  before_id: z.coerce.number().int().positive().nullish(),
});
```

`EntityTree`가 `save({ name, parent_id })`로 코드 없이 노드를 만들 수 있으므로, `code`가 필수면 트리에서 인라인 추가가 실패한다. **서비스에서 `code` 미지정 시 자동 생성**한다(Step 2 참조). 검증기에서는 필수로 두되, 트리 인라인 추가용 별도 스키마를 만든다.

위 `saveSchema` 아래에 추가한다.

```javascript
/** EntityTree 인라인 추가용 — name 만 받고 code 는 서버가 생성 */
export const quickSaveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1, "부서명을 입력하세요"),
  parent_id: z.coerce.number().int().positive().nullish(),
});
```

- [ ] **Step 2: `server/services/department.service.js` 생성**

```javascript
import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

/** 부서 코드 자동 생성 — DEPT-0001 형태. 트리 인라인 추가에서 code 없이 만들 때 사용. */
async function nextCode() {
  const last = await prisma.department.findFirst({
    where: { code: { startsWith: "DEPT-" } },
    orderBy: { id: "desc" },
    select: { code: true },
  });
  const n = last ? (parseInt(last.code.replace("DEPT-", ""), 10) || 0) + 1 : 1;
  return `DEPT-${String(n).padStart(4, "0")}`;
}

/** parent_id 가 자기 자신이거나 자기 후손이면 던진다 (조상 체인을 거슬러 올라가며 검사) */
async function assertNoCycle(id, parentId) {
  if (!parentId) return;
  if (parentId === id) {
    throw new AppError("자기 자신을 상위 부서로 지정할 수 없습니다.", 400, "INVALID_PARENT");
  }
  if (!id) return;
  let cur = await prisma.department.findUnique({
    where: { id: parentId },
    select: { parent_id: true },
  });
  while (cur?.parent_id) {
    if (cur.parent_id === id) {
      throw new AppError("하위 부서를 상위 부서로 지정할 수 없습니다.", 400, "CYCLE");
    }
    cur = await prisma.department.findUnique({
      where: { id: cur.parent_id },
      select: { parent_id: true },
    });
  }
}

export default {
  async list({ q, is_active, page, limit } = {}) {
    const where = {};
    if (typeof is_active === "boolean") where.is_active = is_active;
    if (q) where.OR = [{ name: { contains: q } }, { code: { contains: q } }];
    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.department.findMany({
        where,
        orderBy: [{ sort: "asc" }, { id: "asc" }],
        skip,
        take: l,
        include: { type: true, head_employee: { select: { id: true, name: true, emp_no: true } } },
      }),
      prisma.department.count({ where }),
    ]);
    return buildPageResult({ rows, total, page: p, limit: l });
  },

  /** 계층 트리 (EntityTree 용) */
  async tree() {
    const rows = await prisma.department.findMany({
      orderBy: [{ sort: "asc" }, { id: "asc" }],
      select: { id: true, name: true, code: true, parent_id: true, is_active: true },
    });
    const byId = new Map();
    rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
    const roots = [];
    for (const node of byId.values()) {
      if (node.parent_id && byId.has(node.parent_id)) byId.get(node.parent_id).children.push(node);
      else roots.push(node);
    }
    return roots;
  },

  /** 셀렉트박스용 — 계층 순서대로 평탄화하고 depth 를 붙인다 */
  async options() {
    const rows = await prisma.department.findMany({
      where: { is_active: true },
      orderBy: [{ sort: "asc" }, { id: "asc" }],
      select: { id: true, name: true, code: true, parent_id: true },
    });
    const kids = new Map();
    rows.forEach((r) => {
      const k = r.parent_id ?? 0;
      if (!kids.has(k)) kids.set(k, []);
      kids.get(k).push(r);
    });
    const out = [];
    const walk = (parentId, depth) => {
      for (const r of kids.get(parentId) ?? []) {
        out.push({ id: r.id, name: r.name, code: r.code, depth });
        walk(r.id, depth + 1);
      }
    };
    walk(0, 0);
    return out;
  },

  async get(id) {
    const d = await prisma.department.findUnique({
      where: { id },
      include: { type: true, head_employee: { select: { id: true, name: true, emp_no: true } } },
    });
    if (!d) throw new AppError("부서를 찾을 수 없습니다.", 404, "NOT_FOUND");
    return d;
  },

  async save(data) {
    const { id, ...fields } = data;
    await assertNoCycle(id, fields.parent_id ?? null);

    if (fields.code) {
      const dup = await prisma.department.findFirst({
        where: { code: fields.code, ...(id ? { id: { not: id } } : {}) },
      });
      if (dup) throw new AppError("이미 존재하는 부서 코드입니다.", 400, "DUPLICATE");
    }

    if (id) {
      const ex = await prisma.department.findUnique({ where: { id } });
      if (!ex) throw new AppError("부서를 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.department.update({ where: { id }, data: fields });
    }
    return prisma.department.create({
      data: { ...fields, code: fields.code || (await nextCode()) },
    });
  },

  /** 드래그로 계층·순서 변경 */
  async reorder({ id, parent_id, before_id }) {
    const self = await prisma.department.findUnique({ where: { id }, select: { id: true } });
    if (!self) throw new AppError("부서를 찾을 수 없습니다.", 404, "NOT_FOUND");

    const pid = parent_id ?? null;
    await assertNoCycle(id, pid);

    await prisma.department.update({ where: { id }, data: { parent_id: pid } });

    const sibs = await prisma.department.findMany({
      where: { parent_id: pid, id: { not: id } },
      orderBy: [{ sort: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const orderIds = [];
    let inserted = false;
    for (const s of sibs) {
      if (before_id && s.id === before_id) {
        orderIds.push(id);
        inserted = true;
      }
      orderIds.push(s.id);
    }
    if (!inserted) orderIds.push(id);

    await prisma.$transaction(
      orderIds.map((sid, i) => prisma.department.update({ where: { id: sid }, data: { sort: i } })),
    );
    return { ok: true };
  },

  async remove(id) {
    const ex = await prisma.department.findUnique({ where: { id } });
    if (!ex) throw new AppError("부서를 찾을 수 없습니다.", 404, "NOT_FOUND");

    const kids = await prisma.department.count({ where: { parent_id: id } });
    if (kids > 0) {
      throw new AppError("하위 부서가 있어 삭제할 수 없습니다.", 400, "HAS_CHILDREN");
    }
    const emps = await prisma.employee.count({ where: { department_id: id } });
    if (emps > 0) {
      throw new AppError(
        `소속 직원이 ${emps}명 있어 삭제할 수 없습니다. 비활성 처리하세요.`,
        400,
        "IN_USE",
      );
    }

    await prisma.department.delete({ where: { id } });
    return { ok: true };
  },
};
```

- [ ] **Step 3: `server/routes/department.js` 생성**

```javascript
import service from "../services/department.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idSchema,
  emptySchema,
  listSchema,
  saveSchema,
  quickSaveSchema,
  reorderSchema,
} from "../validators/department.schema.js";

function ensureAuth(user) {
  if (!user?.id) {
    const e = new Error("로그인이 필요합니다."); e.statusCode = 401; e.code = "UNAUTH"; e.isOperational = true; throw e;
  }
}

/** 부서 (/api/department) — 계층 트리 */
export default async function departmentRoutes(app) {
  app.post("/list", async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/tree", async () => service.tree());
  app.post("/options", async () => service.options());
  app.post("/get", async (req) => { const { id } = validate(idSchema, req.body); return service.get(id); });

  // 트리 인라인 추가는 name/parent_id 만 오고, 상세 패널 저장은 전체 필드가 온다.
  // code 유무로 갈라 알맞은 스키마로 검증한다.
  app.post("/save", async (req) => {
    ensureAuth(req.user);
    const body = req.body || {};
    const schema = body.code === undefined ? quickSaveSchema : saveSchema;
    return service.save(validate(schema, body));
  });

  app.post("/reorder", async (req) => { ensureAuth(req.user); return service.reorder(validate(reorderSchema, req.body)); });
  app.post("/delete", async (req) => { ensureAuth(req.user); const { id } = validate(idSchema, req.body); return service.remove(id); });
}
```

- [ ] **Step 4: 라우트 로드 확인**

```bash
cd /Users/wjd/프로젝트/hospital_server
(node server/index.js > /tmp/boot3.log 2>&1 &) ; sleep 6; pkill -f "node server/index.js"; sleep 1
grep -c "Route loaded" /tmp/boot3.log
grep "Route loaded" /tmp/boot3.log | grep department
grep -i "error" /tmp/boot3.log | grep -v EADDRINUSE || echo "에러 없음"
```

Expected: 라우트 `17`개, `/api/department` 포함, 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add server/routes/department.js server/services/department.service.js server/validators/department.schema.js
git commit -m "$(cat <<'EOF'
인사: 부서 API (계층 트리 · 순환 방지 · 드래그 정렬)

parent_id 자기참조 트리. 상위 지정 시 조상 체인을 거슬러 올라가며 순환을
검사(자기 자신 → INVALID_PARENT, 후손 → CYCLE).

삭제는 하위 부서(HAS_CHILDREN)와 소속 직원(IN_USE)을 세어 막는다.

options는 계층 순서대로 평탄화하고 depth를 붙여 셀렉트박스 들여쓰기를 지원.

EntityTree의 인라인 추가는 name/parent_id만 보내므로, code 유무로 스키마를
갈라 검증하고 code 미지정 시 DEPT-0001 형태로 자동 생성.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 직원 API (면허 중첩저장 · 퇴사처리)

**Files:**
- Create: `server/validators/employee.schema.js`
- Create: `server/services/employee.service.js`
- Create: `server/routes/employee.js`

**Interfaces:**
- Consumes: Task 1의 `prisma.employee`/`prisma.employeeLicense`, Task 3의 부서
- Produces:
  - `/api/employee/list` `{q?, department_id?, job_type_id?, status?, page?, limit?}` → `{rows, total, page, limit, totalPages}` (`status`: `"active"` | `"resigned"` | 미지정=전체)
  - `/api/employee/options` `{}` → `{id, name, emp_no}[]`
  - `/api/employee/get` `{id}` → `Employee` (licenses 포함)
  - `/api/employee/save` `{id?, emp_no, name, ..., licenses: [{license_type_id, license_no, issued_at?, expires_at?}]}` → `Employee`
  - `/api/employee/resign` `{id, resigned_at}` → `Employee`
  - `/api/employee/delete` `{id}` → `{ok: true}`
  - Task 8·9(프론트)가 소비한다.

- [ ] **Step 1: `server/validators/employee.schema.js` 생성**

```javascript
import { z } from "zod";

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const listSchema = z.object({
  q: z.string().trim().optional(),
  department_id: z.coerce.number().int().positive().nullish(),
  job_type_id: z.coerce.number().int().positive().nullish(),
  status: z.enum(["active", "resigned"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const licenseSchema = z.object({
  license_type_id: z.coerce.number().int().positive(),
  license_no: z.string().trim().min(1, "면허번호를 입력하세요"),
  issued_at: z.coerce.date().nullish(),
  expires_at: z.coerce.date().nullish(),
});

export const saveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  emp_no: z.string().trim().min(1, "사번을 입력하세요"),
  name: z.string().trim().min(1, "이름을 입력하세요"),
  name_en: z.string().trim().nullish(),
  department_id: z.coerce.number().int().positive().nullish(),
  position_id: z.coerce.number().int().positive().nullish(),
  job_type_id: z.coerce.number().int().positive().nullish(),
  employment_type_id: z.coerce.number().int().positive().nullish(),
  phone: z.string().trim().nullish(),
  email: z.string().trim().email("이메일 형식이 아닙니다").nullish().or(z.literal("")),
  hired_at: z.coerce.date({ message: "입사일을 입력하세요" }),
  is_active: z.boolean().default(true),
  licenses: z.array(licenseSchema).default([]),
});

export const resignSchema = z.object({
  id: z.coerce.number().int().positive(),
  resigned_at: z.coerce.date({ message: "퇴사일을 입력하세요" }),
});
```

- [ ] **Step 2: `server/services/employee.service.js` 생성**

```javascript
import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

const DETAIL_INCLUDE = {
  department: { select: { id: true, name: true, code: true } },
  position: true,
  job_type: true,
  employment_type: true,
  licenses: { include: { license_type: true }, orderBy: { id: "asc" } },
};

export default {
  async list({ q, department_id, job_type_id, status, page, limit } = {}) {
    const where = {};
    if (department_id) where.department_id = department_id;
    if (job_type_id) where.job_type_id = job_type_id;
    if (status === "active") where.resigned_at = null;
    if (status === "resigned") where.resigned_at = { not: null };
    if (q) where.OR = [{ name: { contains: q } }, { emp_no: { contains: q } }];

    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        orderBy: [{ emp_no: "asc" }],
        skip,
        take: l,
        include: {
          department: { select: { id: true, name: true } },
          position: { select: { id: true, text: true } },
          job_type: { select: { id: true, text: true } },
        },
      }),
      prisma.employee.count({ where }),
    ]);
    return buildPageResult({ rows, total, page: p, limit: l });
  },

  async options() {
    return prisma.employee.findMany({
      where: { resigned_at: null, is_active: true },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, emp_no: true },
    });
  },

  async get(id) {
    const e = await prisma.employee.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!e) throw new AppError("직원을 찾을 수 없습니다.", 404, "NOT_FOUND");
    return e;
  },

  /** 신규/수정 겸용. 면허는 통째로 갈아끼운다(deleteMany → createMany). */
  async save(data) {
    const { id, licenses, ...fields } = data;
    if (fields.email === "") fields.email = null;

    const dup = await prisma.employee.findFirst({
      where: { emp_no: fields.emp_no, ...(id ? { id: { not: id } } : {}) },
    });
    if (dup) throw new AppError("이미 존재하는 사번입니다.", 400, "DUPLICATE");

    return prisma.$transaction(async (tx) => {
      let emp;
      if (id) {
        const ex = await tx.employee.findUnique({ where: { id } });
        if (!ex) throw new AppError("직원을 찾을 수 없습니다.", 404, "NOT_FOUND");
        emp = await tx.employee.update({ where: { id }, data: fields });
        await tx.employeeLicense.deleteMany({ where: { employee_id: id } });
      } else {
        emp = await tx.employee.create({ data: fields });
      }

      if (licenses?.length) {
        await tx.employeeLicense.createMany({
          data: licenses.map((l) => ({ ...l, employee_id: emp.id })),
        });
      }

      return tx.employee.findUnique({ where: { id: emp.id }, include: DETAIL_INCLUDE });
    });
  },

  /** 퇴사 처리 — 물리 삭제 대신 이걸 쓴다. 인사 기록은 보존한다. */
  async resign({ id, resigned_at }) {
    const ex = await prisma.employee.findUnique({ where: { id } });
    if (!ex) throw new AppError("직원을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (ex.resigned_at) throw new AppError("이미 퇴사 처리된 직원입니다.", 400, "ALREADY_RESIGNED");

    return prisma.employee.update({
      where: { id },
      data: { resigned_at, is_active: false },
      include: DETAIL_INCLUDE,
    });
  },

  /** 물리 삭제 — 오등록 취소용. 참조가 하나라도 있으면 거부. */
  async remove(id) {
    const ex = await prisma.employee.findUnique({ where: { id } });
    if (!ex) throw new AppError("직원을 찾을 수 없습니다.", 404, "NOT_FOUND");

    const asHead = await prisma.department.count({ where: { head_employee_id: id } });
    if (asHead > 0) {
      throw new AppError("부서장으로 지정되어 있어 삭제할 수 없습니다.", 400, "IN_USE");
    }
    const linked = await prisma.user.count({ where: { employee_id: id } });
    if (linked > 0) {
      throw new AppError("연결된 로그인 계정이 있어 삭제할 수 없습니다.", 400, "IN_USE");
    }

    // 면허는 onDelete: Cascade 로 함께 지워진다
    await prisma.employee.delete({ where: { id } });
    return { ok: true };
  },
};
```

- [ ] **Step 3: `server/routes/employee.js` 생성**

```javascript
import service from "../services/employee.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema, resignSchema } from "../validators/employee.schema.js";

function ensureAuth(user) {
  if (!user?.id) {
    const e = new Error("로그인이 필요합니다."); e.statusCode = 401; e.code = "UNAUTH"; e.isOperational = true; throw e;
  }
}

/** 직원 (/api/employee) — 마스터. 퇴사는 resign, 삭제는 오등록 취소용. */
export default async function employeeRoutes(app) {
  app.post("/list", async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/options", async () => service.options());
  app.post("/get", async (req) => { const { id } = validate(idSchema, req.body); return service.get(id); });
  app.post("/save", async (req) => { ensureAuth(req.user); return service.save(validate(saveSchema, req.body)); });
  app.post("/resign", async (req) => { ensureAuth(req.user); return service.resign(validate(resignSchema, req.body)); });
  app.post("/delete", async (req) => { ensureAuth(req.user); const { id } = validate(idSchema, req.body); return service.remove(id); });
}
```

- [ ] **Step 4: 라우트 로드 확인**

```bash
cd /Users/wjd/프로젝트/hospital_server
(node server/index.js > /tmp/boot4.log 2>&1 &) ; sleep 6; pkill -f "node server/index.js"; sleep 1
grep -c "Route loaded" /tmp/boot4.log
grep "Route loaded" /tmp/boot4.log | grep -E "employee|department|category"
grep -i "error" /tmp/boot4.log | grep -v EADDRINUSE || echo "에러 없음"
```

Expected: 라우트 `18`개, `/api/category` `/api/department` `/api/employee` 셋 다 로드, 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add server/routes/employee.js server/services/employee.service.js server/validators/employee.schema.js
git commit -m "$(cat <<'EOF'
인사: 직원 API (면허 중첩저장 · 퇴사 처리)

면허는 별도 라우트 없이 직원 save에 배열로 함께 넘긴다. 트랜잭션 안에서
deleteMany → createMany로 갈아끼움. 면허만 따로 조회할 일이 없다.

삭제는 두 갈래:
- resign: 퇴사 처리(resigned_at + is_active=false). 기본. 인사 기록 보존.
- delete: 물리 삭제. 오등록 취소용. 부서장 지정이나 연결 계정이 있으면 거부.
  면허는 onDelete: Cascade로 함께 삭제.

목록은 부서·직종·재직여부 필터 + 이름/사번 검색.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 시드 (Category 코드 + 부서 트리)

**Files:**
- Create: `prisma/seed-hr.js`
- Modify: `package.json` (scripts에 `seed:hr` 추가)

**Interfaces:**
- Consumes: Task 1의 모델, Task 2·3의 서비스는 쓰지 않고 prisma 직접 접근
- Produces: Category 5그룹 코드, 부서 트리 3단계 (`DEPT-MED` > `DEPT-IM` > `DEPT-CARD`). Task 8·9의 화면 검증이 이 데이터를 쓴다.

- [ ] **Step 1: `prisma/seed-hr.js` 생성**

```javascript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// [group, value, text] — 개발 편의용 기본 코드
const CODES = [
  ["department_type", "MEDICAL", "진료과"],
  ["department_type", "NURSING", "간호부"],
  ["department_type", "ADMIN", "행정"],
  ["department_type", "SUPPORT", "진료지원"],

  ["position", "DIRECTOR", "원장"],
  ["position", "CHIEF", "부장"],
  ["position", "MANAGER", "과장"],
  ["position", "LEADER", "팀장"],
  ["position", "SENIOR", "주임"],
  ["position", "STAFF", "사원"],

  ["job_type", "DOCTOR", "의사"],
  ["job_type", "NURSE", "간호사"],
  ["job_type", "PHARMACIST", "약사"],
  ["job_type", "TECHNICIAN", "의료기사"],
  ["job_type", "ADMIN", "행정직"],
  ["job_type", "SUPPORT", "기능직"],

  ["employment_type", "FULLTIME", "정규직"],
  ["employment_type", "CONTRACT", "계약직"],
  ["employment_type", "PARTTIME", "파트타임"],
  ["employment_type", "DISPATCH", "파견"],

  ["license_type", "DOCTOR", "의사면허"],
  ["license_type", "NURSE", "간호사면허"],
  ["license_type", "PHARMACIST", "약사면허"],
  ["license_type", "TECHNICIAN", "의료기사면허"],
];

// [code, name, parent_code|null, type_value]
const DEPARTMENTS = [
  ["DEPT-MED", "진료부", null, "MEDICAL"],
  ["DEPT-IM", "내과", "DEPT-MED", "MEDICAL"],
  ["DEPT-CARD", "순환기내과", "DEPT-IM", "MEDICAL"],
  ["DEPT-OS", "정형외과", "DEPT-MED", "MEDICAL"],
  ["DEPT-NUR", "간호부", null, "NURSING"],
  ["DEPT-WARD", "병동간호팀", "DEPT-NUR", "NURSING"],
  ["DEPT-ADM", "행정부", null, "ADMIN"],
  ["DEPT-RECEP", "원무팀", "DEPT-ADM", "ADMIN"],
];

async function main() {
  // 1) 공통 코드
  const codeId = {}; // `${group}:${value}` -> id
  let sort = 0;
  for (const [group, value, text] of CODES) {
    const c = await prisma.category.upsert({
      where: { group_value: { group, value } },
      update: { text, sort },
      create: { group, value, text, sort },
    });
    codeId[`${group}:${value}`] = c.id;
    sort++;
  }

  // 2) 부서 트리 — 부모가 먼저 생성되도록 배열 순서를 지킨다
  const deptId = {}; // code -> id
  let dsort = 0;
  for (const [code, name, parentCode, typeValue] of DEPARTMENTS) {
    const d = await prisma.department.upsert({
      where: { code },
      update: {
        name,
        parent_id: parentCode ? deptId[parentCode] : null,
        type_id: codeId[`department_type:${typeValue}`],
        sort: dsort,
      },
      create: {
        code,
        name,
        parent_id: parentCode ? deptId[parentCode] : null,
        type_id: codeId[`department_type:${typeValue}`],
        sort: dsort,
      },
    });
    deptId[code] = d.id;
    dsort++;
  }

  console.log(`✅ hr seed done: ${CODES.length} codes, ${DEPARTMENTS.length} departments`);
  console.log("   직원은 시드하지 않습니다 — 화면에서 등록하며 검증하세요.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

`prisma.category.upsert`의 `where`에 쓰는 `group_value`는 Task 1의 `@@unique([group, value])`가 만드는 복합 유니크 키 이름이다.

- [ ] **Step 2: `package.json`에 스크립트 추가**

`"seed:rbac": "node prisma/seed-rbac.js",` 아래에 한 줄 추가한다.

```json
    "seed:hr": "node prisma/seed-hr.js",
```

- [ ] **Step 3: 시드 실행**

```bash
cd /Users/wjd/프로젝트/hospital_server
npm run seed:hr
```

Expected:
```
✅ hr seed done: 24 codes, 8 departments
   직원은 시드하지 않습니다 — 화면에서 등록하며 검증하세요.
```

`Unknown arg 'group_value'` 에러가 나오면 Task 1의 `@@unique([group, value])`가 빠진 것이다. 스키마를 확인하고 `npx prisma db push`를 다시 돌린다.

- [ ] **Step 4: DB 확인**

```bash
M=/opt/homebrew/opt/mysql@8.0/bin/mysql
$M -u root -h 127.0.0.1 hospital_system -e "SELECT \`group\`, COUNT(*) AS n FROM Category GROUP BY \`group\`;"
$M -u root -h 127.0.0.1 hospital_system -e "SELECT code, name, parent_id FROM Department ORDER BY sort;"
```

Expected: Category 5그룹(department_type 4, employment_type 4, job_type 6, license_type 4, position 6), Department 8행이며 `DEPT-CARD`의 `parent_id`가 `DEPT-IM`의 id.

`group`은 MySQL 예약어라 백틱이 필요하다.

- [ ] **Step 5: 커밋**

```bash
git add prisma/seed-hr.js package.json
git commit -m "$(cat <<'EOF'
인사: 시드 — 공통코드 24개, 부서 트리 8개(3단계)

부서 트리는 진료부 > 내과 > 순환기내과로 3단계를 만들어, 순환 참조와
계층 집계를 실제로 검증할 수 있게 함.

직원은 시드하지 않는다 — 화면에서 등록하며 검증한다.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 프론트 — EntityTree 복원 + API 모듈

**Files:**
- Create: `src/components/base/EntityTree.vue` (git에서 복원)
- Create: `src/api/hr.ts`

**Interfaces:**
- Consumes: Task 2·3·4의 API 엔드포인트
- Produces:
  - `EntityTree.vue` — props: `{api, label, selectedId}`, emits: `select`. `api` 객체는 `{tree(), save(body), remove(id), reorder(body)}`를 가져야 한다.
  - `src/api/hr.ts` → `departmentApi { tree, list, options, get, save, reorder, remove }`, `employeeApi { list, options, get, save, resign, remove }`, `categoryApi { list, save, remove }`
  - Task 7·8·9가 소비한다.

- [ ] **Step 1: EntityTree 복원**

```bash
cd /Users/wjd/프로젝트/hospital_frontend
git show b2a6f32^:src/components/base/EntityTree.vue > src/components/base/EntityTree.vue
wc -l src/components/base/EntityTree.vue
```

Expected: `347` 줄.

- [ ] **Step 2: 복원한 EntityTree의 옛 토큰 정리**

복원한 파일은 픽셀 테마 시절 것이라 옛 CSS 변수와 형태를 쓴다. 다른 파일들은 이미 정리됐으므로 같은 규칙을 적용한다.

```bash
cd /Users/wjd/프로젝트/hospital_frontend
sed -i '' \
  -e 's/--ink-faint/--text-subtle/g' \
  -e 's/--ink-muted/--text-muted/g' \
  -e 's/--ink-soft/--text/g' \
  -e 's/--ink/--text/g' \
  -e 's/--line-strong/--border-strong/g' \
  -e 's/--line-hard/--border-strong/g' \
  -e 's/--line/--border/g' \
  -e 's/--seal-deep/--accent-hover/g' \
  -e 's/--seal/--accent/g' \
  -e 's/--paper/--canvas/g' \
  -e 's/--font-pixel/--font-sans/g' \
  -e 's/box-shadow: *1px 1px 0 var(--border-strong)/box-shadow: var(--shadow-sm)/g' \
  -e 's/box-shadow: *2px 2px 0 var(--border-strong)/box-shadow: var(--shadow-sm)/g' \
  -e 's/box-shadow: *3px 3px 0 var(--border-strong)/box-shadow: var(--shadow-md)/g' \
  -e 's/border: *3px solid/border: 1px solid/g' \
  -e 's/border: *2px solid/border: 1px solid/g' \
  -e 's/border-radius: *2px/border-radius: var(--radius)/g' \
  -e 's/border-radius: *3px/border-radius: var(--radius)/g' \
  -e 's/border-radius: *4px/border-radius: var(--radius)/g' \
  src/components/base/EntityTree.vue

grep -n -- "var(--ink\|var(--seal\|var(--line\|--font-pixel" src/components/base/EntityTree.vue || echo "옛 토큰 없음"
```

Expected: `옛 토큰 없음`

- [ ] **Step 3: `src/api/hr.ts` 생성**

```typescript
// @ts-nocheck
import api from "@/api/api";

// 부서 (계층 트리)
export const departmentApi = {
  tree: () => api.post("/department/tree", {}).then((r) => r.data),
  list: (body = {}) => api.post("/department/list", body).then((r) => r.data),
  options: () => api.post("/department/options", {}).then((r) => r.data),
  get: (id) => api.post("/department/get", { id }).then((r) => r.data),
  save: (body) => api.post("/department/save", body).then((r) => r.data),
  reorder: (body) => api.post("/department/reorder", body).then((r) => r.data),
  remove: (id) => api.post("/department/delete", { id }).then((r) => r.data),
};

// 직원
export const employeeApi = {
  list: (body = {}) => api.post("/employee/list", body).then((r) => r.data),
  options: () => api.post("/employee/options", {}).then((r) => r.data),
  get: (id) => api.post("/employee/get", { id }).then((r) => r.data),
  save: (body) => api.post("/employee/save", body).then((r) => r.data),
  resign: (id, resigned_at) => api.post("/employee/resign", { id, resigned_at }).then((r) => r.data),
  remove: (id) => api.post("/employee/delete", { id }).then((r) => r.data),
};

// 공통 코드 (직급·직종·고용형태·면허종류·부서유형)
export const categoryApi = {
  list: (body = {}) => api.post("/category/list", body).then((r) => r.data),
  save: (body) => api.post("/category/save", body).then((r) => r.data),
  remove: (id) => api.post("/category/delete", { id }).then((r) => r.data),
};
```

- [ ] **Step 4: 빌드 검증**

```bash
cd /Users/wjd/프로젝트/hospital_frontend
npm run build
```

Expected: 성공. `EntityTree`는 아직 아무도 import하지 않으므로 트리셰이킹되지만 컴파일은 된다.

- [ ] **Step 5: 커밋**

```bash
git add src/components/base/EntityTree.vue src/api/hr.ts
git commit -m "$(cat <<'EOF'
인사: EntityTree 복원 + hr API 모듈

EntityTree(347줄)를 b2a6f32^ 에서 복원. api 객체로 tree/save/remove/reorder를
주입받는 범용 트리라 부서에 그대로 쓸 수 있다. 복원본은 픽셀 테마 시절이라
옛 토큰·하드 그림자·두꺼운 보더를 새 토큰으로 정리.

api/hr.ts — departmentApi, employeeApi, categoryApi.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 프론트 — 부서 관리 화면

**Files:**
- Create: `src/pages/hr/DepartmentView.vue`

**Interfaces:**
- Consumes: Task 6의 `departmentApi`, `employeeApi.options`, `categoryApi.list`, `EntityTree`
- Produces: `/hr/department` 라우트가 렌더링할 컴포넌트. Task 10이 라우터에 등록한다.

- [ ] **Step 1: `src/pages/hr/DepartmentView.vue` 생성**

좌측 트리 + 우측 상세의 2단 구성. `EntityTree`가 `select` 이벤트로 노드를 넘기면 상세를 불러온다.

```vue
<template>
  <div class="dept">
    <header class="phead">
      <h1 class="ttl">{{ $t("부서 관리") }}</h1>
      <p class="sub">{{ $t("조직도를 만들고 부서장·유형을 지정합니다. 드래그로 계층과 순서를 바꿀 수 있습니다.") }}</p>
    </header>

    <div class="split">
      <section class="pcard treepane">
        <EntityTree
          ref="treeRef"
          :api="departmentApi"
          label="부서"
          :selected-id="selectedId"
          @select="onSelect"
        />
      </section>

      <section class="pcard detail">
        <template v-if="form.id">
          <h2 class="dttl">{{ $t("부서 정보") }}</h2>

          <label class="fld">
            <span class="form-label">{{ $t("부서명") }}</span>
            <input v-model="form.name" class="field" :placeholder="$t('부서명')" />
          </label>

          <label class="fld">
            <span class="form-label">{{ $t("부서 코드") }}</span>
            <input v-model="form.code" class="field" placeholder="DEPT-CARD" />
          </label>

          <label class="fld">
            <span class="form-label">{{ $t("부서 유형") }}</span>
            <SearchSelect v-model="form.type_id" :options="typeOptions" :placeholder="$t('유형 선택')" />
          </label>

          <label class="fld">
            <span class="form-label">{{ $t("부서장") }}</span>
            <SearchSelect v-model="form.head_employee_id" :options="empOptions" :placeholder="$t('부서장 선택 (선택)')" />
          </label>

          <label class="fld row">
            <span class="form-label">{{ $t("활성화") }}</span>
            <BaseToggle v-model="form.is_active" />
          </label>

          <div class="actions">
            <button class="btn btn-primary" :disabled="saving" @click="save">
              {{ saving ? $t("저장 중…") : $t("저장") }}
            </button>
          </div>
        </template>

        <EmptyState v-else variant="select" :title="$t('부서를 선택하세요')" :desc="$t('좌측 트리에서 부서를 고르면 상세가 표시됩니다.')" />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, reactive, onMounted } from "vue";
import EntityTree from "@/components/base/EntityTree.vue";
import SearchSelect from "@/components/base/SearchSelect.vue";
import BaseToggle from "@/components/base/BaseToggle.vue";
import EmptyState from "@/components/base/EmptyState.vue";
import { departmentApi, employeeApi, categoryApi } from "@/api/hr";
import { useToast } from "vue-toastification";
import { alertStore } from "@/plugins/alert.store";

const toast = useToast();

const treeRef = ref(null);
const selectedId = ref(null);
const saving = ref(false);

const typeOptions = ref([]);
const empOptions = ref([]);

const form = reactive({
  id: null,
  name: "",
  code: "",
  type_id: null,
  head_employee_id: null,
  is_active: true,
});

async function onSelect(node) {
  if (!node?.id) {
    form.id = null;
    selectedId.value = null;
    return;
  }
  selectedId.value = node.id;
  const d = await departmentApi.get(node.id);
  form.id = d.id;
  form.name = d.name;
  form.code = d.code;
  form.type_id = d.type_id ?? null;
  form.head_employee_id = d.head_employee_id ?? null;
  form.is_active = d.is_active;
}

async function save() {
  if (!form.name.trim()) {
    toast.warning("부서명을 입력하세요.");
    return;
  }
  saving.value = true;
  try {
    await departmentApi.save({ ...form });
    toast.success("부서가 저장되었습니다.");
    await treeRef.value?.reload?.();
  } catch (e) {
    toast.error(e?.message || "저장에 실패했습니다.");
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  typeOptions.value = (await categoryApi.list({ group: "department_type", only_active: true }))
    .map((c) => ({ value: c.id, label: c.text }));
  empOptions.value = (await employeeApi.options())
    .map((e) => ({ value: e.id, label: `${e.name} (${e.emp_no})` }));
});
</script>

<style scoped>
.dept { max-width: 1100px; margin: 0 auto; }
.phead { margin-bottom: 1.1rem; }
.ttl { font-size: 1.5rem; font-weight: 700; color: var(--text); }
.sub { margin-top: 0.3rem; font-size: 0.85rem; color: var(--text-muted); }

.split { display: grid; grid-template-columns: 320px 1fr; gap: 1rem; align-items: start; }
.treepane { padding: 0.9rem; min-height: 420px; }
.detail { padding: 1.2rem 1.4rem; min-height: 420px; }
.dttl { font-size: 1rem; font-weight: 600; color: var(--text); margin-bottom: 1rem; }

.fld { display: block; margin-bottom: 0.9rem; }
.fld.row { display: flex; align-items: center; justify-content: space-between; }
.fld.row .form-label { margin-bottom: 0; }

.actions { margin-top: 1.4rem; display: flex; justify-content: flex-end; }

@media (max-width: 900px) {
  .split { grid-template-columns: 1fr; }
}
</style>
```

**확정된 컴포넌트 시그니처** (제가 실제 파일을 읽어 확인했습니다 — 추측이 아닙니다):

- **토스트**: `import { useToast } from "vue-toastification";` → `const toast = useToast();` → `toast.success(msg)` / `toast.error(msg)` / `toast.warning(msg)`. `UserAdmin.vue`가 쓰는 방식이다.
- **확인창**: `alertStore.openConfirm(message, title = "확인", variant = "info")` → `Promise<boolean>`. `import { alertStore } from "@/plugins/alert.store";`
- **SearchSelect**: props `{modelValue, options, labelKey="label", valueKey="value", placeholder, creatable}`. options는 `{value, label}[]` 형태. emits `update:modelValue`.
- **Pager**: props `{page, totalPages, total, window}`. **`limit`이 아니라 `totalPages`를 받는다.** emits `update:page`, `change`.

- [ ] **Step 2: `EntityTree`가 노출하는 메서드 확인**

```bash
cd /Users/wjd/프로젝트/hospital_frontend
grep -n "defineExpose\|defineEmits\|defineProps\|function reload" src/components/base/EntityTree.vue
```

`reload`가 `defineExpose`로 노출돼 있지 않으면 `treeRef.value.reload()`가 동작하지 않는다. 그 경우 `EntityTree.vue`에 `defineExpose({ reload })`를 추가한다.

`select` 이벤트가 없으면(옛 CS 트리는 다른 이벤트명일 수 있다) 실제 emit 이름에 맞춰 `@select`를 고친다.

- [ ] **Step 3: 빌드 검증**

```bash
npm run build
```

Expected: 성공.

- [ ] **Step 4: 커밋**

```bash
git add src/pages/hr/DepartmentView.vue src/components/base/EntityTree.vue
git commit -m "$(cat <<'EOF'
인사: 부서 관리 화면 (트리 + 상세 2단)

좌측 EntityTree로 계층·순서를 드래그 편집, 우측에서 코드·유형·부서장 지정.
EntityTree는 name만 다루므로 나머지 필드는 상세 패널에서 저장한다.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 프론트 — 직원 관리 화면

**Files:**
- Create: `src/pages/hr/EmployeeView.vue`

**Interfaces:**
- Consumes: Task 6의 `employeeApi`, `departmentApi.options`, `categoryApi.list`
- Produces: `/hr/employee` 라우트가 렌더링할 컴포넌트. Task 10이 라우터에 등록한다.

- [ ] **Step 1: 표본 파일을 먼저 읽는다**

```bash
cd /Users/wjd/프로젝트/hospital_frontend
cat src/pages/settings/UserAdmin.vue
```

표 + 드로어 + `SearchSelect` + `Pager` 조합이 그대로 필요하다. **클래스명(`.tbl`, `.th`, `.td`, `.drawer`, `.panel`, `.filterbar`)과 `alertStore` 사용법을 이 파일에서 그대로 가져오세요.** 아래 코드는 그 패턴을 따르지만, 실제 클래스명이 다르면 표본을 따르세요.

- [ ] **Step 2: `src/pages/hr/EmployeeView.vue` 생성**

```vue
<template>
  <div class="emp">
    <header class="phead">
      <h1 class="ttl">{{ $t("직원 관리") }}</h1>
    </header>

    <div class="filterbar">
      <span class="f-label">{{ $t("부서") }}</span>
      <SearchSelect v-model="filter.department_id" :options="deptOptions" :placeholder="$t('전체')" clearable />
      <span class="f-label">{{ $t("직종") }}</span>
      <SearchSelect v-model="filter.job_type_id" :options="jobOptions" :placeholder="$t('전체')" clearable />
      <span class="f-label">{{ $t("상태") }}</span>
      <select v-model="filter.status" class="field field-xs" style="width: 110px">
        <option :value="undefined">{{ $t("전체") }}</option>
        <option value="active">{{ $t("재직") }}</option>
        <option value="resigned">{{ $t("퇴사") }}</option>
      </select>
      <input v-model="filter.q" class="field field-xs" style="width: 180px" :placeholder="$t('이름 · 사번')" @keyup.enter="load(1)" />
      <button class="btn btn-xs" @click="load(1)">{{ $t("검색") }}</button>
      <button class="btn btn-xs btn-primary" style="margin-left: auto" @click="openNew">＋ {{ $t("직원 등록") }}</button>
    </div>

    <div class="pcard">
      <table class="tbl">
        <thead>
          <tr>
            <th class="th">{{ $t("사번") }}</th>
            <th class="th">{{ $t("이름") }}</th>
            <th class="th">{{ $t("부서") }}</th>
            <th class="th">{{ $t("직급") }}</th>
            <th class="th">{{ $t("직종") }}</th>
            <th class="th">{{ $t("입사일") }}</th>
            <th class="th">{{ $t("상태") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length">
            <td colspan="7"><EmptyState :title="$t('직원이 없습니다')" :desc="$t('직원을 등록하면 여기에 표시됩니다.')" compact /></td>
          </tr>
          <tr v-for="e in rows" :key="e.id" class="rowclick" @click="openEdit(e.id)">
            <td class="td num">{{ e.emp_no }}</td>
            <td class="td">{{ e.name }}</td>
            <td class="td">{{ e.department?.name || "-" }}</td>
            <td class="td">{{ e.position?.text || "-" }}</td>
            <td class="td">{{ e.job_type?.text || "-" }}</td>
            <td class="td num">{{ fmt(e.hired_at) }}</td>
            <td class="td">
              <span v-if="e.resigned_at" class="badge badge-neutral">{{ $t("퇴사") }}</span>
              <span v-else class="badge badge-success">{{ $t("재직") }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <Pager v-if="totalPages > 1" :page="page" :total="total" :total-pages="totalPages" @change="load" />
    </div>

    <!-- 상세 드로어 -->
    <div v-if="showForm" class="drawer" @click.self="showForm = false">
      <div class="panel">
        <header class="dhead">
          <h2>{{ form.id ? $t("직원 상세") : $t("직원 등록") }}</h2>
          <span v-if="form.resigned_at" class="badge badge-neutral">{{ $t("퇴사") }} · {{ fmt(form.resigned_at) }}</span>
        </header>

        <section class="sec">
          <h3 class="sttl">{{ $t("신원") }}</h3>
          <div class="grid2">
            <label class="fld"><span class="form-label">{{ $t("사번") }}</span><input v-model="form.emp_no" class="field" /></label>
            <label class="fld"><span class="form-label">{{ $t("이름") }}</span><input v-model="form.name" class="field" /></label>
            <label class="fld"><span class="form-label">{{ $t("영문명") }}</span><input v-model="form.name_en" class="field" /></label>
            <label class="fld"><span class="form-label">{{ $t("연락처") }}</span><input v-model="form.phone" class="field" /></label>
            <label class="fld"><span class="form-label">{{ $t("이메일") }}</span><input v-model="form.email" class="field" /></label>
          </div>
        </section>

        <section class="sec">
          <h3 class="sttl">{{ $t("소속") }}</h3>
          <div class="grid2">
            <label class="fld"><span class="form-label">{{ $t("부서") }}</span><SearchSelect v-model="form.department_id" :options="deptOptions" :placeholder="$t('부서 선택')" /></label>
            <label class="fld"><span class="form-label">{{ $t("직급") }}</span><SearchSelect v-model="form.position_id" :options="posOptions" :placeholder="$t('직급 선택')" /></label>
            <label class="fld"><span class="form-label">{{ $t("직종") }}</span><SearchSelect v-model="form.job_type_id" :options="jobOptions" :placeholder="$t('직종 선택')" /></label>
            <label class="fld"><span class="form-label">{{ $t("고용형태") }}</span><SearchSelect v-model="form.employment_type_id" :options="empTypeOptions" :placeholder="$t('고용형태 선택')" /></label>
            <label class="fld"><span class="form-label">{{ $t("입사일") }}</span><input v-model="form.hired_at" type="date" class="field" /></label>
          </div>
        </section>

        <section class="sec">
          <header class="sechead">
            <h3 class="sttl">{{ $t("면허") }}</h3>
            <button class="btn btn-xs" @click="addLicense">＋ {{ $t("면허 추가") }}</button>
          </header>
          <div v-if="!form.licenses.length" class="nolic">{{ $t("등록된 면허가 없습니다.") }}</div>
          <div v-for="(l, i) in form.licenses" :key="i" class="licrow">
            <SearchSelect v-model="l.license_type_id" :options="licOptions" :placeholder="$t('종류')" />
            <input v-model="l.license_no" class="field field-xs" :placeholder="$t('면허번호')" />
            <input v-model="l.issued_at" type="date" class="field field-xs" />
            <input v-model="l.expires_at" type="date" class="field field-xs" />
            <button class="btn btn-xs btn-ghost" @click="form.licenses.splice(i, 1)">✕</button>
          </div>
        </section>

        <footer class="dfoot">
          <button v-if="form.id && !form.resigned_at" class="btn btn-xs" @click="resign">{{ $t("퇴사 처리") }}</button>
          <span style="flex: 1"></span>
          <button class="btn btn-xs" @click="showForm = false">{{ $t("닫기") }}</button>
          <button class="btn btn-xs btn-primary" :disabled="saving" @click="save">
            {{ saving ? $t("저장 중…") : $t("저장") }}
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, reactive, onMounted } from "vue";
import SearchSelect from "@/components/base/SearchSelect.vue";
import EmptyState from "@/components/base/EmptyState.vue";
import Pager from "@/components/base/Pager.vue";
import { employeeApi, departmentApi, categoryApi } from "@/api/hr";
import { useToast } from "vue-toastification";
import { alertStore } from "@/plugins/alert.store";
import { formatDateDot as fmt } from "@/utils/date";

const toast = useToast();

const rows = ref([]);
const total = ref(0);
const totalPages = ref(0);
const page = ref(1);
const limit = ref(20);
const saving = ref(false);
const showForm = ref(false);

const filter = reactive({ q: "", department_id: null, job_type_id: null, status: undefined });

const deptOptions = ref([]);
const posOptions = ref([]);
const jobOptions = ref([]);
const empTypeOptions = ref([]);
const licOptions = ref([]);

const blank = () => ({
  id: null,
  emp_no: "",
  name: "",
  name_en: "",
  department_id: null,
  position_id: null,
  job_type_id: null,
  employment_type_id: null,
  phone: "",
  email: "",
  hired_at: "",
  resigned_at: null,
  is_active: true,
  licenses: [],
});
const form = reactive(blank());

function reset(src = blank()) {
  Object.assign(form, blank(), src);
}

async function load(p = page.value) {
  page.value = p;
  const res = await employeeApi.list({ ...filter, page: p, limit: limit.value });
  rows.value = res.rows || [];
  total.value = res.total || 0;
  totalPages.value = res.totalPages || 0;
}

function openNew() {
  reset();
  showForm.value = true;
}

async function openEdit(id) {
  const e = await employeeApi.get(id);
  reset({
    ...e,
    hired_at: e.hired_at ? String(e.hired_at).slice(0, 10) : "",
    resigned_at: e.resigned_at ? String(e.resigned_at).slice(0, 10) : null,
    licenses: (e.licenses || []).map((l) => ({
      license_type_id: l.license_type_id,
      license_no: l.license_no,
      issued_at: l.issued_at ? String(l.issued_at).slice(0, 10) : null,
      expires_at: l.expires_at ? String(l.expires_at).slice(0, 10) : null,
    })),
  });
  showForm.value = true;
}

function addLicense() {
  form.licenses.push({ license_type_id: null, license_no: "", issued_at: null, expires_at: null });
}

async function save() {
  if (!form.emp_no.trim() || !form.name.trim() || !form.hired_at) {
    toast.warning("사번·이름·입사일은 필수입니다.");
    return;
  }
  saving.value = true;
  try {
    const body = { ...form };
    delete body.resigned_at; // 퇴사는 resign 으로만 처리한다
    body.licenses = form.licenses.filter((l) => l.license_type_id && l.license_no?.trim());
    await employeeApi.save(body);
    toast.success("직원이 저장되었습니다.");
    showForm.value = false;
    await load();
  } catch (e) {
    toast.error(e?.message || "저장에 실패했습니다.");
  } finally {
    saving.value = false;
  }
}

async function resign() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    await employeeApi.resign(form.id, today);
    toast.success("퇴사 처리되었습니다.");
    showForm.value = false;
    await load();
  } catch (e) {
    toast.error(e?.message || "퇴사 처리에 실패했습니다.");
  }
}

onMounted(async () => {
  const [depts, pos, job, empType, lic] = await Promise.all([
    departmentApi.options(),
    categoryApi.list({ group: "position", only_active: true }),
    categoryApi.list({ group: "job_type", only_active: true }),
    categoryApi.list({ group: "employment_type", only_active: true }),
    categoryApi.list({ group: "license_type", only_active: true }),
  ]);
  // 계층 들여쓰기 — depth 만큼 공백을 앞에 붙인다
  deptOptions.value = depts.map((d) => ({
    value: d.id,
    label: `${"　".repeat(d.depth)}${d.name}`,
  }));
  posOptions.value = pos.map((c) => ({ value: c.id, label: c.text }));
  jobOptions.value = job.map((c) => ({ value: c.id, label: c.text }));
  empTypeOptions.value = empType.map((c) => ({ value: c.id, label: c.text }));
  licOptions.value = lic.map((c) => ({ value: c.id, label: c.text }));
  await load(1);
});
</script>

<style scoped>
.emp { max-width: 1200px; margin: 0 auto; }
.phead { margin-bottom: 1.1rem; }
.ttl { font-size: 1.5rem; font-weight: 700; color: var(--text); }

.rowclick { cursor: pointer; }
.rowclick:hover { background: var(--surface-2); }

.drawer { position: fixed; inset: 0; z-index: 70; background: rgba(15, 23, 42, 0.45); display: flex; justify-content: flex-end; }
.panel { width: 640px; max-width: 100%; height: 100%; overflow-y: auto; background: var(--surface); padding: 1.4rem 1.6rem; display: flex; flex-direction: column; }
.dhead { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 1.2rem; }
.dhead h2 { font-size: 1.1rem; font-weight: 700; color: var(--text); }

.sec { margin-bottom: 1.6rem; }
.sechead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.7rem; }
.sttl { font-size: 0.88rem; font-weight: 600; color: var(--text-muted); }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem 0.9rem; }
.fld { display: block; }

.nolic { font-size: 0.82rem; color: var(--text-subtle); padding: 0.6rem 0; }
.licrow { display: grid; grid-template-columns: 1.2fr 1.2fr 1fr 1fr auto; gap: 0.4rem; margin-bottom: 0.4rem; align-items: center; }

.dfoot { margin-top: auto; padding-top: 1.2rem; display: flex; gap: 0.5rem; align-items: center; border-top: 1px solid var(--border); }
</style>
```

- [ ] **Step 3: 빌드 검증**

```bash
cd /Users/wjd/프로젝트/hospital_frontend
npm run build
```

Expected: 성공. `Pager`의 props(`page`/`total`/`limit`, `@change`)가 실제와 다르면 `src/components/base/Pager.vue`를 읽어 맞춘다.

- [ ] **Step 4: 커밋**

```bash
git add src/pages/hr/EmployeeView.vue
git commit -m "$(cat <<'EOF'
인사: 직원 관리 화면 (표 + 상세 드로어)

ag-grid를 쓰지 않는다 — package.json에 있으나 코드베이스 미사용이고,
기존 화면은 전부 순수 table + .tbl/.th/.td. UserAdmin.vue 패턴을 따름.

드로어 3섹션: 신원 / 소속 / 면허(행 추가·삭제 반복 필드).
부서 셀렉트는 options의 depth로 들여쓰기.
퇴사는 별도 버튼(resign) — save에서는 resigned_at을 보내지 않는다.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: 프론트 — 분류 관리 탭

**Files:**
- Create: `src/pages/settings/CategorySettings.vue`
- Modify: `src/pages/settings/SettingsView.vue`

**Interfaces:**
- Consumes: Task 6의 `categoryApi`
- Produces: 환경설정의 `category` 탭. 직급·직종·고용형태·면허종류·부서유형을 관리한다.

- [ ] **Step 1: `src/pages/settings/CategorySettings.vue` 생성**

```vue
<template>
  <div class="cat">
    <div class="split">
      <aside class="groups">
        <button
          v-for="g in GROUPS"
          :key="g.key"
          class="gitem"
          :class="{ on: active === g.key }"
          @click="select(g.key)"
        >
          {{ $t(g.label) }}
        </button>
      </aside>

      <section class="listpane">
        <div class="addrow">
          <input v-model="draft.text" class="field field-xs" :placeholder="$t('표시명')" />
          <input v-model="draft.value" class="field field-xs" :placeholder="$t('코드값 (영문 대문자)')" />
          <button class="btn btn-xs btn-primary" @click="add">＋ {{ $t("추가") }}</button>
        </div>

        <table class="tbl">
          <thead>
            <tr>
              <th class="th">{{ $t("표시명") }}</th>
              <th class="th">{{ $t("코드값") }}</th>
              <th class="th">{{ $t("활성") }}</th>
              <th class="th"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!rows.length">
              <td colspan="4"><EmptyState :title="$t('코드가 없습니다')" :desc="$t('위에서 코드를 추가하세요.')" compact /></td>
            </tr>
            <tr v-for="c in rows" :key="c.id">
              <td class="td"><input v-model="c.text" class="cell-input" @change="update(c)" /></td>
              <td class="td num">{{ c.value }}</td>
              <td class="td"><BaseToggle v-model="c.is_active" size="sm" @update:modelValue="update(c)" /></td>
              <td class="td"><button class="btn btn-xs btn-ghost" @click="remove(c)">{{ $t("삭제") }}</button></td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, reactive, onMounted } from "vue";
import BaseToggle from "@/components/base/BaseToggle.vue";
import EmptyState from "@/components/base/EmptyState.vue";
import { categoryApi } from "@/api/hr";
import { useToast } from "vue-toastification";
import { alertStore } from "@/plugins/alert.store";

const GROUPS = [
  { key: "department_type", label: "부서 유형" },
  { key: "position", label: "직급" },
  { key: "job_type", label: "직종" },
  { key: "employment_type", label: "고용형태" },
  { key: "license_type", label: "면허 종류" },
];

const toast = useToast();

const active = ref(GROUPS[0].key);
const rows = ref([]);
const draft = reactive({ text: "", value: "" });

async function load() {
  rows.value = await categoryApi.list({ group: active.value });
}

function select(key) {
  active.value = key;
  draft.text = "";
  draft.value = "";
  load();
}

async function add() {
  if (!draft.text.trim() || !draft.value.trim()) {
    toast.warning("표시명과 코드값을 모두 입력하세요.");
    return;
  }
  try {
    await categoryApi.save({
      group: active.value,
      text: draft.text.trim(),
      value: draft.value.trim().toUpperCase(),
      sort: rows.value.length,
    });
    draft.text = "";
    draft.value = "";
    await load();
  } catch (e) {
    toast.error(e?.message || "추가에 실패했습니다.");
  }
}

async function update(c) {
  try {
    await categoryApi.save({ id: c.id, group: c.group, text: c.text, value: c.value, sort: c.sort, is_active: c.is_active });
  } catch (e) {
    toast.error(e?.message || "수정에 실패했습니다.");
    await load();
  }
}

async function remove(c) {
  try {
    await categoryApi.remove(c.id);
    await load();
  } catch (e) {
    toast.error(e?.message || "삭제에 실패했습니다.");
  }
}

onMounted(load);
</script>

<style scoped>
.split { display: grid; grid-template-columns: 180px 1fr; gap: 1rem; align-items: start; }
.groups { display: flex; flex-direction: column; gap: 2px; }
.gitem {
  text-align: left; padding: 0.5rem 0.7rem; border-radius: var(--radius);
  font-size: 0.85rem; color: var(--text-muted); transition: background 0.12s, color 0.12s;
}
.gitem:hover { background: var(--surface-2); color: var(--text); }
.gitem.on { background: var(--accent-soft); color: var(--accent); font-weight: 600; }

.addrow { display: flex; gap: 0.4rem; margin-bottom: 0.8rem; }
</style>
```

- [ ] **Step 2: `SettingsView.vue`에 탭 추가**

import 한 줄을 추가한다.

```typescript
import CategorySettings from "@/pages/settings/CategorySettings.vue";
```

`tabs` 배열의 **`lang` 탭 앞에** 항목을 넣는다.

```javascript
  { key: "category", label: "분류 관리", icon: "fa-list-check", superOnly: true, comp: markRaw(CategorySettings), desc: "직급·직종·고용형태·면허종류·부서유형 코드를 관리합니다. 인사 화면의 선택 항목이 됩니다." },
```

- [ ] **Step 3: 빌드 검증**

```bash
cd /Users/wjd/프로젝트/hospital_frontend
npm run build
```

Expected: 성공. `BaseToggle`의 `size` prop이 없으면 제거한다(`src/components/base/BaseToggle.vue` 확인).

- [ ] **Step 4: 커밋**

```bash
git add src/pages/settings/CategorySettings.vue src/pages/settings/SettingsView.vue
git commit -m "$(cat <<'EOF'
인사: 환경설정에 "분류 관리" 탭 추가

좌측 코드 그룹 목록(부서유형·직급·직종·고용형태·면허종류) + 우측 코드 CRUD.
Category 관리는 별도 권한 없이 환경설정 권한(superOnly)을 재사용.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: 프론트 — 라우터 · 사이드바 연결

**Files:**
- Modify: `src/router/index.ts`
- Modify: `src/components/layout/AppSidebar.vue`

**Interfaces:**
- Consumes: Task 7의 `DepartmentView`, Task 8의 `EmployeeView`, Task 2의 권한 코드
- Produces: `/hr/department`, `/hr/employee` 라우트와 사이드바 "인사" 그룹. 이 태스크가 끝나면 화면에 실제로 도달할 수 있다.

- [ ] **Step 1: `src/router/index.ts`에 import 추가**

`import FaqView from "@/pages/faq/FaqView.vue";` 아래에 추가한다.

```typescript
import DepartmentView from "@/pages/hr/DepartmentView.vue";
import EmployeeView from "@/pages/hr/EmployeeView.vue";
```

- [ ] **Step 2: 라우트 2개 추가**

`{ path: "faq", ... }` 아래에 넣는다.

```typescript
            // 인사
            { path: "hr/department", component: DepartmentView, meta: { auth: true, title: "부서 관리", perm: "department.view" } },
            { path: "hr/employee", component: EmployeeView, meta: { auth: true, title: "직원 관리", perm: "hr.view" } },
```

catch-all(`{ path: "/:pathMatch(.*)*", redirect: "/" }`)은 배열 맨 끝에 있어야 하므로 그 앞에 넣는다. 이미 최상위 `routes` 배열의 마지막 원소이므로 children 안에 추가하면 문제없다.

- [ ] **Step 3: `AppSidebar.vue`의 `menus`에 "인사" 그룹 추가**

`{ label: "대시보드", ... }` 아래, `{ label: "게시판", ... }` 위에 넣는다.

```javascript
  {
    label: "인사",
    icon: "fa-hospital-user",
    children: [
      { label: "부서 관리", to: "/hr/department", perm: "department.view" },
      { label: "직원 관리", to: "/hr/employee", perm: "hr.view" },
    ],
  },
```

`expanded` reactive 객체에도 키를 추가한다.

```javascript
const expanded = reactive({ 인사: true, 게시판: false });
```

- [ ] **Step 4: 빌드 검증**

```bash
cd /Users/wjd/프로젝트/hospital_frontend
npm run build
```

Expected: 성공.

- [ ] **Step 5: 커밋**

```bash
git add src/router/index.ts src/components/layout/AppSidebar.vue
git commit -m "$(cat <<'EOF'
인사: 라우터 · 사이드바 연결

/hr/department (department.view), /hr/employee (hr.view) 라우트 추가.
사이드바에 "인사" 그룹 신설, 기본 펼침.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## 완료 조건

- [ ] 백엔드: `npx prisma validate` 통과, 모델 20개
- [ ] 백엔드: 라우트 18개 로드 (`category`, `department`, `employee` 포함)
- [ ] 백엔드: 권한 15개, Category 24행(5그룹), Department 8행(3단계)
- [ ] 프론트: `npm run build` 통과
- [ ] 수동 시나리오 (아래 8개 전부)

## 수동 검증 시나리오

이 사이클의 핵심 리스크는 **순환 참조**와 **소프트 삭제**다. 정면으로 찌른다.

1. **부서 트리 3단계 확인** — 시드가 만든 진료부 > 내과 > 순환기내과가 트리에 보이는가
2. **직원 등록** — 순환기내과 소속으로 직원 1명 등록. 면허도 1개 추가.
3. **부서장 지정** — 그 직원을 순환기내과의 부서장으로 지정 → **순환 참조가 실제로 저장되는가**
4. **퇴사 처리** — 직원을 퇴사 처리 → `resigned_at` 설정되고 목록에 "퇴사" 배지
5. **하위 있는 부서 삭제 시도** — 내과 삭제 → `HAS_CHILDREN` 에러로 막히는가
6. **직원 있는 부서 삭제 시도** — 순환기내과 삭제 → `IN_USE` 에러로 막히는가
7. **사용 중인 코드 삭제 시도** — 환경설정에서 직급 코드 삭제 → `IN_USE` 에러로 막히는가
8. **드래그 정렬** — 트리에서 정형외과를 내과 아래로 드래그 → `reorder`가 도는가. 이어서 **내과를 순환기내과 아래로 드래그** → `CYCLE` 에러로 막히는가

## 다음 사이클로 넘기는 것

- **인사(HR) 본체** — 근태·교대·급여·평가·교육
- **조직 개편 이력** — 부서 이동 히스토리
- **인적사항** — 급여 지급용. 암호화·접근제어 설계와 함께
