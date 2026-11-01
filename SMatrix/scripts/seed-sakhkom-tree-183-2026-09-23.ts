/**
 * РЕСТАВРАЦИЯ 2026-09-23: контрольная тема #183 «лесенка Сахкома»
 * (сид-скрипт seed-sakhkom-tree-183-2026-09-23.ts потерян при откате
 * воркспейса; структура восстановлена по worklog: ровно 6 сообщений
 * #1..#6, уровни [1,1,1,1,2,3], ответы-на-ответ #5→#2 и #6→#5 —
 * ровно 2 SVG-линии, цитаты у всех ответов, без аватаров).
 * Запуск: bunx tsx scripts/seed-sakhkom-tree-183-2026-09-23.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const exists = await db.topic.findUnique({ where: { id: 183 } });
  if (exists) {
    console.log("Тема 183 уже существует — сид пропущен");
    return;
  }
  const admin = await db.user.findFirst({ where: { role: { in: ["owner", "admin"] } } });
  const guest = await db.user.findFirst({ where: { nickname: "гость222" } });

  const topic = await db.topic.create({
    data: {
      id: 183,
      number: 183,
      title: "Проверка лесенки Сахкома: ответы, линии и цитаты",
      authorName: admin?.nickname ?? "Админ",
      authorId: admin?.id ?? null,
      rubricId: 120,
      views: 48,
      lastAuthorName: "Гость",
    },
  });

  // #1 — корневой пост (ответы на автора темы цитируют его, parentId пуст)
  const m1 = await db.message.create({
    data: {
      topicId: topic.id,
      num: 1,
      authorName: admin?.nickname ?? "Админ",
      authorId: admin?.id ?? null,
      body:
        "Где найти свежую горбушу по минимальной цене напрямую от рыбаков?\n" +
        "Интересует оптовая покупка в сезон — август-сентябрь, посоветуйте проверенные места.",
    },
  });

  // #2..#4 — ответы на автора темы (уровень 1, цитата корневого поста)
  const m2 = await db.message.create({
    data: {
      topicId: topic.id,
      num: 2,
      authorName: "Гость",
      authorId: guest?.id ?? null,
      body: "Все перекупщики уроды, задрали ценник на рыбу в два раза!",
    },
  });
  const m3 = await db.message.create({
    data: {
      topicId: topic.id,
      num: 3,
      authorName: "Гость",
      authorId: guest?.id ?? null,
      body:
        "Дополнение к вопросу: интересует рыба именно свежего вылова, заморозка не подходит. " +
        "Самовывоз или доставка по городу — обсудимо.",
    },
  });
  await db.message.create({
    data: {
      topicId: topic.id,
      num: 4,
      authorName: "Гость",
      authorId: guest?.id ?? null,
      body: "Объём — от пяти килограммов, бюджет до 350 р. за кг. Жду варианты в личку или прямо в тему.",
    },
  });

  // #5 — ответ на #2 (уровень 2, SVG-линия #5→#2)
  const m5 = await db.message.create({
    data: {
      topicId: topic.id,
      num: 5,
      parentId: m2.id,
      depth: 1,
      authorName: "Гость",
      authorId: guest?.id ?? null,
      body:
        "По делу: без наценки перекупщиков продают на причале в Холмске и на рынке в Морежедке, " +
        "лучше приезжать к шести утра.",
    },
  });

  // #6 — ответ на #5 (уровень 3, SVG-линия #6→#5)
  await db.message.create({
    data: {
      topicId: topic.id,
      num: 6,
      parentId: m5.id,
      depth: 2,
      authorName: "Гость",
      authorId: guest?.id ?? null,
      body:
        "Подтверждаю про Морежедку, беру там постоянно — цены самые низкие в городе, торговаться не нужно.",
    },
  });

  console.log("Тема 183 создана: 6 сообщений, линии #5→#2 и #6→#5");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
