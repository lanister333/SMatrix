/**
 * ШАГ 18: визуальная фикстура раздела «Где купить» для браузерной приёмки.
 * create   — создаёт 16 вопросов (Ищу/Нашёл/Неактуально, разные места, длинные
 *            названия и тексты) от имени админа;
 * cleanall — удаляет все вопросы с меткой TAG (и связанные темы/жалобы).
 * Запуск: bun scripts/wheretobuy-fixture.ts [create|cleanall]
 */
const TAG = " wb";

async function main() {
  const mode = process.argv[2] ?? "create";
  const { db } = await import("../src/lib/db");

  if (mode === "cleanall") {
    const posts = await db.whereToBuyPost.findMany({ where: { text: { contains: TAG } } });
    const ids = posts.map((p) => p.id);
    const topics = await db.topic.findMany({ where: { whereToBuyPost: { id: { in: ids } } } });
    for (const t of topics) {
      await db.message.deleteMany({ where: { topicId: t.id } });
      await db.topic.delete({ where: { id: t.id } });
    }
    await db.whereToBuyComplaint.deleteMany({ where: { postId: { in: ids } } });
    const del = await db.whereToBuyPost.deleteMany({ where: { id: { in: ids } } });
    console.log(`RESULT cleaned: posts=${del.count}, topics=${topics.length}`);
    return;
  }

  const admin = await db.user.findUnique({ where: { nickname: "Админ" } });
  if (!admin) throw new Error("Админ не найден");

  const items: { title: string; text: string; place?: string; status?: string }[] = [
    { title: "Где в Южно-Сахалинске купить аккумулятор Bosch S5 AGM 70 Ah?", text: "Нужен именно Bosch S5 AGM 70 Ah, обратная полярность. Подскажите, где есть в наличии, и сколько сейчас стоит.", place: "Южно-Сахалинск" },
    { title: "Где купить детское автокресло Cybex Solution T i-Fix?", text: "Ростовая группа 2/3, цвет хотелось бы серый. Магазины или страницы товара на сайтах — подскажите, пожалуйста." },
    { title: "Где купить телевизор Samsung QE55S90D 55\"?", text: "Интересует конкретно модель QE55S90D на 55 дюймов, OLED. Сравню цены в обсуждении.", place: "Южно-Сахалинск" },
    { title: "Где купить фильтр Mann C 35 154?", text: "Масляный фильтр Mann C 35 154, оригинал или качественный аналог. Нужен к плановому ТО." },
    { title: "Где купить зимние шины Nokian Hakkapeliitta 10 205/55 R16?", text: "Комплект 4 штуки, 205/55 R16. Кто недавно покупал — где и почём?", place: "Холмск" },
    { title: "Где купить кофемолку Bosch TSM6A013B в Корсакове?", text: "Мелкая бытовая техника, конкретно Bosch TSM6A013B. Продают ли в Корсакове или ехать в Южно-Сахалинск?", place: "Корсаков" },
    { title: "Где купить мангу «Ван Пис» том 101 на русском?", text: "Ищу именно 101-й том издательства Азбука. Говорят, в одном книжном привозили недавно." },
    { title: "Где купить редуктор заднего моста на Suzuki Jimny 2015?", text: "Конкретно редуктор заднего моста на Jimny 2015 года, 3.908. Б/у тоже рассмотрю — подскажите разборки.", place: "Корсаков" },
    { title: "Где купить термопот Panasonic NC-EG3000 с доставкой на Сахалин?", text: "Конкретная модель NC-EG3000, стальной корпус. В местных магазинах не нашёл — может, кто заказывал?" },
    { title: "Где купить cheat-разъём OBD2 с проводом 1.5 метра?", text: "Удлинитель OBD2 с выключателем, длина провода 1.5 м. Для видеорегистратора." },
    { title: "Где купить рыболовные катушки Shimano Twin Power 2500S? Кто видел в наличии — напишите, пожалуйста, в обсуждении на форуме: очень нужен именно этот размер, редакция 2025 года, готов подъехать в любой район города в удобное время и посмотреть товар на месте", text: "Катушка Shimano Twin Power 2500S, редакция 2025 года. Нужна для джига. Цена вопроса известна, ищу наличие.", place: "Долинск" },
    { title: "Где купить игрушку-антистресс Pop-It большого размера?", text: "Ребёнку на день рождения. Большой Pop-It, 30 сантиметров, яркий." },
    { title: "Где купить аккумуляторный шуруповёрт Bosch GSR 120-LI?", text: "Нашёл, спасибо! Два комплекта были в гипермаркете на Сахалинской, цена приятная.", status: "found" },
    { title: "Где купить зерносушилку для фермерского хозяйства производительностью 10 тонн в час?", text: "Купили через дилера в Краснодаре, вопрос закрыт. Если кому-то нужен контакт дилера — напишите в обсуждении.", place: "Тымовское", status: "found" },
    { title: "Где купить новогоднюю ёлку выше 2 метров в конце декабря?", text: "Прошлый год — вопрос закрыт, ёлки тогда разобрали ещё до 20 декабря. В этом году ищите заранее.", status: "irrelevant" },
    { title: "Где купить запчасть 66299-4H000 на Hyundai Grand Starex?", text: "Вопрос снят — деталь сняли с учёта, нашёл альтернативу. Спасибо всем, кто отвечал.", status: "irrelevant" },
  ];

  const created: string[] = [];
  for (const it of items) {
    const p = await db.whereToBuyPost.create({
      data: {
        title: it.title,
        text: it.text + TAG,
        place: it.place ?? "",
        status: it.status ?? "seeking",
        authorId: admin.id,
        authorName: admin.nickname,
      },
    });
    created.push(p.id);
  }
  // пара вопросов с темами обсуждения (кнопка «Обсуждается на форуме»)
  const rubric = await (async () => {
    let parent = await db.rubric.findFirst({ where: { slug: "blocks-discuss" } });
    if (!parent) parent = await db.rubric.create({ data: { name: "Обсуждение сообщений из блоков", slug: "blocks-discuss", isService: true } });
    let r = await db.rubric.findFirst({ where: { slug: "wheretobuy-discuss" } });
    if (!r) r = await db.rubric.create({ data: { name: "Где купить", slug: "wheretobuy-discuss", isService: true, parentId: parent.id } });
    return r;
  })();
  for (const idx of [0, 2]) {
    const post = await db.whereToBuyPost.findUnique({ where: { id: created[idx] } });
    if (!post || post.topicId) continue;
    const last = await db.topic.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    const topic = await db.topic.create({
      data: {
        number: (last?.number ?? 0) + 1,
        title: `Обсуждение: ${post.title}`.slice(0, 150),
        authorName: admin.nickname,
        authorId: admin.id,
        rubricId: rubric.id,
        lastAuthorName: admin.nickname,
        whereToBuyPost: { connect: { id: post.id } },
      },
    });
    await db.message.create({
      data: {
        topicId: topic.id,
        num: 1,
        authorName: admin.nickname,
        authorId: admin.id,
        body: `Вопрос из раздела «Где купить»:\n\n«${post.title}»\n\n${post.text}\n\nИсточник: Где купить\n/gde-kupit?post=${post.id}`,
      },
    });
    await db.whereToBuyPost.update({ where: { id: post.id }, data: { topicId: topic.id } });
  }
  console.log(`RESULT created: posts=${created.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
