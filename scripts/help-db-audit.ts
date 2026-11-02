/** Аудит БД: форум не содержит следов раздела «Нужна помощь», лента раздела пуста. */
async function main() {
  const { db } = await import("../src/lib/db");
  const topics = await db.topic.count({ where: { title: { contains: "помощь" } } });
  const rubrics = await db.rubric.count({ where: { name: { contains: "Нужна помощь" } } });
  const publications = await db.helpPublication.count();
  const complaints = await db.helpComplaint.count();
  console.log("RESULT", JSON.stringify({ topics, rubrics, publications, complaints }));
  await db.$disconnect();
}
main();
