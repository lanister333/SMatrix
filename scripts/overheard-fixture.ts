/**
 * Фикстура «Подслушано» для визуальной приёмки (прямая запись в БД, без ИИ).
 * Режимы: create — 16 сообщений (2 страницы по 15); cleanall — удалить всё,
 * созданное фикстурой (заголовки с маркером «Проверка ленты №»).
 */
const MARK = "Проверка ленты №";

async function main() {
  const { db } = await import("../src/lib/db");
  const mode = process.argv[2] || "create";

  if (mode === "cleanall") {
    const del = await db.overheardPost.deleteMany({ where: { title: { contains: MARK } } });
    console.log("CLEANED", del.count);
    await db.$disconnect();
    return;
  }

  const admin = await db.user.findUnique({ where: { nickname: "Админ" } });
  if (!admin) throw new Error("Админ не найден");
  const places = ["Южно-Сахалинск", "Корсаков", "Холмск", ""];
  const texts = [
    "Слышал от соседа, что в этом районе скоро начнут ремонт дороги. Кто-нибудь подтверждал?",
    "Заметил утром, что новый светофор на перекрёстке работает в тестовом режиме.",
    "Говорят, в сквере посадят новые деревья к осени. Хотелось бы верить.",
    "На ярмарке в выходные появились фермеры из Корсакова, продают очень хорошую рыбу.",
    "Кто-нибудь слышал, когда откроют новую поликлинику в северной части города?",
    "Вечером заметил, что автобус №3 поехал по объездной — видимо, ремонт моста.",
  ];
  for (let i = 0; i < 16; i++) {
    const place = places[i % places.length];
    await db.overheardPost.create({
      data: {
        title: `${MARK}${i + 1} — городская заметка`,
        text: texts[i % texts.length] + ` (сообщение ${i + 1} для проверки ленты и пагинации).`,
        place,
        authorId: admin.id,
        authorName: admin.nickname,
      },
    });
  }
  const count = await db.overheardPost.count({ where: { title: { contains: MARK } } });
  console.log("CREATED", count);
  await db.$disconnect();
}
main();
