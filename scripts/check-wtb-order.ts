// Проверка реального порядка публикаций в БД для «Где купить» и «Где дешевле».
// Использует Prisma Client, чтобы не зависеть от better-sqlite3.
// Запуск: `bun scripts/check-wtb-order.ts`

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RANK_WTB: Record<string, number> = { seeking: 0, found: 1, irrelevant: 2 };
const RANK_CD: Record<string, number> = { comparing: 0, cheaper: 1, fixed: 1, irrelevant: 2 };

async function inspectTable(name: "whereToBuyPost" | "cheapPost") {
  const isWtb = name === "whereToBuyPost";
  const rank = isWtb ? RANK_WTB : RANK_CD;
  const label = isWtb ? "Где купить (WhereToBuyPost)" : "Где дешевле (CheapPost)";

  console.log(`\n========== ${label} ==========`);

  // Распределение по статусам
  const counts = await (prisma[name] as any).groupBy({
    by: ["status"],
    where: { isDeleted: false, isHiddenByAi: false },
    _count: { _all: true },
  });
  console.log("Status counts (filtered):", counts);

  // Тот же запрос, что и в API — orderBy createdAt desc, id desc
  const rows = await (prisma[name] as any).findMany({
    where: { isDeleted: false, isHiddenByAi: false },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1000,
    select: { id: true, status: true, createdAt: true, statusAt: true, title: true },
  });
  console.log(`Total rows (filtered): ${rows.length}`);

  // Применим тот же feedOrder, что и в API
  const sorted = [...rows].sort((a: any, b: any) => {
    const ra = rank[a.status] ?? 0;
    const rb = rank[b.status] ?? 0;
    if (ra !== rb) return ra - rb;
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    if (ta !== tb) return tb - ta;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });

  // Покажем топ-30 и проверим, есть ли «обратные» переходы
  console.log("\nTop 30 (after feedOrder sort):");
  let prevRank = -1;
  let prevStatus = "";
  const transitions: { at: number; from: number; to: number; fromStatus: string; toStatus: string }[] = [];
  sorted.slice(0, 30).forEach((r: any, i: number) => {
    const rRk = rank[r.status] ?? 0;
    const flag = rRk !== prevRank ? `  <-- переход ${prevRank}→${rRk}` : "";
    if (rRk !== prevRank && prevRank !== -1) {
      transitions.push({ at: i, from: prevRank, to: rRk, fromStatus: prevStatus, toStatus: r.status });
    }
    const fmt = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19);
    console.log(
      `${(i + 1).toString().padStart(2)}. [${r.status.padEnd(11)}] rank=${rRk} ${fmt(r.createdAt)}${flag}  ${r.title.slice(0, 60)}`
    );
    prevRank = rRk;
    prevStatus = r.status;
  });

  console.log(`\nВсе переходы ранга (между группами): ${transitions.length}`);
  transitions.slice(0, 30).forEach((t) =>
    console.log(`  на позиции ${t.at + 1}: rank ${t.from} (${t.fromStatus}) → rank ${t.to} (${t.toStatus})`)
  );

  // Подсчёт, какие статусы встречаются в каждой части списка
  console.log("\nРаспределение статусов по всему отсортированному списку:");
  const buckets = { top: {} as Record<string, number>, mid: {} as Record<string, number>, bot: {} as Record<string, number> };
  sorted.forEach((r: any, i: number) => {
    const section = i < sorted.length / 3 ? "top" : i < (sorted.length * 2) / 3 ? "mid" : "bot";
    buckets[section][r.status] = (buckets[section][r.status] || 0) + 1;
  });
  console.log("Top third:", buckets.top);
  console.log("Middle third:", buckets.mid);
  console.log("Bottom third:", buckets.bot);

  // КРИТИЧЕСКАЯ ПРОВЕРКА: после rank=2 (irrelevant) не должно быть rank=0
  let foundReverse = false;
  let prevRk = -1;
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const rRk = rank[r.status] ?? 0;
    if (rRk < prevRk) {
      console.log(`❌ ОБНАРУЖЕН обратный переход: позиция ${i + 1}: rank ${prevRk} → ${rRk} (${r.status})`);
      foundReverse = true;
    }
    prevRk = rRk;
  }
  if (foundReverse) {
    console.log("⚠️ ПОРЯДОК НАРУШЕН — актуальные элементы идут после неактуальных!");
  } else {
    console.log("✓ Порядок корректный — актуальные сверху, неактуальные снизу.");
  }
}

async function main() {
  await inspectTable("whereToBuyPost");
  await inspectTable("cheapPost");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
