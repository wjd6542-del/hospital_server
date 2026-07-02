import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const role = await prisma.role.upsert({
    where: { name: "슈퍼관리자" },
    update: {},
    create: { name: "슈퍼관리자", description: "전체 권한", is_super: true },
  });

  const password = await bcrypt.hash("admin12", 10);

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password,
      name: "관리자",
      role_id: role.id,
    },
  });

  console.log("✅ seed done: admin / admin12");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
