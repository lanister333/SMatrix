/**
 * Поиск утечки «епать» (и вариантов) в Message.
 * Запуск: cd /opt/smatrix && bun run scripts/find-epat.ts
 */
import { db } from "@/lib/db";

async function main() {
  // Регистронезависимые варианты (SQLite LIKE по умолчанию case-insensitive для ASCII,
  // но для кириллицы Prisma содержит кейс-зависимый поиск — берём оба регистра)
  const pats = ["епать", "Епать", "ЕПАТЬ", "ёпать", "Ёпать", "ЁПАТЬ",
                "епат", "Епат", "ЕПАТ", "ёпат", "Ёпат"];
  const msgs = await db.message.findMany({
    where: { OR: pats.map((p) => ({ body: { contains: p } })) },
    select: {
      id: true, topicId: true, num: true, authorName: true,
      body: true, isHiddenByAi: true, isDeleted: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
    take: 30,
  });
  console.log(`=== MESSAGES: ${msgs.length}`);
  for (const m of msgs) {
    console.log(JSON.stringify({ ...m, body: m.body.slice(0, 200) }));
  }
  await db.$disconnect();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
