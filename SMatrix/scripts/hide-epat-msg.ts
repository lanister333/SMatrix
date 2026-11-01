
import { db } from "@/lib/db";
async function main() {
  const id = "cmvq7pzk4001fk4zciiodcwbd";
  const m = await db.message.findUnique({ where: { id }, select: { body: true, aiNote: true } });
  if (!m) { console.log("HIDE: not found"); return; }
  const prev = (m.aiNote ?? "").trim();
  await db.message.update({
    where: { id },
    data: {
      isHiddenByAi: true,
      aiAction: "HIDE",
      hiddenReason: "Авто-скрытие: мат (епать) — стем добавлен в лексикон 2026-10-27",
      aiNote: prev ? prev + " | ручное скрытие: брань «епать» (утечка фильтра)" : "ручное скрытие: брань «епать» (утечка фильтра)",
    },
  });
  console.log("HIDDEN:", id);
  await db.$disconnect();
}
main().catch(e => { console.error("FATAL HIDE:", e); process.exit(1); });
