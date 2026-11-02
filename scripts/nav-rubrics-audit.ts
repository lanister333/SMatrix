/**
 * Аудит рубрик форума для директивы «Чистка навигации»:
 * полный список рубрик (вкл. служебные) + число тем в каждой.
 * Запуск: cd /home/z/my-project && bun scripts/nav-rubrics-audit.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rubrics = await prisma.rubric.findMany({
    orderBy: { id: "asc" },
    include: { _count: { select: { topics: true } } },
  });
  console.log("=== РУБРИКИ ===");
  for (const r of rubrics) {
    console.log(
      `id=${r.id} slug=${r.slug} name="${r.name}" isService=${r.isService} topics=${r._count.topics} parentId=${r.parentId}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
