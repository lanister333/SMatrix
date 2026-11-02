/**
 * ТЗ 2026-09-26 «Три реальные публикации + удаление тестовых».
 * Запуск: cd /home/z/my-project && bun scripts/seed-recommend-real.ts
 *
 * 1) Удаляет 4 тестовых RecPost: «Ателье на Сахарной», «Автосервис на
 *    Комсомольской», «Мастер на час Иван», «Мебельный цех на Ленина».
 * 2) Создаёт 3 реальные публикации с конкретным текстом (если их ещё нет):
 *    - IslandVibe_65 — Пуркаева, 21.09.2026, «Предупреждаю» (пян-се,
 *      упоминание Натальи, ответ организации про сбой оборудования).
 *    - Aniva_Drift — Стародубское/Корсаков, 18.09.2026, «Рекомендую»
 *      (консоль из плавника, упоминание мастера Игоря, ответ организации).
 *    - Korsakov_Fish — Корсаков/ЮС, 20.09.2026, «Предупреждаю» (икра
 *      горбушовая, без упоминания, ответ организации про претензию).
 * 3) Корректно выставляет createdAt и stanceAt по ТЗ.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // 1) Найдём автора (первый пользователь в БД).
  const author = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!author) {
    console.error("❌ Нет пользователя в БД — сначала создайте пользователя.");
    process.exit(1);
  }
  console.log(`Автор публикаций: ${author.nickname} (id=${author.id})\n`);

  // 2) Удалим тестовые записи (по началу subject).
  const testSubjects = [
    "Ателье на Сахарной",
    "Автосервис на Комсомольской",
    "Мастер на час Иван",
    "Мебельный цех на Ленина",
  ];
  console.log("=== Удаляем тестовые записи ===");
  for (const subj of testSubjects) {
    const found = await prisma.recPost.findMany({
      where: { subject: { startsWith: subj } },
      select: { id: true, subject: true, title: true, stance: true },
    });
    for (const p of found) {
      await prisma.recPost.delete({ where: { id: p.id } });
      console.log(`  ❌ DELETE ${p.id} | ${p.stance} | ${p.subject} — ${p.title}`);
    }
  }

  // 3) Создадим 3 реальные публикации (если их ещё нет — защита от дублей).
  const realPosts = [
    {
      subject: "IslandVibe_65 — точка на Пуркаева",
      stance: "notrecommend",
      title: "Пян-се на Пуркаева — качество подвело",
      text: "Взяли пян-се на вынос в точке на Пуркаева. Тесто влажное, начинки наполовину меньше обычного, капуста не доведена до вкуса. Всегда покупали здесь, но в этот раз качество подвело.",
      place: "Южно-Сахалинск, ул. Пуркаева",
      humanHighlight: "Отдельно отмечу продавца Наталью — вежливая, быстро рассчитала, к её работе вопросов нет.",
      orgResponseText: "Провели проверку технологических карт на точке Пуркаева за 21.09. Выявлен технический сбой в работе парового оборудования. Смена поваров отправлена на переаттестацию. Благодарим за сигнал о качестве.",
      orgResponseAt: new Date("2026-09-22T10:00:00Z"),
      orgResponseById: author.id,
      orgResponseByName: "Представитель IslandVibe",
      createdAt: new Date("2026-09-21T12:00:00Z"),
      stanceAt: new Date("2026-09-21T12:00:00Z"),
    },
    {
      subject: "Aniva_Drift — мастерская дерева",
      stance: "recommend",
      title: "Консоль из плавника — премиум-уровень",
      text: "Заказали консоль из плавника, собранного на побережье Стародубского. Работа ювелирная, уникальная текстура дерева сохранена идеально. Доставили в Корсаков в надёжной деревянной обрешетке. Настоящий премиум-уровень.",
      place: "с. Стародубское / Корсаков",
      humanHighlight: "Мастер Игорь лично созванивался для согласования трещин и изгибов дерева. Профессионал.",
      orgResponseText: "Благодарим за оценку нашего труда. Каждая деталь из плавника уникальна и обрабатывается вручную. Рады, что консоль заняла достойное место в вашем интерьере.",
      orgResponseAt: new Date("2026-09-19T12:00:00Z"),
      orgResponseById: author.id,
      orgResponseByName: "Мастерская Aniva_Drift",
      createdAt: new Date("2026-09-18T14:00:00Z"),
      stanceAt: new Date("2026-09-18T14:00:00Z"),
    },
    {
      subject: "Korsakov_Fish — корсаковский цех",
      stance: "notrecommend",
      title: "Икра горбушовая — солёная сверх меры",
      text: "Купил банку горбушовой икры (крупный зернистый посол, Корсаковский производитель) в супермаркете Южно-Сахалинска. Икра солёная сверх меры, на дне банки отстой (влага). Явно нарушили температурный режим при транспортировке или хранении на витрине магазина.",
      place: "Корсаков / Южно-Сахалинск",
      humanHighlight: "",
      orgResponseText: "Мы дорожим репутацией нашего корсаковского цеха. Данная партия ушла с завода с протоколом соответствия ТУ. Направлена официальная претензия в адрес розничной торговой сети для проверки работы их холодильных витрин.",
      orgResponseAt: new Date("2026-09-21T08:00:00Z"),
      orgResponseById: author.id,
      orgResponseByName: "Korsakov_Fish",
      createdAt: new Date("2026-09-20T15:00:00Z"),
      stanceAt: new Date("2026-09-20T15:00:00Z"),
    },
  ];

  console.log("\n=== Создаём 3 реальные публикации ===");
  for (const p of realPosts) {
    // Проверка дублей по subject.
    const existing = await prisma.recPost.findFirst({
      where: { subject: p.subject },
      select: { id: true, createdAt: true },
    });
    if (existing) {
      // Обновим даты/поля (на случай если запись есть, но даты откатились).
      await prisma.recPost.update({
        where: { id: existing.id },
        data: {
          stance: p.stance,
          title: p.title,
          text: p.text,
          place: p.place,
          humanHighlight: p.humanHighlight,
          orgResponseText: p.orgResponseText,
          orgResponseAt: p.orgResponseAt,
          orgResponseById: p.orgResponseById,
          orgResponseByName: p.orgResponseByName,
          createdAt: p.createdAt,
          stanceAt: p.stanceAt,
          authorId: author.id,
          authorName: author.nickname,
        },
      });
      console.log(`  ↻ UPDATE ${existing.id} | ${p.stance} | ${p.subject}`);
    } else {
      const post = await prisma.recPost.create({
        data: { ...p, authorId: author.id, authorName: author.nickname } as any,
      });
      console.log(`  ✓ CREATE ${post.id} | ${post.stance} | ${post.subject}`);
    }
  }

  // 4) Итоговая сводка.
  console.log("\n=== ИТОГОВЫЕ ЗАПИСИ ===");
  const remain = await prisma.recPost.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      subject: true, stance: true, title: true, place: true,
      humanHighlight: true, orgResponseText: true, orgResponseByName: true,
      createdAt: true, stanceAt: true, orgResponseAt: true,
    },
  });
  console.log(`Всего: ${remain.length}`);
  for (const p of remain) {
    console.log(`\n[${p.stance === "recommend" ? "Рекомендую" : "Предупреждаю"}] ${p.subject}`);
    console.log(`  title      : ${p.title}`);
    console.log(`  place      : ${p.place}`);
    console.log(`  createdAt  : ${p.createdAt.toISOString()}`);
    console.log(`  humanHigh  : ${p.humanHighlight?.slice(0, 100) ?? "(пусто)"}`);
    console.log(`  orgRespBy : ${p.orgResponseByName}`);
    console.log(`  orgRespAt : ${p.orgResponseAt?.toISOString() ?? "(null)"}`);
    console.log(`  orgResp   : ${p.orgResponseText?.slice(0, 140) ?? "(пусто)"}...`);
  }
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
