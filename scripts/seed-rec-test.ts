/**
 * Seed: 6 тестовых отзывов «Рекомендую / Не рекомендую» с разными статусами.
 * Запуск:  bun scripts/seed-rec-test.ts
 *
 * Создаёт 6 публикаций для демонстрации всех возможных статусов:
 *   - 1 recommend (без resolved) — зелёная рамка
 *   - 1 notrecommend (без resolved) — красная рамка
 *   - 2 recommend + resolved=true — зелёная рамка + голубой бейдж «✓ Решено»
 *   - 2 notrecommend + resolved=true — красная рамка + голубой бейдж «✓ Решено»
 *
 * Если публикация с таким же subject уже есть — пропускаем (защита от дублей).
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const CITIES = ["Южно-Сахалинск", "Корсаков", "Холмск", "Долинск", "Анива"];

interface RecSeed {
  subject: string;
  stance: "recommend" | "notrecommend";
  title: string;
  text: string;
  place: string;
  humanHighlight?: string;
  resolved: boolean;
}

const SEED: RecSeed[] = [
  // ============ 1. recommend, resolved = false ============
  {
    subject: "Кафе «Уют» на Ленина",
    stance: "recommend",
    title: "Советую — Кафе «Уют» на Ленина",
    text: "Зашли на бизнес-ланч в будний день. Горячее, салат, суп — 380 руб. Вкусно, по-домашнему. Персонал вежливый,чисто. Рекомендую для тихого обеда.",
    place: "Южно-Сахалинск",
    humanHighlight: "Официантка Анна — приветливая, быстро обслужила, подсказала по меню.",
    resolved: false,
  },
  // ============ 2. notrecommend, resolved = false ============
  {
    subject: "Магазин «Продукты 24»",
    stance: "notrecommend",
    title: "Предупреждаю — Магазин «Продукты 24»",
    text: "Купил молоко, срок годности нормальный по этикетке. Дома открыл — кислое, запах неприятный. Пошёл возвращать — отказали, сказали «возврат только в день покупки». Это уже второй раз. Не рекомендую.",
    place: "Корсаков",
    resolved: false,
  },
  // ============ 3. recommend, resolved = true ============
  {
    subject: "Шиномонтаж «Колесо» на Сахалинской",
    stance: "recommend",
    title: "Советую — Шиномонтаж «Колесо» на Сахалинской",
    text: "Переобулся на зимнюю резину. Записался заранее — без очереди. Шиномонтажник Дмитрий показал износ протектора, посоветовал не менять одно колесо, а пару — по оси. Цена честная, 1800 руб за 4 колеса с балансировкой.",
    place: "Южно-Сахалинск",
    humanHighlight: "Мастер Дмитрий — профессионал, объяснил всё доходчиво.",
    resolved: true,
  },
  // ============ 4. notrecommend, resolved = true (проблема решилась) ============
  {
    subject: "Стоматология «Дента-Плюс»",
    stance: "notrecommend",
    title: "Предупреждаю — Стоматология «Дента-Плюс»",
    text: "Сначала записали на 12:00, пришли — ждали 40 минут без объяснений. Врач молодая девушка, но неуверенно ставила пломбу — переделывала 2 раза. Не рекомендую по записи.",
    place: "Холмск",
    resolved: true,
  },
  // ============ 5. recommend, resolved = true ============
  {
    subject: "Ателье «Иголочка»",
    stance: "recommend",
    title: "Советую — Ателье «Иголочка»",
    text: "Подшила зимнее пальто — за 1 день и 600 руб. Швы ровные, подкладку не испортили. Девушка-мастер подсказала, что лучше не укорачивать, а перешить — получилось аккуратнее. Рекомендую.",
    place: "Долинск",
    resolved: true,
  },
  // ============ 6. notrecommend, resolved = true ============
  {
    subject: "Прачечная «Свежесть»",
    stance: "notrecommend",
    title: "Предупреждаю — Прачечная «Свежесть»",
    text: "Сдала постельное бельё на стирку. Забрала — на наволочке оказалось пятно от ржавчины, которого не было. Сначала отказались компенсировать, потом перезвонили, извинились, вернули деньги за услугу + оплатили замену белья.",
    place: "Анива",
    resolved: true,
  },
];

async function getAuthor() {
  let u = await prisma.user.findFirst({ where: { role: "owner" } });
  if (!u) u = await prisma.user.findFirst({ where: { role: "moderator" } });
  if (!u) u = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!u) throw new Error("Нет пользователя в БД — сначала создайте пользователя");
  return u;
}

async function main() {
  const author = await getAuthor();
  console.log(`Автор публикаций: ${author.nickname} (id=${author.id})\n`);

  let created = 0;
  let skipped = 0;

  for (const rec of SEED) {
    const exists = await prisma.recPost.findFirst({
      where: { subject: rec.subject },
      select: { id: true },
    });
    if (exists) {
      skipped++;
      continue;
    }
    const now = new Date();
    await prisma.recPost.create({
      data: {
        subject: rec.subject,
        stance: rec.stance,
        stanceAt: now,
        title: rec.title,
        text: rec.text,
        place: rec.place,
        humanHighlight: rec.humanHighlight ?? "",
        authorId: author.id,
        authorName: author.nickname,
        resolved: rec.resolved,
        resolvedAt: rec.resolved ? now : null,
        // orgResponse — для одной из resolved=true добавим официальный ответ
        orgResponseText: rec.subject === "Стоматология «Дента-Плюс»"
          ? "Благодарим за сигнал. Проводим внутреннюю проверку записи и качества лечения. С администратором проведена беседа о соблюдении тайминга. Готовы предложить бесплатную консультацию у старшего врача для исправления пломбы."
          : "",
        orgResponseAt: rec.subject === "Стоматология «Дента-Плюс»" ? now : null,
        orgResponseByName: rec.subject === "Стоматология «Дента-Плюс»" ? "Администрация «Дента-Плюс»" : "",
      },
    });
    created++;
    const status = `${rec.stance === "recommend" ? "🟢 Recommend" : "🔴 Notrecommend"}${rec.resolved ? " + 🔵 Resolved" : ""}`;
    console.log(`  ✓ [${status}] ${rec.subject}`);
  }

  console.log(`\n=== ИТОГ ===`);
  console.log(`Создано: ${created}`);
  console.log(`Пропущено (уже есть): ${skipped}`);
  console.log(`Всего обработано: ${SEED.length}`);

  const total = await prisma.recPost.count();
  const byStance = await prisma.recPost.groupBy({ by: ["stance"], _count: true });
  const byResolved = await prisma.recPost.groupBy({ by: ["resolved"], _count: true });
  console.log(`\nВсего отзывов в БД сейчас: ${total}`);
  console.log("По stance:", byStance);
  console.log("По resolved:", byResolved);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Ошибка:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
