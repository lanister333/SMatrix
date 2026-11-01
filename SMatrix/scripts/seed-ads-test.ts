/**
 * Seed: тестовые объявления в 8 рубриках (по 5 в каждой)
 * Запуск:  bun scripts/seed-ads-test.ts
 *
 * Рубрики AdListing (schema.prisma):
 *   sell «Продам», buy «Куплю», give «Отдам даром»,
 *   services «Услуги», jobs «Работа», realty «Недвижимость»,
 *   transport «Транспорт», other «Разное»
 *
 * По 5 объявлений × 8 рубрик = 40 записей.
 * Если объявление с таким же title уже есть — пропускаем (защита от дублей).
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const CITIES = ["Южно-Сахалинск", "Корсаков", "Холмск", "Долинск", "Анива"];

interface AdSeed {
  rubric: string;
  title: string;
  text: string;
  price: string;
  contact: string;
  place: string;
  status: string; // active | closed
}

/** По 5 объявлений в каждой рубрике — реальные сахалинские темы */
const SEED: AdSeed[] = [
  // ============ sell «Продам» ============
  { rubric: "sell", title: "Продам зимнюю резину Nokian 215/60 R16, 4 шт.",
    text: "Шипованная, б/у один сезон. Хранение в тёплом гараже. Подойдёт на Cross/Pajero Sport. Самовывоз из района Сахалинского ГУ.",
    price: "18000 руб", contact: "Telegram @seller_yss", place: "Южно-Сахалинск", status: "active" },
  { rubric: "sell", title: "Продам холодильник Indesit двухкамерный, рабочий",
    text: "Перевозить не надо — помогу подвезти по городу. Работает тихо, без нареканий. Меняем на большой бок-о-бок. Размеры 60×60×180.",
    price: "12000 руб", contact: "+7 924 XXX-XX-XX", place: "Корсаков", status: "active" },
  { rubric: "sell", title: "Продам палатку 4-местную Tramp",
    text: "Ткань — оксфорд, швы проклеены. Дуга алюминиевая. Брала на рыбалку 3 сезона, без проколов. В чехле.",
    price: "6000 руб", contact: "WhatsApp по ЛС", place: "Холмск", status: "active" },
  { rubric: "sell", title: "Продам ноутбук ASUS X550, 8 ГБ, SSD 240",
    text: "Стоит Windows 10, офис, браузер. Батарея держит ~1.5 часа. Подойдёт ребёнку для учёбы или как медиа-станция. Б/у 4 года.",
    price: "9500 руб", contact: "Telegram @notebook_sakh", place: "Долинск", status: "active" },
  { rubric: "sell", title: "Продам набор кухонной посуды Tefal, 10 предметов",
    text: "Антипригарное покрытие целое. Крышки стеклянные. Ни одной царапины. Продаю — переехали на индукцию, нужна другая посуда.",
    price: "4500 руб", contact: "Telegram @tefal_kholmsk", place: "Анива", status: "active" },

  // ============ buy «Куплю» ============
  { rubric: "buy", title: "Куплю б/у прицеп для лодки до 5 метров",
    text: "Сахалин/Курилы — заберу сам. Описание, фото и цену — в ЛС. Готов рассмотреть варианты СТ-215, МЗСА.",
    price: "до 80000 руб", contact: "Telegram @buyer_boat", place: "Южно-Сахалинск", status: "active" },
  { rubric: "buy", title: "Куплю газовый баллон 50 л (пропан)",
    text: "Баллон и редуктор. Самовывоз. Сахалин, anytime.",
    price: "до 3000 руб", contact: "+7 924 XXX-XX-XX", place: "Корсаков", status: "active" },
  { rubric: "buy", title: "Куплю старый айфон 8/SE2 для ребёнка",
    text: "Б/у, состояние не критично — экран целый, батарея любая. Коробка не нужна. Бюджет 8-12 тыс.",
    price: "до 12000 руб", contact: "Telegram @phone_for_kid", place: "Холмск", status: "active" },
  { rubric: "buy", title: "Куплю кирпич б/у (красный), 200-300 шт.",
    text: "Для печки в бане. Самовывоз с вашей разгрузки. Холмск/Невельск. Рассмотрю партии от 100 шт.",
    price: "договорная", contact: "WhatsApp по ЛС", place: "Долинск", status: "active" },
  { rubric: "buy", title: "Куплю генератор бензиновый 2-3 кВт б/у",
    text: "Для дачи. Honda, Kipor, Patriot — рассмотрю. Сахалин/Курилы. Желательно с проверкой.",
    price: "до 15000 руб", contact: "Telegram @generator_buy", place: "Анива", status: "active" },

  // ============ give «Отдам даром» ============
  { rubric: "give", title: "Отдам детские вещи 3-5 лет (мальчик)",
    text: "Куртки, штаны, футболки — всё в хорошем состоянии. Самовывоз из Левого берега. По одной вещи не отдаю — только всё сразу.",
    price: "бесплатно", contact: "Telegram @give_yss", place: "Южно-Сахалинск", status: "active" },
  { rubric: "give", title: "Отдам советский книгопоиск, винил, пластинки",
    text: "Дома много старых пластинок 60-80х годов. Звук проверял — играют. Забрать всё сразу.",
    price: "бесплатно", contact: "WhatsApp по ЛС", place: "Корсаков", status: "active" },
  { rubric: "give", title: "Отдам старую мебель — шкаф и стол",
    text: "Переехали, не помещается. Состояние — б/у, но крепкая. Самовывоз с подъездом. Холмск, центр.",
    price: "бесплатно", contact: "+7 924 XXX-XX-XX", place: "Холмск", status: "active" },
  { rubric: "give", title: "Отдам игрушки для кошки и собаки",
    text: "Когтеточки, мячики, косточки. Животных больше нет — отдать всё в хорошие руки.",
    price: "бесплатно", contact: "Telegram @pet_toys", place: "Долинск", status: "active" },
  { rubric: "give", title: "Отдам строительные доски (обрезки)",
    text: "Остались после ремонта бани. 20-30 досок разной длины. Самовывоз. На растопку или для поддонов.",
    price: "бесплатно", contact: "WhatsApp по ЛС", place: "Анива", status: "active" },

  // ============ services «Услуги» ============
  { rubric: "services", title: "Услуги: ремонт компьютеров и ноутбуков",
    text: "Опыт 12 лет. Чистка от пыли, замена термопасты, установка Windows, ремонт клавиатуры. Выезд по городу. Гарантия на работы 30 дней.",
    price: "от 1000 руб", contact: "Telegram @it_master_yss", place: "Южно-Сахалинск", status: "active" },
  { rubric: "services", title: "Услуги: репетитор по математике 5-11 класс",
    text: "Подготовка к ОГЭ/ЕГЭ. Опыт работы в школе 8 лет. Занятия у ученика или онлайн. 60 мин — 800 руб.",
    price: "800 руб/час", contact: "+7 924 XXX-XX-XX", place: "Корсаков", status: "active" },
  { rubric: "services", title: "Услуги: муж на час, мелкий ремонт",
    text: "Повесить карниз, собрать мебель, починить кран, установить розетку. Опытный. Выезд в пределах города. Расчёт после работы.",
    price: "от 500 руб", contact: "Telegram @master_hour", place: "Холмск", status: "active" },
  { rubric: "services", title: "Услуги: перевозка пассажиров до аэропорта",
    text: "Hyundai Solaris, чистый салон, без накурено. Утро/вечер — удобно для ранних рейсов. Стоимость — 1500 руб в одну сторону.",
    price: "1500 руб", contact: "WhatsApp по ЛС", place: "Долинск", status: "active" },
  { rubric: "services", title: "Услуги: стрижка собак и кошек на дому",
    text: "Грумер с 6-летним опытом. Стрижка любой сложности, когти, уши. Выезжаю с инструментом. Спокойное отношение к нервным животным.",
    price: "от 1500 руб", contact: "Telegram @pet_groomer", place: "Анива", status: "active" },

  // ============ jobs «Работа» ============
  { rubric: "jobs", title: "Работа: водитель-экспедитор на Газель",
    text: "ИП по доставке стройматериалов. Оформление по ТК РФ. Зарплата 60-70 тыс + премии. Опыт от 2 лет. Маршруты — Сахалин, иногда Курилы.",
    price: "от 60000 руб/мес", contact: "+7 924 XXX-XX-XX", place: "Южно-Сахалинск", status: "active" },
  { rubric: "jobs", title: "Работа: повар в кафе, 2/2",
    text: "Кафе в центре. График 2/2, с 8 до 22. Зарплата 55-60 тыс на руки. Опыт от года. Оформление официальное.",
    price: "55000-60000 руб/мес", contact: "Telegram @cafe_job", place: "Корсаков", status: "active" },
  { rubric: "jobs", title: "Работа: электросварщик 4 разряда",
    text: "Строительная компания. Ремонт теплотрасс. Оформление по ТК. Вахта 15/15. Опыт от 3 лет. Удостоверение обязательно.",
    price: "85000 руб/мес", contact: "WhatsApp по ЛС", place: "Холмск", status: "active" },
  { rubric: "jobs", title: "Работа: менеджер по продажам недвижимости",
    text: "Агентство. Обучение за счёт компании. Сдельная оплата — 3-5% от сделки. Активные студенты — welcome. Опыт в риелторе — преимущество.",
    price: "% от сделки", contact: "Telegram @realty_job", place: "Долинск", status: "active" },
  { rubric: "jobs", title: "Работа: няня для ребёнка 3 лет, на 4 часа в день",
    text: "Понедельник-пятница, 16:00-20:00. Семья в центре. Женщина 30-55 лет, с рекомендациями. 250 руб/час.",
    price: "250 руб/час", contact: "+7 924 XXX-XX-XX", place: "Анива", status: "active" },

  // ============ realty «Недвижимость» ============
  { rubric: "realty", title: "Сдам 1-комн. квартиру, 35 м², 5/5 эт.",
    text: "Центр, ул. Сахалинская. Кухня 8 м², балкон. Мебель, бытовая техника. Сдаю на длительный срок. Без животных. 30 тыс/мес + КУ.",
    price: "30000 руб/мес", contact: "Telegram @rent_yss", place: "Южно-Сахалинск", status: "active" },
  { rubric: "realty", title: "Продам дачу в Корсакове, 6 соток",
    text: "Дом щитовой 30 м², баня 12 м², теплица. Свет, вода — скважина. До моря 800 м. Документы на руках.",
    price: "850000 руб", contact: "+7 924 XXX-XX-XX", place: "Корсаков", status: "active" },
  { rubric: "realty", title: "Сдам гараж в ГСК «Строитель», бокс 24",
    text: "Капитальный, сухой. Ворота распашные 2.6 м. Охрана. 4500 руб/мес. Залог 1 мес.",
    price: "4500 руб/мес", contact: "WhatsApp по ЛС", place: "Холмск", status: "active" },
  { rubric: "realty", title: "Сниму комнату для студента, до 10 тыс/мес",
    text: "Студент 22 лет, без в/п. Сахалин/Корсаков. Можно подселение. Спокойный, без животных.",
    price: "до 10000 руб/мес", contact: "Telegram @student_room", place: "Долинск", status: "active" },
  { rubric: "realty", title: "Продам участок 10 соток под ИЖС в Аниве",
    text: "Категория земли — населённые пункты. Ровный, огорожен. До центра Анивы 5 мин. Электричество по границе. 350 тыс/сотка.",
    price: "3500 тыс руб", contact: "+7 924 XXX-XX-XX", place: "Анива", status: "active" },

  // ============ transport «Транспорт» ============
  { rubric: "transport", title: "Продам Toyota Mark II 1998, 2.5, 180 тыс км",
    text: "Один хозяин 8 лет. Кузов без коррозии, салон некурящий. Зимняя/летняя резина в комплекте. 100 тыс. рублей. Торг при осмотре.",
    price: "100000 руб", contact: "Telegram @mark2_sell", place: "Южно-Сахалинск", status: "active" },
  { rubric: "transport", title: "Продам мотоцикл ИЖ Юпитер 5, на ходу",
    text: "1987 г.в. Заводится с пол-оборота. Документы в порядке. На замену владельцу — новый. Байк-любитель — приветствуется.",
    price: "35000 руб", contact: "+7 924 XXX-XX-XX", place: "Корсаков", status: "active" },
  { rubric: "transport", title: "Продам прицеп СЗП 8177, тент",
    text: "Г/п 7 тонн. Документы действительны до 2027 г. Тент новый, торцевые ворота. Стоит в Холмске, готов к выезду.",
    price: "320000 руб", contact: "WhatsApp по ЛС", place: "Холмск", status: "active" },
  { rubric: "transport", title: "Куплю велосипед горный взрослый",
    text: "Б/у, рост L-XL. Merida, Trek, Scott — рассмотрю. Для поездок на работу. Бюджет 15-25 тыс. Долинск.",
    price: "до 25000 руб", contact: "Telegram @bike_buy", place: "Долинск", status: "active" },
  { rubric: "transport", title: "Продам квадроцикл Stels 500, 2015 г.",
    text: "Полный привод, лебёдка. Б/у только летом на даче. Стоит в тёплом боксе. Резина летняя + зимняя. 220 тыс. руб.",
    price: "220000 руб", contact: "+7 924 XXX-XX-XX", place: "Анива", status: "active" },

  // ============ other «Разное» ============
  { rubric: "other", title: "Продам садовый инвентарь — всё сразу",
    text: "Лопаты, грабли, тяпки, секатор. Хозяйка переезжает. Состояние рабочее. Самовывоз.",
    price: "2000 руб всё", contact: "Telegram @garden_sell", place: "Южно-Сахалинск", status: "active" },
  { rubric: "other", title: "Куплю билеты на концерт 28 сент., 2 шт",
    text: "Любой сектор, рассмотрите все предложения. Если есть — пишите в ЛС, договоримся.",
    price: "договорная", contact: "+7 924 XXX-XX-XX", place: "Корсаков", status: "active" },
  { rubric: "other", title: "Продам коллекцию монет СССР, 50 шт.",
    text: "1, 2, 3, 5, 10, 15, 20 коп. 1924-1991. Большинство в коллекционном состоянии. Каталог по запросу.",
    price: "15000 руб", contact: "WhatsApp по ЛС", place: "Холмск", status: "active" },
  { rubric: "other", title: "Отдам котёнка, девочка, 3 месяца",
    text: "Приучена к лотку, ест корм. Очень ласковая. Забрать в течение недели — переезд.",
    price: "бесплатно", contact: "Telegram @kitten_free", place: "Долинск", status: "active" },
  { rubric: "other", title: "Продам самовар электрический, vintage 1980-х",
    text: "Работает. Объём 3 литра. Родной свисток. На подставке. 4500 руб. Корсаков, самовывоз.",
    price: "4500 руб", contact: "+7 924 XXX-XX-XX", place: "Анива", status: "active" },
];

async function getAuthor() {
  // Берём первого пользователя — owner/moderator, иначе — первого попавшегося
  let u = await prisma.user.findFirst({ where: { role: "owner" } });
  if (!u) u = await prisma.user.findFirst({ where: { role: "moderator" } });
  if (!u) u = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!u) throw new Error("Нет пользователя в БД — сначала создайте пользователя");
  return u;
}

async function main() {
  const author = await getAuthor();
  console.log(`Автор объявлений: ${author.nickname} (id=${author.id})\n`);

  let created = 0;
  let skipped = 0;
  const byRubricCount: Record<string, number> = {};

  for (const ad of SEED) {
    // Проверяем, есть ли уже объявление с таким title
    const exists = await prisma.adListing.findFirst({
      where: { title: ad.title },
      select: { id: true },
    });
    if (exists) {
      skipped++;
      byRubricCount[ad.rubric] = (byRubricCount[ad.rubric] ?? 0) + 1;
      continue;
    }
    await prisma.adListing.create({
      data: {
        rubric: ad.rubric,
        title: ad.title,
        text: ad.text,
        price: ad.price,
        contact: ad.contact,
        place: ad.place,
        status: ad.status,
        statusAt: new Date(),
        authorId: author.id,
        authorName: author.nickname,
      },
    });
    created++;
    byRubricCount[ad.rubric] = (byRubricCount[ad.rubric] ?? 0) + 1;
  }

  console.log("=== ИТОГ ===");
  console.log(`Создано: ${created}`);
  console.log(`Пропущено (уже есть): ${skipped}`);
  console.log(`Всего обработано: ${SEED.length}`);
  console.log("\nПо рубрикам (создано+пропущено):");
  for (const [r, c] of Object.entries(byRubricCount)) {
    console.log(`  ${r.padEnd(12)} ${c}`);
  }

  // Итоговое состояние
  const total = await prisma.adListing.count();
  console.log(`\nВсего объявлений в БД сейчас: ${total}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Ошибка:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
