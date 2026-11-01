/**
 * Сид 2026-09-23 — «специальная ветка форума» для раздела
 * «Знакомства (Love Sakh)» (/znakomstva).
 *
 * Указ заказчика 2026-09-23 «добавляй кнопку»: текст «О разделе» обещает
 * «кнопку для перехода в специальную ветку форума» под публикациями
 * вкладки «Ищу человека / Благодарность». Ветка создаётся по образцу
 * тем-приёмников других разделов:
 *   — служебная рубрика «Обсуждение сообщений из блоков» (id=131,
 *     service=true) ▸ ребёнок «Знакомства (Love Sakh)» (как 132–136
 *     у «Где купить»/«ЖКХ»/«Где дешевле»/«Рекомендую»/«О работодателях»);
 *   — тема Topic.id=179 (id фиксирован: числовой путь /forum/topic/179
 *     роут-адаптер src/app/forum/topic/[topicId]/route.ts переводит в
 *     /?topic=179; TSX-кнопка ссылается на константу), source =
 *     "lovesakh-transfer" (маркер переноса, как "wtb-hints-transfer");
 *   — вводное сообщение от «Админ».
 *
 * Скрипт ИДЕМПОТЕНТЕН: повторный запуск ничего не ломает (рубрика — по
 * уникальному слагу, тема — по id=179; существующие записи не трогаем).
 */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const RUBRIC_SLUG = "znakomstva-discuss";
const RUBRIC_NAME = "Знакомства (Love Sakh)";
const PARENT_RUBRIC_ID = 131; // «Обсуждение сообщений из блоков» (service)
const TOPIC_ID = 179;

const TOPIC_TITLE = "Истории благодарности: спасители и герои сахалинских дорог";
const TOPIC_SOURCE = "lovesakh-transfer";

const INTRO_BODY = [
  "Эта ветка — специальное место для продолжения историй из раздела «Знакомства (Love Sakh)», вкладка «Ищу человека / Благодарность».",
  "",
  "Если история разрослась — рассказывайте её здесь: кто вытащил из сугроба, кто помог в метель и уехал без имени, кого ищете, чтобы сказать спасибо.",
  "",
  "Правила действуют те же: без коммерции, рекламы, платных интим-услуг и массажа — такие аккаунты блокируются модератором навсегда.",
].join("\n");

(async () => {
  // 1. Рубрика (по уникальному слагу).
  let rubric = await db.rubric.findUnique({ where: { slug: RUBRIC_SLUG } });
  if (!rubric) {
    rubric = await db.rubric.create({
      data: { name: RUBRIC_NAME, slug: RUBRIC_SLUG, parentId: PARENT_RUBRIC_ID, isService: true },
    });
    console.log("RUBRIC CREATED:", rubric.id, rubric.slug);
  } else {
    console.log("RUBRIC EXISTS:", rubric.id, rubric.slug);
  }

  // 2. Тема-приёмник с фиксированным id=179.
  let topic = await db.topic.findUnique({ where: { id: TOPIC_ID } });
  if (!topic) {
    const last = await db.topic.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    const number = (last?.number ?? 0) + 1;
    topic = await db.topic.create({
      data: {
        id: TOPIC_ID,
        number,
        title: TOPIC_TITLE,
        authorName: "Админ",
        rubricId: rubric.id,
        source: TOPIC_SOURCE,
        lastAuthorName: "Админ",
      },
    });
    console.log("TOPIC CREATED:", topic.id, "number=", topic.number);
  } else {
    console.log("TOPIC EXISTS:", topic.id, "number=", topic.number);
  }

  // 3. Вводное сообщение (только если в теме ещё нет сообщений).
  const msgCount = await db.message.count({ where: { topicId: topic.id } });
  if (msgCount === 0) {
    await db.message.create({
      data: { topicId: topic.id, num: 1, authorName: "Админ", body: INTRO_BODY },
    });
    console.log("INTRO MESSAGE CREATED (num=1)");
  } else {
    console.log("MESSAGES ALREADY PRESENT:", msgCount);
  }

  const check = await db.topic.findUnique({
    where: { id: TOPIC_ID },
    select: { id: true, number: true, title: true, rubricId: true, source: true, _count: { select: { messages: true } } },
  });
  console.log("FINAL STATE:", JSON.stringify(check));
  await db.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
