import prisma from "./prisma.js";

/** @db.Date 는 UTC 자정으로 저장된다 */
function toDateOnly(d) {
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

/** 이 처방으로 생성된 출고를 식별하는 태그 (취소 시 매칭 삭제용) */
const dispenseTag = (id) => `처방조제 #${id}`;

/**
 * 조제 반영 — item_id 있고 qty>0 인 약품마다 재고 출고(StockMovement OUT, 음수 qty)를 만든다.
 * item_id 없는(자유입력) 약품은 재고에 영향 없음.
 */
export async function dispenseToStock(prescription) {
  const { id, prescribed_at, items = [] } = prescription;
  const targets = items.filter((it) => it.item_id && Number(it.qty) > 0);
  if (!targets.length) return;

  const moved_at = toDateOnly(prescribed_at);
  const data = targets.map((it) => ({
    item_id: it.item_id,
    type: "OUT",
    qty: -Math.abs(Number(it.qty)), // 출고는 음수
    moved_at,
    memo: dispenseTag(id),
  }));
  await prisma.stockMovement.createMany({ data });
}

/** 조제 취소 원복 — 그 처방으로 생성된 출고 이력만 삭제한다 */
export async function revertDispense(prescriptionId) {
  await prisma.stockMovement.deleteMany({
    where: { type: "OUT", memo: dispenseTag(prescriptionId) },
  });
}
