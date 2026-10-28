
import { db } from "@/lib/db";
async function main() {
  // Ищем pending/approved записи BotQueue, где text содержит «епать»
  const items = await db.botQueue.findMany({
    where: { OR: [
      { text: { contains: "епать" } },
      { text: { contains: "Епать" } },
      { text: { contains: "ЕПАТЬ" } },
      { text: { contains: "ёпать" } },
      { text: { contains: "Ёпать" } },
    ] },
    select: { id: true, status: true, text: true, botNickname: true, topicId: true, createdAt: true },
  });
  console.log("QUEUE items with «епать»:", items.length);
  for (const it of items) {
    console.log(" -", JSON.stringify({ ...it, text: it.text?.slice(0, 200) }));
  }
  // Удаляем только те, что ещё не опубликованы (status != published)
  const toDelete = items.filter((it) => it.status !== "published");
  for (const it of toDelete) {
    await db.botQueue.delete({ where: { id: it.id } });
    console.log("DELETED from queue:", it.id, "status=", it.status);
  }
  await db.$disconnect();
}
main().catch(e => { console.error("FATAL QUEUE:", e); process.exit(1); });
