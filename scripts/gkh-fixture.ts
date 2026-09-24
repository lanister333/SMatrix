/**
 * ШАГ 19: визуальная фикстура раздела «ЖКХ и городские проблемы» для
 * браузерной приёмки.
 * create   — создаёт 16 проблем (актуальные/решается/решено, разные места,
 *            длинные заголовки и тексты, обновления, журнал статусов,
 *            пара проблем с темами обсуждения, ответ организации);
 * cleanall — удаляет все проблемы с меткой TAG (и связанные темы/жалобы).
 * Запуск: bun scripts/gkh-fixture.ts [create|cleanall]
 */
const TAG = " gk";

async function main() {
  const mode = process.argv[2] ?? "create";
  const { db } = await import("../src/lib/db");

  if (mode === "cleanall") {
    const problems = await db.gkhProblem.findMany({ where: { text: { contains: TAG } } });
    const ids = problems.map((p) => p.id);
    const topics = await db.topic.findMany({ where: { gkhProblem: { id: { in: ids } } } });
    for (const t of topics) {
      await db.message.deleteMany({ where: { topicId: t.id } });
      await db.topic.delete({ where: { id: t.id } });
    }
    await db.gkhComplaint.deleteMany({ where: { problemId: { in: ids } } });
    await db.gkhStatusLog.deleteMany({ where: { problemId: { in: ids } } });
    await db.gkhUpdate.deleteMany({ where: { problemId: { in: ids } } });
    await db.gkhMedia.deleteMany({ where: { problemId: { in: ids } } });
    const del = await db.gkhProblem.deleteMany({ where: { id: { in: ids } } });
    console.log(`RESULT cleaned: problems=${del.count}, topics=${topics.length}`);
    return;
  }

  const admin = await db.user.findUnique({ where: { nickname: "Админ" } });
  if (!admin) throw new Error("Админ не найден");

  const items: { title: string; text: string; place?: string; problemDate?: string; status?: string; organization?: string; orgResponse?: string }[] = [
    { title: "Яма глубиной полметра на Пионерской во дворе дома 25", text: "Во дворе дома по ул. Пионерская, 25 уже месяц растёт яма на дороге, машины объезжают по тротуару. Нужно ограждение и ремонт.", place: "Южно-Сахалинск, Пионерская 25", problemDate: "2026-08-10" },
    { title: "Не работает уличное освещение на Солнечной", text: "Фонари на участке Солнечной от Комсомольской до Детской не горят вторую неделю. Темно, ходить опасно.", place: "Южно-Сахалинск, Солнечная", problemDate: "2026-08-28" },
    { title: "Горячей воды нет в доме на Солнечной 11", text: "С понедельника нет горячей воды, никто не объясняет причину. Просим пояснений от ответственных служб.", place: "Южно-Сахалинск, Солнечная 11", problemDate: "2026-09-05" },
    { title: "Мусорные контейнеры переполнены на Хабаровской", text: "Контейнерная площадка у дома 72 не убирается по три-четыре дня, запах и следы животных.", place: "Южно-Сахалинск, Хабаровская 72", problemDate: "2026-08-30" },
    { title: "Отсыпка дороги во дворе на Прудовой", text: "Двор размывает дождями, подъезд к дому стал проблемным для машин скорой помощи.", place: "Корсаков, Прудовая" },
    { title: "Тротуар разрушился у школы №2 в Холмске", text: "Дети идут на уроки по обочине, тротуарная плитка разбита, лужи по колено.", place: "Холмск, школа №2", problemDate: "2026-09-01" },
    { title: "Не убирается двор многоквартирного дома на Украинской", text: "Управляющая компания не вывозит ветки после обрезки деревьев уже месяц.", place: "Южно-Сахалинск, Украинская 4" },
    { title: "Постоянный гул от насосной станции на Зеленой", text: "Насосная работает круглосуточно, слышно в квартирах первых этажей.", place: "Южно-Сахалинск, Зеленая" },
    { title: "Прорвало трубу на тепломагистрали у школы", text: "Пар идет из-под асфальта у входа в школу, ограждения нет.", place: "Холмск" },
    { title: "Ржавая вода из крана в доме 15 по Крюсa", text: "Вода идет коричневая по утрам, приходится сливать по несколько минут.", place: "Корсаков, Крюса 15" },
    { title: "Разбитый пешеходный переход у поликлиники на Прудовой, зебра полностью стёрлась и не видна даже в сухую погоду, а теперь после дождей на переходе ещё и большая лужа, люди переходят по газону", text: "Пешеходный переход у поликлиники нужен заново разметить и поставить знак на противоположной стороне, сейчас он смещён.", place: "Корсаков, Прудовая", problemDate: "2026-08-20" },
    { title: "Долг не вывезенный снег не даёт припарковаться во дворе на Ленина", text: "Зимний вопрос, но повторяется каждую зиму: снежные валы убирают в последний момент.", place: "Южно-Сахалинск, Ленина 47" },
    { title: "Ремонт кровли дома на Комсомольской завершён", text: "Крышу починили после нашей публикации, протечек больше нет. Спасибо всем, кто сообщал обновления.", status: "solved", organization: "МУП «Городское благоустройство»" },
    { title: "Ливнёвка на Обской прочищена", text: "Прочистили ливневую канализацию, вода ушла с проезжей части.", status: "solved", place: "Южно-Сахалинск, Обская" },
    { title: "Освещение на Детской восстановлено после проверки", text: "Заменили светильники, участок освещается полностью.", status: "in_progress", organization: "Сахалинские коммунальные системы" },
    { title: "Уберём стихийную свалку в овраге за гаражами", text: "Свалку убрали, но мусор снова начинают возить. Нужен запрет и знак.", status: "in_progress" },
  ];

  const created: string[] = [];
  for (const it of items) {
    const p = await db.gkhProblem.create({
      data: {
        title: it.title,
        text: it.text + TAG,
        place: it.place ?? "",
        problemDate: it.problemDate ?? "",
        status: it.status ?? "active",
        organization: it.organization ?? "",
        authorId: admin.id,
        authorName: admin.nickname,
      },
    });
    created.push(p.id);
  }

  // Журнал статусов и обновления жителей для истории
  const p1 = created[0];
  await db.gkhStatusLog.create({ data: { problemId: p1, fromStatus: "active", toStatus: "in_progress", byName: admin.nickname, byRole: "moderator" } });
  await db.gkhStatusLog.create({ data: { problemId: p1, fromStatus: "in_progress", toStatus: "active", byName: admin.nickname, byRole: "author" } });
  await db.gkhUpdate.create({ data: { problemId: p1, authorId: admin.id, authorName: admin.nickname, text: "Сегодня объехала яму аварийная служба, обещали засыпать щебнем до конца недели." + TAG } });
  await db.gkhUpdate.create({ data: { problemId: p1, authorId: admin.id, authorName: admin.nickname, text: "У меня в этом же доме такая же проблема, яма прямо у подъезда." + TAG } });
  const p3 = created[2];
  await db.gkhUpdate.create({ data: { problemId: p3, authorId: admin.id, authorName: admin.nickname, text: "Проблема всё ещё сохраняется, горячей воды нет уже третий день." + TAG } });
  // Официальный ответ организации на проблему 2 (освещение)
  const p2 = created[1];
  await db.gkhProblem.update({
    where: { id: p2 },
    data: {
      orgResponseText: "Работы по восстановлению освещения включены в план на текущую неделю, материалы завезены, монтаж начнётся завтра." + TAG,
      orgResponseAt: new Date(),
      orgResponseById: admin.id,
      orgResponseByName: admin.nickname,
      organization: "Сахалинские коммунальные системы",
    },
  });
  await db.gkhUpdate.create({ data: { problemId: p2, authorId: admin.id, authorName: admin.nickname, text: "Вчера вечером ночью всё ещё темно, но лестницу техники уже привезли." + TAG } });

  // Пара проблем с темами обсуждения (кнопка «Обсуждается на форуме»)
  const rubric = await (async () => {
    let parent = await db.rubric.findFirst({ where: { slug: "blocks-discuss" } });
    if (!parent) parent = await db.rubric.create({ data: { name: "Обсуждение сообщений из блоков", slug: "blocks-discuss", isService: true } });
    let r = await db.rubric.findFirst({ where: { slug: "gkh-discuss" } });
    if (!r) r = await db.rubric.create({ data: { name: "ЖКХ и городские проблемы", slug: "gkh-discuss", isService: true, parentId: parent.id } });
    return r;
  })();
  for (const idx of [0, 3]) {
    const problem = await db.gkhProblem.findUnique({ where: { id: created[idx] } });
    if (!problem || problem.topicId) continue;
    const last = await db.topic.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    const topic = await db.topic.create({
      data: {
        number: (last?.number ?? 0) + 1,
        title: `Обсуждение: ${problem.title}`.slice(0, 150),
        authorName: problem.authorName,
        authorId: problem.authorId,
        rubricId: rubric.id,
        lastAuthorName: problem.authorName,
        gkhProblem: { connect: { id: problem.id } },
      },
    });
    await db.message.create({
      data: {
        topicId: topic.id,
        num: 1,
        authorName: problem.authorName,
        authorId: problem.authorId,
        body: `Проблема из раздела «ЖКХ и городские проблемы»:\n\n«${problem.title}»\n\n${problem.text}\n\nМесто: ${problem.place}\nТекущий статус: Проблема актуальна\n\nИсточник: ЖКХ и городские проблемы\nhttp://localhost:3000/gkh?post=${problem.id}`,
      },
    });
    await db.gkhProblem.update({ where: { id: problem.id }, data: { topicId: topic.id } });
  }

  console.log(`RESULT created: problems=${created.length}, updates=3, statusLogs=2, topics=2, orgResponse=1`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
