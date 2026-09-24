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

/** Согласные (кириллица; «й» — согласный) + латинские согласные. */
const CONSONANTS = "бвгджзйклмнпрстфхцчшщbcdfghjklmnpqrstvwxz";

/** Пол по окончанию ника: «…а», «…я» — женский; согласная — мужской; иначе нейтральный. */
export function guessNickGender(name: string): NickGender {
  const s = (name ?? "").trim();
  if (!s) return "neutral";
  const last = s[s.length - 1].toLowerCase();
  if (last === "а" || last === "я") return "female";
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
