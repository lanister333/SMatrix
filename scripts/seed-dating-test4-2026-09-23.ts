/**
 * ТЗ 2026-09-23 «Знакомства (Love Sakh)»: 4 тестовых сценария — по одному
 * на каждую вкладку, ДОСЛОВНЫЕ тексты заказчика (контакты открыты сразу:
 * Telegram / WhatsApp). Заменяет демо-сид этого же дня (4 заготовки раунда
 * реставрации): старые снимаются, чтобы на доске остался ровно тестовый
 * набор «по одному на вкладку».
 * Идемпотентно: если тестовый пост №1 уже есть — пропускает.
 * Запуск: bunx tsx scripts/seed-dating-test4-2026-09-23.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/** Маркеры тел старого демо-сида (снимаются только они, чужие посты не трогаем). */
const OLD_DEMO_MARKERS = [
  "@sakh_travel65",
  "+7 914 000-00-00",
  "@holm_games",
  "vk.com/olga_sakh",
];

/** 4 тестовых сценария ТЗ — тексты 1-в-1 (без внешних «» заказа). */
const TEST4 = [
  {
    category: "m4w",
    place: "Корсаков",
    authorName: "Роман_Корсаков",
    hoursAgo: 4,
    body:
      "Переехал в Корсаков год назад, работаю в порту. Легкий на подъем, каждые выходные выезжаю на природу — Анива, Буссе, Новиково. Ищу девушку для серьезных отношений и создания семьи, которая разделит мои интересы. Пишите в Telegram: @korsakov_active или WhatsApp: 8-924-111-AA-BB",
  },
  {
    category: "w4m",
    place: "Южно-Сахалинск",
    authorName: "Наталья_ЮС",
    hoursAgo: 3,
    body:
      "Ищу надежного, честного человека для жизни. Люблю домашний уют, кулинарию, книги и тихие прогулки по городу. Сама спокойная, без вредных привычек. Мой номер для связи (звонки или сообщения в WhatsApp): 8-914-000-CC-DD",
  },
  {
    category: "friendship",
    place: "Холмск",
    authorName: "Мария_Холмск",
    hoursAgo: 2,
    body:
      "Недавно вернулась на Сахалин, все старые друзья разъехались. Ищу девчонок из Холмска для простого человеческого общения, совместных прогулок по набережной, походов в кино и разговоров за кофе. Пишите в Telegram: @holmsk_girl, буду рада знакомству!",
  },
  {
    category: "person",
    place: "Южно-Сахалинск / Долинская трасса",
    authorName: "Ольга_ЮС",
    hoursAgo: 1,
    body:
      "Ищу парня на сером Делика, который вчера вечером (22 сентября) спас меня на трассе в районе Березняков. У меня заглох мотор, я стояла на обочине в полной темноте, все проезжали мимо. Ты остановился, отбуксировал мою машину до самого дома в Южном, отказался от денег и быстро уехал. Я даже имя спросить не успела от шока! Отзовись, добрый человек, хочу отблагодарить за спасение. Мой WhatsApp: 8-924-222-EE-FF",
  },
];

async function main() {
  const existing = await db.datingPost.findFirst({
    where: { body: { contains: "@korsakov_active" } },
  });
  if (existing) {
    console.log("Тестовые 4 объявления уже есть — сид пропущен");
    return;
  }

  // Старые демо-заготовки снимаем (по маркерам тел — только свои сид-посты).
  const gone = await db.datingPost.deleteMany({
    where: { OR: OLD_DEMO_MARKERS.map((m) => ({ body: { contains: m } })) },
  });
  console.log("Старых демо-объявлений удалено:", gone.count);

  const author = await db.user.findFirst({ where: { role: { in: ["owner", "admin"] } } });
  for (const d of TEST4) {
    // Заголовок выводится из текста (первая строка, до 60) — как в API.
    await db.datingPost.create({
      data: {
        category: d.category,
        title: d.body.split("\n")[0].slice(0, 60),
        body: d.body,
        place: d.place,
        authorId: author?.id ?? "seed",
        authorName: d.authorName,
        status: "actual",
        aiStatus: "ok",
        // Разные часы назад: порядок «новые сверху» детерминирован.
        createdAt: new Date(Date.now() - d.hoursAgo * 3600 * 1000),
      },
    });
    console.log(`+ [${d.category}] ${d.place} — ${d.authorName}`);
  }
  console.log("Тестовые объявления созданы:", TEST4.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
