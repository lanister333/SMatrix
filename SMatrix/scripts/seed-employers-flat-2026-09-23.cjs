/**
 * Сид 2026-09-23 — демо-карточки «О работодателях» (/o-rabotodatelyah)
 * для ТЗ Flat 2.0 (Пункты 5/6/8/20 ТЗ №2). ИДЕМПОТЕНТЕН: если карточка
 * по компании «ООО «Сахалин-Строй-Ресурс»» уже есть — ничего не создаёт.
 *
 * 3 карточки: первая — ДОСЛОВНЫЙ пример из ТЗ (Сахалин-Строй-Ресурс,
 * задержка расчёта + похвала начальнику участка — принцип
 * «Человек ≠ Организация»); вторая — положительный опыт; третья —
 * смешанный опыт из другого города. Автор — сид-аккаунт «Админ».
 */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const MARK_EMPLOYER = "ООО «Сахалин-Строй-Ресурс»";
const H = 60 * 60 * 1000;
const DAY = 24 * H;

const ITEMS = [
  {
    employer: MARK_EMPLOYER,
    city: "Южно-Сахалинск",
    workPeriod: "май – август 2026 г.",
    experience:
      "Работал на строительном объекте в Дальнем. Возникла проблема с задержкой окончательного расчёта при увольнении на две недели.",
    personMention:
      "Отдельно хочу отметить начальника участка Дмитрия Николаевича — он лично контролировал ведомости и помог мне выбить закрытие смены. К его работе претензий нет.",
    ago: 2 * H,
  },
  {
    employer: 'ИП «Портовый пекарь»',
    city: "Холмск",
    workPeriod: "январь 2026 г. – по настоящее время",
    experience:
      "Устроилась пекарем-универсалом через официальный договор. Зарплату платят дважды в месяц без задержек, аванс 25-го, расчёт 10-го. График сменный, но его составляют заранее на месяц.",
    personMention: "",
    ago: 1 * DAY,
  },
  {
    employer: "ООО «Корсаковский груз-терминал»",
    city: "Корсаков",
    workPeriod: "март – апрель 2026 г.",
    experience:
      "Отработал два месяца комплектовщиком на складе. Оборудование старое, весов не хватало, из-за этого пересортицы и перепроверки после смены. Расчёт при увольнении дали в день приказа, оформили по ТК.",
    personMention:
      "Кладовщик Сергей помог освоиться в первые недели и терпеливо отвечал на вопросы по учёту — отдельно благодарю его за человеческое отношение.",
    ago: 3 * DAY,
  },
];

(async () => {
  const admin = await db.user.findUnique({ where: { nickname: "Админ" } });
  if (!admin) throw new Error("Сид-аккаунт «Админ» не найден");

  const exists = await db.empPost.findFirst({ where: { employer: MARK_EMPLOYER, isDeleted: false } });
  if (exists) {
    console.log("SEED EXISTS — пропускаю (Сахалин-Строй-Ресурс уже есть)");
    await db.$disconnect();
    return;
  }

  for (const it of ITEMS) {
    const createdAt = new Date(Date.now() - it.ago);
    await db.empPost.create({
      data: {
        employer: it.employer,
        city: it.city,
        workPeriod: it.workPeriod,
        experience: it.experience,
        personMention: it.personMention,
        authorId: admin.id,
        authorName: admin.nickname,
        createdAt,
        updatedAt: createdAt,
      },
    });
    console.log("CREATED:", it.employer, "|", it.city, "|", it.workPeriod);
  }
  await db.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
