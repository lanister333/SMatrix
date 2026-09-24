/**
 * Поиск Cybex-публикации в БД «Где купить» + её связанная тема форума.
 * Запуск: node scripts/db-find-cybex-2026-09-23.cjs
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const posts = await p.whereToBuyPost.findMany({
    where: { OR: [{ title: { contains: 'Cybex' } }, { text: { contains: 'Cybex' } }] },
  });
  console.log('=== WTB Cybex-публикации:', posts.length, '===');
  for (const r of posts) {
    console.log(JSON.stringify({
      id: r.id, title: r.title, text: r.text?.slice(0, 140),
      authorName: r.authorName, createdAt: r.createdAt,
      topicId: r.topicId, status: r.status, aiStatus: r.aiStatus,
      isHiddenByAi: r.isHiddenByAi, isDeleted: r.isDeleted,
    }, null, 2));
  }
  // темы-приёмники
  const topics = await p.forumTopic.findMany({
    where: { OR: [{ id: { in: [177, 178] } }, { title: { contains: 'Cybex' } }, { title: { contains: 'ГРМ' } }] },
    select: { id: true, title: true, sectionId: true, createdAt: true },
  });
  console.log('=== Темы форума (177/178 + Cybex/ГРМ):', topics.length, '===');
  for (const t of topics) console.log(JSON.stringify(t));
  await p.$disconnect();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
