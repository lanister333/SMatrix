/**
 * Поиск утечки «ептвоюмать» (варианты написания) в Message.
 * Запуск: cd /opt/smatrix && bun run scripts/find-eptv.ts
 */
import { db } from "@/lib/db";

async function main() {
  // Cyrillic LIKE в SQLite чувствителен к регистру — перебираем варианты
  const pats = ["птвоюм", "ПТВОЮМ", "епт", "Епт", "ЕПТ", "ёпт", "Ёпт", "ЁПТ"];
  const msgs = await db.message.findMany({
    where: { OR: pats.map((p) => ({ body: { contains: p } })) },
    select: {
      id: true, topicId: true, num: true, authorName: true,
      body: true, isHiddenByAi: true, isDeleted: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
    take: 50,
  });
  console.log(`=== MESSAGES: ${msgs.length}`);
  for (const m of msgs) {
    console.log(JSON.stringify({ ...m, body: m.body.slice(0, 180) }));
  }
  await db.$disconnect();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
