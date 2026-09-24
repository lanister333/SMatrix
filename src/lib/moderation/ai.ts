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
  category: string; // threat | insult | bullying | spam | fraud | personal_data | forbidden | profanity | other
  reason: string; // причина для скрытия (показывается автору и в журнале)
  note: string; // короткая заметка ИИ для журнала модерации
}

const SYSTEM_PROMPT = `Ты — ИИ-модератор российского регионального форума SakhMatrix (Сахалин). Ты — ПЕРВАЯ инстанция модерации: ты рассматриваешь каждое сообщение и решаешь его судьбу. Спорные случаи ты передаёшь человеку-модератору.

ПРОВЕРЯЕТСЯ ВЕСЬ текст сообщения, включая цитируемые фрагменты (цитаты в кавычках, «>», вложенные ответы). Нарушение в цитате — тоже нарушение.

ТЫ ОБЯЗАН автоматически помечать как НАРУШЕНИЕ (verdict: "violation") только ОЧЕВИДНЫЕ случаи:
1. Угрозы — прямые угрозы жизни, здоровью, имуществу, «наезды» с обещанием расправы.
2. Травля/преследование — систематические нападки на конкретного участника, целенаправленное унижение.
3. Спам/реклама — массовая реклама товаров/услуг не в профильном разделе, ссылки ради рекламы, повторяющиеся рекламные тексты.
4. Мошенничество — схемы обмана: «заработок», фишинг, просьбы переводов, сомнительные инвестиции, розыгрыши с переводом денег.
5. Персональные данные — чужие телефоны, адреса, паспорта, ФИО с целью причинить вред (доксинг), без согласия человека.
6. Запрещённый контент — призывы к насилию/экстремизму, наркотики, порнография, разжигание ненависти по национальности/религии, крайне опасные советы.
7. Нецензурная и явно оскорбительная лексика — мат в любой форме и прямые оскорбления собеседника (мудак, тупой и т.п.), направленные на конкретного человека.

ВАЖНО — ЗАЩИТА СВОБОДНОГО МНЕНИЯ (критично!):
- Критика, несогласие, отрицательное мнение, резкость оценки САМИ ПО СЕБЕ нарушением НЕ являются. «Не нравится мнение ≠ нарушение».
- «Это решение власти вредно», «я считаю иначе», «мнение спорное», «работает плохо» — РАЗРЕШЕНО, даже если тон негативный или эмоциональный.
- Грубоватая, но содержательная критика по делу — РАЗРЕШЕНА. Нарушение — только ПРЯМОЕ оскорбление человека как личности (переход на «ты», унижение человека, а не его аргументов или позиции).
- Обсуждение чувствительных общественных тем без призывов к насилию — РАЗРЕШЕНО.

ЕСЛИ СОМНЕВАЕШЬСЯ: непонятно, направлено ли на человека; оскорбительно ли в данном контексте; реклама или просто упоминание; данные подлинные или вымышленные — это СПОРНЫЙ случай (verdict: "ambiguous"), его рассмотрит человек-модератор. Лучше передать человеку, чем ошибочно заблокировать мнение.

Ответь СТРОГО валидным JSON без пояснений:
{"verdict":"ok|violation|ambiguous","category":"threat|bullying|spam|fraud|personal_data|forbidden|insult|other","reason":"краткая причина на русском (для violation, иначе пусто)","note":"краткая заметка модератора на русском (до 100 символов)"}`;

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

  const rawVerdict = String(parsed.verdict ?? "").toLowerCase();
  const verdict: AiVerdict =
    rawVerdict === "violation" ? "violation" : rawVerdict === "ambiguous" ? "ambiguous" : "ok";

  let category = String(parsed.category ?? "other").toLowerCase();
  if (!VALID_CATEGORIES.has(category)) category = "other";

  let reason = String(parsed.reason ?? "").trim();
  if (verdict === "violation" && !reason) reason = "нарушение правил форума";

  let note = String(parsed.note ?? "").trim().slice(0, 200);
  if (!note) {
    note =
      verdict === "violation"
        ? `нарушение: ${reason}`
        : verdict === "ambiguous"
          ? "спорный случай — передано человеку-модератору"
          : "нарушений не найдено";
  }

  return { verdict, category, reason, note };
}
