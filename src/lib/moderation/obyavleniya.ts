/**
 * ШАГ 22 (восстановление). Модерация раздела «Объявления» — доски объявлений
 * жителей Сахалина (/obyavleniya).
 *
 * Ключевое отличие от других разделов: здесь ПРЕДЛАГАТЬ ТОВАРЫ И УСЛУГИ —
 * это суть раздела. Объявление «продам велосипед, 5000 руб, звоните» —
 * нормальное содержание. Нарушения:
 *  — мошенничество: предоплата переводом на карту «вперёд», «забронируйте
 *    переводом», нереально дешёвые фейковые товары, фишинговые ссылки;
 *  — запрещённые к обороту товары: наркотики, оружие, поддельные документы;
 *  — спам: бессмысленный текст, массовые однотипные объявления;
 *  — чужие персональные данные: чужие телефоны/адреса/ФИО без согласия.
 * Реклама НЕ является нарушением раздела — весь раздел состоит из рекламы
 * своих товаров/услуг. Профессиональный магазинный ассортимент — на усмотрение
 * модератора (спорное → человек).
 */

import { checkProfanity } from "./profanity";
import type { ModerationOutcome } from "./index";

/**
 * Причины жалоб в «Объявлениях» (ровно пять). Рекламы НЕТ в списке —
 * объявления сами по себе являются рекламой товаров/услуг автора.
 */
export const ADS_COMPLAINT_CATEGORIES = [
  "spam", // Спам
  "fraud", // Мошенничество
  "forbidden", // Запрещённый товар
  "personal_data", // Личные данные
  "other", // Другое
] as const;

/** Маппинг категорий раздела на категории лестницы санкций форума. */
const SANCTION_CATEGORY_MAP: Record<string, string> = {
  spam: "spam",
  fraud: "fraud",
  forbidden: "forbidden",
  personal_data: "personal_data",
  profanity: "insult",
  other: "other",
};

export function adsSanctionCategory(category: string | undefined): string {
  return SANCTION_CATEGORY_MAP[category ?? "other"] ?? "other";
}

const ADS_SYSTEM_PROMPT = `Ты — ИИ-модератор раздела «Объявления» портала SakhMatrix. Это доска объявлений жителей Сахалина: восемь рубрик (Продам, Куплю, Отдам даром, Услуги, Работа, Недвижимость, Транспорт, Разное). Заголовок + текст + необязательные цена, контакты, место. Комментариев нет — связь покупателя и продавца напрямую.

САМОЕ ВАЖНОЕ: предлагать свой товар или услугу здесь — ЭТО СУТЬ РАЗДЕЛА. Объявление «продам велосипед, 5000 руб, звоните после 18:00» — НОРМАЛЬНОЕ содержание, НЕ нарушение. НЕ скрывай объявления за то, что они «рекламные» — весь раздел состоит из рекламы своих вещей и услуг. Цены, контакты, ссылки на свою страницу товара, упоминание магазина автора — всё это РАЗРЕШЕНО.

Помечай как НАРУШЕНИЕ (verdict: "violation") только ОЧЕВИДНЫЕ случаи:
1. Мошенничество — просьба перевести предоплату вперёд незнакомому человеку («переведите на карту, потом отправлю товар»), «забронировать переводом», нереально дешёвые фейковые предложения (айфон за 3 тысячи), фишинговые ссылки, схемы обмана.
2. Запрещённые к обороту товары — наркотики и психотропные вещества, оружие, взрывчатка, поддельные документы, чужие аккаунты.
3. Спам — бессмысленный текст, флуд, копии одного и того же объявления, реклама вообще без конкретного товара/услуги («заработок из дома, пиши в личку» без описания работы).
4. Чужие персональные данные — чужие телефоны/адреса/ФИО без согласия, доксинг.
5. Запрещённый контент — призывы к насилию, порнография, разжигание ненависти, экстремизм.

ВАЖНО — НЕ БЛОКИРУЙ обычные объявления. РАЗРЕШЕНО:
- Продажа своих вещей с ценой и контактами.
- Предложение услуг (ремонт, репетиторство, перевозки, работа на заказ).
- Поиск работы и предложение работы (рубрика «Работа»).
- Сдача/поиск жилья, продажа транспорта.
- Ссылки на свои страницы товара, упоминание своего магазина/мастерской.
- Мягкие фразы «торг уместен», «самовывоз», «обмен».

ЕСЛИ СОМНЕВАЕШЬСЯ: непонятно, мошенничество это или честная сделка; спорный товар; пограничное предложение — это СПОРНЫЙ случай (verdict: "ambiguous"), его рассмотрит человек-модератор. Лучше передать человеку, чем ошибочно скрыть честное объявление.

Ответь СТРОГО валидным JSON без пояснений:
{"verdict":"ok|violation|ambiguous","category":"fraud|forbidden|spam|personal_data|forbidden|profanity|other","reason":"краткая причина на русском (для violation, иначе пусто)","note":"краткая заметка модератора на русском (до 100 символов)"}`;

export interface AdsAiVerdict {
  verdict: "ok" | "violation" | "ambiguous";
  category: string;
  reason: string;
  note: string;
}

const VALID_CATEGORIES = new Set([
  "fraud", "forbidden", "spam", "personal_data", "profanity", "other",
]);

/** ИИ-вердикт по объявлению. Бросает исключение при недоступности ИИ. */
export async function aiModerateAdListing(
  rubric: string,
  title: string,
  text: string,
  price?: string,
  contact?: string,
  place?: string
): Promise<AdsAiVerdict> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const completion = await Promise.race([
    zai.chat.completions.create({
      messages: [
        { role: "system", content: ADS_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Проверь объявление доски «Объявления» (рубрика — справочная часть):\n\nРУБРИКА:\n"""\n${rubric.slice(0, 40)}\n"""\n\nЗАГОЛОВОК:\n"""\n${title.slice(0, 300)}\n"""\n\nТЕКСТ ОБЪЯВЛЕНИЯ:\n"""\n${text.slice(0, 6000)}\n"""\n\nЦЕНА (необязательно):\n"""\n${(price ?? "").slice(0, 80)}\n"""\n\nКОНТАКТЫ (необязательно):\n"""\n${(contact ?? "").slice(0, 200)}\n"""\n\nМЕСТО (необязательно):\n"""\n${(place ?? "").slice(0, 120)}\n"""`,
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
  if (verdict === "violation" && !reason) reason = "нарушение правил раздела «Объявления»";

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

/** Полный текст объявления для проверки лексики. */
function fullText(title: string, text: string, price?: string, contact?: string, place?: string): string {
  return [title, text, price ?? "", contact ?? "", place ?? ""].filter(Boolean).join("\n");
}

/**
 * Проверка НОВОГО объявления перед публикацией (и при редактировании).
 * Шаг 1 — детерминированный фильтр лексики; шаг 2 — ИИ раздела «Объявления»
 * (мошенничество/запрещённые товары/спам/чужие данные; продажа своих товаров
 * и услуг — суть раздела, НЕ нарушение).
 */
export async function moderateNewAdListingText(
  rubric: string,
  title: string,
  text: string,
  price?: string,
  contact?: string,
  place?: string
): Promise<ModerationOutcome & { adsCategory?: string }> {
  // Шаг 1. Общий фильтр нецензурной/оскорбительной лексики (общий механизм сайта).
  const prof = checkProfanity(fullText(title, text, price, contact, place));
  if (prof.blocked) {
    return {
      action: "block",
      blockMessage:
        "Объявление содержит нецензурную или оскорбительную лексику. Пожалуйста, отредактируйте текст и попробуйте снова.",
      aiNote: "нецензурная лексика (автофильтр)",
      needHuman: false,
      source: "profanity",
      hits: prof.hits,
      adsCategory: "profanity",
    };
  }

  // Шаг 2. ИИ-модератор раздела.
  try {
    const ai = await aiModerateAdListing(rubric, title, text, price, contact, place);
    if (ai.verdict === "violation") {
      return {
        action: "hide",
        hiddenReason: ai.reason,
        aiNote: ai.note,
        needHuman: false,
        source: "ai",
        category: adsSanctionCategory(ai.category),
        adsCategory: ai.category,
      };
    }
    if (ai.verdict === "ambiguous") {
      return {
        action: "human",
        aiNote: ai.note,
        needHuman: true,
        source: "ai",
        category: adsSanctionCategory(ai.category),
        adsCategory: ai.category,
      };
    }
    return { action: "allow", aiNote: ai.note, needHuman: false, source: "ai", adsCategory: ai.category };
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

/** Повторная проверка УЖЕ опубликованного объявления (по жалобе или при правке). */
export async function moderatePublishedAdListingText(
  rubric: string,
  title: string,
  text: string,
  price?: string,
  contact?: string,
  place?: string
): Promise<ModerationOutcome & { adsCategory?: string }> {
  const outcome = await moderateNewAdListingText(rubric, title, text, price, contact, place);
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
