/**
 * 진료(EMR) 검증 — 환자 등록 · 진단 중첩 트랜잭션(교체) · 예약→방문(VISITED) 연동.
 *   실행: npm run verify:emr
 * 자체적으로 임시 환자/예약/진료를 만들고 검증 후 전부 정리한다. 실패 시 exit 1.
 */
import prisma from "../server/lib/prisma.js";
import patient from "../server/services/patient.service.js";
import encounter from "../server/services/encounter.service.js";

async function main() {
  const stamp = "verify-emr";
  // 사전 정리
  await prisma.patient.deleteMany({ where: { patient_no: { startsWith: "VF-" } } });

  // 1) 환자 등록
  const p = await patient.save({
    patient_no: "VF-0001", name: "검증환자", sex: "M", birth_date: "1990-05-01", phone: "010-0000-0000",
  });
  const okPatient = !!p.id && p.patient_no === "VF-0001";

  // 예약 하나(BOOKED) 만들어 연동 확인
  const appt = await prisma.appointment.create({
    data: { patient_name: "검증환자", reserved_at: new Date(), status: "BOOKED" },
  });

  // 2) 진료 생성 — 진단 2개(주상병 1) + 예약 연동
  const enc = await encounter.save({
    patient_id: p.id,
    appointment_id: appt.id,
    encounter_date: new Date(),
    chief_complaint: "두통",
    subjective: "3일 전부터 두통",
    objective: "BP 120/80",
    assessment: "긴장성 두통",
    plan: "진통제 처방",
    bp_systolic: 120, bp_diastolic: 80, temp: 36.5, weight: 70,
    diagnoses: [
      { code: "G44.2", name: "긴장성 두통", is_primary: true },
      { code: "R51", name: "두통", is_primary: false },
    ],
  });
  const okCreate = enc.diagnoses.length === 2 && enc.diagnoses[0].is_primary === true && enc.bp_systolic === 120;

  // 3) 예약이 VISITED 로 바뀌었는지
  const appt2 = await prisma.appointment.findUnique({ where: { id: appt.id } });
  const okVisited = appt2.status === "VISITED";

  // 4) 진단 교체 — 1개로 갱신, 기존 2개는 사라져야 함
  const upd = await encounter.save({
    id: enc.id, patient_id: p.id, encounter_date: enc.encounter_date,
    diagnoses: [{ code: "J00", name: "감기", is_primary: true }],
  });
  const dxCount = await prisma.diagnosis.count({ where: { encounter_id: enc.id } });
  const okReplace = upd.diagnoses.length === 1 && dxCount === 1 && upd.diagnoses[0].code === "J00";

  // 5) 환자 이력에 진료가 잡히는지
  const detail = await patient.get(p.id);
  const okHistory = detail.encounters.length === 1 && detail.encounters[0].id === enc.id;

  // 정리
  await encounter.remove(enc.id);
  await prisma.appointment.delete({ where: { id: appt.id } }).catch(() => {});
  await prisma.patient.delete({ where: { id: p.id } }).catch(() => {});

  console.log(
    `환자등록:${okPatient ? "PASS" : "FAIL"}  진료+진단:${okCreate ? "PASS" : "FAIL"}  예약→방문:${okVisited ? "PASS" : "FAIL"}  진단교체:${okReplace ? "PASS" : "FAIL"}  환자이력:${okHistory ? "PASS" : "FAIL"}`,
  );
  const ok = okPatient && okCreate && okVisited && okReplace && okHistory;
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
