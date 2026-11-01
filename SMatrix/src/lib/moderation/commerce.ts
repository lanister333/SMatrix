/**
 * ШАГ 10. Детерминированный фильтр коммерческих объявлений.
 *
 * Блокирует ВСЕГДА при отправке (как и profanity) — shadow mode не обходит.
 *
 * Ловит:
 *  — глаголы продажи: «продам», «продаю», «продает», «продадим», «реализую», «сбываю»
 *  — глаголы покупки: «куплю», «купим», «приобрету», «закупаю»
 *  — маркеры коммерции: «торг», «опт», «розница», «в наличии», «доставка»,
 *    «самовывоз», «отправка по РФ», «дешево», «недорого», «скидка»,
 *    «в наличие» (частая опечатка), «торговля»
 *  — ценники: «руб», «р.», «₽», «тенге», «usd», «eur», «₸», «$», «€»,
 *    «за кг», «за штуку», «за хвост», «за литр»
 *  — связки «товар + цена»: «горбуша 800», «рыба 500», «мясо 1000»
 *
 * НЕ ловит (whitelist):
 *  — обсуждение цен: «сколько стоит», «какая цена», «цена норм», «дорого/дешево»
 *    в контексте обсуждения, а не предложения
 *  — слова «купил», «покупал» (прошедшее время — обсуждение покупки)
 *  — «продаётся в магазине» (безличная форма)
 *
 * Логика: детектим «продающий» intent, а не любое упоминание commerce-слов.
 * Триггер: наличие одновременно (A) глагола/маркера продажи И (B) предмета или цены.
 */

export interface CommerceHit {
  word: string;
  category: "sale_verb" | "buy_verb" | "price_marker" | "quantity";
}

export interface CommerceResult {
  blocked: boolean;
  reason: string;
  hits: CommerceHit[];
}

/** Глаголы/маркеры активной продажи (настоящее/будущее время, 1-е лицо). */
const SALE_VERBS = [
  "продам", "продаю", "продаем", "продаём", "продадим", "продаешь", "продает", "продаёт",
  "реализую", "реализуем", "сбываю", "сбыт", "сбываем", "отдам", "отдаю",
  "перепродам", "перепродаю", "барыжу", "торгую", "торгуем",
];

/** Пассивные формы — НЕ триггер (обсуждение факта продажи). */
const PASSIVE_WHITELIST = [
  "продаётся", "продается", "продаются", "продавался", "продавалась",
  "продано", "продана", "продан", "проданы",
  "купил", "купила", "купили", "покупал", "покупала", "покупали",
];

/** Глаголы активной закупки. */
const BUY_VERBS = ["куплю", "купим", "закуплю", "закупим", "приобрету", "приобретем"];

/** Маркеры коммерции (как самостоятельные сигналы). */
const COMMERCE_MARKERS = [
  "оптом", "опт.", "опт,", "розница", "в наличии", "в наличие", "вналичии",
  "самовывоз", "доставка по рф", "отправка по рф", "торг уместен", "торг",
  "бартер", "обмен на", "меняю на", "сдаю", "сдаётся", "аренда",
];

/** Маркеры цены. */
const PRICE_MARKERS = [
  "руб", "р.", "₽", "тенге", "₸", "usd", "eur", "€", "$",
  "за кг", "за штуку", "за хвост", "за литр", "за метр", "за упаковку",
  "за блок", "за ящик", "за коробку", "за тонну",
];

/** Паттерны цены: число + единица. */
const PRICE_PATTERN = /\b\d{2,6}\s*(руб|р\.|₽|тенге|₸|usd|eur|€|\$|кг|шт|литр|метр|хвост)\b/i;

/** Whitelist: фразы обсуждения (не блокировать). */
const DISCUSSION_WHITELIST = [
  "сколько стоит", "какая цена", "цена норм", "цена ок", "цена нормальная",
  "цена высокая", "цена низкая", "дорого", "дешево", "недорого",
  "почём", "почем", "за сколько", "сколько просишь",
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

/**
 * Основная проверка коммерческого intent'а.
 *
 * Триггер срабатывает, когда:
 *  1. Есть активный глагол продажи (SALE_VERBS) + любой товарный контекст, ИЛИ
 *  2. Есть активный глагол закупки (BUY_VERBS) + явный предмет, ИЛИ
 *  3. Есть ≥2 коммерческих маркера (например, «опт + доставка»), ИЛИ
 *  4. Явная цена + предмет ( PRICE_PATTERN + существительное-товар )
 *
 * Пассивные формы и обсуждение цен — НЕ блокируются.
 */
export function checkCommerce(text: string): CommerceResult {
  const hits: CommerceHit[] = [];
  if (!text || text.length < 4) return { blocked: false, reason: "", hits };

  const norm = normalize(text);

  // Whitelist: обсуждение цен — пропускаем
  for (const w of DISCUSSION_WHITELIST) {
    if (norm.includes(w)) return { blocked: false, reason: "", hits };
  }

  // Проверка пассивных форм — если есть пассив, но нет активного sale verb, пропускаем
  let hasPassive = false;
  for (const p of PASSIVE_WHITELIST) {
    if (norm.includes(p)) hasPassive = true;
  }

  let hasSaleVerb = false;
  let hasBuyVerb = false;
  let markerCount = 0;
  let hasPrice = false;

  // Сканируем SALE_VERBS как слова (с границами)
  for (const v of SALE_VERBS) {
    const re = new RegExp(`\\b${v}\\b`, "i");
    if (re.test(norm)) {
      hits.push({ word: v, category: "sale_verb" });
      hasSaleVerb = true;
    }
  }

  for (const v of BUY_VERBS) {
    const re = new RegExp(`\\b${v}\\b`, "i");
    if (re.test(norm)) {
      hits.push({ word: v, category: "buy_verb" });
      hasBuyVerb = true;
    }
  }

  for (const m of COMMERCE_MARKERS) {
    if (norm.includes(m)) {
      hits.push({ word: m, category: "price_marker" });
      markerCount++;
    }
  }

  for (const p of PRICE_MARKERS) {
    if (norm.includes(p.toLowerCase())) {
      hits.push({ word: p, category: "price_marker" });
      hasPrice = true;
      break; // достаточно одного
    }
  }

  if (PRICE_PATTERN.test(norm)) {
    hasPrice = true;
    const m = norm.match(PRICE_PATTERN);
    if (m) hits.push({ word: m[0], category: "price_marker" });
  }

  // Если только пассивные формы и нет активных sale verbs — пропускаем
  if (hasPassive && !hasSaleVerb && !hasBuyVerb && markerCount === 0) {
    return { blocked: false, reason: "", hits };
  }

  // Триггер 1: активный глагол продажи + что-то ещё (цена/маркер/длина текста)
  if (hasSaleVerb) {
    // «продам горбушу 800 руб» — sale_verb + price
    // «продам машину» — sale_verb + существительное (любое слово после)
    // простая эвристика: если есть sale_verb и текст длиннее самого глагола
    // — есть предмет продажи
    if (hasPrice || markerCount > 0 || norm.length > 8) {
      return {
        blocked: true,
        reason: "Коммерческое объявление (продажа) — запрещено на форуме",
        hits,
      };
    }
  }

  // Триггер 2: активный глагол закупки + явная формулировка
  if (hasBuyVerb && (hasPrice || markerCount > 0)) {
    return {
      blocked: true,
      reason: "Коммерческое объявление (закупка) — запрещено на форуме",
      hits,
    };
  }

  // Триггер 3: 2+ коммерческих маркера (опт + доставка и т.п.)
  if (markerCount >= 2) {
    return {
      blocked: true,
      reason: "Коммерческое объявление (маркеры оптовой торговли) — запрещено",
      hits,
    };
  }

  // Триггер 4: явная цена + предмет (без глагола, но с явным предложением)
  // «горбуша 800 руб» — но не «горбуша стоит 800 руб»
  if (hasPrice && !hasPassive) {
    // ищем существительное-предмет рядом с ценой
    // эвристика: если есть PRICE_PATTERN и текст не содержит «стоит»/«цена»/«почём»
    const hasDiscussionWord = /стоит|цена|почём|почем|сколько/i.test(norm);
    if (!hasDiscussionWord && PRICE_PATTERN.test(norm)) {
      return {
        blocked: true,
        reason: "Коммерческое объявление (явная цена без контекста обсуждения) — запрещено",
        hits,
      };
    }
  }

  return { blocked: false, reason: "", hits };
}
