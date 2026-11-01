/**
 * Востановление линейной цепочки ответов в темах парсера «Театра ботов».
 *
 * Старые темы парсера (до 2026-10-05) создавались без parentId: все
 * ответы (num >= 2) имели parentId=null и depth=0. Из-за этого:
 *   • в UI не рисовались SVG-линии «кто кому ответил»
 *   • у каждого ответа появлялась серая цитата первого сообщения
 *     (т.к. quoteOfFor берёт rootMsg при отсутствии parentId)
 *
 * Этот скрипт ставит parentId в линейную цепочку:
 *   #1 (root)   parent=null   depth=0
 *   #2          parent=#1     depth=1
 *   #3          parent=#2      depth=2
 *   #4          parent=#3      depth=3
 *
 * Запуск:
 *   DATABASE_URL="file:..." bun scripts/theatre-bots/fix-reply-chain.ts
 *
 * Флаги:
 *   --dry-run — только показать что было бы изменено.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const topics = await db.topic.findMany({
    where: { source: { startsWith: "tg:" } },
    select: { id: true, number: true, title: true },
    orderBy: { id: "asc" },
  });

  console.log(`Найдено тем парсера: ${topics.length}`);
  if (dryRun) console.log("[dry-run] изменения НЕ будут записаны в БД.\n");

  let totalFixed = 0;

  for (const t of topics) {
    const msgs = await db.message.findMany({
      where: { topicId: t.id },
      orderBy: { num: "asc" },
      select: { id: true, num: true, parentId: true, depth: true },
    });

    if (msgs.length < 2) continue;

    const root = msgs.find((m) => m.num === 1);
    if (!root) {
      console.log(`  ⚠ Тема #${t.id}: нет первого сообщения, пропуск`);
      continue;
    }

    // Проверим, нужно ли что-то менять. Считаем что нужно, если хотя бы
    // у одного ответа (num>=2) parentId != id предыдущего сообщения.
    let needsFix = false;
    let prevId = root.id;
    let prevDepth = 0;
    const updates: { id: string; num: number; newParentId: string | null; newDepth: number }[] = [];

    for (let i = 1; i < msgs.length; i++) {
      const m = msgs[i];
      const expectedParent = prevId;
      const expectedDepth = Math.min(6, prevDepth + 1);
      if (m.parentId !== expectedParent || m.depth !== expectedDepth) {
        needsFix = true;
        updates.push({ id: m.id, num: m.num, newParentId: expectedParent, newDepth: expectedDepth });
      }
      prevId = m.id;
      prevDepth = expectedDepth;
    }

    if (!needsFix) {
      console.log(`  ✓ Тема #${t.id} «${t.title.slice(0, 50)}…» — цепочка уже правильная`);
      continue;
    }

    console.log(`  🔧 Тема #${t.id} «${t.title.slice(0, 50)}…» — исправляем ${updates.length} сообщений:`);
    for (const u of updates) {
      console.log(`     • #${u.num}: parentId=${u.newParentId?.slice(-6) || "-"}, depth=${u.newDepth}`);
      if (!dryRun) {
        await db.message.update({
          where: { id: u.id },
          data: { parentId: u.newParentId, depth: u.newDepth },
        });
      }
    }
    totalFixed += updates.length;
  }

  console.log(`\n=== ИТОГ ===`);
  console.log(`Всего тем: ${topics.length}`);
  console.log(`Исправлено сообщений: ${totalFixed}`);
  if (dryRun) console.log(`[dry-run] изменения НЕ записаны.`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error("❌ Фатальная ошибка:", e);
  db.$disconnect();
  process.exit(1);
});
