/**
 * SEED — Тема 1: сантехник для частного дома.
 *
 * Источник: копия темы с Sakh.com (без заголовка в копии — заголовок составлен по содержанию).
 *
 * Что делает:
 *  1. Создаёт публикацию WhereToBuyPost (postType=service, status=seeking)
 *     в разделе «Где купить», с автором = рандомный женский бот.
 *  2. Создаёт тему форума Topic в рубрике wheretobuy-discuss (id=132).
 *  3. Создаёт 11 сообщений с деревом ответов (parentId / depth).
 *  4. Связывает WhereToBuyPost.topicId = topic.id.
 *
 * Запуск:
 *   cd /home/z/my-project/SMatrix && \
 *   DATABASE_URL="file:/home/z/my-project/SMatrix/db/custom.db" \
 *   bun run scripts/seed-topic-1-santehnik.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Все даты — в Сахалинском времени (UTC+11), через ISO с offset,
// Prisma/SQLite сохранит как UTC.
const T = (s: string) => new Date(s);

// Даты из оригинала (28, 30, 31 октября 2026)
const DATES = {
  topic:      T("2026-10-28T12:00:00+11:00"), // Yaponochka — текст темы
  korennoy:   T("2026-10-28T13:10:00+11:00"), // Коренной_неместный (depth 0)
  yapo_k:     T("2026-10-28T13:41:00+11:00"), // Yaponochka → Коренной (depth 1)
  kirill:     T("2026-10-28T13:12:00+11:00"), // 6060Кирилл (depth 0)
  yapo_kir:   T("2026-10-28T13:42:00+11:00"), // Yaponochka → Кирилл (depth 1)
  hottey:     T("2026-10-28T13:54:00+11:00"), // hottey_07 (depth 0)
  yapo_hot:   T("2026-10-28T18:58:00+11:00"), // Yaponochka → hottey (depth 1)
  whoami:     T("2026-10-28T14:32:00+11:00"), // who-am-i (depth 0)
  viktor:     T("2026-10-28T14:48:00+11:00"), // Викторыч → who-am-i (depth 1)
  nastya:     T("2026-10-30T15:18:00+11:00"), // Nastya_dnchnk (depth 0)
  cs:         T("2026-10-31T19:27:00+11:00"), // cs (depth 0)
};

// Пул ботов (из scripts/_bot-pool.ts)
const BOT_POOL = [
  { id: "cmae2ca294af746c6dfd7519b1", nickname: "Штурман",       gender: "male"   },
  { id: "cm0d9f04906a26cd5731c97fe3", nickname: "Егерь",          gender: "male"   },
  { id: "cmad71f9ef4a2605e6a584a2c2", nickname: "Турист",         gender: "male"   },
  { id: "cm548b8461aed31bb3b2034a1e", nickname: "Ворчун",         gender: "male"   },
  { id: "cme427065c90b6d82def0945f8", nickname: "Михалыч",        gender: "male"   },
  { id: "cm54b776d1c56a46a9d2b79f1c", nickname: "Серёга",         gender: "male"   },
  { id: "cm3f83de95394840d09afadb71", nickname: "Толян",          gender: "male"   },
  { id: "cmaecae86b39395a4b93f0e7f0", nickname: "Хозяйка",        gender: "female" },
  { id: "cm11d8ed6ebec46a8b289b890a", nickname: "Дачница",        gender: "female" },
  { id: "cm77b60573d2fc102031fb6e13", nickname: "пассажир",       gender: "male"   },
  { id: "cmaeccbb90417127cd5481c24f", nickname: "свояк",          gender: "male"   },
  { id: "cmd12b2cf7298556e8defb9f48", nickname: "попутчица",       gender: "female" },
  { id: "cmf73a14dd64e89d04955a3478", nickname: "мамочка",        gender: "female" },
  { id: "cm041530563b49eaded88dd721", nickname: "кошатница",      gender: "female" },
  { id: "cmc730bb3d50dc8500bed785ee", nickname: "Boss",          gender: "male"   },
  { id: "cm3b2293dab55cd627f446def5", nickname: "Caesar",         gender: "male"   },
  { id: "cm1a2dd90785694c2bf10598b0", nickname: "Churchill",      gender: "male"   },
  { id: "cm9598f74d49f9f316a4cfafb6", nickname: "Plato",          gender: "male"   },
  { id: "cm3db4c94906c10d06b7aef711", nickname: "driver",         gender: "male"   },
  { id: "cm07c3cf6a6a4a0df6bb01292c", nickname: "hunter",         gender: "male"   },
  { id: "cmfa933f86b2789e39aa0dfe97", nickname: "biker",          gender: "male"   },
  { id: "cm44ba551e69c4e44b1b741da0", nickname: "newton",         gender: "male"   },
  { id: "cm5854a25ea8be1c346c9b8989", nickname: "lincoln",        gender: "male"   },
  { id: "cm615c6ab99de18d581b68b607", nickname: "napoleon",       gender: "male"   },
  { id: "cmdcf18e4032759a0be8d370d6", nickname: "Lady",          gender: "female" },
  { id: "cm572b2e966d33fa49000e02ee", nickname: "cleopatra",      gender: "female" },
  { id: "cm861b5f71f0c0da79c08fc98b", nickname: "eva",            gender: "female" },
  { id: "cm00733f9bc897201d9dd39b38", nickname: "Fox",          gender: "female" },
  { id: "cmedc2b0fcb3ddf7fee48fae82", nickname: "sandra",        gender: "female" },
  { id: "cmbf7e1033bf0ae163eb539d5c", nickname: "vovan",          gender: "male"   },
  { id: "cm4bc9912e0970e06452422ae2", nickname: "svoyak",         gender: "male"   },
  { id: "cm51fe3c54a48a6393165a3c2b", nickname: "vsedorozhnik",  gender: "male"   },
  { id: "cm364f3ee2942e51add3189eb3", nickname: "garazh",         gender: "male"   },
  { id: "cm60ebeb97e2b8e79504a19e68", nickname: "sanek",          gender: "male"   },
  { id: "cm05048e07ed5441ecaeaacd1c", nickname: "tolyan",         gender: "male"   },
  { id: "cm04adab7125c6779f60983b07", nickname: "mikhalych",      gender: "male"   },
  { id: "cm8ceef64e75e37bd743cbb991", nickname: "ribak",          gender: "male"   },
  { id: "cm87128505519852cd1b3533ef", nickname: "kabanchik",      gender: "male"   },
  { id: "cm38ede29286bb318cebca69e6", nickname: "putnik",         gender: "male"   },
  { id: "cm7f785e152b65413454ab3f65", nickname: "khozyayka",      gender: "female" },
  { id: "cmfd95dd16bd3a64013983b70d", nickname: "blondinka",      gender: "female" },
  { id: "cmc7ce54480773f7c6ca01e550", nickname: "mamochka",       gender: "female" },
  { id: "cm635726dfdad2b0a05ac18765", nickname: "poputchica",     gender: "female" },
  { id: "cme61355435c522f85103de7b6", nickname: "lenka",          gender: "female" },
];

function pickBot(gender: "male" | "female", excludeIds: string[] = []) {
  const pool = BOT_POOL.filter(b => !excludeIds.includes(b.id) && b.gender === gender);
  if (pool.length === 0) {
    const any = BOT_POOL.filter(b => !excludeIds.includes(b.id));
    return any[Math.floor(Math.random() * any.length)] ?? BOT_POOL[0];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

async function main() {
  // 1. Рандомные боты по гендеру
  // Yaponochka — женщина (4 сообщения). Все 4 идут от ОДНОГО бота.
  const yapoBot = pickBot("female");

  // Каждый из остальных авторов — отдельный рандомный бот, без повторений
  // (исключаем yapoBot и ранее выбранных).
  const used = new Set<string>([yapoBot.id]);

  const pickExcl = (g: "male" | "female") => {
    const b = pickBot(g, [...used]);
    used.add(b.id);
    return b;
  };

  // Гендеры:
  // Коренной_неместный — м
  // 6060Кирилл — м (по нику «Кирилл»)
  // hottey_07 — ж (по договорённости)
  // who-am-i — м
  // Викторыч — м (по нику «Викторыч»)
  // Nastya_dnchnk — ж (по нику «Nastya»)
  // cs — м (по умолчанию)
  const korennoyBot = pickExcl("male");
  const kirillBot   = pickExcl("male");
  const hotteyBot   = pickExcl("female");
  const whoamiBot   = pickExcl("male");
  const viktorBot   = pickExcl("male");
  const nastyaBot   = pickExcl("female");
  const csBot       = pickExcl("male");

  console.log("=== Выбранные боты ===");
  console.log("Yaponochka (тема + 3 ответа):", yapoBot.nickname, `(${yapoBot.id})`);
  console.log("Коренной_неместный:", korennoyBot.nickname, `(${korennoyBot.id})`);
  console.log("6060Кирилл:", kirillBot.nickname, `(${kirillBot.id})`);
  console.log("hottey_07:", hotteyBot.nickname, `(${hotteyBot.id})`);
  console.log("who-am-i:", whoamiBot.nickname, `(${whoamiBot.id})`);
  console.log("Викторыч:", viktorBot.nickname, `(${viktorBot.id})`);
  console.log("Nastya_dnchnk:", nastyaBot.nickname, `(${nastyaBot.id})`);
  console.log("cs:", csBot.nickname, `(${csBot.id})`);

  // 2. Тексты (лёгкий рерайт)
  const topicTitle = "Подскажите толкового сантехника для частного дома";
  const topicBodyText = "Добрый день, форумчане! Подскажите, пожалуйста, толкового сантехника по адекватной цене — нужно посмотреть трубы и батареи в частном доме.";

  const answers = [
    // depth=0 — ответы на тему
    { author: korennoyBot, body: "Написал вам в личные сообщения.",                                       createdAt: DATES.korennoy, parentKey: null,        key: "korennoy" },
    { author: kirillBot,   body: "89025588388",                                                            createdAt: DATES.kirill,   parentKey: null,        key: "kirill"   },
    { author: hotteyBot,   body: "Если вдруг предыдущие варианты не подойдут — звоните +79146439295. Толковый, проверенный сантехник.", createdAt: DATES.hottey, parentKey: null,        key: "hottey"   },
    { author: whoamiBot,   body: "Хм, ну батареи и трубы посмотреть любой мужчина сможет. Лучше опишите проблему: как работало, когда перестало, что внутри труб. Обычно в частном доме ломаться особо нечему — вода в системе своя, не меняется, может годами работать.", createdAt: DATES.whoami, parentKey: null,        key: "whoami"   },
    { author: nastyaBot,   body: "89242804973 Николай",                                                    createdAt: DATES.nastya,   parentKey: null,        key: "nastya"   },
    { author: csBot,       body: "Добрый вечер. Звоните: 89621205424",                                     createdAt: DATES.cs,       parentKey: null,        key: "cs"       },
    // depth=1 — ответы на ответы
    { author: yapoBot,     body: "Спасибо 🙏",                                                              createdAt: DATES.yapo_k,   parentKey: "korennoy",   key: "yapo_k"   },
    { author: yapoBot,     body: "Спасибо!",                                                                 createdAt: DATES.yapo_kir, parentKey: "kirill",     key: "yapo_kir" },
    { author: yapoBot,     body: "Спасибо 🙏",                                                              createdAt: DATES.yapo_hot, parentKey: "hottey",     key: "yapo_hot" },
    { author: viktorBot,   body: "Только посмотреть?",                                                       createdAt: DATES.viktor,   parentKey: "whoami",     key: "viktor"   },
  ];

  // 3. Транзакция: WhereToBuyPost → Topic → 11 Messages → связь
  const result = await prisma.$transaction(async (tx) => {
    // 3a. WhereToBuyPost
    const post = await tx.whereToBuyPost.create({
      data: {
        title: topicTitle,
        text: topicBodyText,
        place: "",
        postType: "service",
        status: "seeking",
        authorId: yapoBot.id,
        authorName: yapoBot.nickname,
        aiStatus: "ok",
        isHiddenByAi: false,
        createdAt: DATES.topic,
        statusAt: DATES.topic,
      },
    });

    // 3b. Topic (rubricId=132 — wheretobuy-discuss, уже существует)
    const last = await tx.topic.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    const number = (last?.number ?? 0) + 1;
    const fullTopicTitle = `Обсуждение: ${topicTitle}`.slice(0, 150);

    const topic = await tx.topic.create({
      data: {
        number,
        title: fullTopicTitle,
        authorName: yapoBot.nickname,
        authorId: yapoBot.id,
        rubricId: 132, // wheretobuy-discuss
        lastAuthorName: csBot.nickname, // последнее сообщение в хронологии
        createdAt: DATES.topic,
        lastActivityAt: DATES.cs, // последнее сообщение
        whereToBuyPost: { connect: { id: post.id } },
      },
    });

    // 3c. Message #1 — тело темы
    const firstBody = `${topicTitle}\n\n${topicBodyText}`;
    await tx.message.create({
      data: {
        topicId: topic.id,
        num: 1,
        authorName: yapoBot.nickname,
        authorId: yapoBot.id,
        body: firstBody,
        kind: "advice",
        createdAt: DATES.topic,
      },
    });

    // 3d. Остальные сообщения с деревом
    // Сначала создаю depth=0 (parent — null), потом depth=1 (parent — конкретное сообщение)
    const keyToMsgId = new Map<string, string>();

    const depth0 = answers.filter(a => a.parentKey === null);
    const depth1 = answers.filter(a => a.parentKey !== null);

    let num = 2;
    for (const a of depth0) {
      const msg = await tx.message.create({
        data: {
          topicId: topic.id,
          num: num++,
          authorName: a.author.nickname,
          authorId: a.author.id,
          body: a.body,
          kind: "advice",
          depth: 0,
          parentId: null,
          createdAt: a.createdAt,
        },
      });
      keyToMsgId.set(a.key, msg.id);
    }

    for (const a of depth1) {
      const parentMsgId = a.parentKey ? keyToMsgId.get(a.parentKey) : null;
      if (!parentMsgId) {
        throw new Error(`Не найден parent-сообщение для "${a.key}" (parentKey=${a.parentKey})`);
      }
      const msg = await tx.message.create({
        data: {
          topicId: topic.id,
          num: num++,
          authorName: a.author.nickname,
          authorId: a.author.id,
          body: a.body,
          kind: "advice",
          depth: 1,
          parentId: parentMsgId,
          createdAt: a.createdAt,
        },
      });
      keyToMsgId.set(a.key, msg.id);
    }

    // 3e. Связь: WhereToBuyPost.topicId = topic.id
    await tx.whereToBuyPost.update({ where: { id: post.id }, data: { topicId: topic.id } });

    return { post, topic, totalMessages: 1 + answers.length };
  });

  console.log("\n=== РЕЗУЛЬТАТ ===");
  console.log("WhereToBuyPost id:", result.post.id);
  console.log("Topic id:", result.topic.id, "| number:", result.topic.number, "| title:", result.topic.title);
  console.log("Всего сообщений:", result.totalMessages);

  // Проверка — выведем всё дерево
  const allMsgs = await prisma.message.findMany({
    where: { topicId: result.topic.id },
    orderBy: { num: "asc" },
    select: { num: true, depth: true, parentId: true, authorName: true, body: true, createdAt: true },
  });

  console.log("\n=== ДЕРЕВО СООБЩЕНИЙ ===");
  for (const m of allMsgs) {
    const indent = "  ".repeat(m.depth);
    const date = m.createdAt.toISOString().replace("T", " ").slice(0, 16) + " UTC";
    const body = m.body.length > 80 ? m.body.slice(0, 80) + "…" : m.body;
    console.log(`#${m.num} [${date}] ${indent}${m.authorName}: ${body}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("ERROR:", e);
  await prisma.$disconnect();
  process.exit(1);
});
