import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// [code, name, group] — group 은 UI 권한 편집 화면의 묶음
const PERMS = [
  // 게시판
  ["board.view", "게시판 조회", "게시판"],
  ["board.write", "게시판 작성", "게시판"],
  // 지급/회수
  ["ledger.view", "장부 조회", "지급/회수"],
  ["ledger.edit", "장부 편집", "지급/회수"],
  ["settlement.view", "정산 조회", "지급/회수"],
  ["settlement.edit", "정산 처리", "지급/회수"],
  // CS 관리
  ["support.view", "응대 조회", "CS 관리"],
  ["support.edit", "응대 처리", "CS 관리"],
  ["faq.view", "FAQ 조회", "CS 관리"],
  ["faq.edit", "FAQ 편집", "CS 관리"],
  // 환경설정
  ["gameCompany.view", "게임사 조회", "환경설정"],
  ["gameCompany.edit", "게임사 편집", "환경설정"],
  ["vendor.view", "업체 조회", "환경설정"],
  ["vendor.edit", "업체 편집", "환경설정"],
  ["usermanager.view", "계정 조회", "환경설정"],
  ["usermanager.create", "계정 생성", "환경설정"],
  ["usermanager.update", "계정 수정", "환경설정"],
  ["permission.user.view", "역할 조회", "환경설정"],
  ["permission.user.update", "역할 수정", "환경설정"],
  ["permission.menu.view", "권한 조회", "환경설정"],
  ["permission.menu.update", "권한 수정", "환경설정"],
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

  const manager = await prisma.role.upsert({
    where: { name: "정산담당" },
    update: {},
    create: { name: "정산담당", description: "지급/회수·정산 관리", sort: 1 },
  });
  const cs = await prisma.role.upsert({
    where: { name: "CS담당" },
    update: {},
    create: { name: "CS담당", description: "CS 응대·FAQ", sort: 2 },
  });

  async function assign(roleId, codes) {
    await prisma.rolePermission.deleteMany({ where: { role_id: roleId } });
    await prisma.rolePermission.createMany({
      data: codes.map((c) => ({ role_id: roleId, permission_id: idByCode[c] })),
    });
  }
  await assign(manager.id, [
    "board.view", "board.write",
    "ledger.view", "ledger.edit", "settlement.view", "settlement.edit",
    "gameCompany.view", "vendor.view", "vendor.edit",
  ]);
  await assign(cs.id, [
    "board.view", "board.write",
    "support.view", "support.edit", "faq.view", "faq.edit",
    "vendor.view", "gameCompany.view",
  ]);

  console.log(`✅ rbac seed done: ${Object.keys(idByCode).length} perms, roles 정산담당/CS담당`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
