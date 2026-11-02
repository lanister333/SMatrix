/**
 * Stage 2 (директива «Добавить 2 рубрики на форум»): добавляет
 * «Доставка еды» и «Клубы по интересам» в БД как top-level рубрики
 * (без parentId, isService:false). Слаг-формат как у существующих:
 * translit с дефисами. Идентификаторы — следующие свободные (max+1, +2).
 *
 * Запуск: bun scripts/add-rubrics-delivery-clubs.ts
 */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  console.log("Добавляю 2 рубрики на форум: «Доставка еды» и «Клубы по интересам»...");

  // Следующий свободный id — max(id) + 1
  const maxRow = await db.rubric.findFirst({ orderBy: { id: "desc" } });
  const startId = (maxRow?.id ?? 0) + 1;

  const newRubrics = [
    {
      id: startId,
      name: "Доставка еды",
      slug: "dostavka-edy",
      isService: false,
    },
    {
      id: startId + 1,
      name: "Клубы по интересам",
      slug: "kluby-po-interesam",
      isService: false,
    },
  ];

  for (const r of newRubrics) {
    // Проверка — вдруг уже есть (идемпотентность при повторном запуске)
    const existing = await db.rubric.findUnique({ where: { slug: r.slug } });
    if (existing) {
      console.log(`  ✓ ${r.name} (slug=${r.slug}) уже существует — пропускаю`);
      continue;
    }
    await db.rubric.create({ data: r });
    console.log(`  + ${r.name} (id=${r.id}, slug=${r.slug}) — создано`);
  }

  const total = await db.rubric.count();
  console.log(`\nГотово. Всего рубрик в БД: ${total}`);
}

main()
  .catch((e) => {
    console.error("Ошибка:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
