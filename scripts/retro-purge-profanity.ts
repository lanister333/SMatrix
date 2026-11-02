/**
 * Ретро-зачистка (вариант A, 2026-10-27).
 *
 * Проходится по всем Message, которые НЕ скрыты и НЕ удалены,
 * прогоняет через детерминированный фильтр checkProfanity (ТОТ ЖЕ,
 * что использует moderateNewText) и скрывает найденные с матом.
 *
 * Запуск: cd /opt/smatrix && bun run scripts/retro-purge-profanity.ts
 */
import { checkProfanity } from "@/lib/moderation/profanity";
import { db } from "@/lib/db";

async function main() {
  const t0 = Date.now();
  console.log("[retro-purge] start");

  // Загружаем все кандидаты: не скрыты AI и не удалены.
  const candidates = await db.message.findMany({
    where: { isHiddenByAi: false, isDeleted: false },
    select: { id: true, body: true, aiNote: true, topicId: true, num: true, authorName: true },
  });
  console.log(`[retro-purge] candidates: ${candidates.length}`);

  let flagged = 0;
  const updates: { id: string; hits: string; topicId: number; num: number; author: string; body: string }[] = [];

  for (const m of candidates) {
    if (!m.body) continue;
    const res = checkProfanity(m.body);
    if (!res.blocked) continue;
    flagged++;
    const hitsStr = res.hits.map((h) => `${h.word}→${h.stem}(${h.mode})`).join(", ");
    updates.push({
      id: m.id,
      hits: hitsStr,
      topicId: m.topicId,
      num: m.num,
      author: m.authorName,
      body: m.body.slice(0, 200),
    });
  }

  console.log(`[retro-purge] flagged: ${flagged}`);
  if (flagged === 0) {
    await db.$disconnect();
    console.log(`[retro-purge] done in ${Date.now() - t0}ms (no changes)`);
    return;
  }

  // Применяем UPDATE по каждому.
  // Чтобы не терять исходный aiNote — конкатенируем через " | ".
  for (const u of updates) {
    const existing = await db.message.findUnique({
      where: { id: u.id },
      select: { aiNote: true },
    });
    const prevNote = (existing?.aiNote ?? "").trim();
    const newNote = prevNote
      ? `${prevNote} | ретро-зачистка (вариант A): мат — ${u.hits}`
      : `ретро-зачистка (вариант A): мат — ${u.hits}`;

    await db.message.update({
      where: { id: u.id },
      data: {
        isHiddenByAi: true,
        aiAction: "HIDE",
        hiddenReason: "Ретро-зачистка (вариант A): нецензурная лексика",
        aiNote: newNote,
        needHuman: false,
      },
    });
  }

  // Печатаем подробности для аудита
  console.log("\n=== FLAGGED MESSAGES ===");
  for (const u of updates) {
    console.log(`- topic ${u.topicId} msg#${u.num} by ${u.author} [id=${u.id}]`);
    console.log(`  hits: ${u.hits}`);
    console.log(`  body: ${u.body.replace(/\n/g, " ").slice(0, 120)}${u.body.length > 120 ? "…" : ""}`);
  }
  console.log(`\n[retro-purge] hidden ${flagged} messages in ${Date.now() - t0}ms`);

  await db.$disconnect();
  console.log("[retro-purge] done");
}

main().catch((e) => {
  console.error("[retro-purge] FATAL:", e);
  process.exit(1);
});
