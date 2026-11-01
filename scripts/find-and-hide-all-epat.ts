/**
 * Найти опубликованное сообщение бота biker со словами «че за епать?»
 * и скрыть его.
 */
import { db } from "@/lib/db";

async function main() {
  const msgs = await db.message.findMany({
    where: { body: { contains: "епать" } },
    select: {
      id: true, topicId: true, num: true, authorName: true,
      body: true, isHiddenByAi: true, isDeleted: true,
      aiNote: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
    take: 20,
  });
  console.log(`=== ALL messages with «епать» (case-sensitive): ${msgs.length}`);
  for (const m of msgs) {
    console.log(JSON.stringify({ ...m, body: m.body.slice(0, 200) }));
  }

  // Скрыть все, что ещё видны
  const toHide = msgs.filter((m) => !m.isHiddenByAi && !m.isDeleted);
  console.log(`\n=== HIDING ${toHide.length} messages`);
  for (const m of toHide) {
    const prev = (m.aiNote ?? "").trim();
    const note = prev ? prev + " | ручное скрытие: брань «епать» (утечка фильтра)" : "ручное скрытие: брань «епать» (утечка фильтра)";
    await db.message.update({
      where: { id: m.id },
      data: {
        isHiddenByAi: true,
        aiAction: "HIDE",
        hiddenReason: "Авто-скрытие: мат (епать) — стем добавлен в лексикон 2026-10-27",
        aiNote: note,
      },
    });
    console.log("HIDDEN:", m.id, "by", m.authorName, "topic", m.topicId, "msg#", m.num);
  }
  await db.$disconnect();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
