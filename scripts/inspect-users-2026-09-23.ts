// Инспекция: пользователи и объявления «Знакомства» в БД (для пробы авторизации).
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const users = await db.user.findMany({
    select: { id: true, nickname: true, role: true, email: true },
    take: 10,
  });
  console.log("USERS:", JSON.stringify(users, null, 1));
  const dc = await db.datingPost.count();
  console.log("datingPosts:", dc);
  const posts = await db.datingPost.findMany({
    select: { id: true, category: true, place: true, authorName: true, createdAt: true, body: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  for (const p of posts) {
    console.log(`- [${p.category}] ${p.place} | ${p.authorName} | ${p.createdAt.toISOString()} | ${p.body.slice(0, 50)}...`);
  }
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
