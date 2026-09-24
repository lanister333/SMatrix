/* Уборка тестовых постов «проба колонок» (probe-cols-fixes-2026-09-24.mjs)
   из WhereToBuyPost / CheapPost — включая мягко удалённые (isDeleted).
   Публичный API их не отдаёт; чистим прямым доступом к БД (prisma).
   Идемпотентно. */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  for (const [label, model] of [
    ["wheretobuy", prisma.whereToBuyPost],
    ["gdedeshevle", prisma.cheapPost],
  ]) {
    const found = await model.findMany({
      where: { OR: [{ title: { contains: "проба колонок" } }, { title: { contains: "Проба колонок" } }] },
      select: { id: true, title: true, isDeleted: true },
    });
    console.log(`${label}: найдено ${found.length} тестовых постов`);
    for (const p of found) {
      await model.delete({ where: { id: p.id } });
      console.log(`  удалён физически: id=${p.id} isDeleted=${p.isDeleted} title="${(p.title || "").slice(0, 70)}"`);
    }
    const rest = await model.count({
      where: { OR: [{ title: { contains: "проба колонок" } }, { title: { contains: "Проба колонок" } }] },
    });
    console.log(`${label}: осталось ${rest}`);
  }
  console.log("живых wtb-постов:", await prisma.whereToBuyPost.count({ where: { isDeleted: false } }));
  console.log("живых cd-постов:", await prisma.cheapPost.count({ where: { isDeleted: false } }));
})()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
