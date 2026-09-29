/**
 * Цвет ника по полу — ЕДИНООБРАЗНО с форумом (п.7 правок 2026-09-24).
 *
 * Форум красит ники классами .sk-nick.g-* (globals.css):
 *   мужской     — синий    #1050b8
 *   женский     — розово-красный #c2185b
 *   неизвестно  — нейтральный серый #4c5563
 *
 * Лента «Где купить»/«Где дешевле» и карточки e2e-панели используют те же
 * цвета через класс .sm-nick-gender.g-* (см. globals.css).
 *
 * Логика определения пола (п.7):
 *   1) если известен профиль пользователя и в нём задано поле «пол»
 *      ("male"/"female" — как в БД User.gender) — берётся оно;
 *   2) иначе пол определяется ПО ОКОНЧАНИЮ НИКА:
 *      «…а», «…я»               — женский;
 *      согласная (б…щ, латиница) — мужской;
 *      всё остальное (цифра, «ь», гласные кроме а/я, пусто) — нейтральный.
 */

export type NickGender = "male" | "female" | "neutral";

/** Согласные (кириллица; «й» — согласный) + латинские согласные.
 *  29.09.2026: добавлен «ь» (мягкий знак) — агентивные существительные
 *  на «-тель» (любитель, водитель, строитель) — мужского рода. */
const CONSONANTS = "бвгджзйклмнпрстфхцчшщьbcdfghjklmnpqrstvwxz";

/** Пол по окончанию ника с улучшенной эвристикой (29.09.2026):
 *  1. Убираем трейлинг не-буквы (цифры, подчёркивания): «автолюбитель74» → «автолюбитель»
 *  2. Если ЛЮБОЕ слово ника кончается на «а»/«я» → female
 *     (ловит «мама двоих» → «мама» кончается на «а» → female)
 *  3. Если последнее слово кончается на согласную (включая «ь») → male
 *  4. Иначе → neutral */
export function guessNickGender(name: string): NickGender {
  const s = (name ?? "").trim();
  if (!s) return "neutral";

  // 29.09.2026: убираем трейлинг не-буквы (цифры, подчёркивания, пробелы)
  const stripped = s.replace(/[^a-zA-Zа-яА-ЯёЁ]+$/, "");
  if (!stripped) return "neutral";

  // Разбиваем на слова (по пробелам и подчёркиваниям)
  const words = stripped.split(/[\s_]+/).filter((w) => w.length > 0);
  if (words.length === 0) return "neutral";

  // 2. Если ЛЮБОЕ слово кончается на «а»/«я» → female
  //    (мама двоих → «мама» на «а» → female)
  for (const w of words) {
    const wl = w[w.length - 1].toLowerCase();
    if (wl === "а" || wl === "я" || wl === "a") return "female";
  }

  // 3. Последнее слово — согласная (включая «ь») → male
  const lastWord = words[words.length - 1];
  const last = lastWord[lastWord.length - 1].toLowerCase();
  if (CONSONANTS.includes(last)) return "male";

  return "neutral";
}

/**
 * Пол ника с приоритетом профиля: поле «пол» ("male"/"female") перекрывает
 * эвристику по окончанию. Для гостевых/демо-карточек профиль неизвестен —
 * работает правило окончания.
 */
export function resolveNickGender(name: string, profileGender?: string | null): NickGender {
  if (profileGender === "male" || profileGender === "female") return profileGender;
  return guessNickGender(name);
}

/** CSS-класс цветного ника: "sm-nick-gender g-male|g-female|g-neutral". */
export function nickGenderClass(name: string, profileGender?: string | null): string {
  return `sm-nick-gender g-${resolveNickGender(name, profileGender)}`;
}
