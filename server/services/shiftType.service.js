import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

/** "" 를 null 로 — 입력을 비우면 빈 문자열이 온다 */
function normTime(v) {
  return v === "" || v === undefined ? null : v;
}

export default {
  async list({ only_active } = {}) {
    const where = only_active ? { is_active: true } : {};
    return prisma.shiftType.findMany({
      where,
      orderBy: [{ sort: "asc" }, { id: "asc" }],
    });
  },

  async save(data) {
    const { id, ...fields } = data;

    if (fields.start_time !== undefined) fields.start_time = normTime(fields.start_time);
    if (fields.end_time !== undefined) fields.end_time = normTime(fields.end_time);

    // 종료시각이 시작시각보다 이르거나 같으면 자정을 넘긴 근무다("HH:MM" 사전순 = 시각순 비교).
    // crosses_midnight 를 관리자가 깜빡해도(기본값 false) 판정 계산기가 24시간 유령 연장을
    // 만들지 않도록 여기서 자동 파생한다. is_work가 false(비번·연차 등)면 시각이 없으니 건너뛴다.
    if (fields.is_work !== false && fields.start_time && fields.end_time) {
      if (fields.end_time <= fields.start_time && fields.crosses_midnight !== true) {
        fields.crosses_midnight = true;
      }
    }

    const dup = await prisma.shiftType.findFirst({
      where: { code: fields.code, ...(id ? { id: { not: id } } : {}) },
    });
    if (dup) throw new AppError("이미 존재하는 근무유형 코드입니다.", 400, "DUPLICATE");

    if (id) {
      const ex = await prisma.shiftType.findUnique({ where: { id } });
      if (!ex) throw new AppError("근무유형을 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.shiftType.update({ where: { id }, data: fields });
    }
    return prisma.shiftType.create({ data: fields });
  },

  async remove(id) {
    const ex = await prisma.shiftType.findUnique({ where: { id } });
    if (!ex) throw new AppError("근무유형을 찾을 수 없습니다.", 404, "NOT_FOUND");

    const [schedules, attendances] = await Promise.all([
      prisma.shiftSchedule.count({ where: { shift_type_id: id } }),
      prisma.attendance.count({ where: { shift_type_id: id } }),
    ]);
    const used = schedules + attendances;
    if (used > 0) {
      throw new AppError(
        `근무표·근태에서 ${used}건 사용 중이라 삭제할 수 없습니다. 비활성 처리하세요.`,
        400,
        "IN_USE",
      );
    }

    await prisma.shiftType.delete({ where: { id } });
    return { ok: true };
  },
};
