/**
 * Сид 2026-09-23 — демо-сигналы «ЖКХ и городские проблемы» (/gkh)
 * для ТЗ №2 (Flat 2.0). ИДЕМПОТЕНТЕН: если карточка с адресом
 * «Южно-Сахалинск, ул. Емельянова, д. 21» уже есть — ничего не создаёт.
 *
 * 4 карточки покрывают все статусы ТЗ №2 (В поиске решения / Передано
 * в УК / Решено / Отклонено), первая — дословный пример из ТЗ (ГВС на
 * Емельянова 21, заявка 4512-Ж). Автор всех — сид-аккаунт «Админ».
 */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const MARK_PLACE = "Южно-Сахалинск, ул. Емельянова, д. 21";
const H = 60 * 60 * 1000;
const DAY = 24 * H;

const ITEMS = [
  {
    place: MARK_PLACE,
    problemDate: "2026-09-15",
    status: "active", // В поиске решения
    text: "С 15 сентября полностью отсутствует горячее водоснабжение в третьем подъезде.",
    actions: "Подана коллективная заявка в УК №10 от 16.09. Номер заявки: 4512-Ж. Ответ до сих пор не дан.",
    ago: 2 * H,
  },
  {
    place: "Южно-Сахалинск, ул. Пионерская, д. 25",
    problemDate: "2026-08-30",
    status: "in_progress", // Передано в УК
    text: "Во дворе дома яма на проезжей части глубиной около полуметра — машины объезжают по тротуару и ломают бордюр.",
    actions: "Заявка в ЕДДС от 01.09 (№3387-Ж). Городская комиссия 05.09 передала участок в УК «Горизонт» — асфальтовый ремонт обещан до конца сентября.",
    ago: 1 * DAY,
  },
  {
    place: "Корсаков, ул. Краснофлотская, д. 8",
    problemDate: "2026-09-03",
    status: "solved", // Решено
    text: "Не работало уличное освещение во дворе — фонари не горели с 3 сентября, темнота до утра.",
    actions: "Обращение в администрацию ГО от 04.09 (вх. №1122). 10 сентября освещение восстановлено.",
    ago: 3 * DAY,
  },
  {
    place: "Холмск, ул. Советская",
    problemDate: "2026-09-10",
    status: "rejected", // Отклонено
    text: "Все вокруг воруют, никто ничего не делает годами, никому ничего не нужно.",
    actions: "Конкретные обращения не подавались. Модератор: текст без фактов — отклонён ИИ-фильтром, автору предложено переписать.",
    ago: 4 * DAY,
  },
];

(async () => {
  const admin = await db.user.findUnique({ where: { nickname: "Админ" } });
  if (!admin) throw new Error("Сид-аккаунт «Админ» не найден");

  const exists = await db.gkhProblem.findFirst({ where: { place: MARK_PLACE, isDeleted: false } });
  if (exists) {
    console.log("SEED EXISTS — пропускаю (Емельянова 21 уже есть)");
    await db.$disconnect();
    return;
  }

  for (const it of ITEMS) {
    const firstSentence = it.text.split(/[.!?;\n]/)[0].trim();
    const titleBase = firstSentence.length >= 10 ? firstSentence : it.text;
    const title = titleBase.slice(0, 120).trim();
    const createdAt = new Date(Date.now() - it.ago);
    await db.gkhProblem.create({
      data: {
        title,
        text: it.text,
        actions: it.actions,
        place: it.place,
        problemDate: it.problemDate,
        status: it.status,
        statusAt: createdAt,
        authorId: admin.id,
        authorName: admin.nickname,
        createdAt,
        updatedAt: createdAt,
      },
    });
    console.log("CREATED:", it.status, "|", it.place);
  }
  await db.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
