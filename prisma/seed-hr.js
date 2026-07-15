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

// [code, name, start, end, crosses_midnight, break_minutes, is_work, color]
const SHIFT_TYPES = [
  ["D", "데이", "07:00", "15:00", false, 30, true, "#2563eb"],
  ["E", "이브닝", "15:00", "23:00", false, 30, true, "#d97706"],
  ["N", "나이트", "22:00", "07:00", true, 60, true, "#4338ca"],
  ["OFF", "비번", null, null, false, 0, false, "#94a3b8"],
  ["ANNUAL", "연차", null, null, false, 0, false, "#059669"],
  ["SICK", "병가", null, null, false, 0, false, "#dc2626"],
  ["EVENT", "경조", null, null, false, 0, false, "#7c3aed"],
  ["OFFICIAL", "공가", null, null, false, 0, false, "#0891b2"],
  ["UNPAID", "무급", null, null, false, 0, false, "#a16207"],
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

  console.log(
    `✅ hr seed done: ${CODES.length} codes, ${DEPARTMENTS.length} departments, ${SHIFT_TYPES.length} shift types`,
  );
  console.log("   직원은 시드하지 않습니다 — 화면에서 등록하며 검증하세요.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
