import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

function toDateOnly(v) {
  if (!v) return null;
  const dt = new Date(v);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

const DETAIL_INCLUDE = {
  department: { select: { id: true, name: true } },
  doctor: { select: { id: true, name: true } },
};

export default {
  async list({ status, department_id, doctor_id, date_from, date_to, q, page, limit }) {
    const where = {};
    if (status) where.status = status;
    if (department_id) where.department_id = department_id;
    if (doctor_id) where.doctor_id = doctor_id;
    if (date_from || date_to) {
      where.admitted_at = {};
      if (date_from) where.admitted_at.gte = toDateOnly(date_from);
      if (date_to) where.admitted_at.lte = toDateOnly(date_to);
    }
    if (q) where.OR = [{ patient_name: { contains: q } }, { room: { contains: q } }, { diagnosis: { contains: q } }];

    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.admission.findMany({ where, orderBy: [{ status: "asc" }, { admitted_at: "desc" }, { id: "desc" }], skip, take: l, include: DETAIL_INCLUDE }),
      prisma.admission.count({ where }),
    ]);
    return buildPageResult({ rows, total, page: p, limit: l });
  },

  async save(data) {
    const { id, ...fields } = data;
    const payload = {
      patient_name: fields.patient_name,
      patient_phone: fields.patient_phone ?? null,
      room: fields.room ?? null,
      department_id: fields.department_id ?? null,
      doctor_id: fields.doctor_id ?? null,
      admitted_at: toDateOnly(fields.admitted_at),
      discharged_at: toDateOnly(fields.discharged_at),
      status: fields.status ?? "ADMITTED",
      diagnosis: fields.diagnosis ?? null,
      memo: fields.memo ?? null,
    };
    // 퇴원일이 있으면 상태도 퇴원으로 맞춘다
    if (payload.discharged_at && payload.status === "ADMITTED") payload.status = "DISCHARGED";

    if (id) {
      const ex = await prisma.admission.findUnique({ where: { id } });
      if (!ex) throw new AppError("입원 기록을 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.admission.update({ where: { id }, data: payload, include: DETAIL_INCLUDE });
    }
    return prisma.admission.create({ data: payload, include: DETAIL_INCLUDE });
  },

  async discharge({ id, discharged_at }) {
    const ex = await prisma.admission.findUnique({ where: { id } });
    if (!ex) throw new AppError("입원 기록을 찾을 수 없습니다.", 404, "NOT_FOUND");
    const date = toDateOnly(discharged_at) ?? toDateOnly(new Date());
    return prisma.admission.update({ where: { id }, data: { status: "DISCHARGED", discharged_at: date }, include: DETAIL_INCLUDE });
  },

  async remove(id) {
    const ex = await prisma.admission.findUnique({ where: { id } });
    if (!ex) throw new AppError("입원 기록을 찾을 수 없습니다.", 404, "NOT_FOUND");
    await prisma.admission.delete({ where: { id } });
    return { ok: true };
  },

  /** 재원(입원중) 환자 수 */
  async summary() {
    const [admitted, total] = await Promise.all([
      prisma.admission.count({ where: { status: "ADMITTED" } }),
      prisma.admission.count(),
    ]);
    return { admitted, total };
  },
};
