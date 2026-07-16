import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";
import { recordIncome, revertIncome } from "../lib/billingFinance.js";

function toDateOnly(d) {
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

/** Decimal → Number 로 직렬화 (프론트 계산 편의) */
function serialize(bill) {
  if (!bill) return bill;
  const num = (v) => (v == null ? v : Number(v));
  return {
    ...bill,
    total_amount: num(bill.total_amount),
    insurance_amount: num(bill.insurance_amount),
    patient_amount: num(bill.patient_amount),
    paid_amount: num(bill.paid_amount),
    items: bill.items?.map((it) => ({ ...it, unit_price: num(it.unit_price), amount: num(it.amount) })),
  };
}

function calcStatus(paid, total) {
  if (paid <= 0) return "UNPAID";
  if (paid >= total) return "PAID";
  return "PARTIAL";
}

const DETAIL_INCLUDE = {
  patient: { select: { id: true, patient_no: true, name: true } },
  encounter: { select: { id: true, encounter_date: true } },
  department: { select: { id: true, name: true } },
  items: { orderBy: [{ id: "asc" }] },
};

// 산정 기본 단가(수가표 미구축 — 명목 단가)
const FEE = { CONSULT: 15000, PRESCRIPTION: 3000, LAB: 10000 };

export default {
  async list({ patient_id, encounter_id, status, date_from, date_to, q, page, limit }) {
    const where = {};
    if (patient_id) where.patient_id = patient_id;
    if (encounter_id) where.encounter_id = encounter_id;
    if (status) where.status = status;
    if (date_from || date_to) {
      where.billed_at = {};
      if (date_from) where.billed_at.gte = toDateOnly(date_from);
      if (date_to) where.billed_at.lte = toDateOnly(date_to);
    }
    if (q) {
      where.patient = { OR: [{ name: { contains: q } }, { patient_no: { contains: q } }] };
    }

    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.bill.findMany({ where, orderBy: [{ billed_at: "desc" }, { id: "desc" }], skip, take: l, include: DETAIL_INCLUDE }),
      prisma.bill.count({ where }),
    ]);
    return buildPageResult({ rows: rows.map(serialize), total, page: p, limit: l });
  },

  async get(id) {
    const bill = await prisma.bill.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!bill) throw new AppError("수납 건을 찾을 수 없습니다.", 404, "NOT_FOUND");
    return serialize(bill);
  },

  /** 진료 기준 수납 항목 자동 산정 (프리필용) — 저장하지 않는다 */
  async suggest({ encounter_id }) {
    const enc = await prisma.encounter.findUnique({
      where: { id: encounter_id },
      include: {
        prescriptions: { include: { items: true } },
        labOrders: { include: { items: true } },
      },
    });
    if (!enc) throw new AppError("진료를 찾을 수 없습니다.", 404, "NOT_FOUND");

    const items = [{ category: "진찰", name: "진찰료", qty: 1, unit_price: FEE.CONSULT, amount: FEE.CONSULT }];
    for (const rx of enc.prescriptions) {
      if (rx.status === "CANCELED") continue;
      const first = rx.items[0]?.drug_name ?? "처방";
      const extra = rx.items.length > 1 ? ` 외 ${rx.items.length - 1}` : "";
      items.push({ category: "처방", name: `처방료 (${first}${extra})`, qty: 1, unit_price: FEE.PRESCRIPTION, amount: FEE.PRESCRIPTION });
    }
    for (const order of enc.labOrders) {
      if (order.status === "CANCELED") continue;
      for (const it of order.items) {
        items.push({ category: "검사", name: it.test_name, qty: 1, unit_price: FEE.LAB, amount: FEE.LAB });
      }
    }

    return {
      patient_id: enc.patient_id,
      encounter_id: enc.id,
      department_id: enc.department_id,
      items,
    };
  },

  async save(data) {
    const { id, items = [], patient_id } = data;

    const patient = await prisma.patient.findUnique({ where: { id: patient_id } });
    if (!patient) throw new AppError("환자를 찾을 수 없습니다.", 404, "NOT_FOUND");

    const itemData = items.map((it) => {
      const qty = it.qty ?? 1;
      const unit_price = it.unit_price ?? 0;
      return { category: it.category, name: it.name, qty, unit_price, amount: qty * unit_price };
    });
    const total = itemData.reduce((s, it) => s + it.amount, 0);
    const insurance = data.insurance_amount ?? 0;
    const patient_amount = Math.max(0, total - insurance);

    const payload = {
      patient_id,
      encounter_id: data.encounter_id ?? null,
      department_id: data.department_id ?? null,
      billed_at: toDateOnly(data.billed_at),
      total_amount: total,
      insurance_amount: insurance,
      patient_amount,
      memo: data.memo ?? null,
    };

    let billId;
    if (id) {
      const ex = await prisma.bill.findUnique({ where: { id } });
      if (!ex) throw new AppError("수납 건을 찾을 수 없습니다.", 404, "NOT_FOUND");
      if (ex.status === "CANCELED") throw new AppError("취소된 수납은 수정할 수 없습니다.", 409, "INVALID_STATE");
      // 본인부담액이 바뀌면 기존 수납액 기준으로 상태 재계산
      const status = calcStatus(Number(ex.paid_amount), patient_amount);
      await prisma.$transaction([
        prisma.bill.update({ where: { id }, data: { ...payload, status } }),
        prisma.billItem.deleteMany({ where: { bill_id: id } }),
        prisma.billItem.createMany({ data: itemData.map((it) => ({ ...it, bill_id: id })) }),
      ]);
      billId = id;
    } else {
      const created = await prisma.bill.create({
        data: { ...payload, status: "UNPAID", items: { create: itemData } },
      });
      billId = created.id;
    }
    return this.get(billId);
  },

  /** 수납 처리 — 수납액 누계 + 진료수입 거래 기록 */
  async pay({ id, amount, method }) {
    const bill = await prisma.bill.findUnique({ where: { id } });
    if (!bill) throw new AppError("수납 건을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (bill.status === "CANCELED") throw new AppError("취소된 수납입니다.", 409, "INVALID_STATE");

    // 완납 기준은 본인부담액 (보험부담분은 환자가 내지 않는다)
    const payable = Number(bill.patient_amount);
    const newPaid = Number(bill.paid_amount) + Number(amount);
    const status = calcStatus(newPaid, payable);

    await prisma.bill.update({
      where: { id },
      data: { paid_amount: newPaid, status, method: method ?? bill.method ?? "CASH" },
    });
    await recordIncome(bill, amount, method); // 재무 수입 기록
    return this.get(id);
  },

  /** 취소 — 진료수입 원복 */
  async cancel(id) {
    const bill = await prisma.bill.findUnique({ where: { id } });
    if (!bill) throw new AppError("수납 건을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (bill.status === "CANCELED") throw new AppError("이미 취소된 수납입니다.", 409, "INVALID_STATE");

    await revertIncome(id);
    await prisma.bill.update({ where: { id }, data: { status: "CANCELED" } });
    return this.get(id);
  },

  /** 보험청구 생성 — 보험부담액으로 InsuranceClaim(DRAFT) 만든다 */
  async createClaim(id) {
    const bill = await prisma.bill.findUnique({ where: { id }, include: { patient: true } });
    if (!bill) throw new AppError("수납 건을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (Number(bill.insurance_amount) <= 0) {
      throw new AppError("보험 부담액이 없어 청구를 생성할 수 없습니다.", 409, "NO_INSURANCE");
    }

    return prisma.insuranceClaim.create({
      data: {
        patient_name: bill.patient.name,
        department_id: bill.department_id ?? null,
        insurer: "HEALTH",
        claim_date: bill.billed_at,
        total_amount: bill.total_amount,
        claim_amount: bill.insurance_amount,
        status: "DRAFT",
        memo: `수납 #${bill.id} 연계`,
      },
    });
  },

  async remove(id) {
    const ex = await prisma.bill.findUnique({ where: { id } });
    if (!ex) throw new AppError("수납 건을 찾을 수 없습니다.", 404, "NOT_FOUND");
    await revertIncome(id); // 재무 잔재 방지
    await prisma.bill.delete({ where: { id } }); // 항목 onDelete: Cascade
    return { ok: true };
  },
};
