import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const users = await db.user.findMany({
    where: { nickname: "Админ" },
    select: { id: true, nickname: true, email: true, gender: true, role: true, createdAt: true },
  });
  console.log("Users with nickname 'Админ':", users.length);
  for (const u of users) {
    console.log(`  id=${u.id}  email=${u.email}  gender=${u.gender}  role=${u.role}  createdAt=${u.createdAt.toISOString()}`);
  }
  const mods = await db.user.findMany({
    where: { nickname: "Модератор" },
    select: { id: true, nickname: true, email: true, gender: true, role: true, createdAt: true },
  });
  console.log("\nUsers with nickname 'Модератор':", mods.length);
  for (const u of mods) {
    console.log(`  id=${u.id}  email=${u.email}  gender=${u.gender}  role=${u.role}  createdAt=${u.createdAt.toISOString()}`);
  }
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
