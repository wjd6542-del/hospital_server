import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

/** "" · undefined → null (@db.Date 등 비우면 빈 문자열이 온다) */
function normDate(v) {
  return v === "" || v === undefined || v === null ? null : new Date(v);
}

export default {
  async list({ q, is_active, page, limit }) {
    const where = {};
    if (is_active !== undefined) where.is_active = is_active;
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { patient_no: { contains: q } },
        { phone: { contains: q } },
      ];
    }

    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.patient.findMany({ where, orderBy: [{ id: "desc" }], skip, take: l }),
      prisma.patient.count({ where }),
    ]);
    return buildPageResult({ rows, total, page: p, limit: l });
  },

  /** 단건 + 최근 진료 이력 */
  async get(id) {
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        encounters: {
          orderBy: [{ encounter_date: "desc" }],
          take: 20,
          include: {
            department: { select: { id: true, name: true } },
            doctor: { select: { id: true, name: true } },
            diagnoses: { select: { id: true, code: true, name: true, is_primary: true } },
          },
        },
      },
    });
    if (!patient) throw new AppError("환자를 찾을 수 없습니다.", 404, "NOT_FOUND");
    return patient;
  },

  async save(data) {
    const { id, patient_no } = data;
    const payload = {
      patient_no,
      name: data.name,
      birth_date: normDate(data.birth_date),
      sex: data.sex ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      blood_type: data.blood_type ?? null,
      allergies: data.allergies ?? null,
      memo: data.memo ?? null,
      is_active: data.is_active ?? true,
    };

    // 환자번호 중복 검사
    const dup = await prisma.patient.findUnique({ where: { patient_no } });
    if (dup && dup.id !== id) {
      throw new AppError("이미 사용 중인 환자번호입니다.", 409, "DUPLICATE");
    }

    if (id) {
      const ex = await prisma.patient.findUnique({ where: { id } });
      if (!ex) throw new AppError("환자를 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.patient.update({ where: { id }, data: payload });
    }
    return prisma.patient.create({ data: payload });
  },

  async remove(id) {
    const ex = await prisma.patient.findUnique({
      where: { id },
      include: { _count: { select: { encounters: true } } },
    });
    if (!ex) throw new AppError("환자를 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (ex._count.encounters > 0) {
      throw new AppError("진료 이력이 있어 삭제할 수 없습니다. 비활성화하세요.", 409, "IN_USE");
    }
    await prisma.patient.delete({ where: { id } });
    return { ok: true };
  },
};
