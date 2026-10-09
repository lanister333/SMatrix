/**
 * ШАГ 17. Модерация раздела «Подслушано Сахалин» — самостоятельной городской
 * ленты слухов, наблюдений и сообщений жителей (ТЗ п.16).
 *
 * Принципы (по ТЗ п.15/16):
 *  — Сам факт того, что сообщение является слухом или неподтверждённой
 *    информацией, НЕ является нарушением. ИИ оценивает содержание и реальные
 *    нарушения, а не достоверность сведений.
 *  — Критика, недовольство, слух или неподтверждённое наблюдение сами по себе
 *    не являются нарушением.
 *  — Отдельно проверяются: оскорбления; угрозы; травлю; мошенничество; спам;
 *    рекламу; публикацию персональных данных; запрещённый контент.
 *  — Спорные случаи передаются человеку-модератору.
 */

import { aiModerate, type ModerationOutcome } from "./index";
import { checkProfanity } from "./profanity";

/** Причины жалоб в «Подслушано» (ТЗ п.22). */
export const OVERHEARD_COMPLAINT_CATEGORIES = [
  "insult", // Оскорбления
  "threat", // Угрозы
  "bullying", // Травля
  "fraud", // Мошенничество
  "spam", // Спам
  "ad", // Реклама
  "personal_data", // Персональные данные
  "forbidden", // Запрещённое содержание
  "other", // Другие нарушения
] as const;

/** Маппинг категорий раздела на категории лестницы санкций форума. */
const SANCTION_CATEGORY_MAP: Record<string, string> = {
  insult: "insult",
  threat: "threat",
  bullying: "insult",
  fraud: "fraud",
  spam: "spam",
  ad: "spam",
  personal_data: "personal_data",
  forbidden: "forbidden",
  profanity: "insult",
  other: "other",
};

export function overheardSanctionCategory(category: string | undefined): string {
  return SANCTION_CATEGORY_MAP[category ?? "other"] ?? "other";
}

const OVERHEARD_SYSTEM_PROMPT = `Ты — ИИ-модератор раздела «Подслушано Сахалин» портала SakhMatrix. Это городская лента СЛУХОВ, наблюдений и сообщений жителей: короткие сообщения о том, что человек услышал или заметил в городе. Заголовок + текст + необязательное место. Никаких обсуждений под публикацией.

КЛЮЧЕВОЙ ПРИНЦИП РАЗДЕЛА: сообщения здесь по определению могут быть слухами и неподтверждённой информацией. Сам факт, что сообщение является слухом, сплетней, неподтверждённым наблюдением или «говорят, что…» — ЭТО НЕ НАРУШЕНИЕ. НЕ оценивай достоверность сведений. Оценивай только форму и реальные нарушения.

Помечай как НАРУШЕНИЕ (verdict: "violation") только ОЧЕВИДНЫЕ случаи:
1. Оскорбления — мат, унизительные высказывания о конкретных людях или группах.
2. Угрозы — прямые угрозы физической расправы, насилием, «найду и покалечу» и т.п.
3. Травля — организованное преследование, призывы травить конкретного человека, травля по признаку.
4. Мошенничество — схемы обмана, фишинг, «переведите деньги», сбор средств, финансовые пирамиды.
5. Спам — бессмысленные повторяющиеся сообщения, флуд.
6. Реклама — реклама бизнеса, магазинов, услуг, брендов, «продаю/куплю», вакансии/заработок.
7. Чужие персональные данные — чужие телефоны, адреса, ФИО без согласия, доксинг (не путать с публичными местами и событиями: «на Первой улице авария» — это нормально).
8. Запрещённый контент — призывы к насилию, наркотики, порнография, разжигание ненависти, экстремизм, крайне опасные советы.

ВАЖНО — НЕ БЛОКИРУЙ обычные сообщения раздела. РАЗРЕШЕНО:
- Любые слухи и разговоры города: «говорят, что…», «слышал, что…», «кто-нибудь знает, что происходит…», «заметил, что…».
- Критика и недовольство: плохие дороги, работа учреждений, транспорта, коммунальных служб, мнение о событиях — это НЕ нарушение (если нет оскорблений и угроз).
- Вопросы к городу: «когда включат отопление?», «что за строительство на этой улице?».
- Упоминание публичных мест, улиц, учреждений, организаций в фактическом ключе — это нормально.

ЕСЛИ СОМНЕВАЕШЬСЯ: непонятно, слух это или клевета на конкретного человека; критика или оскорбление — это СПОРНЫЙ случай (verdict: "ambiguous"), его рассмотрит человек-модератор. Лучше передать человеку, чем ошибочно удалить городскую новость или слух.

Ответь СТРОГО валидным JSON без пояснений:
{"verdict":"ok|violation|ambiguous","category":"insult|threat|bullying|fraud|spam|ad|personal_data|forbidden|profanity|other","reason":"краткая причина на русском (для violation, иначе пусто)","note":"краткая заметка модератора на русском (до 100 символов)"}`;

export interface OverheardAiVerdict {
  verdict: "ok" | "violation" | "ambiguous";
  category: string;
  reason: string;
  note: string;
}

const OVERHEARD_VALID_CATEGORIES = new Set([
  "insult", "threat", "bullying", "fraud", "spam", "ad", "personal_data", "forbidden", "profanity", "other",
]);

/** ИИ-вердикт по сообщению «Подслушано». Бросает исключение при недоступности ИИ. */
export async function aiModerateOverheard(title: string, text: string, place?: string): Promise<OverheardAiVerdict> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const completion = await Promise.race([
    zai.chat.completions.create({
      messages: [
        { role: "system", content: OVERHEARD_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Проверь сообщение городской ленты «Подслушано Сахалин» (заголовок и текст; место — справочная часть):\n\nЗАГОЛОВОК:\n"""\n${title.slice(0, 300)}\n"""\n\nТЕКСТ:\n"""\n${text.slice(0, 6000)}\n"""\n\nМЕСТО (необязательно):\n"""\n${(place ?? "").slice(0, 120)}\n"""`,
        },
      ],
      thinking: { type: "disabled" },
    }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("AI timeout")), 45000)),
  ]);

  const { extractJson } = await import("./ai");
  const content = completion.choices[0]?.message?.content ?? "";
  const parsed = extractJson(content);
  if (!parsed) throw new Error("AI: не удалось разобрать ответ");

  const rawVerdict = String(parsed.verdict ?? "").toLowerCase();
  const verdict = rawVerdict === "violation" ? "violation" : rawVerdict === "ambiguous" ? "ambiguous" : "ok";
  let category = String(parsed.category ?? "other").toLowerCase();
  if (!OVERHEARD_VALID_CATEGORIES.has(category)) category = "other";

  let reason = String(parsed.reason ?? "").trim();
  if (verdict === "violation" && !reason) reason = "нарушение правил раздела «Подслушано Сахалин»";

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

/** Полный текст сообщения для проверки лексики. */
function overheardFullText(title: string, text: string, place?: string): string {
  return [title, text, place ?? ""].filter(Boolean).join("\n");
}

/**
 * Проверка НОВОГО сообщения перед публикацией (и при редактировании).
 * Шаг 1 — детерминированный фильтр лексики; шаг 2 — ИИ раздела «Подслушано».
 */
export async function moderateNewOverheardText(
  title: string,
  text: string,
  place?: string
): Promise<ModerationOutcome & { overheardCategory?: string }> {
  // Шаг 1. Общий фильтр нецензурной/оскорбительной лексики (общий механизм сайта).
  const prof = checkProfanity(overheardFullText(title, text, place));
  if (prof.blocked) {
    return {
      action: "block",
      blockMessage:
        "Сообщение содержит нецензурную или оскорбительную лексику. Пожалуйста, отредактируйте текст и попробуйте снова.",
      aiNote: "нецензурная лексика (автофильтр)",
      needHuman: false,
      source: "profanity",
      hits: prof.hits,
      overheardCategory: "profanity",
    };
  }

  // Шаг 2. ИИ-модератор раздела.
  try {
    const ai = await aiModerateOverheard(title, text, place);
    if (ai.verdict === "violation") {
      return {
        action: "hide",
        hiddenReason: ai.reason,
        aiNote: ai.note,
        needHuman: false,
        source: "ai",
        category: overheardSanctionCategory(ai.category),
        overheardCategory: ai.category,
      };
    }
    if (ai.verdict === "ambiguous") {
      return {
        action: "human",
        aiNote: ai.note,
        needHuman: true,
        source: "ai",
        category: overheardSanctionCategory(ai.category),
        overheardCategory: ai.category,
      };
    }
    return { action: "allow", aiNote: ai.note, needHuman: false, source: "ai", overheardCategory: ai.category };
  } catch {
    // ИИ недоступен: лексический фильтр пройден — публикуем,
    // но обязательно ставим в очередь человеку-модератору.
    return {
      action: "human",
      aiNote: "ИИ-модератор недоступен — требуется проверка человеком",
      needHuman: true,
      source: "fallback",
    };
  }
}

/** Повторная проверка УЖЕ опубликованного сообщения (по жалобе или при правке). */
export async function moderatePublishedOverheardText(
  title: string,
  text: string,
  place?: string
): Promise<ModerationOutcome & { overheardCategory?: string }> {
  const outcome = await moderateNewOverheardText(title, text, place);
  if (outcome.action === "block") {
    return {
      ...outcome,
      action: "hide",
      hiddenReason: "нецензурная или оскорбительная лексика",
      needHuman: false,
    };
  }
  return outcome;
}
