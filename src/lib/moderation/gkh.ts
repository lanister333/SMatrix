/**
 * ШАГ 19. Модерация раздела «ЖКХ и городские проблемы» (ТЗ п.18/19/26).
 *
 * Конвейер сайта: Пользователь → AI-модерация → человек-модератор при
 * спорной/неоднозначной ситуации.
 *
 * КЛЮЧЕВОЙ ПРИНЦИП (ТЗ п.18) — «Не нравится ≠ нарушение»:
 * НЕЛЬЗЯ автоматически удалять/скрывать материал только потому, что
 * пользователь недоволен, критикует организацию, сообщает о плохом
 * состоянии объекта или описывает негативный личный опыт. Жалоба и
 * негативный опыт — не доказанный факт, но и не нарушение.
 *
 * Модерация борется с РЕАЛЬНЫМИ нарушениями (ТЗ п.18): угрозы, оскорбления,
 * травля, мошенничество, спам, реклама, публикация ненужных персональных
 * данных, запрещённый контент.
 *
 * Персональные данные (ТЗ п.19): чужие телефоны/домашние адреса физлиц/
 * личная почта/документы без необходимости — нарушение. Адрес самой
 * городской/коммунальной проблемы («ул. Ленина, дом 25») — НЕ нарушение,
 * если он нужен для понимания проблемы.
 */

import { checkProfanity } from "./profanity";
import type { ModerationOutcome } from "./index";
import { GKH_COMPLAINT_CATEGORIES } from "@/lib/gkh";

/** Маппинг категорий раздела на категории лестницы санкций форума. */
const SANCTION_CATEGORY_MAP: Record<string, string> = {
  ad: "spam",
  spam: "spam",
  fraud: "fraud",
  personal_data: "personal_data",
  threat: "threat",
  insult: "insult",
  offtopic: "other",
  forbidden: "other",
  profanity: "insult",
  other: "other",
};

export function gkhSanctionCategory(category: string | undefined): string {
  return SANCTION_CATEGORY_MAP[category ?? "other"] ?? "other";
}

const GKH_SYSTEM_PROMPT = `Ты — ИИ-модератор раздела «ЖКХ и городские проблемы» портала SakhMatrix. Жители Сахалина обозначают здесь конкретные проблемы города, ЖКХ и инфраструктуры: ямы на дорогах, лужи и гололёд, мусор, неработающее уличное освещение, отопление, воду, поликлиники, дворы, тротуары, общественный транспорт. Формат: заголовок + текст проблемы + необязательное место и дата + фото/видео. Обновления к проблеме могут добавлять другие жители.

ГЛАВНЫЙ ПРИНЦИП РАЗДЕЛА — «Не нравится ≠ нарушение»:
- Критика организации (управляющей компании, администрации, служб) — РАЗРЕШЕНА.
- Сообщение о плохом состоянии объекта, ямах, мусоре, перебоях — РАЗРЕШЕНО, даже если оно звучит остро.
- Описание негативного личного опыта — РАЗРЕШЕНО.
- Недовольство, эмоции, разговорный стиль — НЕ нарушение.
- Публикация отражает личный опыт и сведения автора; неподтверждённость информации сама по себе НЕ нарушение.

Помечай как НАРУШЕНИЕ (verdict: "violation") только ОЧЕВИДНЫЕ случаи:
1. Угрозы — угрозы жизни/здоровью, обещание расправы конкретному человеку или группе.
2. Оскорбления и травля — прямые оскорбления жителей, сотрудников, организаций; переход на личности вместо описания проблемы; целенаправленная травля человека.
3. Мошенничество — схемы обмана, фишинг, сбор денег с обещанием услуг, фейковые сборы.
4. Спам — бессмысленный текст, флуд, бессвязная абракадабра, массовые однотипные сообщения.
5. Реклама — продвижение товаров/услуг/компании под видом проблемы: «обращайтесь к нам, починим недорого», телефоны и ссылки с рекламной целью.
6. Чужие персональные данные — НЕНУЖНЫЕ для описания проблемы: личные телефоны, домашние адреса физических лиц, личная почта, ФИО частных лиц без согласия, данные документов, доксинг.
7. Запрещённый контент — призывы к насилию, наркотики, порнография, разжигание ненависти, экстремизм.

ВАЖНО — НЕ БЛОКИРУЙ обычные сообщения раздела. РАЗРЕШЕНО:
- Адрес самой городской/коммунальной проблемы («ул. Ленина, дом 25», «двор дома 5 по Пионерской») — НЕ персональные данные, это нужно для понимания проблемы.
- Названия организаций, управляющих компаний, служб, ведомств и критика их работы — разрешено.
- Фамилии публичных должностных лиц в связи с их должностными действиями — оценивай контекст, само по себе не нарушение.
- Фотографии проблемных объектов, ссылки на карты, упоминание номеров заявок.

ЕСЛИ СОМНЕВАЕШЬСЯ: неясно, оскорбление это или острая критика организации; похоже на личные данные, но, возможно, нужно для описания проблемы; спорная реклама — это СПОРНЫЙ случай (verdict: "ambiguous"), его рассмотрит человек-модератор. Лучше передать человеку, чем ошибочно скрыть честное сообщение жителя о проблеме.

Ответь СТРОГО валидным JSON без пояснений:
{"verdict":"ok|violation|ambiguous","category":"insult|threat|fraud|spam|ad|personal_data|forbidden|other","reason":"краткая причина на русском (для violation, иначе пусто)","note":"краткая заметка модератора на русском (до 100 символов)"}`;

export interface GkhAiVerdict {
  verdict: "ok" | "violation" | "ambiguous";
  category: string;
  reason: string;
  note: string;
}

/**
 * ТЗ №2 от 2026-09-23 (Пункт 17 «Проблема не должна превращаться
 * в обвинение») — ДОСЛОВНОЕ сообщение ИИ-фильтра лозунгов.
 * Публикация отклоняется, но текст НЕ стирается: форма остаётся
 * с текстом автора, система предлагает переписать его фактами.
 */
export const GKH_REWRITE_MESSAGE =
  "Пожалуйста, переформулируйте: укажите конкретный факт (что именно не работает), точный адрес и дату начала проблемы. Бездоказательные обобщения отклоняются";

/** Нормализация для детерминированного фильтра лозунгов: нижний регистр, е/ё, пробелы. */
function sloganNorm(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

/**
 * Паттерны лозунгов и бездоказательных обобщений (ТЗ №2 п.17: «все воруют»,
 * «УК ничего не делает годами», «никому ничего не нужно»; правила: «все
 * бездействуют») + однородные обобщения без факта. Список намеренно узкий:
 * ложное срабатывание на сухом факте («заявку не ответили») недопустим
 * — критика организации и негативный опыт разрешены (п.18).
 *
 * ВАЖНО (фикс 2026-09-23): в JS-регулярках \b основан на \w = [A-Za-z0-9_],
 * кириллица в \w НЕ входит — «\bвсе» НЕ совпадает с «все воруют» (граница
 * между не-словесными символами не образуется). Границу слова даёт
 * негативный lookbehind (?<![a-zа-яё0-9]): совпадение не начинается
 * в середине слова. \w* заменён на [а-яё]* по той же причине.
 */
const SLOGAN_PATTERNS: RegExp[] = [
  /(?<![a-zа-яё0-9])все\s+(вору|вородел|крад|расхищ)/,
  /(?<![a-zа-яё0-9])одни\s+(воры|мошенники|бездельники)/,
  /(?<![a-zа-яё0-9])везде\s+(воруют|вор|коррупция|обман)/,
  /(?<![a-zа-яё0-9])все\s+куплено/,
  /(?<![a-zа-яё0-9])все\s+(пропало|бездействуют|вокруг\s+воры)/,
  /(?<![a-zа-яё0-9])никому\s+ничего\s+не\s+нужно/,
  /(?<![a-zа-яё0-9])никто\s+ничего\s+не\s+делает/,
  /(?<![a-zа-яё0-9])ничего\s+не\s+делает\s+(годами|веками|месяцами|год)/,
  /(?<![a-zа-яё0-9])(?:ук|управля[а-яё]*)\s+ничего\s+не\s+делает/,
  /(?<![a-zа-яё0-9])никогда\s+ничего\s+не\s+(решается|меняется|делается|ремонтируется)/,
  /(?<![a-zа-яё0-9])только\s+для\s+своих/,
  /(?<![a-zа-яё0-9])никому\s+нет\s+дела/,
];

/**
 * Детерминированный ИИ-фильтр лозунгов и обобщений (ТЗ №2 п.17).
 * Возвращает true, если в тексте найден хотя бы один паттерн.
 */
export function detectGkhSlogans(...parts: string[]): boolean {
  const joined = sloganNorm(parts.filter(Boolean).join("\n"));
  return SLOGAN_PATTERNS.some((re) => re.test(joined));
}

const VALID_CATEGORIES = new Set([
  "insult", "threat", "fraud", "spam", "ad", "personal_data", "forbidden", "other",
]);

/** ИИ-вердикт по тексту раздела «ЖКХ». Бросает исключение при недоступности ИИ. */
export async function aiModerateGkh(
  kindLabel: string,
  title: string,
  text: string,
  place?: string
): Promise<GkhAiVerdict> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const completion = await Promise.race([
    zai.chat.completions.create({
      messages: [
        { role: "system", content: GKH_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Проверь ${kindLabel} раздела «ЖКХ и городские проблемы»${title ? ` (заголовок: «${title.slice(0, 200)}»)` : ""}:\n\nТЕКСТ:\n"""\n${text.slice(0, 6000)}\n"""${place ? `\n\nМЕСТО ПРОБЛЕМЫ (адрес объекта — разрешён, ТЗ п.19):\n"""\n${place.slice(0, 200)}\n"""` : ""}`,
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
  if (verdict === "violation" && !reason) reason = "нарушение правил раздела «ЖКХ и городские проблемы»";

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

/** Полный текст для проверки лексики. */
function fullText(title: string, text: string, place?: string): string {
  return [title, text, place ?? ""].filter(Boolean).join("\n");
}

/**
 * Проверка НОВОГО текста раздела «ЖКХ» перед публикацией (публикация,
 * обновление жителя, правка, ответ организации).
 * Шаг 1 — детерминированный фильтр лексики; шаг 1.5 — ИИ-фильтр лозунгов
 * и обобщений (ТЗ №2 от 2026-09-23, п.17, action="block" с Дословным
 * сообщением GKH_REWRITE_MESSAGE); шаг 2 — ИИ раздела
 * («Не нравится ≠ нарушение»: критика организации и негативный опыт
 * разрешены, ТЗ п.18).
 */
export async function moderateNewGkhText(
  kindLabel: string,
  title: string,
  text: string,
  place?: string
): Promise<ModerationOutcome & { gkhCategory?: string }> {
  // Шаг 1. Общий фильтр нецензурной/оскорбительной лексики (общий механизм сайта).
  const prof = checkProfanity(fullText(title, text, place));
  if (prof.blocked) {
    return {
      action: "block",
      blockMessage:
        "Сообщение содержит нецензурную или оскорбительную лексику. Пожалуйста, отредактируйте текст и попробуйте снова.",
      aiNote: "нецензурная лексика (автофильтр)",
      needHuman: false,
      source: "profanity",
      hits: prof.hits,
      gkhCategory: "insult",
    };
  }

  // Шаг 1.5 — ТЗ №2 от 2026-09-23 (Пункт 17 «Проблема не должна превращаться
  // в обвинение»): ИИ-фильтр лозунгов и бездоказательных обобщений.
  // Публикация отклоняется автоматически; текст НЕ стирается — форма
  // остаётся с текстом автора, система предлагает переписать его фактами.
  if (detectGkhSlogans(title, text)) {
    return {
      action: "block",
      blockMessage: GKH_REWRITE_MESSAGE,
      aiNote: "лозунги и бездоказательные обобщения (ИИ-фильтр ТЗ №2 п.17)",
      needHuman: false,
      source: "slogan",
      gkhCategory: "other",
    };
  }

  // Шаг 2. ИИ-модератор раздела.
  try {
    const ai = await aiModerateGkh(kindLabel, title, text, place);
    if (ai.verdict === "violation") {
      return {
        action: "hide",
        hiddenReason: ai.reason,
        aiNote: ai.note,
        needHuman: false,
        source: "ai",
        category: gkhSanctionCategory(ai.category),
        gkhCategory: ai.category,
      };
    }
    if (ai.verdict === "ambiguous") {
      return {
        action: "human",
        aiNote: ai.note,
        needHuman: true,
        source: "ai",
        category: gkhSanctionCategory(ai.category),
        gkhCategory: ai.category,
      };
    }
    return { action: "allow", aiNote: ai.note, needHuman: false, source: "ai", gkhCategory: ai.category };
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

/** Повторная проверка УЖЕ опубликованного текста (по жалобе или в очереди). */
export async function moderatePublishedGkhText(
  kindLabel: string,
  title: string,
  text: string,
  place?: string
): Promise<ModerationOutcome & { gkhCategory?: string }> {
  const outcome = await moderateNewGkhText(kindLabel, title, text, place);
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

/** Категория жалобы валидна (импортировано из lib/gkh). */
export { GKH_COMPLAINT_CATEGORIES };
