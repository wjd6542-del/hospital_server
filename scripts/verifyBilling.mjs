/**
 * 수납·정산 검증 — 항목 산정 · 수납→진료수입(재무) 기록 · 취소→원복 · 보험청구 생성.
 *   실행: npm run verify:billing   (사전: seed:billing)
 * 임시 환자/수납을 만들고 검증 후 전부 정리한다. 실패 시 exit 1.
 */
import prisma from "../server/lib/prisma.js";
import patient from "../server/services/patient.service.js";
import bill from "../server/services/bill.service.js";

/** 진료수입 계정의 거래 합계 */
async function incomeTotal() {
  const acc = await prisma.accountItem.findUnique({ where: { type_name: { type: "INCOME", name: "진료수입" } } });
  if (!acc) return null;
  const agg = await prisma.financeTransaction.aggregate({ where: { account_item_id: acc.id }, _sum: { amount: true } });
  return Number(agg._sum.amount ?? 0);
}

async function main() {
  const acc = await prisma.accountItem.findUnique({ where: { type_name: { type: "INCOME", name: "진료수입" } } });
  if (!acc) { console.log("SKIP — seed:billing 을 먼저 실행하세요."); process.exit(0); }

  await prisma.patient.deleteMany({ where: { patient_no: { startsWith: "VF-BILL" } } });
  const p = await patient.save({ patient_no: "VF-BILL1", name: "수납검증환자", sex: "F" });

  const before = await incomeTotal();

  // 1) 수납 생성 — 진찰 15000 + 검사 10000 = 25000, 보험 10000, 본인부담 15000
  const b = await bill.save({
    patient_id: p.id, billed_at: new Date(), insurance_amount: 10000,
    items: [
      { category: "진찰", name: "진찰료", qty: 1, unit_price: 15000 },
      { category: "검사", name: "혈당", qty: 1, unit_price: 10000 },
    ],
  });
  const okTotal = b.total_amount === 25000 && b.patient_amount === 15000 && b.status === "UNPAID";

  // 2) 부분 수납 5000 → PARTIAL
  const b1 = await bill.pay({ id: b.id, amount: 5000, method: "CARD" });
  const okPartial = b1.paid_amount === 5000 && b1.status === "PARTIAL";

  // 3) 잔액 수납 10000 → PAID (본인부담 15000 완납)
  const b2 = await bill.pay({ id: b.id, amount: 10000, method: "CASH" });
  const okPaid = b2.paid_amount === 15000 && b2.status === "PAID";

  // 4) 재무 진료수입이 +15000 됐는지
  const afterPay = await incomeTotal();
  const okIncome = afterPay === before + 15000;

  // 5) 보험청구 생성 — claim_amount = 보험부담 10000
  const claim = await bill.createClaim(b.id);
  const okClaim = Number(claim.claim_amount) === 10000 && claim.status === "DRAFT";

  // 6) 취소 → 진료수입 원복
  await bill.cancel(b.id);
  const afterCancel = await incomeTotal();
  const okRevert = afterCancel === before;

  // 정리
  await prisma.insuranceClaim.delete({ where: { id: claim.id } }).catch(() => {});
  await bill.remove(b.id).catch(() => {});
  await prisma.patient.delete({ where: { id: p.id } }).catch(() => {});

  console.log(
    `산정:${okTotal ? "PASS" : "FAIL"}  부분수납:${okPartial ? "PASS" : "FAIL"}  완납:${okPaid ? "PASS" : "FAIL"}  진료수입+15000:${okIncome ? "PASS" : "FAIL"}  보험청구:${okClaim ? "PASS" : "FAIL"}  취소→원복:${okRevert ? "PASS" : "FAIL"}`,
  );
  const ok = okTotal && okPartial && okPaid && okIncome && okClaim && okRevert;
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
