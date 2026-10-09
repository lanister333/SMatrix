/**
 * ШАГ 18. Модерация раздела «Где купить» — самостоятельной страницы вопросов
 * о КОНКРЕТНЫХ товарах (ТЗ п.14–17).
 *
 * Принципы (по ТЗ):
 *  — Раздел НЕ рекламная площадка (п.14): запрещены реклама магазинов/продавцов,
 *    продвижение собственного бизнеса, «продаю… покупайте у меня», коммерческие
 *    объявления, массовые рекламные сообщения, скрытая реклама, рекламные ссылки.
 *  — ВАЖНОЕ ИСКЛЮЧЕНИЕ (п.15): ссылка, телефон, адрес или название магазина
 *    сами по себе НЕ нарушение. Оценивается КОНТЕКСТ: вопрос о конкретном
 *    товаре, в котором упоминается магазин/цена, — нормальный вопрос.
 *  — Вопрос о цене конкретного товара разрешён (п.6). Вопрос «где дешевле» —
 *    тема отдельного раздела, но не нарушение для скрытия.
 *  — Не блокировать пользователя автоматически только из-за подозрения (п.16):
 *    спорные случаи — человеку-модератору (существующая система AI → человек).
 *  — ИИ учитывает повторяющиеся рекламные публикации (п.16), технические
 *    ограничения повторов реализованы на уровне API (rate limit + дубликаты).
 */

import { checkProfanity } from "./profanity";
import type { ModerationOutcome } from "./index";

/** Причины жалоб в «Где купить» (ТЗ п.18 — ровно пять). */
export const WHERETOBUY_COMPLAINT_CATEGORIES = [
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

export function wheretobuySanctionCategory(category: string | undefined): string {
  return SANCTION_CATEGORY_MAP[category ?? "other"] ?? "other";
}

const WHERETOBUY_SYSTEM_PROMPT = `Ты — ИИ-модератор раздела «Где купить» портала SakhMatrix. Это лента ВОПРОСОВ жителей Сахалина о том, где купить КОНКРЕТНЫЙ товар: конкретную модель, артикул, размер, модификацию. Заголовок + текст вопроса + необязательное место. Никаких комментариев под вопросом — обсуждение только на форуме.

ГЛАВНОЕ ПРАВИЛО РАЗДЕЛА: здесь спрашивают не «где купить вообще», а «где купить вот этот конкретный товар» (например: «Где купить аккумулятор Bosch S5 AGM 70 Ah?»). Общие вопросы-категории («где купить телевизор?») НЕ являются нарушением для скрытия — это просто не подходит разделу; скрытием таких вопросов занимается не ИИ-модерация.

Помечай как НАРУШЕНИЕ (verdict: "violation") только ОЧЕВИДНЫЕ случаи:
1. Реклама — публикация предлагает купить товар у автора: «продаю», «есть в наличии, обращайтесь ко мне», «покупайте в моём магазине», координаты продавца с призывом покупки. Вопрос «где купить X?» рекламой НЕ является.
2. Скрытая реклама — вопрос, замаскированный под рекламу: «кто-нибудь видел Bosch S5 AGM 70 Ah? А то у нас в магазине X на Солнечной отличная цена, звоните» — то есть продвижение конкретного продавца/своего бизнеса под видом вопроса.
3. Коммерческие объявления и продвижение собственного бизнеса/магазина/услуг.
4. Спам — бессмысленный текст, флуд, повторяющиеся однотипные сообщения, массовая публикация одного и того же.
5. Мошенничество — схемы обмана, фишинг, предоплата чужому человеку, сбор денег, фейковые распродажи.
6. Чужие персональные данные — чужие телефоны/адреса/ФИО без согласия, доксинг.
7. Запрещённый контент — призывы к насилию, наркотики, порнография, разжигание ненависти, экстремизм.

ВАЖНО — НЕ БЛОКИРУЙ обычные вопросы раздела. РАЗРЕШЕНО:
- Любые вопросы о месте покупки конкретного товара, включая упоминания магазинов, продавцов, районов.
- Вопросы о цене конкретного товара: «где купить X и сколько он сейчас стоит?» — это разрешено.
- Вопросы со ссылкой на страницу товара, картинкой характеристик, артикулом.
- Просьбы подсказать: «напишите, пожалуйста, где есть в наличии» — это нормально.
- Наличие телефона/ссылки/адреса в тексте вопроса само по себе НЕ нарушение — оценивай контекст: это вопрос к жителям или предложение покупки от автора.

ЕСЛИ СОМНЕВАЕШЬСЯ: непонятно, вопрос это или скрытая реклама; спорная ссылка; пограничное коммерческое упоминание — это СПОРНЫЙ случай (verdict: "ambiguous"), его рассмотрит человек-модератор. Лучше передать человеку, чем ошибочно скрыть честный вопрос покупателя.

Ответь СТРОГО валидным JSON без пояснений:
{"verdict":"ok|violation|ambiguous","category":"ad|spam|fraud|personal_data|forbidden|profanity|other","reason":"краткая причина на русском (для violation, иначе пусто)","note":"краткая заметка модератора на русском (до 100 символов)"}`;

export interface WhereToBuyAiVerdict {
  verdict: "ok" | "violation" | "ambiguous";
  category: string;
  reason: string;
  note: string;
}

const VALID_CATEGORIES = new Set([
  "ad", "spam", "fraud", "personal_data", "forbidden", "profanity", "other",
]);

/** ИИ-вердикт по вопросу «Где купить». Бросает исключение при недоступности ИИ. */
export async function aiModerateWhereToBuy(title: string, text: string, place?: string): Promise<WhereToBuyAiVerdict> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const completion = await Promise.race([
    zai.chat.completions.create({
      messages: [
        { role: "system", content: WHERETOBUY_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Проверь вопрос раздела «Где купить» (заголовок и текст; место — справочная часть):\n\nЗАГОЛОВОК:\n"""\n${title.slice(0, 300)}\n"""\n\nТЕКСТ ВОПРОСА:\n"""\n${text.slice(0, 6000)}\n"""\n\nМЕСТО (необязательно):\n"""\n${(place ?? "").slice(0, 120)}\n"""`,
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
  if (verdict === "violation" && !reason) reason = "нарушение правил раздела «Где купить»";

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
 * Шаг 1 — детерминированный фильтр лексики; шаг 2 — ИИ раздела «Где купить»
 * (реклама/скрытая реклама/спам/мошенничество; упоминание магазина, цены,
 * ссылки или телефона в вопросе о конкретном товаре — НЕ нарушение, ТЗ п.15).
 */
export async function moderateNewWhereToBuyText(
  title: string,
  text: string,
  place?: string
): Promise<ModerationOutcome & { wheretobuyCategory?: string }> {
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
      wheretobuyCategory: "profanity",
    };
  }

  // Шаг 2. ИИ-модератор раздела.
  try {
    const ai = await aiModerateWhereToBuy(title, text, place);
    if (ai.verdict === "violation") {
      return {
        action: "hide",
        hiddenReason: ai.reason,
        aiNote: ai.note,
        needHuman: false,
        source: "ai",
        category: wheretobuySanctionCategory(ai.category),
        wheretobuyCategory: ai.category,
      };
    }
    if (ai.verdict === "ambiguous") {
      return {
        action: "human",
        aiNote: ai.note,
        needHuman: true,
        source: "ai",
        category: wheretobuySanctionCategory(ai.category),
        wheretobuyCategory: ai.category,
      };
    }
    return { action: "allow", aiNote: ai.note, needHuman: false, source: "ai", wheretobuyCategory: ai.category };
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
export async function moderatePublishedWhereToBuyText(
  title: string,
  text: string,
  place?: string
): Promise<ModerationOutcome & { wheretobuyCategory?: string }> {
  const outcome = await moderateNewWhereToBuyText(title, text, place);
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
