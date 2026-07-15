import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// [code, name, is_paid, deduct_annual, requires_approval, shift_code, color]
//  shift_code — 승인 시 근무표에 찍을 ShiftType.code (seed-hr 에서 시드됨). null 이면 미반영.
const LEAVE_TYPES = [
  ["ANNUAL", "연차", true, true, true, "ANNUAL", "#059669"],
  ["SICK", "병가", true, false, true, "SICK", "#dc2626"],
  ["EVENT", "경조사", true, false, true, "EVENT", "#7c3aed"],
  ["OFFICIAL", "공가", true, false, true, "OFFICIAL", "#0891b2"],
  ["UNPAID", "무급휴가", false, false, true, "UNPAID", "#a16207"],
];

async function main() {
  // 근무표 반영을 위해 shift_code → ShiftType.id 매핑 (seed-hr 선행 필요)
  const shiftTypes = await prisma.shiftType.findMany({ select: { id: true, code: true } });
  const shiftIdByCode = Object.fromEntries(shiftTypes.map((s) => [s.code, s.id]));

  let sort = 0;
  for (const [code, name, is_paid, deduct_annual, requires_approval, shift_code, color] of LEAVE_TYPES) {
    const shift_type_id = shift_code ? shiftIdByCode[shift_code] ?? null : null;
    if (shift_code && !shift_type_id) {
      console.warn(`⚠️  근무유형 '${shift_code}' 없음 — seed:hr 를 먼저 실행하세요. (${code})`);
    }
    const data = { name, is_paid, deduct_annual, requires_approval, shift_type_id, color, sort };
    await prisma.leaveType.upsert({
      where: { code },
      update: data,
      create: { code, ...data },
    });
    sort++;
  }

  console.log(`✅ seed:leave done — 휴가유형 ${LEAVE_TYPES.length}종`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
