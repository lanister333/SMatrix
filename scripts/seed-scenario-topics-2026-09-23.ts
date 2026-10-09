/**
 * ПОСЕВ отдельных тем форума для сценариев 1-6 (ТЗ 2026-09-23 «каждый
 * сценарий ведёт в СВОЮ тему»): заголовок = суть исходного вопроса,
 * сообщение №1 = вопрос из карточки, сообщение №2 = тестовый ввод (Ошибка),
 * перенесённый через prefilled_text. Рубрики: 1-3 → «Товары и услуги ▸
 * Где купить» (slug tovary-i-uslugi--gde-kupit), 4-6 → «Товары и услуги ▸
 * Цены» (slug tovary-i-uslugi--ceny). Темы-агрегаторы #177/#178 остаются
 * служебными и кнопками из карточек больше не открываются.
 *
 * Сценарий 7 (Cybex) — отдельной темы не требует: слаг topic-cybex-777
 * мапится на АКТУАЛЬНУЮ тему публикации #176 (заголовок и сообщение №1 —
 * вопрос — уже на месте).
 *
 * ИДЕМПОТЕНТНОСТЬ: повторный запуск пропускает существующие темы
 * (поиск по Topic.source = "scenario-transfer:<слаг>").
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SCENARIOS = [
  {
    slug: "topic-grm-123", rubricSlug: "tovary-i-uslugi--gde-kupit",
    title: "Где купить оригинальный ремкомплект ГРМ на двигатель 1JZ-GE в Южно-Сахалинске?",
    question: "Где в Южно-Сахалинске купить оригинальный японский ремкомплект ГРМ на двигатель 1JZ-GE? На маркетплейсах ждать долго",
    input: "Есть мастер Вова на Железнодорожной, звони ему: 8-924-111-22-33",
  },
  {
    slug: "topic-shkola-789", rubricSlug: "tovary-i-uslugi--gde-kupit",
    title: "Где купить качественную школьную форму на мальчика (рост 140) в Южно-Сахалинске?",
    question: "Где в городе прямо сейчас купить качественную школьную форму на мальчика (рост 140)? В крупных ТЦ всё раскупили перед сезоном",
    input: "В ТЦ Рояль на 3 этаже сидят хамы и мошенники, торгуют синтетикой!",
  },
  {
    slug: "topic-sima-555", rubricSlug: "tovary-i-uslugi--gde-kupit",
    title: "Где купить японские снасти и блесны на симу (розовые, 18г) в Южно-Сахалинске?",
    question: "Ищу специфические японские снасти и блесны на симу (розовые, 18г). В обычных рыболовных магазинах Южного всё выгребли",
    input: "Закажи у чувака на Авито, вот его сотовый 8-914-000-44-55",
  },
  {
    slug: "topic-tyres-456", rubricSlug: "tovary-i-uslugi--ceny",
    title: "Где купить зимнюю резину Triangle R16 в Южно-Сахалинске?",
    question: "Подскажите, где в Южно-Сахалинске сейчас самая дешевая зимняя резина Triangle R16? В крупных сетях ценник сильно задрали",
    input: "На Пуркаева в ТЦ не ходи, там барыги совсем с ума сошли, крутят цены!",
  },
  {
    slug: "topic-salmon-888", rubricSlug: "tovary-i-uslugi--ceny",
    title: "Где найти свежую горбушу по минимальной цене напрямую от рыбаков?",
    question: "Где найти свежую горбушу по минимальной цене напрямую от рыбаков, без наценки перекупщиков?",
    input: "Все перекупщики уроды, задрали ценник на рыбу в два раза!",
  },
  {
    slug: "topic-timber-999", rubricSlug: "tovary-i-uslugi--ceny",
    title: "Где дешевле взять куб обрезной доски 50х150 с доставкой в Троицкое?",
    question: "Где сейчас дешевле взять куб обрезной доски 50х150 с доставкой в Троицкое? Цены на базах Южного сильно разнятся",
    input: "На базах на Холмском шоссе устроили обдираловку, воры кругом!",
  },
];

async function main() {
  const rubrics = await prisma.rubric.findMany({
    where: { slug: { in: ["tovary-i-uslugi--gde-kupit", "tovary-i-uslugi--ceny"] } },
    select: { id: true, slug: true, name: true },
  });
  const rubricBySlug = new Map(rubrics.map((r) => [r.slug, r.id]));
  if (rubricBySlug.size !== 2) throw new Error("Рубрики 118/120 не найдены по слагам: " + JSON.stringify(rubrics));

  const maxRow = await prisma.topic.aggregate({ _max: { number: true } });
  let nextNumber = (maxRow._max.number ?? 1973200) + 1;

  for (let i = 0; i < SCENARIOS.length; i++) {
    const s = SCENARIOS[i];
    const source = `scenario-transfer:${s.slug}`;
    const existing = await prisma.topic.findFirst({ where: { source }, select: { id: true, number: true, title: true } });
    if (existing) {
      console.log(`SKIP ${s.slug}: тема уже есть #${existing.id} (number=${existing.number}) «${existing.title}»`);
      continue;
    }
    const base = new Date(Date.now() - (SCENARIOS.length - i) * 60_000);
    const t = await prisma.topic.create({
      data: {
        number: nextNumber++,
        title: s.title,
        source,
        authorName: "Админ",
        rubricId: rubricBySlug.get(s.rubricSlug),
        createdAt: base,
        lastActivityAt: new Date(base.getTime() + 60_000),
        lastAuthorName: "Гость",
      },
      select: { id: true, number: true },
    });
    await prisma.message.createMany({
      data: [
        {
          topicId: t.id, num: 1, authorName: "Админ",
          body: s.question,
          createdAt: base,
        },
        {
          topicId: t.id, num: 2, authorName: "Гость",
          body: s.input,
          createdAt: new Date(base.getTime() + 60_000),
        },
      ],
    });
    console.log(`CREATED ${s.slug} → тема #${t.id} (number=${t.number}) «${s.title}» + 2 сообщения`);
  }

  console.log("\nИТОГОВАЯ КАРТА ДЛЯ АДАПТЕРА:");
  for (const s of SCENARIOS) {
    const t = await prisma.topic.findFirst({ where: { source: `scenario-transfer:${s.slug}` }, select: { id: true } });
    console.log(`  "${s.slug}": ${t?.id},`);
  }
  console.log(`  "topic-cybex-777": 176,  // актуальная тема публикации Cybex (уже существует)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error("ERR:", e); await prisma.$disconnect(); process.exit(1); });
