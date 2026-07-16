import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

const DETAIL_INCLUDE = {
  patient: { select: { id: true, patient_no: true, name: true, sex: true, birth_date: true } },
  department: { select: { id: true, name: true } },
  doctor: { select: { id: true, name: true } },
  appointment: { select: { id: true, reserved_at: true, status: true } },
  diagnoses: { orderBy: [{ is_primary: "desc" }, { id: "asc" }] },
};

/** 바이탈 필드 — 스키마 preprocess 로 "" 는 이미 null 이 된다 */
const VITALS = ["bp_systolic", "bp_diastolic", "pulse", "temp", "resp", "spo2", "height", "weight"];

export default {
  async list({ patient_id, department_id, doctor_id, status, date_from, date_to, q, page, limit }) {
    const where = {};
    if (patient_id) where.patient_id = patient_id;
    if (department_id) where.department_id = department_id;
    if (doctor_id) where.doctor_id = doctor_id;
    if (status) where.status = status;
    if (date_from || date_to) {
      where.encounter_date = {};
      if (date_from) where.encounter_date.gte = new Date(date_from);
      if (date_to) where.encounter_date.lte = new Date(date_to);
    }
    if (q) {
      where.patient = {
        OR: [{ name: { contains: q } }, { patient_no: { contains: q } }],
      };
    }

    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.encounter.findMany({
        where,
        orderBy: [{ encounter_date: "desc" }],
        skip,
        take: l,
        include: DETAIL_INCLUDE,
      }),
      prisma.encounter.count({ where }),
    ]);
    return buildPageResult({ rows, total, page: p, limit: l });
  },

  async get(id) {
    const enc = await prisma.encounter.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!enc) throw new AppError("진료를 찾을 수 없습니다.", 404, "NOT_FOUND");
    return enc;
  },

  async save(data) {
    const { id, diagnoses = [], patient_id, appointment_id } = data;

    const patient = await prisma.patient.findUnique({ where: { id: patient_id } });
    if (!patient) throw new AppError("환자를 찾을 수 없습니다.", 404, "NOT_FOUND");

    const payload = {
      patient_id,
      department_id: data.department_id ?? null,
      doctor_id: data.doctor_id ?? null,
      appointment_id: appointment_id ?? null,
      encounter_date: new Date(data.encounter_date),
      chief_complaint: data.chief_complaint ?? null,
      subjective: data.subjective ?? null,
      objective: data.objective ?? null,
      assessment: data.assessment ?? null,
      plan: data.plan ?? null,
      status: data.status ?? "OPEN",
      memo: data.memo ?? null,
    };
    for (const v of VITALS) payload[v] = data[v] ?? null;

    const diagData = diagnoses.map((d) => ({
      code: d.code,
      name: d.name,
      is_primary: d.is_primary ?? false,
      note: d.note ?? null,
    }));

    let encounterId;
    if (id) {
      const ex = await prisma.encounter.findUnique({ where: { id } });
      if (!ex) throw new AppError("진료를 찾을 수 없습니다.", 404, "NOT_FOUND");
      // 헤더 갱신 + 진단 교체를 원자적으로 (부분 실패 시 진단 유실 방지)
      await prisma.$transaction([
        prisma.encounter.update({ where: { id }, data: payload }),
        prisma.diagnosis.deleteMany({ where: { encounter_id: id } }),
        prisma.diagnosis.createMany({ data: diagData.map((d) => ({ ...d, encounter_id: id })) }),
      ]);
      encounterId = id;
    } else {
      const created = await prisma.encounter.create({
        data: { ...payload, diagnoses: { create: diagData } },
      });
      encounterId = created.id;
    }

    // 예약에서 시작된 진료면 그 예약을 방문 완료로 표시한다 (BOOKED 일 때만)
    if (appointment_id) {
      await prisma.appointment.updateMany({
        where: { id: appointment_id, status: "BOOKED" },
        data: { status: "VISITED" },
      });
    }

    return this.get(encounterId);
  },

  async remove(id) {
    const ex = await prisma.encounter.findUnique({ where: { id } });
    if (!ex) throw new AppError("진료를 찾을 수 없습니다.", 404, "NOT_FOUND");
    await prisma.encounter.delete({ where: { id } }); // 진단은 onDelete: Cascade
    return { ok: true };
  },
};
