/**
 * ТЗ 2026-09-27 «Тестовые сообщения в 7 блоках».
 * Запуск: cd /home/z/my-project && bun scripts/seed-all-blocks-test.ts
 *
 * По 5 сообщений в каждом подблоке каждого блока:
 *
 *   Где купить (WhereToBuyPost) — status: seeking | found | irrelevant × 5 = 15
 *   Где дешевле (CheapPost) — status: comparing | cheaper | fixed | irrelevant × 5 = 20
 *   ЖКХ (GkhProblem) — status: active | in_progress | solved | rejected × 5 = 20
 *   Работодатели (EmpPost) — stance: recommend | notrecommend × 5 = 10
 *   Знакомства (DatingPost) — category: m4w | w4m | friendship | person × 5 = 20
 *   Рекомендую/не рекомендую (RecPost) — stance: recommend | notrecommend × 5 = 10
 *   Нужна помощь (HelpPublication) — status: active | resolved | irrelevant × 5 = 15
 *
 * Итого: 110 сообщений. Если запись уже есть с таким же title — пропускаем
 * (защита от дублей при повторном запуске).
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const AUTHORS = ["Модератор", "Админ", "SakhMatrix", "ТестовыйЮзер", "ГостьСахалин"];
const CITIES = ["Южно-Сахалинск", "Корсаков", "Холмск", "Долинск", "Анива"];

async function getAuthor() {
  let u = await prisma.user.findFirst({ where: { role: "owner" } });
  if (!u) u = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!u) throw new Error("Нет пользователя в БД — сначала создайте пользователя");
  return u;
}

/** Уникальный счётчик для уникальных title. */
let counter = 0;
function nextTitle(prefix: string) {
  counter += 1;
  return `${prefix} #${counter.toString().padStart(3, "0")}`;
}

async function createIfMissing(model: any, where: any, data: any) {
  const existing = await model.findFirst({ where });
  if (existing) return { created: false, id: existing.id };
  const created = await model.create({ data });
  return { created: true, id: created.id };
}

async function main() {
  const author = await getAuthor();
  console.log(`Автор: ${author.nickname} (id=${author.id})\n`);

  let created = 0;
  let skipped = 0;

  // ============================================================
  // 1. Где купить (WhereToBuyPost) — 3 подблока × 5 = 15
  // ============================================================
  console.log("=== 1. Где купить (WhereToBuyPost) ===");
  const wtbSubblocks: Array<{ status: string; title: string; text: string }> = [];
  // seeking × 5
  for (let i = 1; i <= 5; i++) {
    wtbSubblocks.push({
      status: "seeking",
      title: nextTitle("Ищу"),
      text: `Ищу ${i === 1 ? "детское автокресло" : i === 2 ? "электросамокат" : i === 3 ? "обогреватель" : i === 4 ? "велосипед детский" : "стиральную машину"} б/у в хорошем состоянии. Сахалин, готов забрать сам.`,
    });
  }
  // found × 5
  for (let i = 1; i <= 5; i++) {
    wtbSubblocks.push({
      status: "found",
      title: nextTitle("Найдено"),
      text: `Нашёл ${i === 1 ? "коляску детскую" : i === 2 ? "ноутбук" : i === 3 ? "стол письменный" : i === 4 ? "холодильник" : "ковёр"} через этот раздел. Спасибо всем откликнувшимся!`,
    });
  }
  // irrelevant × 5
  for (let i = 1; i <= 5; i++) {
    wtbSubblocks.push({
      status: "irrelevant",
      title: nextTitle("Неактуально"),
      text: `Поиск ${i === 1 ? "монитора" : i === 2 ? "палатки" : i === 3 ? "сапов" : i === 4 ? "рюкзака" : "удочки"} больше не актуален — купил новый в магазине.`,
    });
  }
  for (const p of wtbSubblocks) {
    const r = await createIfMissing(prisma.whereToBuyPost, { title: p.title }, {
      ...p, place: CITIES[counter % 5], authorId: author.id, authorName: AUTHORS[counter % 5],
    });
    r.created ? created++ : skipped++;
    console.log(`  ${r.created ? "✓" : "↻"} [${p.status}] ${p.title}`);
  }

  // ============================================================
  // 2. Где дешевле (CheapPost) — 4 подблока × 5 = 20
  // ============================================================
  console.log("\n=== 2. Где дешевле (CheapPost) ===");
  const cheapSubblocks: Array<{ status: string; title: string; text: string }> = [];
  for (let i = 1; i <= 5; i++) {
    cheapSubblocks.push({
      status: "comparing",
      title: nextTitle("Сравниваю цены"),
      text: `Сравниваю цены на ${i === 1 ? "курицу" : i === 2 ? "сахар" : i === 3 ? "молоко" : i === 4 ? "яйца" : "хлеб"} в разных магазинах Сахалинска. Где дешевле?`,
    });
  }
  for (let i = 1; i <= 5; i++) {
    cheapSubblocks.push({
      status: "cheaper",
      title: nextTitle("Нашёл дешевле"),
      text: `Нашёл ${i === 1 ? "гречку" : i === 2 ? "масло" : i === 3 ? "рис" : i === 4 ? "макароны" : "соль"} дешевле на 15% в магазине у дома. Соседние супермаркеты дороже.`,
    });
  }
  for (let i = 1; i <= 5; i++) {
    cheapSubblocks.push({
      status: "fixed",
      title: nextTitle("Цена зафиксирована"),
      text: `Зафиксировал цену на ${i === 1 ? "бензин АИ-92" : i === 2 ? "дизель" : i === 3 ? "газ" : i === 4 ? "уголь" : "дрова"} — лучшая цена в Корсакове.`,
    });
  }
  for (let i = 1; i <= 5; i++) {
    cheapSubblocks.push({
      status: "irrelevant",
      title: nextTitle("Поиск снят"),
      text: `Цены на ${i === 1 ? "гречку" : i === 2 ? "соль" : i === 3 ? "сахар" : i === 4 ? "муку" : "масло"} выровнялись, поиск не актуален.`,
    });
  }
  let cIdx = 0;
  for (const p of cheapSubblocks) {
    const r = await createIfMissing(prisma.cheapPost, { title: p.title }, {
      ...p, place: CITIES[cIdx++ % 5], authorId: author.id, authorName: AUTHORS[cIdx % 5],
    });
    r.created ? created++ : skipped++;
    console.log(`  ${r.created ? "✓" : "↻"} [${p.status}] ${p.title}`);
  }

  // ============================================================
  // 3. ЖКХ (GkhProblem) — 4 подблока × 5 = 20
  // ============================================================
  console.log("\n=== 3. ЖКХ (GkhProblem) ===");
  const gkhSubblocks: Array<{ status: string; title: string; text: string }> = [];
  for (let i = 1; i <= 5; i++) {
    gkhSubblocks.push({
      status: "active",
      title: nextTitle("ЖКХ в поиске решения"),
      text: `${i === 1 ? "Прорвало трубу" : i === 2 ? "Нет отопления" : i === 3 ? "Двор не убирают" : i === 4 ? "Лифт сломан" : "Подъезд не освещён"} уже неделю. Заявки в УК — молчат.`,
    });
  }
  for (let i = 1; i <= 5; i++) {
    gkhSubblocks.push({
      status: "in_progress",
      title: nextTitle("Передано в УК"),
      text: `${i === 1 ? "Крыша течёт" : i === 2 ? "Фасад сыплется" : i === 3 ? "Подвал затоплен" : i === 4 ? "Стены плесневеют" : "Трубы ржавые"} — УК приняла заявку, ждём исполнителя.`,
    });
  }
  for (let i = 1; i <= 5; i++) {
    gkhSubblocks.push({
      status: "solved",
      title: nextTitle("Решено"),
      text: `${i === 1 ? "Лифт починили" : i === 2 ? "Отопление дали" : i === 3 ? "Крышу залатали" : i === 4 ? "Двор убрали" : "Свет в подъезде восстановлен"}. Спасибо УК и форуму за поддержку.`,
    });
  }
  for (let i = 1; i <= 5; i++) {
    gkhSubblocks.push({
      status: "rejected",
      title: nextTitle("Отклонено"),
      text: `${i === 1 ? "Шум соседей" : i === 2 ? "Запах из подвала" : i === 3 ? "Парковка во дворе" : i === 4 ? "Собаки без поводка" : "Мусор не в баках"} — заявка отклонена, не относится к УК.`,
    });
  }
  cIdx = 0;
  for (const p of gkhSubblocks) {
    const r = await createIfMissing(prisma.gkhProblem, { title: p.title }, {
      ...p,
      place: CITIES[cIdx++ % 5],
      actions: "Звонил в УК, писали в диспетчерскую",
      authorId: author.id,
      authorName: AUTHORS[cIdx % 5],
    });
    r.created ? created++ : skipped++;
    console.log(`  ${r.created ? "✓" : "↻"} [${p.status}] ${p.title}`);
  }

  // ============================================================
  // 4. Работодатели (EmpPost) — 2 подблока (recommend/notrecommend) × 5 = 10
  // ============================================================
  console.log("\n=== 4. Работодатели (EmpPost) ===");
  const empSubblocks: Array<{ stance: string; employer: string; title: string; text: string; city: string; workPeriod: string; experience: string; personMention: string }> = [];
  const EMPLOYERS_REC = ["ООО Сахалин-Рыба", "АО Курильский рыбоконсервный", "ООО Сахалин Энергосбыт", "ООО Дальнефтегаз Сахалин", "ООО АТЭК"];
  const EMPLOYERS_NOREC = ["ООО Рога и Копыта", "ИП Иванов И.И.", "ООО Сахалин-Трейд", "ООО Дальний Восток-Сервис", "ООО СтройСах"];
  for (let i = 1; i <= 5; i++) {
    empSubblocks.push({
      stance: "recommend",
      employer: EMPLOYERS_REC[i - 1],
      title: `Советую — ${EMPLOYERS_REC[i - 1]}`,
      text: `Работал в "${EMPLOYERS_REC[i - 1]}" период 2024-2026. Своевременные зарплаты, адекватное руководство, удобный график. Рекомендую как работодателя.`,
      city: CITIES[(i - 1) % 5],
      workPeriod: "2024–2026",
      experience: "Стабильные выплаты, белый договор, оплачиваемый отпуск",
      personMention: "",
    });
  }
  for (let i = 1; i <= 5; i++) {
    empSubblocks.push({
      stance: "notrecommend",
      employer: EMPLOYERS_NOREC[i - 1],
      title: `Не советую — ${EMPLOYERS_NOREC[i - 1]}`,
      text: `Работал в "${EMPLOYERS_NOREC[i - 1]}" 3 месяца в 2025. Задержки зарплаты, серая оплата, грубое руководство. Не рекомендую.`,
      city: CITIES[(i - 1) % 5],
      workPeriod: "2025 (3 месяца)",
      experience: "Задержки зарплаты 2-3 недели, договор не оформили вовремя",
      personMention: "",
    });
  }
  for (const p of empSubblocks) {
    const r = await createIfMissing(prisma.empPost, { title: p.title }, {
      ...p, authorId: author.id, authorName: AUTHORS[counter % 5], stanceAt: new Date(),
    });
    r.created ? created++ : skipped++;
    console.log(`  ${r.created ? "✓" : "↻"} [${p.stance}] ${p.title}`);
  }

  // ============================================================
  // 5. Знакомства (DatingPost) — 4 подблока × 5 = 20
  // ============================================================
  console.log("\n=== 5. Знакомства (DatingPost) ===");
  const datingSubblocks: Array<{ category: string; title: string; body: string }> = [];
  for (let i = 1; i <= 5; i++) {
    datingSubblocks.push({
      category: "m4w",
      title: `М→Ж ${i}: ищу девушку для серьёзных отношений`,
      body: `Мне ${28 + i} лет, работаю ${i === 1 ? "рыбаком" : i === 2 ? "нефтяником" : i === 3 ? "строителем" : i === 4 ? "врачом" : "инженером"}. Живу в Южно-Сахалинске. Ищу девушку 25-32 лет для серьёзных отношений. Без детей, здоровый образ жизни.`,
    });
  }
  for (let i = 1; i <= 5; i++) {
    datingSubblocks.push({
      category: "w4m",
      title: `Ж→М ${i}: ищу надёжного мужчину`,
      body: `Мне ${25 + i} лет, работаю ${i === 1 ? "бухгалтером" : i === 2 ? "учителем" : i === 3 ? "продавцом" : i === 4 ? "медсестрой" : "дизайнером"}. Корсаков. Ищу мужчину 28-40 лет, с работой и без вредных привычек.`,
    });
  }
  for (let i = 1; i <= 5; i++) {
    datingSubblocks.push({
      category: "friendship",
      title: `Дружба ${i}: ищу компанию для прогулок`,
      body: `${i === 1 ? "Переехала в Холмск, ищу подруг для прогулок" : i === 2 ? "Ищу друзей для походов в горы" : i === 3 ? "Ищу компанию для рыбалки" : i === 4 ? "Ищу друзей для настольных игр" : "Ищу компанию для шашлыков по выходным"}. Возраст 25-40.`,
    });
  }
  for (let i = 1; i <= 5; i++) {
    datingSubblocks.push({
      category: "person",
      title: `Поиск человека ${i}: ищу старого друга`,
      body: `${i === 1 ? "Ищу одноклассника из школы №1 Южно-Сахалинска, выпускались в 2005" : i === 2 ? "Ищу сослуживца по в/ч 12345, служили 2010-2012" : i === 3 ? "Ищу преподавателя математики, Анива, 1998-2000" : i === 4 ? "Благодарность: спасибо врачу отделения 5-й больницы" : "Ищу дальнобойщика, помог на трассе в 2024"}. Откликнитесь!`,
    });
  }
  cIdx = 0;
  for (const p of datingSubblocks) {
    const r = await createIfMissing(prisma.datingPost, { title: p.title }, {
      ...p, place: CITIES[cIdx++ % 5], authorId: author.id, authorName: AUTHORS[cIdx % 5], status: "actual",
    });
    r.created ? created++ : skipped++;
    console.log(`  ${r.created ? "✓" : "↻"} [${p.category}] ${p.title}`);
  }

  // ============================================================
  // 6. Рекомендую/не рекомендую (RecPost) — 2 подблока × 5 = 10
  // ============================================================
  console.log("\n=== 6. Рекомендую / Не рекомендую (RecPost) ===");
  // Внимание: 3 реальные публикации уже есть в БД (IslandVibe_65, Aniva_Drift,
  // Korsakov_Fish) — их не трогаем, добавляем тестовые к ним.
  const recSubblocks: Array<{ stance: string; subject: string; title: string; text: string; place: string; humanHighlight: string; orgResponseText: string; orgResponseByName: string }> = [];
  const REC_SUBJECTS = ["Кафе «Сахалин»", "Магазин «Берёзка»", "Автосервис «Колесо»", "Парикмахерская «Стрижка»", "Химчистка «Чисто»"];
  const NOREC_SUBJECTS = ["Шаурма у вокзала", "Ремонт телефонов «АйФон-Сервис»", "Стоматология «Дента-Плюс»", "Прачечная «Свежесть»", "Ресторан «Сушами»"];
  for (let i = 0; i < 5; i++) {
    recSubblocks.push({
      stance: "recommend",
      subject: REC_SUBJECTS[i],
      title: `Советую — ${REC_SUBJECTS[i]}`,
      text: `Был в "${REC_SUBJECTS[i]}". Чисто, вежливый персонал, качественная услуга. Рекомендую.`,
      place: CITIES[i % 5],
      humanHighlight: "",
      orgResponseText: "",
      orgResponseByName: "",
    });
  }
  for (let i = 0; i < 5; i++) {
    recSubblocks.push({
      stance: "notrecommend",
      subject: NOREC_SUBJECTS[i],
      title: `Предупреждаю — ${NOREC_SUBJECTS[i]}`,
      text: `Был в "${NOREC_SUBJECTS[i]}". Грязно, хамство персонала, услуга оказана некачественно. Не рекомендую.`,
      place: CITIES[i % 5],
      humanHighlight: "",
      orgResponseText: "",
      orgResponseByName: "",
    });
  }
  for (const p of recSubblocks) {
    const r = await createIfMissing(prisma.recPost, { title: p.title }, {
      ...p, authorId: author.id, authorName: AUTHORS[counter % 5], stanceAt: new Date(),
    });
    r.created ? created++ : skipped++;
    console.log(`  ${r.created ? "✓" : "↻"} [${p.stance}] ${p.title}`);
  }

  // ============================================================
  // 7. Нужна помощь (HelpPublication) — 3 подблока × 5 = 15
  // ============================================================
  console.log("\n=== 7. Нужна помощь (HelpPublication) ===");
  const helpSubblocks: Array<{ status: string; title: string; text: string }> = [];
  for (let i = 1; i <= 5; i++) {
    helpSubblocks.push({
      status: "active",
      title: nextTitle("Помогите"),
      text: `${i === 1 ? "Собираю гуманитарную помощь для многодетной семьи" : i === 2 ? "Ищу волонтёров для приюта животных" : i === 3 ? "Нужны продукты для пенсионера" : i === 4 ? "Ищу доноров крови (II+)" : "Нужна помощь с переездом инвалида"}. Свяжитесь со мной через личные сообщения.`,
    });
  }
  for (let i = 1; i <= 5; i++) {
    helpSubblocks.push({
      status: "resolved",
      title: nextTitle("Помощь оказана"),
      text: `${i === 1 ? "Спасибо всем, кто откликнулся — продукты доставлены" : i === 2 ? "Доноры найдены, спасибо" : i === 3 ? "Переезд состоялся, благодарю" : i === 4 ? "Гуманитарка собрана" : "Приют получил помощь"}. Закрываю заявку.`,
    });
  }
  for (let i = 1; i <= 5; i++) {
    helpSubblocks.push({
      status: "irrelevant",
      title: nextTitle("Снято"),
      text: `${i === 1 ? "Помощь больше не нужна — ситуация разрешилась" : i === 2 ? "Самостоятельно решил вопрос" : i === 3 ? "Нашёл другой канал помощи" : i === 4 ? "Получил поддержку от родных" : "Заявка устарела"}.`,
    });
  }
  cIdx = 0;
  for (const p of helpSubblocks) {
    const r = await createIfMissing(prisma.helpPublication, { title: p.title }, {
      ...p,
      contactData: "@telegram_handle",
      authorId: author.id,
      authorName: AUTHORS[cIdx++ % 5],
    });
    r.created ? created++ : skipped++;
    console.log(`  ${r.created ? "✓" : "↻"} [${p.status}] ${p.title}`);
  }

  // ============================================================
  // ИТОГ
  // ============================================================
  console.log("\n=== ИТОГ ===");
  console.log(`Создано: ${created}`);
  console.log(`Пропущено (уже есть): ${skipped}`);
  console.log(`Всего обработано: ${created + skipped}`);
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
