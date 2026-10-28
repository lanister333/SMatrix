/**
 * Найти «уебок»/«уёбок»/«уебан» в Message (видимые) и в BotQueue (approved/pending).
 */
import { db } from "@/lib/db";

async function main() {
  const pats = ["уебок", "Уебок", "УЕБОК", "уёбок", "Ёбок", "уебан", "Уебан", "уёбан"];
  const msgs = await db.message.findMany({
    where: { OR: pats.map((p) => ({ body: { contains: p } })) },
    select: { id: true, topicId: true, num: true, authorName: true, body: true, isHiddenByAi: true, isDeleted: true, createdAt: true },
    orderBy: { createdAt: "desc" as const },
    take: 20,
  });
  console.log(`=== MESSAGES: ${msgs.length}`);
  for (const m of msgs) console.log(JSON.stringify({ ...m, body: m.body.slice(0, 200) }));

  const queue = await db.botQueue.findMany({
    where: { OR: pats.flatMap((p) => [{ text: { contains: p } }, { sourceText: { contains: p } }]) },
    select: { id: true, status: true, text: true, botNickname: true, topicId: true, createdAt: true },
    take: 20,
  });
  console.log(`\n=== BOTQUEUE: ${queue.length}`);
  for (const q of queue) console.log(JSON.stringify({ ...q, text: q.text?.slice(0, 200) }));
  await db.$disconnect();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
