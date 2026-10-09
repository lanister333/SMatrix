import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  // Поиск всех сообщений и тем, где authorName содержит "Новости"
  const msgs = await db.message.findMany({
    where: { authorName: { contains: "Новости" } },
    select: { authorName: true, topicId: true, num: true, body: true },
    take: 5,
  });
  console.log(`Messages with authorName containing 'Новости': ${msgs.length}`);
  for (const m of msgs) {
    console.log(`  authorName="${m.authorName}"  topic=${m.topicId}  num=${m.num}  body="${m.body.slice(0,50)}"`);
  }
  const topics = await db.topic.findMany({
    where: { OR: [{ authorName: { contains: "Новости" } }, { title: { contains: "Новости" } }] },
    select: { id: true, authorName: true, title: true },
    take: 5,
  });
  console.log(`\nTopics with authorName/title containing 'Новости': ${topics.length}`);
  for (const t of topics) {
    console.log(`  id=${t.id}  authorName="${t.authorName}"  title="${t.title.slice(0,50)}"`);
  }
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
