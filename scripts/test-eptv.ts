/**
 * Тест нового стема «ептвоюмать» (2026-10-27).
 * Запуск: cd /opt/smatrix && bun run scripts/test-eptv.ts
 */
import { checkProfanity } from "@/lib/moderation/profanity";

interface Case { text: string; expect: boolean; why: string }

const cases: Case[] = [
  // должны блокироваться
  { text: "Ептвоюмать", expect: true, why: "слово целиком (стем ептвоюм)" },
  { text: "ёптвоюмать", expect: true, why: "вариант с ё" },
  { text: "ЕПТВОЮМАТЬ!!!", expect: true, why: "капс + пунктуация" },
  { text: "ептваюмать", expect: true, why: "скелет птвмт (пропуск о→а)" },
  { text: "ёпт", expect: true, why: "короткая форма, точное слово" },
  { text: "ёпта", expect: true, why: "короткая форма, префикс епта" },
  { text: "ёб твою мать", expect: true, why: "склейка окна → ебтвоюм" },
  { text: "это всё хуйня", expect: true, why: "регрессия: старый стем" },
  // НЕ должны блокироваться (whitelist/санити)
  { text: "опт и розница", expect: false, why: "опт — скелет «пт» не в списке" },
  { text: "У меня бляха и я из Херсона", expect: false, why: "whitelist регрессия" },
  { text: "Добрый день, подскажите", expect: false, why: "чистый текст" },
];

let pass = 0;
for (const c of cases) {
  const r = checkProfanity(c.text);
  const ok = r.blocked === c.expect;
  if (ok) pass++;
  const hits = r.hits.map((h) => `${h.word}→${h.stem}(${h.mode})`).join(", ");
  console.log(`${ok ? "PASS" : "FAIL"} | ${ok ? "блок" : "пропуск"}=${r.blocked} | "${c.text}" — ${c.why}${hits ? ` | hits: ${hits}` : ""}`);
}
console.log(`\n[RESULT] ${pass}/${cases.length} PASS — ${pass === cases.length ? "ФИЛЬТР ГОТОВ ✅" : "ЕСТЬ ПРОБЛЕМЫ ❌"}`);
process.exit(pass === cases.length ? 0 : 1);
