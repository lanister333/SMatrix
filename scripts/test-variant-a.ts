/**
 * Тест варианта A (2026-10-27): moderateNewText() должна блокировать мат
 * ВСЕГДА, даже в shadow mode (aiShadowMode="1" / отсутствует).
 *
 * Запуск: cd /opt/smatrix && bun run scripts/test-variant-a.ts
 */
import { moderateNewText, isShadowMode } from "@/lib/moderation/index";
import { db } from "@/lib/db";

async function main() {
  const shadow = await isShadowMode();
  console.log(`[test] shadowMode (текущий): ${shadow}`);

  // Аудит: сколько сообщений уже помечены ретро-зачисткой (след раннего запуска)
  const retroMarked = await db.message.count({
    where: {
      OR: [
        { hiddenReason: { contains: "Ретро-зачистка" } },
        { aiNote: { contains: "ретро-зачистка" } },
      ],
    },
  });
  console.log(`[audit] сообщений с меткой «ретро-зачистка»: ${retroMarked}`);

  // Состояние известного инцидентного сообщения (топик 1025, msg #8)
  const incident = await db.message.findUnique({
    where: { id: "cmvq48qod001dk4sxstdvqsws" },
    select: { isHiddenByAi: true, aiAction: true, hiddenReason: true },
  });
  console.log(`[audit] инцидентное msg cmvq48qod: ${JSON.stringify(incident)}`);

  // Тест 1: мат — должен быть block при любом shadow mode
  const t1 = await moderateNewText("Это все хуйня");
  console.log(`[test1 мат] action=${t1.action} source=${t1.source} shadowMode=${t1.shadowMode} aiNote="${t1.aiNote}"`);
  console.log(`[test1 мат] hits=${JSON.stringify(t1.hits?.map((h) => h.word))}`);
  console.log(`[test1 мат] blockMessage="${t1.blockMessage}"`);

  // Тест 2: обфусцированный мат — тоже block
  const t2 = await moderateNewText("какой же ты м у д а к");
  console.log(`[test2 обфуск] action=${t2.action} source=${t2.source} hits=${JSON.stringify(t2.hits?.map((h) => h.word))}`);

  // Тест 3: легитимное слово из whitelist («бляха», «херсон») — НЕ block
  const t3 = await moderateNewText("У меня есть бляха и я приехал из Херсона");
  console.log(`[test3 whitelist] action=${t3.action} source=${t3.source} aiNote="${t3.aiNote ?? ""}"`);

  // Итог
  const pass1 = t1.action === "block" && t1.source === "profanity";
  const pass2 = t2.action === "block" && t2.source === "profanity";
  const pass3 = t3.action !== "block";
  console.log(`\n[RESULT] test1(мат→block): ${pass1 ? "PASS" : "FAIL"} | test2(обфуск→block): ${pass2 ? "PASS" : "FAIL"} | test3(whitelist не блокируется): ${pass3 ? "PASS" : "FAIL"}`);
  console.log(`[RESULT] ВАРИАНТ A: ${pass1 && pass2 && pass3 ? "РАБОТАЕТ ✅" : "ЕСТЬ ПРОБЛЕМЫ ❌"}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error("[test] FATAL:", e);
  process.exit(1);
});
