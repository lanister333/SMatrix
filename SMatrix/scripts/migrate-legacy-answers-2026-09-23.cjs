/**
 * ТЗ 2026-09-23 «Ответить»: миграцияLegacy-ответов.
 * Раньше у карточки был только ОДИН ответ (answerText/answerAuthorName).
 * Новый ТЗ: ПЛОСКИЙ СПИСОК ответов (таблицы WhereToBuyAnswer/CheapAnswer).
 * Скрипт переносит старые одиночные ответы в новые таблицы (идемпотентно:
 * дубль не создаётся, если ответ с той же парой автор+текст уже есть).
 */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function migrate(model, answerModel, key) {
  const posts = await model.findMany({
    where: { answerText: { not: "" } },
    select: { id: true, answerText: true, answerAuthorName: true, answeredAt: true },
  });
  let created = 0;
  for (const p of posts) {
    const exists = await answerModel.findFirst({
      where: { postId: p.id, text: p.answerText, authorName: p.answerAuthorName },
    });
    if (exists) continue;
    await answerModel.create({
      data: {
        postId: p.id,
        text: p.answerText,
        authorName: p.answerAuthorName || "Аноним",
        ...(p.answeredAt ? { createdAt: p.answeredAt } : {}),
      },
    });
    created++;
  }
  console.log(`${key}: постов с legacy-ответом ${posts.length}, создано ответов ${created}`);
}

(async () => {
  await migrate(db.whereToBuyPost, db.whereToBuyAnswer, "WTB");
  await migrate(db.cheapPost, db.cheapAnswer, "CD");
  await db.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
