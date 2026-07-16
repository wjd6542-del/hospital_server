/**
 * 처방 검증 — 약품 중첩 · 조제→재고 차감(StockMovement OUT) · 취소→원복.
 *   실행: npm run verify:prescription
 * 임시 환자/품목/처방을 만들고 검증 후 전부 정리한다. 실패 시 exit 1.
 */
import prisma from "../server/lib/prisma.js";
import patient from "../server/services/patient.service.js";
import prescription from "../server/services/prescription.service.js";

/** 품목 현재고 = 이력 qty 합계 */
async function stock(itemId) {
  const agg = await prisma.stockMovement.aggregate({ where: { item_id: itemId }, _sum: { qty: true } });
  return Number(agg._sum.qty ?? 0);
}

async function main() {
  await prisma.patient.deleteMany({ where: { patient_no: { startsWith: "VF-RX" } } });
  await prisma.item.deleteMany({ where: { name: "검증약품(타이레놀)" } });

  const p = await patient.save({ patient_no: "VF-RX1", name: "처방검증환자", sex: "F" });
  // 재고 약품 + 초기 입고 100
  const item = await prisma.item.create({ data: { name: "검증약품(타이레놀)", unit: "정", safety_stock: 20 } });
  await prisma.stockMovement.create({ data: { item_id: item.id, type: "IN", qty: 100, moved_at: new Date(Date.UTC(2026, 0, 1)) } });

  const before = await stock(item.id); // 100

  // 처방 생성(약품 2종 — 하나는 재고연계, 하나는 자유입력)
  const rx = await prescription.save({
    patient_id: p.id,
    prescribed_at: new Date(),
    status: "ISSUED",
    items: [
      { item_id: item.id, drug_name: "타이레놀", dosage: "500mg", frequency: "3회", duration_days: 3, route: "경구", qty: 10 },
      { drug_name: "자유입력약(재고무관)", qty: 5 },
    ],
  });
  const okCreate = rx.items.length === 2 && rx.status === "ISSUED";

  // 조제 → 재고 -10 (자유입력약은 영향 없음)
  await prescription.dispense(rx.id);
  const afterDispense = await stock(item.id);
  const okDispense = afterDispense === before - 10;

  // 상태 확인
  const rx2 = await prescription.get(rx.id);
  const okStatus = rx2.status === "DISPENSED";

  // 취소 → 원복
  await prescription.cancel(rx.id);
  const afterCancel = await stock(item.id);
  const okRevert = afterCancel === before;

  // 정리
  await prescription.remove(rx.id).catch(() => {});
  await prisma.stockMovement.deleteMany({ where: { item_id: item.id } });
  await prisma.item.delete({ where: { id: item.id } }).catch(() => {});
  await prisma.patient.delete({ where: { id: p.id } }).catch(() => {});

  console.log(
    `처방+약품:${okCreate ? "PASS" : "FAIL"}  조제→재고차감(${before}→${afterDispense}):${okDispense ? "PASS" : "FAIL"}  상태:${okStatus ? "PASS" : "FAIL"}  취소→원복(${afterCancel}):${okRevert ? "PASS" : "FAIL"}`,
  );
  const ok = okCreate && okDispense && okStatus && okRevert;
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
