import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 수납 시 자동 기록되는 진료수입 계정과목 (재무 도메인 INCOME)
async function main() {
  await prisma.accountItem.upsert({
    where: { type_name: { type: "INCOME", name: "진료수입" } },
    update: {},
    create: { type: "INCOME", name: "진료수입", sort: 0 },
  });
  console.log("✅ seed:billing done — 계정과목 '진료수입'(INCOME)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
