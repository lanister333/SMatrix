/**
 * E2E-тест шага 1: AI-модератор через туннель работает.
 * Запуск: cd /opt/smatrix && bun run scripts/test-ai-moderator.ts
 */
import { moderateNewText } from "@/lib/moderation/index";
import { db } from "@/lib/db";

async function main() {
  const cases = [
    { text: "Привет всем! Как погода на выходных?", expect: "allow/human (level 4)" },
    { text: "Я тебя завалю", expect: "violation/ALERT (угроза)" },
    { text: "Трахну", expect: "violation (секс/угроза)" },
    { text: "Отсоси понял", expect: "violation (секс-оскорбление)" },
  ];

  for (const c of cases) {
    const t0 = Date.now();
    const o = await moderateNewText(c.text);
    console.log(
      `"${c.text}"\n` +
      `  → action=${o.action} source=${o.source} level=${o.modLevel} aiAction=${o.aiAction} ` +
      `category=${o.category} conf=${o.aiConfidence} needHuman=${o.needHuman} (${Date.now() - t0}мс)\n` +
      `  note="${(o.aiNote ?? "").slice(0, 120)}"\n` +
      `  ожидание: ${c.expect}`
    );
  }
  await db.$disconnect();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
