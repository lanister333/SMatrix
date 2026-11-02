/**
 * Проверка рубрик тем-приёмников #176/#177/#178 для ТЗ 2026-09-23
 * «переименование кнопки + привязка к рубрикам».
 * Ожидания: 177 и 176 → «Товары и услуги ▸ Где купить»; 178 → «Товары и услуги ▸ Цены».
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ids = [176, 177, 178];
  for (const id of ids) {
    const t = await prisma.topic.findUnique({
      where: { id },
      select: { id: true, title: true, rubricId: true, rubric: { select: { id: true, name: true, slug: true, parentId: true, parent: { select: { name: true, slug: true } } } } },
    });
    if (!t) {
      console.log(`#${id}: НЕ НАЙДЕНА`);
      continue;
    }
    const rub = t.rubric;
    const parent = rub?.parent?.name ?? "(корень)";
    console.log(`#${t.id} | «${t.title}» | rubricId=${t.rubricId} | «${parent} ▸ ${rub?.name}» | rubric slug=${rub?.slug}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("ERR:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
