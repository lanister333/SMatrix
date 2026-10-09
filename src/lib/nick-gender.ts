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

/**
 * 04.10.2026: РУЧНЫЕ OVERRIDE для «исключительных» ников, где эвристика
 * по окончанию не справляется. Override имеет приоритет над profileGender
 * и над guessNickGender — нужен для случаев, когда:
 *   — нет User-записи с этим ником (тестовые/служебные ники),
 *   — но пользователь явно указал, какой пол должен быть.
 *
 * Добавляйте сюда ники, где эвристика даёт «неправильный» результат.
 * Override ПРИОРИТЕТНЫЙ — override перекрывает даже profileGender,
 * чтобы избежать рассинхрона с БД.
 *
 * Проверено через scripts/audit-all-nicks-v2.ts: 8 orphan-ников (без
 * User-записи), из них 2 эвристика определяет неправильно:
 *   - «ОтзывчикПроба1790038809403» — эвристика female («Проба» на «а»),
 *     но это male (пользователь — «Отзывчик», «Проба» — тестовый суффикс)
 *   - «Новости Сахалина» — эвристика female («Сахалина» на «а»),
 *     но это male (служебный аккаунт «новостной ленты», не человек)
 *
 * Остальные 6 orphan-ников эвристика определяет правильно:
 *   «SakhMatrix», «ТестовыйЮзер», «ГостьСахалин», «Роман_Корсаков» → male
 *   «Наталья_ЮС», «Мария_Холмск», «Ольга_ЮС» → female
 */
const MANUAL_OVERRIDES: Record<string, NickGender> = {
  "ОтзывчикПроба1790038809403": "male",
  "Новости Сахалина": "male",
};

/** Согласные (кириллица; «й» — согласный) + латинские согласные.
 *  29.09.2026: добавлен «ь» (мягкий знак) — агентивные существительные
 *  на «-тель» (любитель, водитель, строитель) — мужского рода.
 *  04.10.2026: добавлен «y» — английские мужские имена/ники на «-y»
 *  (Tommy, Andy, Davy, zorkiy) — мужского рода. */
const CONSONANTS = "бвгджзйклмнпрстфхцчшщьbcdfghjklmnpqrstvwxyz";

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
 * Пол ника с приоритетом профиля.
 *
 * 04.10.2026 (правка 2): `profileGender` СНОВА ИСПОЛЬЗУЕТСЯ — но только
 * если он точно соответствует этому нику. Раньше API возвращал gender
 * через JOIN по authorId без проверки, что User.nickname === authorName,
 * и из-за рассинхрона данных ник «Админ» красился разными цветами.
 *
 * ТЕПЕРЬ: API возвращает `authorGender` ТОЛЬКО когда User.nickname ===
 * authorName (см. safeAuthorGender() в src/lib/nick-gender.ts). Это
 * гарантирует, что переданный profileGender — реальный пол автора с
 * этим ником, а не случайного другого пользователя.
 *
 * Если profileGender = "male" или "female" — берётся оно (реальный пол
 * из профиля автора). Иначе — эвристика по окончанию ника.
 *
 * Для гостевых/демо-карточек (authorId=null, authorGender=null) —
 * работает правило окончания.
 */
export function resolveNickGender(name: string, profileGender?: string | null): NickGender {
  // 1. Ручной override — наивысший приоритет (для «исключительных» ников).
  if (MANUAL_OVERRIDES[name]) return MANUAL_OVERRIDES[name];
  // 2. Profile gender из БД — только если User.nickname === authorName
  //    (см. safeAuthorGender в API — проверяет соответствие).
  if (profileGender === "male" || profileGender === "female") return profileGender;
  // 3. Эвристика по окончанию ника.
  return guessNickGender(name);
}

/**
 * Безопасное извлечение authorGender из связанного User.
 *
 * ВАЖНО (04.10.2026): в данных рассинхрон — `authorName` (строка) и
 * `authorId` (FK на User) часто НЕ СООТВЕТСТВУЮТ друг другу. Например,
 * в seed-демо для /rekomenduyu в поле `authorName` записан «Админ», а
 * `authorId` указывает на пользователя «марина_58» (gender=female).
 *
 * Эта функция возвращает gender ТОЛЬКО если User.nickname === authorName.
 * Иначе возвращает null → клиент использует эвристику по окончанию ника.
 *
 * Использование в API:
 *   authorGender: safeAuthorGender(p.authorName, p.author),
 *   где p.author = { nickname, gender } (Prisma select: { nickname: true, gender: true })
 */
export function safeAuthorGender(
  authorName: string,
  author: { nickname: string; gender: string | null } | null
): string | null {
  if (!author) return null;
  if (author.nickname !== authorName) return null;
  return author.gender === "male" || author.gender === "female" ? author.gender : null;
}

/** CSS-класс цветного ника: "sm-nick-gender g-male|g-female|g-neutral". */
export function nickGenderClass(name: string, profileGender?: string | null): string {
  return `sm-nick-gender g-${resolveNickGender(name, profileGender)}`;
}
