/* Проверка/уборка остатков тестовых постов «Проба ТЗ…»/«Отладка ТЗ…»
   в лентах «Где купить» (WhereToBuyPost) и «Где дешевле» (CheapPost) —
   ВКЛЮЧАЯ скрытые (isDeleted) и непрошедшие модерацию: публичный API их
   не отдаёт, поэтому чистим прямым доступом к БД (prisma). Идемпотентно. */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const marker = /Проба ТЗ|Отладка ТЗ/i;
  for (const [label, model] of [
    ["wheretobuy", prisma.whereToBuyPost],
    ["gdedeshevle", prisma.cheapPost],
  ]) {
    const found = await model.findMany({
      where: { OR: [{ title: { contains: "Проба ТЗ" } }, { title: { contains: "Отладка ТЗ" } }] },
      select: { id: true, title: true, isDeleted: true, status: true },
    });
    const extra = found.filter((p) => marker.test(p.title || ""));
    console.log(`${label}: найдено ${extra.length} скрытых/остаточных тестовых постов`);
    for (const p of extra) {
      await model.delete({ where: { id: p.id } });
      console.log(`  удалён физически: id=${p.id} title="${(p.title || "").slice(0, 60)}" isDeleted=${p.isDeleted} status=${p.status}`);
    }
    const rest = await model.count({
      where: { OR: [{ title: { contains: "Проба ТЗ" } }, { title: { contains: "Отладка ТЗ" } }] },
    });
    console.log(`${label}: осталось ${rest}`);
  }
  // Полные остатки лент (живые посты любых маркеров — для справки):
  console.log("живых wtb-постов:", await prisma.whereToBuyPost.count({ where: { isDeleted: false } }));
  console.log("живых cheap-постов:", await prisma.cheapPost.count({ where: { isDeleted: false } }));
})()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
