import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  // Найдём сообщения с этими никами
  const targets = ["SnowQueen", "zorkiy58", "ОтзывчикПроба"];
  for (const nick of targets) {
    const msgs = await db.message.findMany({
      where: { authorName: nick },
      select: { id: true, authorName: true, authorId: true, topicId: true, num: true, body: true },
      take: 3,
    });
    console.log(`\n=== Messages with authorName="${nick}": ${msgs.length} ===`);
    for (const m of msgs) {
      console.log(`  topicId=${m.topicId}  num=${m.num}  authorId=${m.authorId || "(null)"}  body="${m.body.slice(0,60)}"`);
    }
    // Проверим согласованность с User
    const ids = [...new Set(msgs.map(m => m.authorId).filter(Boolean))] as string[];
    if (ids.length) {
      const users = await db.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, nickname: true, gender: true },
      });
      console.log(`  Users by authorId:`);
      for (const u of users) {
        console.log(`    id=${u.id}  nickname="${u.nickname}"  gender=${u.gender}`);
      }
    }
    // Тоже для Topic
    const topics = await db.topic.findMany({
      where: { authorName: nick },
      select: { id: true, authorName: true, authorId: true, title: true },
      take: 3,
    });
    console.log(`\n  Topics with authorName="${nick}": ${topics.length}`);
    for (const t of topics) {
      console.log(`  topicId=${t.id}  authorId=${t.authorId || "(null)"}  title="${t.title.slice(0,60)}"`);
    }
  }
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
