import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 기본 거래처 예시 (상호 기준 멱등)
const VENDORS = [
  { name: "메디칼상사", business_no: "123-45-67890", contact: "김영업", phone: "02-1234-5678" },
  { name: "대한제약", business_no: "234-56-78901", contact: "이담당", phone: "02-2345-6789" },
  { name: "한국의료기기", business_no: "345-67-89012", contact: "박과장", phone: "02-3456-7890" },
];

async function main() {
  let sort = 0;
  for (const v of VENDORS) {
    const ex = await prisma.vendor.findFirst({ where: { name: v.name } });
    if (ex) { sort++; continue; }
    await prisma.vendor.create({ data: { ...v, sort } });
    sort++;
  }
  console.log(`✅ 거래처 시드 완료 (${VENDORS.length}개 대상)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
