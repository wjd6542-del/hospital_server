/**
 * 검사 오더·결과 검증 — 항목 중첩 · 결과 입력 · 이상치 자동판정 · RESULTED 전환.
 *   실행: npm run verify:lab   (사전: seed:lab)
 * 임시 환자/오더를 만들고 검증 후 정리한다. 실패 시 exit 1.
 */
import prisma from "../server/lib/prisma.js";
import patient from "../server/services/patient.service.js";
import labOrder from "../server/services/labOrder.service.js";

async function main() {
  await prisma.patient.deleteMany({ where: { patient_no: { startsWith: "VF-LAB" } } });

  const glu = await prisma.labTest.findUnique({ where: { code: "GLU" } }); // 참고 70~100
  const ua = await prisma.labTest.findUnique({ where: { code: "UA" } }); // 비수치(음성)
  if (!glu || !ua) { console.log("SKIP — seed:lab 를 먼저 실행하세요."); process.exit(0); }

  const p = await patient.save({ patient_no: "VF-LAB1", name: "검사검증환자", sex: "M" });

  // 1) 오더 생성 — 혈당 + 소변검사
  const order = await labOrder.save({
    patient_id: p.id, ordered_at: new Date(), priority: "ROUTINE",
    items: [
      { lab_test_id: glu.id, test_name: glu.name },
      { lab_test_id: ua.id, test_name: ua.name },
    ],
  });
  const okCreate = order.items.length === 2 && order.status === "ORDERED";
  // 참고치 스냅샷 확인 (혈당)
  const okRef = !!order.items.find((it) => it.lab_test_id === glu.id)?.ref_range;

  const gluItem = order.items.find((it) => it.lab_test_id === glu.id);
  const uaItem = order.items.find((it) => it.lab_test_id === ua.id);

  // 2) 결과 입력 — 혈당 140(참고 70~100 → HIGH 자동), 소변 "음성"(비수치 → 수동 ABNORMAL 없이 null)
  const resulted = await labOrder.result({
    id: order.id,
    results: [
      { item_id: gluItem.id, result_value: "140" },
      { item_id: uaItem.id, result_value: "음성" },
    ],
  });
  const rGlu = resulted.items.find((it) => it.id === gluItem.id);
  const rUa = resulted.items.find((it) => it.id === uaItem.id);
  const okFlagHigh = rGlu.flag === "HIGH";       // 자동판정
  const okFlagNull = rUa.flag === null;          // 비수치 → 판정 안 함
  const okResulted = resulted.status === "RESULTED"; // 전부 결과 있음

  // 3) 정상치 재입력 — 혈당 90 → NORMAL
  const re = await labOrder.result({ id: order.id, results: [{ item_id: gluItem.id, result_value: "90" }] });
  const okNormal = re.items.find((it) => it.id === gluItem.id).flag === "NORMAL";

  // 정리
  await labOrder.remove(order.id).catch(() => {});
  await prisma.patient.delete({ where: { id: p.id } }).catch(() => {});

  console.log(
    `오더+항목:${okCreate ? "PASS" : "FAIL"}  참고치스냅샷:${okRef ? "PASS" : "FAIL"}  자동판정HIGH:${okFlagHigh ? "PASS" : "FAIL"}  비수치null:${okFlagNull ? "PASS" : "FAIL"}  완료전환:${okResulted ? "PASS" : "FAIL"}  정상판정:${okNormal ? "PASS" : "FAIL"}`,
  );
  const ok = okCreate && okRef && okFlagHigh && okFlagNull && okResulted && okNormal;
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
