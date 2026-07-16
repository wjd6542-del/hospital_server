/**
 * 휴가 승인→근무표·근태 반영 / 취소→원복 왕복 검증 (DB 통합).
 *
 * 순수 단위 테스트(test/*.test.js)와 달리 실 DB·시드가 필요해 `npm test` 와 분리한다.
 *   실행: npm run verify:leave   (사전: seed:hr, seed:leave, 직원 1명 이상)
 * 자체적으로 미래 날짜(2026-12-24)에 신청을 만들고 검증 후 정리한다. 실패 시 exit 1.
 */
import prisma from "../server/lib/prisma.js";
import leaveRequest from "../server/services/leaveRequest.service.js";
import leaveGrant from "../server/services/leaveGrant.service.js";

const u = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const DAY = u(2026, 12, 24);

async function cleanup(empId) {
  await prisma.leaveRequest.deleteMany({ where: { employee_id: empId, reason: "verify:leave" } });
  await prisma.shiftSchedule.deleteMany({ where: { employee_id: empId, work_date: DAY, memo: "휴가 승인" } });
  await prisma.leaveGrant.deleteMany({ where: { employee_id: empId, year: 2026, note: "verify:leave" } });
}

async function main() {
  const emp = await prisma.employee.findFirst({ where: { resigned_at: null }, orderBy: { id: "asc" } });
  if (!emp) {
    console.log("SKIP — 검증용 직원이 없습니다. 화면에서 직원을 먼저 등록하세요.");
    process.exit(0);
  }
  const annual = await prisma.leaveType.findUnique({ where: { code: "ANNUAL" }, include: { shift_type: true } });
  if (!annual?.shift_type_id) {
    console.log("SKIP — 연차 유형/연동 근무유형이 없습니다. seed:hr, seed:leave 를 먼저 실행하세요.");
    process.exit(0);
  }

  await cleanup(emp.id);
  console.log(`직원: ${emp.name}(#${emp.id})  연차→근무유형 ${annual.shift_type.code}`);

  // 기존에 승인된 연차가 있을 수 있으므로 절대값이 아닌 "증분"으로 검증한다.
  await leaveGrant.save({ employee_id: emp.id, year: 2026, granted_days: 15, note: "verify:leave" });
  const before = (await leaveGrant.list({ department_id: emp.department_id, year: 2026 }))
    .find((g) => g.employee_id === emp.id);
  const usedBefore = before?.used_days ?? 0;

  // 1) 신청 → PENDING, 기간으로 일수 자동계산
  const req = await leaveRequest.create({
    employee_id: emp.id, leave_type_id: annual.id, start_date: DAY, end_date: DAY, reason: "verify:leave",
  });
  const okCreate = req.status === "PENDING" && req.days === 1;

  // 2) 승인 → APPROVED + 근무표 셀(연차) 반영
  await leaveRequest.approve(req.id, null);
  const cell = await prisma.shiftSchedule.findUnique({
    where: { employee_id_work_date: { employee_id: emp.id, work_date: DAY } },
  });
  const okApply = !!cell && cell.shift_type_id === annual.shift_type_id;

  // 3) 사용량이 정확히 +1, 잔여 = 부여 - 사용 인지 (증분 검증)
  const after = (await leaveGrant.list({ department_id: emp.department_id, year: 2026 }))
    .find((g) => g.employee_id === emp.id);
  const okUsed = after?.used_days === usedBefore + 1 && after?.remaining_days === after?.granted_days - after?.used_days;

  // 4) 취소 → 근무표 셀 원복
  await leaveRequest.cancel(req.id);
  const cell2 = await prisma.shiftSchedule.findUnique({
    where: { employee_id_work_date: { employee_id: emp.id, work_date: DAY } },
  });
  const okRevert = !cell2;

  await cleanup(emp.id);

  console.log(`신청/일수:${okCreate ? "PASS" : "FAIL"}  승인→반영:${okApply ? "PASS" : "FAIL"}  부여/잔여:${okUsed ? "PASS" : "FAIL"}  취소→원복:${okRevert ? "PASS" : "FAIL"}`);
  const ok = okCreate && okApply && okUsed && okRevert;
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
