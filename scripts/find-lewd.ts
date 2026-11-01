/**
 * Поиск утечек: «завалю»/«трахну»/«отсоси» и их вариантов в Message.
 * Запуск: cd /opt/smatrix && bun run scripts/find-lewd.ts
 */
import { db } from "@/lib/db";

async function main() {
  const pats = [
    "завалю", "Завалю", "ЗАВАЛЮ",
    "завалю ", "завалю,", "завалю.",
    "трахну", "Трахну", "ТРАХНУ",
    "трахнуть", "Трахнуть",
    "отсоси", "Отсоси", "ОТСОСИ",
    "отсос", "Отсос",
  ];
  const msgs = await db.message.findMany({
    where: { OR: pats.map((p) => ({ body: { contains: p } })) },
    select: {
      id: true, topicId: true, num: true, authorName: true,
      body: true, isHiddenByAi: true, isDeleted: true,
      aiNote: true, aiAction: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
    take: 50,
  });
  console.log(`=== MESSAGES: ${msgs.length}`);
  for (const m of msgs) {
    console.log(JSON.stringify({ ...m, body: m.body.slice(0, 250) }));
  }

  // Скрыть все, что ещё видны
  const toHide = msgs.filter((m) => !m.isHiddenByAi && !m.isDeleted);
  console.log(`\n=== HIDING ${toHide.length} messages`);
  for (const m of toHide) {
    const prev = (m.aiNote ?? "").trim();
    const note = prev ? prev + " | ручное скрытие: угроза/сексуальная лексика" : "ручное скрытие: угроза/сексуальная лексика";
    await db.message.update({
      where: { id: m.id },
      data: {
        isHiddenByAi: true,
        aiAction: "HIDE",
        hiddenReason: "Авто-скрытие: угроза/сексуальная лексика (завалю/трахну/отсоси) 2026-10-27",
        aiNote: note,
      },
    });
    console.log("HIDDEN:", m.id, "by", m.authorName, "topic", m.topicId, "msg#", m.num);
  }
  await db.$disconnect();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
