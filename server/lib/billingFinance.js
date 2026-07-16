import prisma from "./prisma.js";

function toDateOnly(d) {
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

/** 이 수납으로 생성된 재무 거래를 식별하는 태그 (취소 시 매칭 삭제) */
const incomeTag = (billId) => `수납 #${billId}`;

async function incomeAccountId() {
  const acc = await prisma.accountItem.findUnique({
    where: { type_name: { type: "INCOME", name: "진료수입" } },
  });
  return acc?.id ?? null;
}

/**
 * 수납액을 진료수입(FinanceTransaction INCOME)으로 기록한다.
 * '진료수입' 계정이 없으면(seed:billing 미실행) 조용히 skip.
 */
export async function recordIncome(bill, amount, method) {
  const amt = Number(amount);
  if (!(amt > 0)) return;
  const accId = await incomeAccountId();
  if (!accId) return;

  await prisma.financeTransaction.create({
    data: {
      txn_date: toDateOnly(bill.billed_at ?? new Date()),
      type: "INCOME",
      account_item_id: accId,
      amount: amt,
      department_id: bill.department_id ?? null,
      method: method ?? "CASH",
      memo: incomeTag(bill.id),
    },
  });
}

/** 그 수납으로 생성된 진료수입 거래를 원복(삭제)한다 */
export async function revertIncome(billId) {
  await prisma.financeTransaction.deleteMany({
    where: { type: "INCOME", memo: incomeTag(billId) },
  });
}
