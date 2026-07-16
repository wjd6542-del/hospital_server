import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";
import { judgeFlag } from "../lib/labFlag.js";

function toDateOnly(d) {
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

/** 검사 마스터의 참고치를 표시 문자열로 */
function refRangeText(t) {
  if (!t) return null;
  if (t.ref_text) return t.ref_text;
  if (t.ref_low != null || t.ref_high != null) {
    return `${t.ref_low ?? ""} ~ ${t.ref_high ?? ""}${t.unit ? " " + t.unit : ""}`.trim();
  }
  return null;
}

const DETAIL_INCLUDE = {
  patient: { select: { id: true, patient_no: true, name: true } },
  encounter: { select: { id: true, encounter_date: true } },
  doctor: { select: { id: true, name: true } },
  items: {
    orderBy: [{ id: "asc" }],
    include: { lab_test: { select: { id: true, code: true, name: true, ref_low: true, ref_high: true, unit: true } } },
  },
};

export default {
  async list({ patient_id, encounter_id, doctor_id, status, priority, date_from, date_to, q, page, limit }) {
    const where = {};
    if (patient_id) where.patient_id = patient_id;
    if (encounter_id) where.encounter_id = encounter_id;
    if (doctor_id) where.doctor_id = doctor_id;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (date_from || date_to) {
      where.ordered_at = {};
      if (date_from) where.ordered_at.gte = toDateOnly(date_from);
      if (date_to) where.ordered_at.lte = toDateOnly(date_to);
    }
    if (q) {
      where.OR = [
        { patient: { name: { contains: q } } },
        { patient: { patient_no: { contains: q } } },
        { items: { some: { test_name: { contains: q } } } },
      ];
    }

    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.labOrder.findMany({
        where,
        orderBy: [{ ordered_at: "desc" }, { id: "desc" }],
        skip,
        take: l,
        include: DETAIL_INCLUDE,
      }),
      prisma.labOrder.count({ where }),
    ]);
    return buildPageResult({ rows, total, page: p, limit: l });
  },

  async get(id) {
    const order = await prisma.labOrder.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!order) throw new AppError("검사 오더를 찾을 수 없습니다.", 404, "NOT_FOUND");
    return order;
  },

  async save(data) {
    const { id, items = [], patient_id } = data;

    const patient = await prisma.patient.findUnique({ where: { id: patient_id } });
    if (!patient) throw new AppError("환자를 찾을 수 없습니다.", 404, "NOT_FOUND");

    // 연계된 검사 마스터에서 단위·참고치 스냅샷
    const testIds = items.map((it) => it.lab_test_id).filter(Boolean);
    const tests = testIds.length
      ? await prisma.labTest.findMany({ where: { id: { in: testIds } } })
      : [];
    const testById = new Map(tests.map((t) => [t.id, t]));

    const payload = {
      patient_id,
      encounter_id: data.encounter_id ?? null,
      doctor_id: data.doctor_id ?? null,
      ordered_at: toDateOnly(data.ordered_at),
      priority: data.priority ?? "ROUTINE",
      memo: data.memo ?? null,
    };
    const itemData = items.map((it) => {
      const t = it.lab_test_id ? testById.get(it.lab_test_id) : null;
      return {
        lab_test_id: it.lab_test_id ?? null,
        test_name: it.test_name,
        unit: it.unit ?? t?.unit ?? null,
        ref_range: it.ref_range ?? refRangeText(t),
      };
    });

    let orderId;
    if (id) {
      const ex = await prisma.labOrder.findUnique({ where: { id } });
      if (!ex) throw new AppError("검사 오더를 찾을 수 없습니다.", 404, "NOT_FOUND");
      if (ex.status === "RESULTED") {
        throw new AppError("결과가 입력된 오더는 수정할 수 없습니다.", 409, "INVALID_STATE");
      }
      // 헤더 갱신 + 항목 교체를 원자적으로
      await prisma.$transaction([
        prisma.labOrder.update({ where: { id }, data: payload }),
        prisma.labOrderItem.deleteMany({ where: { order_id: id } }),
        prisma.labOrderItem.createMany({ data: itemData.map((it) => ({ ...it, order_id: id })) }),
      ]);
      orderId = id;
    } else {
      const created = await prisma.labOrder.create({
        data: { ...payload, items: { create: itemData } },
      });
      orderId = created.id;
    }
    return this.get(orderId);
  },

  /**
   * 결과 입력 — 항목별 결과값 반영 + 이상 플래그 자동판정(수동 flag 우선).
   * 모든 항목에 결과가 있으면 오더를 RESULTED 로 바꾼다.
   */
  async result({ id, results = [] }) {
    const order = await prisma.labOrder.findUnique({
      where: { id },
      include: { items: { include: { lab_test: true } } },
    });
    if (!order) throw new AppError("검사 오더를 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (order.status === "CANCELED") throw new AppError("취소된 오더입니다.", 409, "INVALID_STATE");

    const byItem = new Map(results.map((r) => [r.item_id, r]));
    const now = new Date();

    await prisma.$transaction(
      order.items
        .filter((it) => byItem.has(it.id))
        .map((it) => {
          const r = byItem.get(it.id);
          const value = r.result_value ?? null;
          // 수동 flag 가 오면 우선, 아니면 참고범위로 자동판정
          const flag = r.flag ?? judgeFlag(value, it.lab_test?.ref_low ?? null, it.lab_test?.ref_high ?? null);
          return prisma.labOrderItem.update({
            where: { id: it.id },
            data: { result_value: value, flag, resulted_at: value ? now : null },
          });
        }),
    );

    // 모든 항목에 결과값이 있으면 완료 처리
    const fresh = await prisma.labOrderItem.findMany({ where: { order_id: id }, select: { result_value: true } });
    const allResulted = fresh.length > 0 && fresh.every((i) => i.result_value != null && i.result_value !== "");
    await prisma.labOrder.update({ where: { id }, data: { status: allResulted ? "RESULTED" : "ORDERED" } });

    return this.get(id);
  },

  async cancel(id) {
    const order = await prisma.labOrder.findUnique({ where: { id } });
    if (!order) throw new AppError("검사 오더를 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (order.status === "CANCELED") throw new AppError("이미 취소된 오더입니다.", 409, "INVALID_STATE");
    return prisma.labOrder.update({ where: { id }, data: { status: "CANCELED" }, include: DETAIL_INCLUDE });
  },

  async remove(id) {
    const ex = await prisma.labOrder.findUnique({ where: { id } });
    if (!ex) throw new AppError("검사 오더를 찾을 수 없습니다.", 404, "NOT_FOUND");
    await prisma.labOrder.delete({ where: { id } }); // 항목 onDelete: Cascade
    return { ok: true };
  },
};
