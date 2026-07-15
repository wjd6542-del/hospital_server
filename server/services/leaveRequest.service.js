import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";
import { applyLeaveToSchedule, revertLeaveFromSchedule } from "../lib/leaveReflect.js";

/** @db.Date 는 UTC 자정으로 저장된다 */
function toDateOnly(d) {
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

/** [start, end] 양끝 포함 일수 */
function inclusiveDays(start, end) {
  const a = toDateOnly(start).getTime();
  const b = toDateOnly(end).getTime();
  return Math.floor((b - a) / 86400000) + 1;
}

const DETAIL_INCLUDE = {
  employee: {
    select: {
      id: true,
      emp_no: true,
      name: true,
      department: { select: { id: true, name: true } },
    },
  },
  leave_type: {
    select: { id: true, code: true, name: true, color: true, deduct_annual: true, shift_type_id: true },
  },
  approver: { select: { id: true, name: true } },
};

/** userId → 연결된 Employee.id (없으면 null) */
async function resolveEmployeeId(userId) {
  if (!userId) return null;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { employee_id: true },
  });
  return u?.employee_id ?? null;
}

export default {
  async list({ department_id, employee_id, status, date_from, date_to, q, page, limit }) {
    const where = {};
    if (employee_id) where.employee_id = employee_id;
    if (status) where.status = status;
    if (date_from || date_to) {
      // 신청 기간이 조회 구간과 겹치는 것
      if (date_to) where.start_date = { lte: toDateOnly(date_to) };
      if (date_from) where.end_date = { gte: toDateOnly(date_from) };
    }
    if (department_id || q) {
      where.employee = {};
      if (department_id) where.employee.department_id = department_id;
      if (q) where.employee.OR = [{ name: { contains: q } }, { emp_no: { contains: q } }];
    }

    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        orderBy: [{ created_at: "desc" }],
        skip,
        take: l,
        include: DETAIL_INCLUDE,
      }),
      prisma.leaveRequest.count({ where }),
    ]);
    return buildPageResult({ rows, total, page: p, limit: l });
  },

  async create(data) {
    const { employee_id, leave_type_id, reason } = data;
    const start = toDateOnly(data.start_date);
    const end = toDateOnly(data.end_date);

    const [emp, type] = await Promise.all([
      prisma.employee.findUnique({ where: { id: employee_id } }),
      prisma.leaveType.findUnique({ where: { id: leave_type_id } }),
    ]);
    if (!emp) throw new AppError("직원을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (!type || !type.is_active) throw new AppError("휴가유형을 찾을 수 없습니다.", 404, "NOT_FOUND");

    const days = data.days ?? inclusiveDays(start, end);
    // 승인 절차가 없는 유형은 즉시 승인 처리한다
    const autoApprove = type.requires_approval === false;

    const created = await prisma.leaveRequest.create({
      data: {
        employee_id,
        leave_type_id,
        start_date: start,
        end_date: end,
        days,
        reason: reason ?? null,
        status: autoApprove ? "APPROVED" : "PENDING",
        approved_at: autoApprove ? new Date() : null,
      },
      include: DETAIL_INCLUDE,
    });

    if (autoApprove) {
      await applyLeaveToSchedule(created);
    }
    return created;
  },

  async approve(id, approverUserId) {
    const req = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { leave_type: true },
    });
    if (!req) throw new AppError("신청을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (req.status !== "PENDING") {
      throw new AppError("대기 중인 신청만 승인할 수 있습니다.", 409, "INVALID_STATE");
    }

    const approverId = await resolveEmployeeId(approverUserId);
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: "APPROVED", approver_id: approverId, approved_at: new Date(), reject_reason: null },
      include: DETAIL_INCLUDE,
    });

    await applyLeaveToSchedule({ ...updated, leave_type: req.leave_type });
    return updated;
  },

  async reject({ id, reason }, approverUserId) {
    const req = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!req) throw new AppError("신청을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (req.status !== "PENDING") {
      throw new AppError("대기 중인 신청만 반려할 수 있습니다.", 409, "INVALID_STATE");
    }

    const approverId = await resolveEmployeeId(approverUserId);
    return prisma.leaveRequest.update({
      where: { id },
      data: { status: "REJECTED", approver_id: approverId, approved_at: new Date(), reject_reason: reason ?? null },
      include: DETAIL_INCLUDE,
    });
  },

  /** 승인/대기 신청을 취소한다. 이미 승인돼 근무표에 반영됐으면 원복한다. */
  async cancel(id) {
    const req = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { leave_type: true },
    });
    if (!req) throw new AppError("신청을 찾을 수 없습니다.", 404, "NOT_FOUND");
    if (req.status === "CANCELED" || req.status === "REJECTED") {
      throw new AppError("이미 취소·반려된 신청입니다.", 409, "INVALID_STATE");
    }

    if (req.status === "APPROVED") {
      await revertLeaveFromSchedule(req);
    }
    return prisma.leaveRequest.update({
      where: { id },
      data: { status: "CANCELED" },
      include: DETAIL_INCLUDE,
    });
  },

  async remove(id) {
    const req = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { leave_type: true },
    });
    if (!req) throw new AppError("신청을 찾을 수 없습니다.", 404, "NOT_FOUND");
    // 승인 상태로 삭제하면 근무표 잔재가 남으므로 먼저 원복한다
    if (req.status === "APPROVED") {
      await revertLeaveFromSchedule(req);
    }
    await prisma.leaveRequest.delete({ where: { id } });
    return { ok: true };
  },
};
