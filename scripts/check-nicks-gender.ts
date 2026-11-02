import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const targets = ["ОтзывчикПроба1790038809403", "SnowQueen", "zorkiy58", "ОтзывчикПроба", "Snow", "Queen"];
  for (const nick of targets) {
    const users = await db.user.findMany({
      where: { nickname: { contains: nick } },
      select: { id: true, nickname: true, gender: true, email: true, createdAt: true },
      take: 5,
    });
    console.log(`\n=== Поиск по "${nick}": ${users.length} совпадений ===`);
    for (const u of users) {
      console.log(`  id=${u.id}  nickname="${u.nickname}"  gender=${u.gender}  email=${u.email}`);
    }
  }
  // Также найдём все ники, у которых gender не unspecified — посмотрим, кто реально
  // указал свой пол в профиле.
  const total = await db.user.count();
  const withGender = await db.user.count({ where: { gender: { in: ["male", "female"] } } });
  const male = await db.user.count({ where: { gender: "male" } });
  const female = await db.user.count({ where: { gender: "female" } });
  const unspec = await db.user.count({ where: { gender: "unspecified" } });
  console.log(`\n=== Статистика User.gender ===`);
  console.log(`  Всего пользователей: ${total}`);
  console.log(`  С указанным полом: ${withGender} (male=${male}, female=${female})`);
  console.log(`  Без указанного пола (unspecified): ${unspec}`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
