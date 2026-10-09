/**
 * Ревизия перед посевом отдельных тем сценариев (ТЗ 2026-09-23):
 * эталон #176 (+2 сообщения), max number тем, рубрики по слагам,
 * как выглядит сообщение #1 в теме (поля).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const t176 = await prisma.topic.findUnique({
    where: { id: 176 },
    select: {
      id: true, number: true, title: true, source: true, authorName: true, authorId: true,
      rubricId: true, views: true, isPinned: true, isClosed: true, createdAt: true,
      lastActivityAt: true, lastAuthorName: true, deletedAt: true,
    },
  });
  console.log("TOPIC #176:", JSON.stringify(t176, null, 2));

  const msgs176 = await prisma.message.findMany({
    where: { topicId: 176 },
    orderBy: { num: "asc" },
    select: { id: true, num: true, authorName: true, authorId: true, body: true, kind: true, aiStatus: true, isDeleted: true, isHiddenByAi: true, depth: true, createdAt: true },
  });
  console.log("MESSAGES #176:", JSON.stringify(msgs176, null, 2));

  const maxNumber = await prisma.topic.aggregate({ _max: { number: true } });
  console.log("MAX topic.number:", maxNumber._max.number);

  const maxNumPerTopic = await prisma.message.aggregate({ _max: { num: true }, where: { topicId: 176 } });
  console.log("MAX message.num in #176:", maxNumPerTopic._max.num);

  for (const slug of ["tovary-i-uslugi--gde-kupit", "tovary-i-uslugi--ceny", "wheretobuy-discuss"]) {
    const r = await prisma.rubric.findUnique({ where: { slug }, select: { id: true, name: true, parentId: true } });
    console.log(`RUBRIC ${slug}:`, JSON.stringify(r));
  }

  const aggregators = await prisma.topic.findMany({
    where: { id: { in: [177, 178] } },
    select: { id: true, number: true, title: true, source: true, rubricId: true, _count: { select: { messages: true } } },
  });
  console.log("AGGREGATORS 177/178:", JSON.stringify(aggregators, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error("ERR:", e); await prisma.$disconnect(); process.exit(1); });
