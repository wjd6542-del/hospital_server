import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// [code, name, group] — group 은 UI 권한 편집 화면의 묶음
// 병원 도메인 권한(hr.*, inventory.* 등)은 각 도메인 사이클에서 추가한다.
const PERMS = [
  // 게시판
  ["board.view", "게시판 조회", "게시판"],
  ["board.write", "게시판 작성", "게시판"],
  // FAQ
  ["faq.view", "FAQ 조회", "FAQ"],
  ["faq.edit", "FAQ 편집", "FAQ"],
  // 인사
  ["department.view", "부서 조회", "인사"],
  ["department.edit", "부서 편집", "인사"],
  ["hr.view", "직원 조회", "인사"],
  ["hr.edit", "직원 편집", "인사"],
  // 감사로그
  ["logs.view", "감사로그 조회", "감사로그"],
  // 알림
  ["notification.view", "알림 조회", "알림"],
  ["notification.read", "알림 읽음 처리", "알림"],
  ["notification.delete", "알림 삭제", "알림"],
  // 환경설정
  ["usermanager.view", "계정 조회", "환경설정"],
  ["usermanager.create", "계정 생성", "환경설정"],
  ["usermanager.update", "계정 수정", "환경설정"],
  ["permission.user.view", "역할 조회", "환경설정"],
  ["permission.user.update", "역할 수정", "환경설정"],
  ["permission.menu.view", "권한 조회", "환경설정"],
  ["permission.menu.update", "권한 수정", "환경설정"],
  ["setting.view", "설정 조회", "환경설정"],
  ["setting.update", "설정 수정", "환경설정"],
];

async function main() {
  let sort = 0;
  const idByCode = {};
  for (const [code, name, group] of PERMS) {
    const p = await prisma.permission.upsert({
      where: { code },
      update: { name, group, sort },
      create: { code, name, group, sort },
    });
    idByCode[code] = p.id;
    sort++;
  }

  // RolePermission.permission 에 onDelete: Cascade가 없으므로, 카탈로그 밖
  // 권한을 참조하는 RolePermission 행을 먼저 지워야 FK 제약을 피할 수 있다.
  await prisma.rolePermission.deleteMany({
    where: { permission: { code: { notIn: PERMS.map(([code]) => code) } } },
  });

  // 카탈로그에서 빠진 권한 행 정리 (CS 도메인 잔재)
  const removed = await prisma.permission.deleteMany({
    where: { code: { notIn: PERMS.map(([code]) => code) } },
  });

  const admin = await prisma.role.upsert({
    where: { name: "관리자" },
    update: {},
    create: { name: "관리자", description: "전체 권한", sort: 1 },
  });

  await prisma.rolePermission.deleteMany({ where: { role_id: admin.id } });
  await prisma.rolePermission.createMany({
    data: PERMS.map(([code]) => ({ role_id: admin.id, permission_id: idByCode[code] })),
  });

  console.log(
    `✅ rbac seed done: ${PERMS.length} perms (removed ${removed.count} stale), role 관리자`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
