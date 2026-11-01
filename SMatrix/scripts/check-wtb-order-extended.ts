// Расширенная проверка реального порядка публикаций: ищем записи с
// неожиданными статусами и проверяем, что они тоже отсортированы правильно.
// Запуск: `DATABASE_URL="file:/home/z/my-project/smatrix/db/custom.db" bun scripts/check-wtb-order-extended.ts`

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function inspectAll(name: "whereToBuyPost" | "cheapPost") {
  const isWtb = name === "whereToBuyPost";
  const label = isWtb ? "Где купить" : "Где дешевле";

  console.log(`\n========== ${label} — ВСЕ записи (включая isDeleted и isHiddenByAi) ==========`);

  // ВСЕ записи без фильтра — посмотрим, какие статусы есть
  const allRows = await (prisma[name] as any).findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 10000,
    select: {
      id: true,
      status: true,
      createdAt: true,
      statusAt: true,
      title: true,
      isDeleted: true,
      isHiddenByAi: true,
      authorId: true,
      authorName: true,
      editedAt: true,
    },
  });
  console.log(`Total rows in table: ${allRows.length}`);

  // Распределение по статусам (БЕЗ фильтра)
  const statusMap: Record<string, number> = {};
  const deletedCount = allRows.filter((r: any) => r.isDeleted).length;
  const hiddenCount = allRows.filter((r: any) => r.isHiddenByAi).length;
  for (const r of allRows as any[]) {
    const key = `${r.status}${r.isDeleted ? " (deleted)" : ""}${r.isHiddenByAi ? " (hidden)" : ""}`;
    statusMap[key] = (statusMap[key] || 0) + 1;
  }
  console.log("Status distribution (all):", statusMap);
  console.log(`Deleted: ${deletedCount}, Hidden by AI: ${hiddenCount}`);

  // Распределение по авторам
  const authorMap: Record<string, number> = {};
  for (const r of allRows as any[]) {
    authorMap[r.authorName] = (authorMap[r.authorName] || 0) + 1;
  }
  console.log("Authors:", authorMap);

  // Уникальные значения createdAt (важно для понимания, почему элементы с
  // одинаковым createdAt могут идти в странном порядке)
  const uniqueCreatedAt = new Set(allRows.map((r: any) => r.createdAt.toISOString()));
  console.log(`Unique createdAt values: ${uniqueCreatedAt.size}`);

  // Покажем все записи в порядке из БД (без сортировки feedOrder)
  console.log("\nAll records in DB order (createdAt DESC, id DESC):");
  for (let i = 0; i < Math.min(allRows.length, 50); i++) {
    const r = allRows[i] as any;
    const flags = [
      r.isDeleted ? "DELETED" : "",
      r.isHiddenByAi ? "HIDDEN" : "",
    ].filter(Boolean).join(",");
    const flagStr = flags ? ` [${flags}]` : "";
    console.log(
      `${(i + 1).toString().padStart(2)}. [${r.status.padEnd(11)}] ${r.createdAt.toISOString().replace("T", " ").slice(0, 19)}${flagStr}  ${r.title.slice(0, 60)}`
    );
  }

  // Покажем элементы с «необычным» статусом
  const knownStatuses = isWtb
    ? ["seeking", "found", "irrelevant"]
    : ["comparing", "cheaper", "fixed", "irrelevant"];
  const unusual = allRows.filter((r: any) => !knownStatuses.includes(r.status));
  if (unusual.length > 0) {
    console.log("\n⚠️ Записи с НЕИЗВЕСТНЫМ статусом:");
    for (const r of unusual as any[]) {
      console.log(`  [${r.status}] ${r.title} (id=${r.id})`);
    }
  } else {
    console.log("\n✓ Все записи имеют известные статусы.");
  }

  // Сравним createdAt с statusAt: возможно, какие-то посты меняли статус
  // и в этом кроется проблема порядка
  console.log("\nЗаписи, у которых statusAt сильно отличается от createdAt:");
  const changed = allRows.filter((r: any) => {
    const delta = Math.abs(r.statusAt.getTime() - r.createdAt.getTime());
    return delta > 1000; // разница больше секунды
  });
  for (const r of changed.slice(0, 20) as any[]) {
    console.log(
      `  [${r.status}] createdAt=${r.createdAt.toISOString().slice(0, 19)} statusAt=${r.statusAt.toISOString().slice(0, 19)} ${r.title.slice(0, 50)}`
    );
  }
  console.log(`Всего со сменой статуса: ${changed.length}`);
}

async function main() {
  await inspectAll("whereToBuyPost");
  await inspectAll("cheapPost");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
