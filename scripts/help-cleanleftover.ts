/** Разовая дочистка тестовых просьб (авторы тест-юзеров удалены, API недоступен). */
async function main() {
  const { db } = await import("../src/lib/db");
  const r1 = await db.helpPublication.deleteMany({ where: { OR: [{ authorName: { startsWith: "HelpTest_" } }, { title: { contains: "Длинная проверочная" } }] } });
  const r2 = await db.helpComplaint.deleteMany({ where: { publication: { authorName: { startsWith: "HelpTest_" } } } });
  console.log("удалено публикаций:", r1.count, "жалоб:", r2.count);
  const left = await db.helpPublication.count();
  console.log("осталось в разделе:", left);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
