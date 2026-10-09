/**
 * ШАГ 26. Модерация раздела «Знакомства» (/znakomstva) — общая система
 * сайта: первичная проверка ИИ, спорные и неоднозначные случаи передаются
 * человеку-модератору.
 *
 * Запрещены (ТЗ): оскорбления; угрозы; сексуальная эксплуатация;
 * незаконные предложения; мошенничество; публикация чужих персональных
 * данных; публикация чужих контактов без разрешения; навязчивая реклама;
 * спам; выдача себя за другого человека; материалы, нарушающие
 * законодательство.
 *
 * Строгость:
 *  — сексуальная эксплуатация, незаконные предложения, мошенничество,
 *    угрозы — очевидное нарушение (hide);
 *  — обычное объявление знакомства НИКОГДА не блокируется только потому,
 *    что оно знакомство: сам раздел для этого и существует;
 *  — несоответствие выбранной категории (объявление явно из другой из
 *    двух категорий) — СПОРНЫЙ случай (human), не hide: ошибочно скрыть
 *    честное объявление хуже, чем показать его человеку-модератору;
 *  — собственные контакты автора в тексте РАЗРЕШЕНЫ (ТЗ: «контактную
 *    информацию, если автор самостоятельно указал её в тексте»);
 *  — жалобы — сигнал, не голосование.
 */

import { checkProfanity } from "./profanity";
import type { ModerationOutcome } from "./index";
import { DATING_CATEGORIES } from "@/lib/znakomstva";

const DATING_SYSTEM_PROMPT = `Ты — ИИ-модератор раздела «Знакомства» портала SakhMatrix. Это раздел объявлений о знакомствах для жителей Сахалина: автор публикует анонимное объявление в одной из двух категорий. Раздел самостоятельный: это не форум, не доска объявлений общего типа и не соцсеть; обсуждений нет.

РАЗРЕШЕННЫЕ КАТЕГОРИИ (ровно две, других не существует):
${DATING_CATEGORIES.map((c) => `- "${c.label}" (ключ: ${c.key})`).join("\n")}

ЖЁСТКИЕ ЗАПРЕТЫ раздела. Помечай как НАРУШЕНИЕ (verdict: "violation") только ОЧЕВИДНЫЕ случаи:
1. Сексуальная эксплуатация — интим-услуги за деньги, «эскорт», проституция, предложение/поиск платного секса, интим-фото/видео за оплату, торговля людьми.
2. Незаконные предложения — наркотики, оружие, поддельные документы, нелегальные схемы, всё нарушающее закон.
3. Мошенничество — схемы обмана: предоплата, фейковые сборы, крипто-схемы, лотереи. Финансовые просьбы под видом знакомства — ЭТО ВСЕГДА ОЧЕВИДНОЕ МОШЕННИЧЕСТВО (verdict: "violation", category "fraud"): «переведите деньги/сумму», «подтвердите серьёзность намерений деньгами/переводом», «оплатите встречу заранее», «проверка платёжеспособности», просьбы на карту, на телефон, криптовалюту, подарочные карты. Это типичная схема обмана в знакомствах — НЕ стесняйтесь скрывать.
4. Угрозы, шантаж, вымогательство, разжигание ненависти.
5. Оскорбления, унижение отдельных людей или групп.
6. Чужие персональные данные — чужие телефоны, адреса, ФИО, паспортные данные; чужие контакты БЕЗ разрешения. Это нарушение.
7. Навязчивая реклама и спам — продвижение магазинов, сайтов, групп, услуг, эскорт-агентств, «салонов», массовые однотипные объявления, бессмысленный текст.
8. Запрещённый контент — порнография, экстремизм, наркотики и подобное.

ВАЖНО — НЕ БЛОКИРУЙ обычные объявления знакомств. РАЗРЕШЕНО и это НОРМА для раздела:
- Само знакомство: честный рассказ о себе, о том, кого автор ищет, о характере, интересах, возрасте, городе. Писать о желании отношений, семьи, общения — НЕ нарушение.
- Контакты, оставленные АВТОРОМ ДЛЯ СВЯЗИ по своему объявлению (телефон, мессенджер, почта) — НЕ персональные данные и НЕ нарушение: автор сам решил их указать.
- Возраст автора/искомого — нормальное содержание; нарушение — только сексуализация несовершеннолетних (это запрещённый контент, violation).
- Негативный опыт прошлых отношений, требования к партнёру, юмор — не нарушение.
- Обычные слова, топонимы, имена (в том числе латиницей) — НЕ спам. Спам — только бессмысленный или массово-рекламный текст в целом.
- Анонимность автора — норма раздела: отсутствие имени в тексте НЕ нарушение.

ПРОВЕРЬ СООТВЕТСТВИЕ КАТЕГОРИИ:
- Если текст явно написан от лица/в интересах противоположной категории (например, выбрано «Мужчина ищет женщину», а текст явно от женщины, ищущей мужчину) — это СПОРНЫЙ случай (verdict: "ambiguous", category "rubric_mismatch"), его рассмотрит человек-модератор. НЕ скрывай такое объявление.
- Если объявление вообще не про знакомство (продажа, услуги, работа, найм, реклама) — применяй запреты выше.

ЕСЛИ СОМНЕВАЕШЬСЯ — это СПОРНЫЙ случай (verdict: "ambiguous"). Лучше передать человеку-модератору, чем ошибочно скрыть честное объявление знакомства.

Ответь СТРОГО валидным JSON без пояснений:
{"verdict":"ok|violation|ambiguous","category":"exploitation|illegal|fraud|threat|insult|personal_data|spam|commercial|forbidden|rubric_mismatch|other","reason":"краткая причина на русском (для violation, иначе пусто)","note":"краткая заметка модератора на русском (до 100 символов)"}`;

export interface DatingAiVerdict {
  verdict: "ok" | "violation" | "ambiguous";
  category: string;
  reason: string;
  note: string;
}

const VALID_CATEGORIES = new Set([
  "exploitation", "illegal", "fraud", "threat", "insult", "personal_data",
  "spam", "commercial", "forbidden", "rubric_mismatch", "other",
]);

/** Категории ИИ, означающие очевидное нарушение правил раздела. */
const VIOLATION_CATEGORIES = new Set([
  "exploitation", "illegal", "fraud", "threat", "insult", "personal_data",
  "spam", "commercial", "forbidden",
]);

/** ИИ-вердикт по объявлению о знакомстве. Бросает исключение при недоступности ИИ. */
export async function aiModerateDatingPost(
  category: string,
  title: string,
  body: string
): Promise<DatingAiVerdict> {
  const categoryLabel = DATING_CATEGORIES.find((c) => c.key === category)?.label ?? category;
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const completion = await Promise.race([
    zai.chat.completions.create({
      messages: [
        { role: "system", content: DATING_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Проверь объявление раздела «Знакомства».\n\nВЫБРАННАЯ КАТЕГОРИЯ: ${categoryLabel} (ключ: ${category})\n\nЗАГОЛОВОК:\n"""\n${title.slice(0, 300)}\n"""\n\nТЕКСТ ОБЪЯВЛЕНИЯ:\n"""\n${body.slice(0, 6000)}\n"""`,
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
  let category2 = String(parsed.category ?? "other").toLowerCase();
  if (!VALID_CATEGORIES.has(category2)) category2 = "other";

  let reason = String(parsed.reason ?? "").trim();
  if (verdict === "violation" && !reason) reason = "нарушение правил раздела «Знакомства»";

  let note = String(parsed.note ?? "").trim().slice(0, 200);
  if (!note) {
    note =
      verdict === "violation"
        ? `нарушение: ${reason}`
        : verdict === "ambiguous"
          ? "спорный случай — передано человеку-модератору"
          : "нарушений не найдено";
  }

  return { verdict, category: category2, reason, note };
}

/** Полный текст объявления для проверки лексики. */
function datingFullText(title: string, body: string): string {
  return [title, body].filter(Boolean).join("\n");
}

/**
 * Маппинг категории ИИ на категорию лестницы санкций.
 * rubric_mismatch — не нарушение (спорный случай), санкции не даёт.
 */
function datingAiSanctionCategory(category: string): string {
  switch (category) {
    case "exploitation":
    case "illegal":
    case "forbidden":
      return "forbidden";
    case "fraud":
      return "fraud";
    case "threat":
      return "threat";
    case "personal_data":
      return "personal_data";
    case "insult":
      return "insult";
    case "spam":
    case "commercial":
      return "spam";
    default:
      return "other";
  }
}

export { datingAiSanctionCategory };

/**
 * Проверка НОВОГО объявления перед публикацией (и при редактировании).
 * Шаг 1 — детерминированный фильтр лексики; шаг 2 — ИИ-модератор раздела.
 */
export async function moderateNewDatingText(
  category: string,
  title: string,
  body: string
): Promise<ModerationOutcome & { dkCategory?: string }> {
  // Шаг 1. Общий фильтр нецензурной/оскорбительной лексики (общий механизм сайта).
  const prof = checkProfanity(datingFullText(title, body));
  if (prof.blocked) {
    return {
      action: "block",
      blockMessage:
        "Объявление содержит нецензурную или оскорбительную лексику. Пожалуйста, отредактируйте текст и попробуйте снова.",
      aiNote: "нецензурная лексика (автофильтр)",
      needHuman: false,
      source: "profanity",
      hits: prof.hits,
      dkCategory: "insult",
    };
  }

  // Шаг 2. ИИ-модератор раздела.
  try {
    const ai = await aiModerateDatingPost(category, title, body);
    if (ai.verdict === "violation" && VIOLATION_CATEGORIES.has(ai.category)) {
      return {
        action: "hide",
        hiddenReason: ai.reason,
        aiNote: ai.note,
        needHuman: false,
        source: "ai",
        category: datingAiSanctionCategory(ai.category),
        dkCategory: ai.category,
      };
    }
    // violation с неизвестной категорией, rubric_mismatch и любые сомнения —
    // человеку-модератору (не скрываем автоматически).
    if (ai.verdict !== "ok") {
      return {
        action: "human",
        aiNote: ai.note || ai.reason || "спорный случай — передано человеку-модератору",
        needHuman: true,
        source: "ai",
        category: datingAiSanctionCategory(ai.category),
        dkCategory: ai.category,
      };
    }
    return { action: "allow", aiNote: ai.note, needHuman: false, source: "ai", dkCategory: ai.category };
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
export async function moderatePublishedDatingText(
  category: string,
  title: string,
  body: string
): Promise<ModerationOutcome & { dkCategory?: string }> {
  const outcome = await moderateNewDatingText(category, title, body);
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
