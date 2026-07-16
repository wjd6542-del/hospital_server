import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// [code, name, category, specimen, unit, ref_low, ref_high, ref_text]
const LAB_TESTS = [
  ["CBC-WBC", "백혈구 수(WBC)", "검체", "혈액", "10^3/µL", 4.0, 10.0, null],
  ["CBC-HB", "혈색소(Hb)", "검체", "혈액", "g/dL", 13.0, 17.0, null],
  ["CBC-PLT", "혈소판(PLT)", "검체", "혈액", "10^3/µL", 150, 450, null],
  ["GLU", "공복혈당(FBS)", "검체", "혈액", "mg/dL", 70, 100, null],
  ["AST", "AST(간기능)", "검체", "혈액", "U/L", 0, 40, null],
  ["ALT", "ALT(간기능)", "검체", "혈액", "U/L", 0, 40, null],
  ["UA", "소변검사(요검사)", "검체", "소변", null, null, null, "음성"],
  ["CXR", "흉부 X선", "영상", null, null, null, null, "정상"],
  ["ECG", "심전도(EKG)", "기능", null, null, null, null, "정상 동리듬"],
];

async function main() {
  let sort = 0;
  for (const [code, name, category, specimen, unit, ref_low, ref_high, ref_text] of LAB_TESTS) {
    const data = { name, category, specimen, unit, ref_low, ref_high, ref_text, sort };
    await prisma.labTest.upsert({ where: { code }, update: data, create: { code, ...data } });
    sort++;
  }
  console.log(`✅ seed:lab done — 검사항목 ${LAB_TESTS.length}종`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
