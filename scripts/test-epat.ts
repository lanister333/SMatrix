/**
 * Тест нового стема «епать» и расширенных «еб-» основ (2026-10-27).
 * Запуск: cd /opt/smatrix && bun run scripts/test-epat.ts
 */
import { checkProfanity } from "@/lib/moderation/profanity";

interface Case { text: string; expect: boolean; why: string }

const cases: Case[] = [
  // должны блокироваться (новые утечки)
  { text: "Епать", expect: true, why: "слово целиком — стем епат" },
  { text: "ёпать", expect: true, why: "вариант с ё" },
  { text: "ЕПАТЬ!!!", expect: true, why: "капс + пунктуация" },
  { text: "че за епать?", expect: true, why: "внутри предложения — стем епат" },
  { text: "епать-колотить", expect: true, why: "через дефис — стем епат" },
  { text: "ебать", expect: true, why: "прямой мат — стем ебат" },
  { text: "ёбаный", expect: true, why: "стем ёбан" },
  { text: "ебаный", expect: true, why: "стем ебан (без ё)" },
  { text: "ебло", expect: true, why: "стем ебло" },
  // регрессии (прежние утечки)
  { text: "Ептвоюмать", expect: true, why: "прежняя утечка 1" },
  { text: "Это все хуйня", expect: true, why: "прежний стем хуй" },
  { text: "м у д а к", expect: true, why: "обфускация мудак" },
  // НЕ должны блокироваться (whitelist/санити)
  { text: "опт и розница", expect: false, why: "опт — скелет «пт» не в списке" },
  { text: "У меня бляха и я из Херсона", expect: false, why: "whitelist" },
  { text: "Добрый день, подскажите", expect: false, why: "чистый текст" },
  { text: "команда медиков из Херсона", expect: false, why: "whitelist сложный" },
  // критичные санити (по смыслу не должны задевать обычные слова)
  { text: "лекарство от температуры", expect: false, why: "обычный текст про здоровье" },
  { text: "командировка в командировку", expect: false, why: "команд-" },
];

let pass = 0;
for (const c of cases) {
  const r = checkProfanity(c.text);
  const ok = r.blocked === c.expect;
  if (ok) pass++;
  const hits = r.hits.map((h) => `${h.word}→${h.stem}(${h.mode})`).join(", ");
  console.log(`${ok ? "PASS" : "FAIL"} | блок=${r.blocked} | "${c.text}" — ${c.why}${hits ? ` | hits: ${hits}` : ""}`);
}
console.log(`\n[RESULT] ${pass}/${cases.length} PASS — ${pass === cases.length ? "ФИЛЬТР ГОТОВ ✅" : "ЕСТЬ ПРОБЛЕМЫ ❌"}`);
process.exit(pass === cases.length ? 0 : 1);
