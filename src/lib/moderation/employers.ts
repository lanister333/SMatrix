/**
 * ТЗ 2026-09-23 «О работодателях» — модерация раздела (Flat 2.0,
 * Пункты 5/6/8/20 ТЗ №2). Раздел фиксирует СУХОЙ, изолированный трудовой
 * опыт конкретного человека на острове. Мы НЕ собираем «чёрные списки»
 * директоров и не выносим коллективный вердикт организациям.
 *
 * Принципы:
 *  — «ЧЕЛОВЕК ≠ ОРГАНИЗАЦИЯ» (Пункты 5/6 ТЗ №2): плохой опыт с компанией не
 *    означает, что все её сотрудники плохие. Автор имеет право отдельно
 *    выделить и поблагодарить конкретного специалиста за человеческое
 *    отношение — поле «Особое упоминание человека». Разрешены РАБОЧИЕ имена
 *    («начальник участка Дмитрий Николаевич»); запрещены личные данные
 *    физлиц (сотовые, домашние адреса, паспортные данные).
 *  — НЕГАТИВНЫЙ ОПЫТ О РАБОТОДАТЕЛЕ — НЕ НАРУШЕНИЕ: задержки расчёта,
 *    условия труда, отношение руководства — на основе собственного опыта.
 *  — Пункт 8 ТЗ №2 (юридический риск): бездоказательные лозунги («там одни
 *    мошенники», «всегда всех обманывают») отклоняются ИИ-фильтром ДО
 *    публикации; личные данные физлиц запрещены; только официальное
 *    название ООО / ИП.
 *  — Вакансии/найм и реклама — нарушение (раздел не доска вакансий).
 *  — Спорные случаи — человеку-модератору.
 */

import { checkProfanity } from "./profanity";
import type { ModerationOutcome } from "./index";

/** Причины жалоб (ровно пять). */
export const EMPLOYERS_COMPLAINT_CATEGORIES = [
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
  slogan: "other",
  other: "other",
};

export function employersSanctionCategory(category: string | undefined): string {
  return SANCTION_CATEGORY_MAP[category ?? "other"] ?? "other";
}

const EMPLOYERS_SYSTEM_PROMPT = `Ты — ИИ-модератор раздела «О работодателях» портала SakhMatrix. Это лента СУХИХ трудовых фактов жителей Сахалина и Курил о работодателях на основе ЛИЧНОГО опыта. Поля: компания/ИП (официальное название), город, период работы (например «май – август 2026 г.»), личный опыт (обязательный), особое упоминание человека (необязательное).

ГЛАВНЫЙ ПРИНЦИП РАЗДЕЛА — «Человек ≠ Организация» (ТЗ №2 п.5/6): плохой опыт с компанией не означает, что все её сотрудники плохие. Автор может отдельно похвалить конкретного специалиста или руководителя за человеческое отношение в поле «Особое упоминание человека» — это ЦЕННО и поощряется. РАБОЧИЕ имена людей («начальник участка Дмитрий Николаевич», «бухгалтер Ольга») — РАЗРЕШЕНЫ.

Негативный опыт о работодателе — НЕ нарушение, это суть раздела: задержки окончательного расчёта, серые схемы оплаты, неоформление, условия труда, отношение руководства — если это рассказ о своём опыте с деталями.

Помечай как НАРУШЕНИЕ (verdict: "violation") только ОЧЕВИДНЫЕ случаи:
1. Личные данные физлиц (ТЗ №2 п.8 — категорически): личные номера сотовых телефонов директоров/бухгалтеров/мастеров, их домашние адреса, паспортные данные, СНИЛС/ИНН частных лиц. РАБОЧЕЕ ИМЯ без контактов — разрешено.
2. Вакансии и найм — «требуются сотрудники», «приглашаем на работу», «есть вакансии, звоните». Раздел — НЕ доска вакансий.
3. Реклама и продвижение — хвалебный отзыв о собственном бизнесе, заказной отзыв с контактами и призывом обратиться/устроиться.
4. Оскорбления и угрозы в адрес КОНКРЕТНЫХ ЛЮДЕЙ по рабочему имени (критика действий — разрешена, «Дмитрий Николаевич — скотина» — нарушение).
5. Чёрные списки и приговоры — публикация превращается в общий ярлык организации без личного опыта («вся компания состоит из мошенников») без описания собственного опыта.
6. Спам — бессмысленный текст, флуд, повторяющиеся однотипные публикации.
7. Мошенничество — схемы обмана, сбор денег за «трудоустройство».
8. Запрещённый контент — призывы к насилию, наркотики, порнография, разжигание ненависти.

ВАЖНО — НЕ БЛОКИРУЙ обычные карточки опыта. РАЗРЕШЕНО:
- Любой личный опыт: положительный, отрицательный, смешанный — с датами, условиями, обязанностями, фактами выплат или задержек.
- Название ООО/ИП, город, период работы, должностные обязанности, суммы и сроки.
- Рабочие имена сотрудников и руководителей (без телефонов/адресов) — и похвала, и деловая критика их действий.
- Официальные каналы работодателя («телефон отдела кадров есть на сайте компании») — это не чужие персональные данные.
- Предупреждения другим соискателям («внимательно читайте договор»).

ЕСЛИ СОМНЕВАЕШЬСЯ: непонятно, личный это опыт или заказной отзыв/вакансия; рабочее имя это или личные данные; пограничная критика — это СПОРНЫЙ случай (verdict: "ambiguous"), его рассмотрит человек-модератор. Лучше передать человеку, чем ошибочно скрыть честную карточку опыта.

Ответь СТРОГО валидным JSON без пояснений:
{"verdict":"ok|violation|ambiguous","category":"ad|spam|fraud|personal_data|forbidden|profanity|other","reason":"краткая причина на русском (для violation, иначе пусто)","note":"краткая заметка модератора на русском (до 100 символов)"}`;

export interface EmployersAiVerdict {
  verdict: "ok" | "violation" | "ambiguous";
  category: string;
  reason: string;
  note: string;
}

const VALID_CATEGORIES = new Set([
  "ad", "spam", "fraud", "personal_data", "forbidden", "profanity", "other",
]);

/** ИИ-вердикт по карточке трудового опыта. Бросает исключение при недоступности ИИ. */
export async function aiModerateEmployers(
  employer: string,
  city: string,
  workPeriod: string,
  experience: string,
  personMention?: string
): Promise<EmployersAiVerdict> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const completion = await Promise.race([
    zai.chat.completions.create({
      messages: [
        { role: "system", content: EMPLOYERS_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Проверь карточку трудового опыта раздела «О работодателях»:\n\nКОМПАНИЯ/ИП:\n"""\n${employer.slice(0, 200)}\n"""\n\nГОРОД:\n"""\n${(city ?? "").slice(0, 80)}\n"""\n\nПЕРИОД РАБОТЫ:\n"""\n${(workPeriod ?? "").slice(0, 120)}\n"""\n\nЛИЧНЫЙ ОПЫТ:\n"""\n${experience.slice(0, 6000)}\n"""\n\nОСОБОЕ УПОМИНАНИЕ ЧЕЛОВЕКА (необязательно; рабочие имена разрешены):\n"""\n${(personMention ?? "").slice(0, 2000)}\n"""`,
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
  if (verdict === "violation" && !reason) reason = "нарушение правил раздела «О работодателях»";

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

/**
 * ТЗ 2026-09-23 «О работодателях» (Пункт 8 ТЗ №2) — ДОСЛОВНОЕ сообщение
 * ИИ-фильтра лозунгов. Публикация отклоняется, но текст НЕ стирается:
 * форма остаётся с текстом автора, система предлагает переписать его фактами.
 * В сообщении дословно использованы примеры лозунгов из ТЗ.
 */
export const EMPLOYERS_REWRITE_MESSAGE =
  "Пожалуйста, переформулируйте: укажите конкретный факт (с чем вы столкнулись лично: даты, условия работы, факты выплат или задержек). Бездоказательные лозунги («там одни мошенники», «всегда всех обманывают») отклоняются ИИ-фильтром";

/** Нормализация для детерминированного фильтра лозунгов: нижний регистр, е/ё, пробелы. */
function sloganNorm(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

/**
 * Паттерны лозунгов и бездоказательных обобщений для раздела «О работодателях»
 * (Пункт 8 ТЗ №2: «там одни мошенники», «всегда всех обманывают») + однородный
 * набор из ТЗ №2 п.17 («все воруют», «никто ничего не делает», «только для
 * своих»). Список намеренно узкий: ложное срабатывание на сухом факте
 * («расчёт задержали на две недели») недопустим — негативный опыт разрешён.
 *
 * ВАЖНО (фикс 2026-09-23, перенесён из ЖКХ): в JS-регулярках \b основан на
 * \w = [A-Za-z0-9_], кириллица в \w НЕ входит. Границу слова даёт негативный
 * lookbehind (?<![a-zа-яё0-9]).
 */
const EMPLOYERS_SLOGAN_PATTERNS: RegExp[] = [
  // Прямые цитаты ТЗ 2026-09-23:
  /(?<![a-zа-яё0-9])одни\s+(воры|мошенники|бездельники|кидалы)/,
  /(?<![a-zа-яё0-9])(?:всегда|везде|всех)\s+(?:всех\s+)?обманыва/,
  // Однородный набор ТЗ №2 п.17 (без лозунгов в юридически рискованном разделе):
  /(?<![a-zа-яё0-9])все\s+(вору|вородел|крад|расхищ|мошенник)/,
  /(?<![a-zа-яё0-9])там\s+одни\s+[а-яё]+/,
  /(?<![a-zа-яё0-9])везде\s+(воруют|вор|коррупция|обман)/,
  /(?<![a-zа-яё0-9])все\s+куплено/,
  /(?<![a-zа-яё0-9])все\s+(пропало|бездействуют|вокруг\s+воры|мошенники)/,
  /(?<![a-zа-яё0-9])никому\s+ничего\s+не\s+нужно/,
  /(?<![a-zа-яё0-9])никто\s+ничего\s+не\s+делает/,
  /(?<![a-zа-яё0-9])никогда\s+никому\s+не\s+плат/,
  /(?<![a-zа-яё0-9])никогда\s+ничего\s+не\s+(платят|решается|меняется|делается)/,
  /(?<![a-zа-яё0-9])только\s+для\s+своих/,
  /(?<![a-zа-яё0-9])никому\s+нет\s+дела/,
  /(?<![a-zа-яё0-9])все\s+они\s+(мошенники|воры|кидалы)/,
];

/**
 * Детерминированный ИИ-фильтр лозунгов и обобщений (Пункт 8 ТЗ №2).
 * Возвращает true, если в тексте найден хотя бы один паттерн.
 */
export function detectEmployersSlogans(...parts: string[]): boolean {
  const joined = sloganNorm(parts.filter(Boolean).join("\n"));
  return EMPLOYERS_SLOGAN_PATTERNS.some((re) => re.test(joined));
}

/** Полный текст карточки для проверки лексики. */
function fullText(employer: string, city: string, workPeriod: string, experience: string, personMention?: string): string {
  return [employer, city, workPeriod, experience, personMention ?? ""].filter(Boolean).join("\n");
}

/**
 * Проверка НОВОЙ карточки трудового опыта перед публикацией (и при правке).
 * Шаг 1 — детерминированный фильтр лексики;
 * шаг 1.5 — ИИ-фильтр лозунгов (Пункт 8 ТЗ №2, action="block" с дословным
 *           сообщением EMPLOYERS_REWRITE_MESSAGE, source="slogan");
 * шаг 2 — ИИ раздела («Человек ≠ Организация»: рабочие имена и похвала
 *           отдельным людям разрешены; личные данные физлиц, вакансии,
 *           реклама найма — нарушение; негативный опыт — НЕ нарушение).
 */
export async function moderateNewEmployersText(
  employer: string,
  city: string,
  workPeriod: string,
  experience: string,
  personMention?: string
): Promise<ModerationOutcome & { employersCategory?: string }> {
  // Шаг 1. Общий фильтр нецензурной/оскорбительной лексики (общий механизм сайта).
  const prof = checkProfanity(fullText(employer, city, workPeriod, experience, personMention));
  if (prof.blocked) {
    return {
      action: "block",
      blockMessage:
        "Карточка опыта содержит нецензурную или оскорбительную лексику. Пожалуйста, отредактируйте текст и попробуйте снова.",
      aiNote: "нецензурная лексика (автофильтр)",
      needHuman: false,
      source: "profanity",
      hits: prof.hits,
      employersCategory: "profanity",
    };
  }

  // Шаг 1.5 — Пункт 8 ТЗ №2: ИИ-фильтр бездоказательных лозунгов.
  // Публикация отклоняется автоматически; текст НЕ стирается — форма
  // остаётся с текстом автора, система предлагает переписать его фактами.
  if (detectEmployersSlogans(employer, experience, personMention ?? "")) {
    return {
      action: "block",
      blockMessage: EMPLOYERS_REWRITE_MESSAGE,
      aiNote: "бездоказательные лозунги (ИИ-фильтр Пункта 8 ТЗ №2)",
      needHuman: false,
      source: "slogan",
      employersCategory: "other",
    };
  }

  // Шаг 2. ИИ-модератор раздела.
  try {
    const ai = await aiModerateEmployers(employer, city, workPeriod, experience, personMention);
    if (ai.verdict === "violation") {
      return {
        action: "hide",
        hiddenReason: ai.reason,
        aiNote: ai.note,
        needHuman: false,
        source: "ai",
        category: employersSanctionCategory(ai.category),
        employersCategory: ai.category,
      };
    }
    if (ai.verdict === "ambiguous") {
      return {
        action: "human",
        aiNote: ai.note,
        needHuman: true,
        source: "ai",
        category: employersSanctionCategory(ai.category),
        employersCategory: ai.category,
      };
    }
    return { action: "allow", aiNote: ai.note, needHuman: false, source: "ai", employersCategory: ai.category };
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

/** Повторная проверка УЖЕ опубликованной карточки (по жалобе или при правке). */
export async function moderatePublishedEmployersText(
  employer: string,
  city: string,
  workPeriod: string,
  experience: string,
  personMention?: string
): Promise<ModerationOutcome & { employersCategory?: string }> {
  const outcome = await moderateNewEmployersText(employer, city, workPeriod, experience, personMention);
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
