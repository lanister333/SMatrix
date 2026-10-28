
import { db } from "@/lib/db";
async function main() {
  const id = "cmvq74jr6001zk4z3kgqhz5ay";
  const m = await db.message.findUnique({ where: { id }, select: { body: true, isHiddenByAi: true, aiNote: true } });
  if (!m) { console.log("NOT FOUND", id); return; }
  const prev = (m.aiNote ?? "").trim();
  await db.message.update({
    where: { id },
    data: {
      isHiddenByAi: true,
      aiAction: "HIDE",
      hiddenReason: "Авто-скрытие: мат (ептвоюмать) — стем добавлен в лексикон 2026-10-27",
      aiNote: prev ? prev + " | ручное скрытие: брань «ептвоюмать» (утечка фильтра)" : "ручное скрытие: брань «ептвоюмать» (утечка фильтра)",
    },
  });
  const after = await db.message.findUnique({ where: { id }, select: { isHiddenByAi: true, aiAction: true, hiddenReason: true } });
  console.log("HIDDEN:", JSON.stringify(after));
  await db.$disconnect();
}
main().catch(e => { console.error("FATAL:", e); process.exit(1); });
