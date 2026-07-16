import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 기본 계정과목 — 병원 수입·지출 예시. (type, name) 유니크로 멱등.
const ITEMS = [
  ["INCOME", "진료수입"],
  ["INCOME", "건강검진수입"],
  ["INCOME", "기타수입"],
  ["EXPENSE", "인건비"],
  ["EXPENSE", "의약품비"],
  ["EXPENSE", "소모품비"],
  ["EXPENSE", "임차료"],
  ["EXPENSE", "공과금"],
  ["EXPENSE", "장비구입"],
  ["EXPENSE", "기타지출"],
];

async function main() {
  let sort = 0;
  for (const [type, name] of ITEMS) {
    await prisma.accountItem.upsert({
      where: { type_name: { type, name } },
      update: { sort },
      create: { type, name, sort },
    });
    sort++;
  }
  console.log(`✅ 계정과목 ${ITEMS.length}개 시드 완료`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
