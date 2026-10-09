/**
 * РЕСТАВРАЦИЯ+ТЗ 2026-09-23 «Знакомства»: демо-объявления для проверки
 * ленты (4 вкладки, контакты открыты, новые сверху). Идемпотентно:
 * пропускает, если демо-посты уже есть.
 * Запуск: bunx tsx scripts/seed-dating-demo-2026-09-23.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DEMO = [
  {
    category: "m4w",
    place: "Южно-Сахалинск",
    authorName: "sakh_travel65",
    body:
      "Южно-Сахалинск. Часто выезжаю на охоту и рыбалку, лёгкий на подъём. " +
      "Ищу спутницу жизни для поездок по острову и создания семьи. " +
      "Пишите мне в Telegram: @sakh_travel65",
  },
  {
    category: "w4m",
    place: "Корсаков",
    authorName: "Марина_К",
    body:
      "Корсаков. Познакомлюсь с серьёзным мужчиной 35-45 лет для отношений и совместных поездок к морю. " +
      "Без вредных привычек. WhatsApp: +7 914 000-00-00 — пишите сразу, звонки не беру.",
  },
  {
    category: "friendship",
    place: "Холмск",
    authorName: "Дмитрий_Х",
    body:
      "Холмск. Ищу компанию для настольных игр и бадминтона по выходным. " +
      "Возраст и пол не важны, главное — чувство юмора. Telegram: @holm_games",
  },
  {
    category: "person",
    place: "Южно-Сахалинск",
    authorName: "Ольга_С",
    body:
      "Южно-Сахалинск. Ищу водителя, который вытащил машину из сугроба на Лесном 20 сентября, " +
      "вы оставили трос и уехали без благодарности. Хочу сказать спасибо и вернуть трос! " +
      "Пишите в ВК: vk.com/olga_sakh",
  },
];

async function main() {
  const existing = await db.datingPost.findFirst({
    where: { body: { contains: "@sakh_travel65" } },
  });
  if (existing) {
    console.log("Демо-объявления уже есть — сид пропущен");
    return;
  }
  const author = await db.user.findFirst({ where: { role: { in: ["owner", "admin"] } } });
  for (const [i, d] of DEMO.entries()) {
    await db.datingPost.create({
      data: {
        category: d.category,
        title: d.body.split("\n")[0].slice(0, 60),
        body: d.body,
        place: d.place,
        authorId: author?.id ?? "seed",
        authorName: d.authorName,
        status: "actual",
        createdAt: new Date(Date.now() - (DEMO.length - i) * 3600 * 1000),
      },
    });
  }
  console.log("Демо-объявления созданы:", DEMO.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
