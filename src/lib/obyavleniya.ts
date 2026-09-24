/**
 * ШАГ 22 (восстановление). Помощники раздела «Объявления» — доски объявлений
 * жителей Сахалина (/obyavleniya).
 *
 * Ровно восемь рубрик (другие запрещены), одно объявление — один товар или
 * одна услуга. Цена и контакты — необязательные поля. Суть раздела —
 * объявления: продать свои вещи и предложить свои услуги МОЖНО; мошенничество
 * (предоплата переводом вперёд, фейковые товары), запрещённые товары, спам
 * и чужие персональные данные — нарушение.
 */

/** Ровно восемь рубрик раздела (порядок отображения в фильтре). */
/* ТЗ 2026-09-22 Flat 2.0 (реставрация 2026-09-23): НЕКОММЕРЧЕСКАЯ доска
   взаимопомощи — ровно три текстовые вкладки (совпадают с
   FLAT_ADS_BOARD в flat-board.tsx); продажа вещей/авто/недвижимости
   исключена (старые коммерческие рубрики сняты). */
export const AD_RUBRICS: { key: string; label: string }[] = [
  { key: "give", label: "Отдам даром / Поделюсь" },
  { key: "need", label: "Приму в дар / Нужна помощь" },
  { key: "lostfound", label: "Бюро находок (Потерял / Нашел)" },
];

export const AD_RUBRIC_KEYS = new Set(AD_RUBRICS.map((r) => r.key));

export function adRubricLabel(key: string): string {
  return AD_RUBRICS.find((r) => r.key === key)?.label ?? "Разное";
}

/** Статусы объявления. */
export const AD_STATUS_LABELS: Record<string, string> = {
  active: "Актуально",
  closed: "Снято с публикации",
};

/** Максимум фото на объявление. */
export const AD_PHOTO_LIMIT = 5;

/** Подсказка формы: одно объявление — один товар/услуга. */
export const AD_ONE_HINT = "Одно объявление — один товар или одна услуга. Разные товары публикуйте отдельными объявлениями.";

/**
 * Защита от массовой торговли в одном объявлении: в заголовке перечислено
 * несколько разных товаров (сегменты по запятым/союзам с латинскими
 * брендами ≥2 или слово-категория в двух сегментах). Похожа на проверку
 * «Где дешевле», но мягче: «продам велосипед и самокат» — нормальное
 * объявление из двух предметов одного владельца, запрещаем только явное
 * перечисление РАЗНЫХ брендов (типичный признак перепродажи/спама).
 */
export function isMultipleGoods(title: string): boolean {
  const normalized = title.replace(/(?:^|\s)(?:и|или)(?:\s|$)/gi, ",");
  const segments = normalized
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
  const brandSets: Set<string>[] = [];
  for (const seg of segments) {
    const brands = (seg.match(/\b[a-z][a-z0-9]{2,}\b/gi) ?? []).map((w) => w.toLowerCase());
    if (brands.length === 0) continue;
    brandSets.push(new Set(brands));
  }
  if (brandSets.length < 2) return false;
  for (let i = 0; i < brandSets.length; i++) {
    for (let j = i + 1; j < brandSets.length; j++) {
      let common = 0;
      for (const w of brandSets[i]) if (brandSets[j].has(w)) common++;
      if (common === 0) return true;
    }
  }
  return false;
}

/** Служебные слова, не влияющие на поиск объявлений. */
const STOPWORDS = new Set([
  "продам", "продаю", "продажа", "куплю", "купл", "отдам", "даром", "ищу",
  "нужен", "нужна", "нужно", "предлагаю", "услуги", "услуга", "выполняю",
  "в", "на", "за", "по", "и", "с", "со", "к", "у", "о", "об", "а", "но",
  "или", "для", "можно", "ли", "бы", "не", "что", "это", "этот", "эта",
  "мне", "вы", "мы", "я", "ты", "кто", "чем", "тут", "здесь", "сейчас",
  "руб", "рублей", "р", "шт", "штук", "телефон", "звоните", "пишите",
]);

/** Наивные окончания для грубой нормализации русских слов. */
const SUFFIXES = [
  "ами", "ями", "ого", "его", "ому", "ему", "ыми", "ими", "ой", "ый", "ий",
  "ая", "яя", "ые", "ие", "ов", "ев", "ах", "ях", "ам", "ям", "ом", "ем",
  "ую", "юю", "ешь", "ает", "ают", "ут", "ют", "ат", "ят",
  "а", "я", "о", "е", "и", "ы", "у", "ю", "ь", "й",
];

/** Набор значимых токенов объявления (для поиска и похожести). */
export function significantTokens(s: string): Set<string> {
  const raw = s.toLowerCase().match(/[a-zа-яё0-9][a-zа-яё0-9-]*/g) ?? [];
  const out = new Set<string>();
  for (let w of raw) {
    w = w.replace(/^[-]+|[-]+$/g, "");
    if (w.length < 2 || STOPWORDS.has(w)) continue;
    if (/[а-яё]/.test(w) && w.length >= 6) {
      for (const suf of SUFFIXES) {
        if (w.length - suf.length >= 4 && w.endsWith(suf)) {
          w = w.slice(0, w.length - suf.length);
          break;
        }
      }
    }
    if (w.length >= 2) out.add(w);
  }
  return out;
}

/** Похожи ли два объявления: общий длинный токен (≥5) или два общих. */
export function listingsSimilar(a: Set<string>, b: Set<string>): boolean {
  let shared = 0;
  let strong = 0;
  for (const t of a) {
    if (!b.has(t)) continue;
    shared++;
    if (t.length >= 5) strong++;
  }
  if (strong >= 1 && shared >= 1) return true;
  if (shared >= 2) return true;
  return false;
}

/** Нормализация заголовка для защиты от точного повтора. */
export function normalizedTitle(title: string): string {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Простой поиск: каждое слово запроса должно частично совпасть. */
export function adMatchesQuery(p: { title: string; text: string; price: string }, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${p.title}\n${p.text}\n${p.price}`.toLowerCase();
  return words.every((w) => haystack.includes(w));
}

/** Компактный фильтр по месту: подстрока без учёта регистра. */
export function adMatchesPlace(p: { place: string }, place: string): boolean {
  if (!place) return true;
  return p.place.toLowerCase().includes(place.toLowerCase());
}
