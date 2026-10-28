/**
 * Кто скрыл сообщения с «уебок»? Читаем hiddenReason/aiNote/aiAction.
 */
import { db } from "@/lib/db";

async function main() {
  const ids = ["cmvq9uoqm0003k410eihc81s4", "cmvq9ug4a001bk4qr5z8f4uv7", "cmvq9sdw50012k4qrlgqeklkg"];
  const msgs = await db.message.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, authorName: true, body: true,
      isHiddenByAi: true, hiddenReason: true, aiAction: true, aiNote: true,
      aiSignal: true, modLevel: true, needHuman: true, createdAt: true,
    },
  });
  for (const m of msgs) {
    console.log(JSON.stringify(m, null, 1));
  }
  await db.$disconnect();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
