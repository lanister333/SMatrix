/**
 * ШАГ 20. Модерация раздела «Рекомендую / Не рекомендую».
 *
 * Принципы:
 *  — КРИТИКА И НЕГАТИВНЫЙ ОПЫТ — НЕ НАРУШЕНИЕ: это суть раздела. Житель имеет
 *    право рассказать о своём негативном опыте в организации/сервисе.
 *  — НАРУШЕНИЕ: реклама и скрытая реклама (заказные рекомендации), продвижение
 *    собственного бизнеса, спам, мошенничество, чужие персональные данные
 *    (ФИО/телефоны/адреса третьих лиц без согласия), оскорбления и угрозы
 *    в адрес конкретных людей (критика организации ≠ оскорбление людей).
 *  — Не блокировать пользователя автоматически только из-за подозрения:
 *    спорные случаи — человеку-модератору.
 */

import { checkProfanity } from "./profanity";
import type { ModerationOutcome } from "./index";

/** Причины жалоб (ровно пять). */
export const RECOMMEND_COMPLAINT_CATEGORIES = [
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

export function recommendSanctionCategory(category: string | undefined): string {
  return SANCTION_CATEGORY_MAP[category ?? "other"] ?? "other";
}

const RECOMMEND_SYSTEM_PROMPT = `Ты — ИИ-модератор раздела «Рекомендую / Не рекомендую» портала SakhMatrix. Это лента публикаций жителей Сахалина о ЛИЧНОМ опыте с организациями, компаниями, сервисами и местами: положительном и отрицательном. Поля: кого (субъект), позиция (Рекомендую или Не рекомендую), заголовок, текст, необязательное место.

ГЛАВНЫЙ ПРИНЦИП РАЗДЕЛА: критика и негативный опыт — НЕ нарушение, это суть раздела. Житель имеет право написать «обслуживали долго, в итоге всё закончилось хорошо, рекомендую» или «сделали некачественно, не рекомендую». Оценочные суждения о компаниях и организациях («работают плохо», «цены завышены», «персонал невнимательный») — разрешены.

Помечай как НАРУШЕНИЕ (verdict: "violation") только ОЧЕВИДНЫЕ случаи:
1. Реклама и заказные рекомендации — публикация продвигает бизнес автора или заказчика под видом личного опыта: «лучшие в городе, обращайтесь, вот мой телефон», однотипные хвалебные тексты о разных организациях от одного автора.
2. Скрытая реклама — «случайно» восторженная рекомендация с контактами, ссылками и призывом обратиться.
3. Оскорбления и угрозы в адрес КОНКРЕТНЫХ ЛЮДЕЙ по имени/фамилии (критика организации без перехода на личности — разрешена).
4. Чужие персональные данные — ФИО сотрудников, телефоны, адреса третьих лиц без согласия, доксинг.
5. Спам — бессмысленный текст, флуд, повторяющиеся однотипные публикации.
6. Мошенничество — схемы обмана, сбор денег, фишинг.
7. Запрещённый контент — призывы к насилию, наркотики, порнография, разжигание ненависти, экстремизм.

ВАЖНО — НЕ БЛОКИРУЙ обычные публикации раздела. РАЗРЕШЕНО:
- Любой личный опыт: положительный, отрицательный, смешанный.
- Негативные оценки организации, сервиса, качества работы, цен, сроков.
- Эмоциональные формулировки («раздувают сроки», «молодцы, всё быстро»), если это не оскорбления конкретных людей.
- Упоминание названий организаций, улиц, районов, сумм.
- Предупреждения других жителей («проверяйте документы», «задавайте вопросы заранее»).

ЕСЛИ СОМНЕВАЕШЬСЯ: непонятно, личный это опыт или заказная реклама; пограничная критика, которую можно счесть оскорблением; спорное упоминание людей — это СПОРНЫЙ случай (verdict: "ambiguous"), его рассмотрит человек-модератор. Лучше передать человеку, чем ошибочно скрыть честный отзыв.

Ответь СТРОГО валидным JSON без пояснений:
{"verdict":"ok|violation|ambiguous","category":"ad|spam|fraud|personal_data|forbidden|profanity|other","reason":"краткая причина на русском (для violation, иначе пусто)","note":"краткая заметка модератора на русском (до 100 символов)"}`;

export interface RecommendAiVerdict {
  verdict: "ok" | "violation" | "ambiguous";
  category: string;
  reason: string;
  note: string;
}

const VALID_CATEGORIES = new Set([
  "ad", "spam", "fraud", "personal_data", "forbidden", "profanity", "other",
]);

/** ИИ-вердикт по публикации. Бросает исключение при недоступности ИИ. */
export async function aiModerateRecommend(
  subject: string,
  stance: string,
  title: string,
  text: string,
  place?: string,
  humanHighlight?: string
): Promise<RecommendAiVerdict> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const completion = await Promise.race([
    zai.chat.completions.create({
      messages: [
        { role: "system", content: RECOMMEND_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Проверь публикацию раздела «Рекомендую / Не рекомендую»:\n\nКОГО (субъект):\n"""\n${subject.slice(0, 200)}\n"""\n\nПОЗИЦИЯ: ${stance === "notrecommend" ? "Не рекомендую" : "Рекомендую"}\n\nЗАГОЛОВОК:\n"""\n${title.slice(0, 300)}\n"""\n\nТЕКСТ:\n"""\n${text.slice(0, 6000)}\n"""\n\nМЕСТО (необязательно):\n"""\n${(place ?? "").slice(0, 120)}\n"""\n\nОТДЕЛЬНО ОТМЕЧЕННЫЙ ЧЕЛОВЕК (необязательно):\n"""\n${(humanHighlight ?? "").slice(0, 800)}\n"""`,
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
  if (verdict === "violation" && !reason) reason = "нарушение правил раздела «Рекомендую / Не рекомендую»";

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

/** Полный текст публикации для проверки лексики. */
function fullText(subject: string, title: string, text: string, place?: string, humanHighlight?: string): string {
  return [subject, title, text, place ?? "", humanHighlight ?? ""].filter(Boolean).join("\n");
}

/**
 * Проверка НОВОЙ публикации перед публикацией (и при редактировании).
 * Шаг 1 — детерминированный фильтр лексики; шаг 2 — ИИ раздела
 * (реклама/заказные рекомендации/спам/мошенничество/переход на личности;
 * негативный опыт и критика организации — НЕ нарушение).
 */
export async function moderateNewRecommendText(
  subject: string,
  stance: string,
  title: string,
  text: string,
  place?: string,
  humanHighlight?: string
): Promise<ModerationOutcome & { recommendCategory?: string }> {
  // Шаг 1. Общий фильтр нецензурной/оскорбительной лексики (общий механизм сайта).
  // Выделение человека (ТЗ 2026-09-21, Пункт 6) проверяется вместе с текстом:
  // в нём чаще всего упоминаются конкретные люди.
  const prof = checkProfanity(fullText(subject, title, text, place, humanHighlight));
  if (prof.blocked) {
    return {
      action: "block",
      blockMessage:
        "Публикация содержит нецензурную или оскорбительную лексику. Пожалуйста, отредактируйте текст и попробуйте снова.",
      aiNote: "нецензурная лексика (автофильтр)",
      needHuman: false,
      source: "profanity",
      hits: prof.hits,
      recommendCategory: "profanity",
    };
  }

  // Шаг 2. ИИ-модератор раздела.
  try {
    const ai = await aiModerateRecommend(subject, stance, title, text, place, humanHighlight);
    if (ai.verdict === "violation") {
      return {
        action: "hide",
        hiddenReason: ai.reason,
        aiNote: ai.note,
        needHuman: false,
        source: "ai",
        category: recommendSanctionCategory(ai.category),
        recommendCategory: ai.category,
      };
    }
    if (ai.verdict === "ambiguous") {
      return {
        action: "human",
        aiNote: ai.note,
        needHuman: true,
        source: "ai",
        category: recommendSanctionCategory(ai.category),
        recommendCategory: ai.category,
      };
    }
    return { action: "allow", aiNote: ai.note, needHuman: false, source: "ai", recommendCategory: ai.category };
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

/** Повторная проверка УЖЕ опубликованной публикации (по жалобе или при правке). */
export async function moderatePublishedRecommendText(
  subject: string,
  stance: string,
  title: string,
  text: string,
  place?: string
): Promise<ModerationOutcome & { recommendCategory?: string }> {
  const outcome = await moderateNewRecommendText(subject, stance, title, text, place);
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
