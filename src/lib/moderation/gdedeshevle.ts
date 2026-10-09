/**
 * ШАГ 23. Модерация раздела «Где дешевле» — самостоятельной страницы
 * сравнения цен на КОНКРЕТНЫЕ товары (ТЗ п.18–20).
 *
 * Принципы (по ТЗ):
 *  — Раздел НЕ рекламная площадка (п.18): запрещены реклама магазинов/продавцов,
 *    продвижение собственного бизнеса, «предложения купить у автора»,
 *    массовые одинаковые ответы, скрытая реклама, навязчивое продвижение
 *    конкретного магазина, платное продвижение публикаций.
 *  — ВАЖНОЕ ИСКЛЮЧЕНИЕ (п.19): ссылка, название/адрес магазина, телефон
 *    сами по себе НЕ нарушение. Оценивается КОНТЕКСТ: ответ «в магазине X
 *    этот товар стоит 18 900 ₽, вот ссылка» — нормальная информация по вопросу.
 *    Систематическая реклама собственного магазина — реклама/спам.
 *  — Спорные случаи передаются человеку-модератору, автоматически
 *    блокировать пользователя только за подозрение нельзя (п.20).
 */

import { checkProfanity } from "./profanity";
import type { ModerationOutcome } from "./index";

/** Причины жалоб в «Где дешевле» (ТЗ п.21 — ровно пять). */
export const GDEDESHEVLE_COMPLAINT_CATEGORIES = [
  "ad", // Реклама
  "spam", // Спам
  "fraud", // Мошенничество
  "personal_data", // Личные данные
  "other", // Другое
] as const;

/** Маппинг категорий раздела на категории лестницы санкций форума. */
const SANCTION_CATEGORY_MAP: Record<string, string> = {
  ad: "spam",
  spam: "spam",
  fraud: "fraud",
  personal_data: "personal_data",
  profanity: "insult",
  other: "other",
};

export function gdedeshevleSanctionCategory(category: string | undefined): string {
  return SANCTION_CATEGORY_MAP[category ?? "other"] ?? "other";
}

const GDEDESHEVLE_SYSTEM_PROMPT = `Ты — ИИ-модератор раздела «Где дешевле» портала SakhMatrix. Это лента вопросов жителей Сахалина, сравнивающих ЦЕНУ КОНКРЕТНОГО товара: конкретную модель, артикул, размер, комплектацию. Заголовок + текст вопроса + необязательное место. Никаких комментариев на странице — сравнение и ответы только на форуме.

ГЛАВНОЕ ПРАВИЛО РАЗДЕЛА: здесь сравнивают цену конкретного товара («Где дешевле купить Bosch S5 AGM 70 Ah?»), а не спрашивают, где вообще дешевле покупать. Общие вопросы о категориях («где дешевле продукты», «какой магазин самый дешёвый») НЕ являются нарушением для скрытия — этим занимается не ИИ-модерация.

Помечай как НАРУШЕНИЕ (verdict: "violation") только ОЧЕВИДНЫЕ случаи:
1. Реклама — публикация предлагает купить у автора: «продаю», «покупайте у меня», «у меня есть такой товар, обращайтесь», координаты продавца с призывом покупки. Вопрос «где дешевле купить X?» рекламой НЕ является.
2. Скрытая реклама — продвижение конкретного магазина/своего бизнеса под видом вопроса или систематическое навязывание одного продавца: «всегда покупайте только в магазине X на Солнечной, у них лучшие цены, звоните мне».
3. Коммерческие предложения и продвижение собственного бизнеса/магазина/услуг.
4. Спам — бессмысленный текст, флуд, массовые одинаковые публикации, повторные однотипные объявления.
5. Мошенничество — схемы обмана, фейковые распродажи, сбор предоплат, фишинг.
6. Чужие персональные данные — чужие телефоны/адреса/ФИО без согласия, доксинг.
7. Запрещённый контент — призывы к насилию, наркотики, порнография, разжигание ненависти, экстремизм.

ВАЖНО — НЕ БЛОКИРУЙ обычные вопросы раздела. РАЗРЕШЕНО:
- Вопрос о цене конкретного товара с упоминанием магазинов, продавцов, районов.
- Указание желаемой цены, бюджета, количества одного конкретного товара.
- Ссылки на страницу товара, упоминание артикулов и моделей.
- Просьбы подсказать, где сейчас выгоднее купить конкретную модель.

ЕСЛИ СОМНЕВАЕШЬСЯ: непонятно, вопрос это или скрытая реклама; спорная ссылка; пограничное коммерческое упоминание — это СПОРНЫЙ случай (verdict: "ambiguous"), его рассмотрит человек-модератор. Лучше передать человеку, чем ошибочно скрыть честный вопрос.

Ответь СТРОГО валидным JSON без пояснений:
{"verdict":"ok|violation|ambiguous","category":"ad|spam|fraud|personal_data|forbidden|profanity|other","reason":"краткая причина на русском (для violation, иначе пусто)","note":"краткая заметка модератора на русском (до 100 символов)"}`;

export interface GdedeshevleAiVerdict {
  verdict: "ok" | "violation" | "ambiguous";
  category: string;
  reason: string;
  note: string;
}

const VALID_CATEGORIES = new Set([
  "ad", "spam", "fraud", "personal_data", "forbidden", "profanity", "other",
]);

/** ИИ-вердикт по вопросу «Где дешевле». Бросает исключение при недоступности ИИ. */
export async function aiModerateGdedeshevle(title: string, text: string, place?: string): Promise<GdedeshevleAiVerdict> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const completion = await Promise.race([
    zai.chat.completions.create({
      messages: [
        { role: "system", content: GDEDESHEVLE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Проверь вопрос раздела «Где дешевле» (заголовок и текст; место — справочная часть):\n\nЗАГОЛОВОК:\n"""\n${title.slice(0, 300)}\n"""\n\nТЕКСТ ВОПРОСА:\n"""\n${text.slice(0, 6000)}\n"""\n\nМЕСТО (необязательно):\n"""\n${(place ?? "").slice(0, 120)}\n"""`,
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
  if (!VALID_CATEGORIES.has(category)) category = "other";

  let reason = String(parsed.reason ?? "").trim();
  if (verdict === "violation" && !reason) reason = "нарушение правил раздела «Где дешевле»";

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

/** Полный текст вопроса для проверки лексики. */
function fullText(title: string, text: string, place?: string): string {
  return [title, text, place ?? ""].filter(Boolean).join("\n");
}

/**
 * Проверка НОВОГО вопроса перед публикацией (и при редактировании).
 * Шаг 1 — детерминированный фильтр лексики; шаг 2 — ИИ раздела «Где дешевле»
 * (реклама/скрытая реклама/спам/мошенничество; упоминание магазина, цены,
 * ссылки или телефона в вопросе о конкретном товаре — НЕ нарушение, ТЗ п.19).
 */
export async function moderateNewGdedeshevleText(
  title: string,
  text: string,
  place?: string
): Promise<ModerationOutcome & { gdedeshevleCategory?: string }> {
  // Шаг 1. Общий фильтр нецензурной/оскорбительной лексики (общий механизм сайта).
  const prof = checkProfanity(fullText(title, text, place));
  if (prof.blocked) {
    return {
      action: "block",
      blockMessage:
        "Вопрос содержит нецензурную или оскорбительную лексику. Пожалуйста, отредактируйте текст и попробуйте снова.",
      aiNote: "нецензурная лексика (автофильтр)",
      needHuman: false,
      source: "profanity",
      hits: prof.hits,
      gdedeshevleCategory: "profanity",
    };
  }

  // Шаг 2. ИИ-модератор раздела.
  try {
    const ai = await aiModerateGdedeshevle(title, text, place);
    if (ai.verdict === "violation") {
      return {
        action: "hide",
        hiddenReason: ai.reason,
        aiNote: ai.note,
        needHuman: false,
        source: "ai",
        category: gdedeshevleSanctionCategory(ai.category),
        gdedeshevleCategory: ai.category,
      };
    }
    if (ai.verdict === "ambiguous") {
      return {
        action: "human",
        aiNote: ai.note,
        needHuman: true,
        source: "ai",
        category: gdedeshevleSanctionCategory(ai.category),
        gdedeshevleCategory: ai.category,
      };
    }
    return { action: "allow", aiNote: ai.note, needHuman: false, source: "ai", gdedeshevleCategory: ai.category };
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

/** Повторная проверка УЖЕ опубликованного вопроса (по жалобе или при правке). */
export async function moderatePublishedGdedeshevleText(
  title: string,
  text: string,
  place?: string
): Promise<ModerationOutcome & { gdedeshevleCategory?: string }> {
  const outcome = await moderateNewGdedeshevleText(title, text, place);
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
