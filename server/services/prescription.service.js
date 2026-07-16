import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";
import { dispenseToStock, revertDispense } from "../lib/prescriptionStock.js";

function toDateOnly(d) {
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

const DETAIL_INCLUDE = {
  patient: { select: { id: true, patient_no: true, name: true } },
  encounter: { select: { id: true, encounter_date: true } },
  doctor: { select: { id: true, name: true } },
  items: {
    orderBy: [{ id: "asc" }],
    include: { item: { select: { id: true, name: true, unit: true } } },
  },
};

export default {
  async list({ patient_id, encounter_id, doctor_id, status, type, date_from, date_to, q, page, limit }) {
    const where = {};
    if (patient_id) where.patient_id = patient_id;
    if (encounter_id) where.encounter_id = encounter_id;
    if (doctor_id) where.doctor_id = doctor_id;
    if (status) where.status = status;
    if (type) where.type = type;
    if (date_from || date_to) {
      where.prescribed_at = {};
      if (date_from) where.prescribed_at.gte = toDateOnly(date_from);
      if (date_to) where.prescribed_at.lte = toDateOnly(date_to);
    }
    if (q) {
      where.OR = [
        { patient: { name: { contains: q } } },
        { patient: { patient_no: { contains: q } } },
        { items: { some: { drug_name: { contains: q } } } },
      ];
    }

    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.prescription.findMany({
        where,
        orderBy: [{ prescribed_at: "desc" }, { id: "desc" }],
        skip,
        take: l,
        include: DETAIL_INCLUDE,
      }),
      prisma.prescription.count({ where }),
    ]);
    return buildPageResult({ rows, total, page: p, limit: l });
  },

  async get(id) {
    const rx = await prisma.prescription.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!rx) throw new AppError("처방을 찾을 수 없습니다.", 404, "NOT_FOUND");
    return rx;
  },

  async save(data) {
    const { id, items = [], patient_id } = data;

    const patient = await prisma.patient.findUnique({ where: { id: patient_id } });
    if (!patient) throw new AppError("환자를 찾을 수 없습니다.", 404, "NOT_FOUND");

    const payload = {
      patient_id,
      encounter_id: data.encounter_id ?? null,
      doctor_id: data.doctor_id ?? null,
      prescribed_at: toDateOnly(data.prescribed_at),
      type: data.type ?? "INTERNAL",
      status: data.status ?? "DRAFT",
      memo: data.memo ?? null,
    };
    const itemData = items.map((it) => ({
      item_id: it.item_id ?? null,
      drug_name: it.drug_name,
      dosage: it.dosage ?? null,
      frequency: it.frequency ?? null,
      duration_days: it.duration_days ?? null,
      route: it.route ?? null,
      qty: it.qty ?? 0,
      instruction: it.instruction ?? null,
    }));

    let rxId;
    if (id) {
      const ex = await prisma.prescription.findUnique({ where: { id } });
      if (!ex) throw new AppError("처방을 찾을 수 없습니다.", 404, "NOT_FOUND");
      // 조제완료 처방은 재고와 얽혀 있어 수정 불가 — 취소 후 다시 작성한다
      if (ex.status === "DISPENSED") {
        throw new AppError("조제완료된 처방은 수정할 수 없습니다. 취소 후 진행하세요.", 409, "INVALID_STATE");
      }
      // 헤더 갱신 + 약품 교체를 원자적으로
      await prisma.$transaction([
        prisma.prescription.update({ where: { id }, data: payload }),
        prisma.prescriptionItem.deleteMany({ where: { prescription_id: id } }),
        prisma.prescriptionItem.createMany({ data: itemData.map((it) => ({ ...it, prescription_id: id })) }),
      ]);
      rxId = id;
    } else {
      const created = await prisma.prescription.create({
        data: { ...payload, items: { create: itemData } },
      });
      rxId = created.id;
    }
    return this.get(rxId);
  },

  /** 조제 — 재고 차감. ISSUED/DRAFT → DISPENSED */
  async dispense(id) {
    const rx = await prisma.prescription.findUnique({ where: { id }, include: { items: true } });
    if (!rx) throw new AppError("처방을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (rx.status === "DISPENSED") throw new AppError("이미 조제완료된 처방입니다.", 409, "INVALID_STATE");
    if (rx.status === "CANCELED") throw new AppError("취소된 처방은 조제할 수 없습니다.", 409, "INVALID_STATE");

    await prisma.prescription.update({ where: { id }, data: { status: "DISPENSED" } });
    await dispenseToStock(rx); // 재고 출고 생성
    return this.get(id);
  },

  /** 취소 — 조제완료였으면 재고 원복 */
  async cancel(id) {
    const rx = await prisma.prescription.findUnique({ where: { id } });
    if (!rx) throw new AppError("처방을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (rx.status === "CANCELED") throw new AppError("이미 취소된 처방입니다.", 409, "INVALID_STATE");

    if (rx.status === "DISPENSED") await revertDispense(id);
    await prisma.prescription.update({ where: { id }, data: { status: "CANCELED" } });
    return this.get(id);
  },

  async remove(id) {
    const rx = await prisma.prescription.findUnique({ where: { id } });
    if (!rx) throw new AppError("처방을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (rx.status === "DISPENSED") await revertDispense(id); // 재고 잔재 방지
    await prisma.prescription.delete({ where: { id } }); // 약품은 onDelete: Cascade
    return { ok: true };
  },
};
