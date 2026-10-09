/**
 * ТЗ 2026-09-23 «Единый вид 7 сценариев»: сценарий 7 (Cybex) переведён
 * из полноценной публикации в ленте «Где купить» в компактную карточку
 * панели e2e-transfer-test-panel. Публикация мягко удаляется (isDeleted),
 * тема обсуждения #176 СОХРАНЯЕТСЯ — она приёмник кнопки «Обсудить на
 * форуме» карточки (слаг topic-cybex-777 → 176 в route.ts).
 * Идемпотентно. Запуск: node scripts/cybex-post-to-panel-2026-09-23.cjs
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const post = await p.whereToBuyPost.findFirst({
    where: { OR: [{ title: { contains: 'Cybex Solution' } }, { text: { contains: 'Cybex Solution' } }] },
  });
  if (!post) {
    console.log('Cybex-публикация не найдена (уже удалена?) — нечего делать.');
    await p.$disconnect();
    return;
  }
  console.log('Найдена:', post.id, '| topicId:', post.topicId, '| isDeleted:', post.isDeleted);
  if (post.isDeleted) {
    console.log('Уже мягко удалена — идемпотентный выход.');
    await p.$disconnect();
    return;
  }
  const res = await p.whereToBuyPost.update({
    where: { id: post.id },
    data: { isDeleted: true, deletedAt: new Date() },
  });
  console.log('Мягко удалена:', res.id, '| isDeleted:', res.isDeleted, '| deletedAt:', res.deletedAt.toISOString());
  // Контроль: тема-приёмник жива
  const topic = await p.topic.findUnique({ where: { id: post.topicId ?? 176 }, select: { id: true, title: true } });
  console.log('Тема-приёмник сохранена:', JSON.stringify(topic));
  // Контроль: в живой ленте Cybex больше нет
  const left = await p.whereToBuyPost.count({ where: { OR: [{ title: { contains: 'Cybex' } }, { text: { contains: 'Cybex' } }], isDeleted: false } });
  console.log('Живых Cybex-публикаций в ленте:', left);
  await p.$disconnect();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
