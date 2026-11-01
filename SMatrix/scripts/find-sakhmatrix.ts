import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const users = await db.user.findMany({
    where: { nickname: { contains: "SakhMatrix" } },
    select: { id: true, nickname: true, gender: true, email: true },
  });
  console.log(`Users matching 'SakhMatrix': ${users.length}`);
  for (const u of users) {
    console.log(`  id=${u.id}  nickname="${u.nickname}"  gender=${u.gender}  email=${u.email}`);
  }
  // Найдём topic с authorName="SakhMatrix"
  const topics = await db.topic.findMany({
    where: { authorName: "SakhMatrix" },
    select: { id: true, authorId: true, authorName: true, title: true },
    take: 5,
  });
  console.log(`\nTopics with authorName="SakhMatrix": ${topics.length}`);
  for (const t of topics) {
    console.log(`  topicId=${t.id}  authorId=${t.authorId}  title="${t.title.slice(0,50)}"`);
  }
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
