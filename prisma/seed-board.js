import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BOARDS = [
  { slug: "notice", name: "공지사항", description: "사내 공지", read_level: "MEMBER", write_level: "ADMIN", allow_comment: true, allow_upload: true, sort: 1 },
  { slug: "free", name: "자유게시판", description: "직원 자유 게시판", read_level: "MEMBER", write_level: "MEMBER", allow_comment: true, allow_upload: true, sort: 2 },
];
async function main() {
  for (const b of BOARDS) {
    await prisma.board.upsert({ where: { slug: b.slug }, update: {}, create: b });
  }
  console.log("✅ board seed:", BOARDS.map((b) => b.name).join(", "));
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
