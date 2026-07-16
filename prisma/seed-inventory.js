import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 기본 품목 예시 (품목명 기준 멱등)
const ITEMS = [
  { name: "주사기 10ml", category: "소모품", unit: "박스", safety_stock: 20 },
  { name: "거즈", category: "소모품", unit: "팩", safety_stock: 30 },
  { name: "소독용 알코올", category: "소모품", unit: "병", safety_stock: 15 },
  { name: "라텍스 장갑", category: "소모품", unit: "박스", safety_stock: 40 },
  { name: "수액세트", category: "의료소모품", unit: "개", safety_stock: 50 },
];

async function main() {
  let sort = 0;
  for (const it of ITEMS) {
    const ex = await prisma.item.findFirst({ where: { name: it.name } });
    if (!ex) await prisma.item.create({ data: { ...it, sort } });
    sort++;
  }
  console.log(`✅ 품목 시드 완료 (${ITEMS.length}개 대상)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
