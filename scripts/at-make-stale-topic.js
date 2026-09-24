const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const yearAgo2 = new Date(Date.now() - 730 * 24 * 3600 * 1000);
  // max existing id
  const last = await p.topic.findFirst({orderBy: {id: 'desc'}, select: {id: true, number: true}});
  const t = await p.topic.create({data: {
    id: last.id + 1,
    number: last.number + 1,
    title: '[AT] Архивная тема старше года',
    authorName: 'Гость',
    rubricId: 49,
    createdAt: yearAgo2,
    lastActivityAt: yearAgo2,
    lastAuthorName: 'Гость',
  }});
  const m = await p.message.create({data: {topicId: t.id, num: 1, authorName: 'Гость', body: 'Старое обсуждение, которому больше года. Должно быть в архиве и закрыто для ответов.', createdAt: yearAgo2}});
  console.log('created stale topic id:', t.id, 'lastActivity:', t.lastActivityAt.toISOString().slice(0,10));
  await p.$disconnect();
})();
