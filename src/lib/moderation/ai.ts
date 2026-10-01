/**
 * ШАГ 10. ИИ-модератор — первая инстанция модерации форума.
 *
 * Принципы (по ТЗ):
 *  — ИИ рассматривает текст ПЕРВЫМ и автоматически разбирает очевидные
 *    нарушения: угрозы; травлю/преследование; спам; мошенничество;
 *    персональные данные; запрещённый контент; нецензурную и явно
 *    оскорбительную лексику; другие очевидные нарушения правил;
 *  — критика, несогласие и отрицательное мнение сами по себе нарушением
 *    НЕ являются («не нравится мнение ≠ нарушение»);
 *  — учитывается контекст, включая цитируемый текст;
 *  — спорные/неоднозначные случаи передаются человеку-модератору.
 */

import ZAI from "z-ai-web-dev-sdk";

export type AiVerdict = "ok" | "violation" | "ambiguous";

export interface AiModerationVerdict {
  verdict: AiVerdict;
  category: string;
  reason: string;
  note: string;
  /** 2026-10-01: уровень нарушения (1=критическая опасность, 2=серьёзное,
   *  3=нарушение правил общения, 4=нарушения нет). */
  level: number;
  /** 2026-10-01: технический статус AI: WATCH | LIMIT | STOP | ALERT. */
  action: string;
  /** 2026-10-01: уверенность AI: "low" | "medium" | "high". */
  confidence: string;
  /** 2026-10-01: сработавший сигнал (короткое описание). */
  signal: string;
  /** 2026-10-01: требуется человек-модератор (да/нет). */
  needsHuman: boolean;
}

const SYSTEM_PROMPT = `Ты — ИИ-помощник модератора общественной платформы SakhMatrix (Сахалин). Ты — ПЕРВАЯ инстанция модерации: проверяешь пользовательский контент, учитываешь контекст и помогаешь администратору соблюдать правила.

ПРОВЕРЯЕТСЯ ВЕСЬ текст сообщения, включая цитируемые фрагменты. Нарушение в цитате — тоже нарушение.

ЧТО АНАЛИЗИРОВАТЬ:
- Текст сообщения, несколько сообщений до и после (если есть контекст в запросе), тему и раздел, жалобу (если есть), историю нарушений, повторяемость поведения и контекст конфликта.

ЧТО НЕ ЯВЛЯЕТСЯ НАРУШЕНИЕМ САМО ПО СЕБЕ:
- Критика, несогласие, негативное мнение, жалоба, резкое содержательное несогласие, неприятная точка зрения и обычное предложение своих услуг НЕ являются нарушением только из-за их содержания.
- «Это решение вредно», «я считаю иначе», «работает плохо» — РАЗРЕШЕНО, даже если тон негативный.
- Грубоватая, но содержательная критика по делу — РАЗРЕШЕНА.

УРОВНИ НАРУШЕНИЯ:
- Уровень 4 — нарушения нет: обычная критика, спор, отрицательное мнение, аргументированное несогласие, нормальное общение. Действие: WATCH (наблюдение).
- Уровень 3 — нарушение правил общения: оскорбления, неуместная грубость, провокации, флуд, бессмысленные повторы, систематический оффтопик, агрессивное поведение, спам. Действие: WATCH или LIMIT (замечание/предупреждение/ограничение в зависимости от уверенности и повторяемости).
- Уровень 2 — серьёзное нарушение: систематическая травля, преследование, серьёзные оскорбления, дискриминация, злонамеренная дезинформация, обход блокировки. Действие: LIMIT или STOP (передать администратору с рекомендацией).
- Уровень 1 — критическая опасность: прямая угроза физического вреда, опасные призывы, очевидное мошенничество через платформу, особо опасные персональные данные (доксинг). Действие: ALERT (скрыть и немедленно уведомить администратора). Длительный бан автоматически не выдавать.

ДОПУСТИМЫЕ ДЕЙСТВИЯ AI:
- Нормальное сообщение — публиковать (WATCH).
- Лёгкое нарушение — публиковать или помечать (WATCH).
- Очевидный флуд — скрывать (STOP).
- Очевидный спам — останавливать (STOP).
- Критическое запрещённое содержание — не публиковать (ALERT).
- Угроза или опасный контент — скрыть и срочно передать администратору (ALERT).
- Сомнительное — передать администратору (LIMIT).
- Повторные нарушения — показать историю и рекомендацию (LIMIT или STOP).

ГЛАВНЫЙ ПРИНЦИП: AI — помощник администратора, а не окончательный судья. В спорных случаях последнее слово остаётся за администратором. AI НЕ выдаёт самостоятельно длительные блокировки.

Ответь СТРОГО валидным JSON без пояснений:
{"level":1|2|3|4,"action":"WATCH|LIMIT|STOP|ALERT","confidence":"low|medium|high","reason":"краткая причина на русском (до 200 символов)","signal":"что сработало (до 100 символов)","needsHuman":true|false,"category":"threat|bullying|spam|fraud|personal_data|forbidden|insult|other"}`;

export function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

const VALID_CATEGORIES = new Set([
  "threat", "bullying", "spam", "fraud", "personal_data", "forbidden", "insult", "other",
]);

/** ИИ-вердикт по тексту сообщения. Бросает исключение при недоступности ИИ. */
export async function aiModerate(text: string): Promise<AiModerationVerdict> {
  const zai = await ZAI.create();
  const completion = await Promise.race([
    zai.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Проверь сообщение форума (проверь весь текст, включая цитаты):\n\n"""\n${text.slice(0, 8000)}\n"""`,
        },
      ],
      thinking: { type: "disabled" },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI timeout")), 45000)
    ),
  ]);

  const content = completion.choices[0]?.message?.content ?? "";
  const parsed = extractJson(content);
  if (!parsed) throw new Error("AI: не удалось разобрать ответ");

  // 2026-10-01: новый формат ответа с уровнями 1-4 и действиями AI
  const level = Math.max(1, Math.min(4, parseInt(String(parsed.level ?? "4"), 10) || 4));
  const rawAction = String(parsed.action ?? "WATCH").toUpperCase();
  const action = ["WATCH", "LIMIT", "STOP", "ALERT"].includes(rawAction) ? rawAction : "WATCH";
  const rawConfidence = String(parsed.confidence ?? "low").toLowerCase();
  const confidence = ["low", "medium", "high"].includes(rawConfidence) ? rawConfidence : "low";
  const reason = String(parsed.reason ?? "").trim().slice(0, 200);
  const signal = String(parsed.signal ?? "").trim().slice(0, 100);
  const needsHuman = parsed.needsHuman === true || action === "ALERT" || action === "LIMIT" || level <= 2;

  let category = String(parsed.category ?? "other").toLowerCase();
  if (!VALID_CATEGORIES.has(category)) category = "other";

  // Маппинг нового формата → старый verdict (обратная совместимость)
  let verdict: AiVerdict;
  if (level <= 2) verdict = "violation";
  else if (level === 3) verdict = "ambiguous";
  else verdict = "ok";

  const note = reason || signal || (level === 4 ? "нарушений не найдено" : level === 3 ? "нарушение правил общения" : level === 2 ? "серьёзное нарушение" : "критическая опасность");

  return { verdict, category, reason, note, level, action, confidence, signal, needsHuman };
}
