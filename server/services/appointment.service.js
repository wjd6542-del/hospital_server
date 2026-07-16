import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

// reserved_at 은 full DateTime. 날짜 필터는 서버 로컬(KST) 하루 경계로 감싼다.
function dayStart(v) {
  const d = new Date(v);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function dayEnd(v) {
  const d = new Date(v);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

const DETAIL_INCLUDE = {
  department: { select: { id: true, name: true } },
  doctor: { select: { id: true, name: true } },
};

export default {
  async list({ date_from, date_to, status, department_id, doctor_id, q, page, limit }) {
    const where = {};
    if (date_from || date_to) {
      where.reserved_at = {};
      if (date_from) where.reserved_at.gte = dayStart(date_from);
      if (date_to) where.reserved_at.lte = dayEnd(date_to);
    }
    if (status) where.status = status;
    if (department_id) where.department_id = department_id;
    if (doctor_id) where.doctor_id = doctor_id;
    if (q) where.OR = [{ patient_name: { contains: q } }, { patient_phone: { contains: q } }];

    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.appointment.findMany({ where, orderBy: [{ reserved_at: "asc" }, { id: "asc" }], skip, take: l, include: DETAIL_INCLUDE }),
      prisma.appointment.count({ where }),
    ]);
    return buildPageResult({ rows, total, page: p, limit: l });
  },

  async save(data) {
    const { id, ...fields } = data;
    const payload = {
      patient_name: fields.patient_name,
      patient_phone: fields.patient_phone ?? null,
      department_id: fields.department_id ?? null,
      doctor_id: fields.doctor_id ?? null,
      reserved_at: new Date(fields.reserved_at),
      status: fields.status ?? "BOOKED",
      memo: fields.memo ?? null,
    };
    if (id) {
      const ex = await prisma.appointment.findUnique({ where: { id } });
      if (!ex) throw new AppError("예약을 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.appointment.update({ where: { id }, data: payload, include: DETAIL_INCLUDE });
    }
    return prisma.appointment.create({ data: payload, include: DETAIL_INCLUDE });
  },

  async setStatus({ id, status }) {
    const ex = await prisma.appointment.findUnique({ where: { id } });
    if (!ex) throw new AppError("예약을 찾을 수 없습니다.", 404, "NOT_FOUND");
    return prisma.appointment.update({ where: { id }, data: { status }, include: DETAIL_INCLUDE });
  },

  async remove(id) {
    const ex = await prisma.appointment.findUnique({ where: { id } });
    if (!ex) throw new AppError("예약을 찾을 수 없습니다.", 404, "NOT_FOUND");
    await prisma.appointment.delete({ where: { id } });
    return { ok: true };
  },
};
