/**
 * ШАГ 26. «Знакомства» (/znakomstva) — самостоятельный раздел SakhMatrix,
 * единственный публично анонимный раздел сайта.
 *
 * ТЗ:
 *  — ровно ДВЕ категории, добавлять другие запрещено;
 *  — публичная анонимность: посетителю не показываются ник, имя, аватар,
 *    пол автора и ссылка на профиль; система и модерация автора знают;
 *  — формат: категория, заголовок, текст, дата, статус, при желании фото,
 *    контакты автор указывает сам в тексте;
 *  — статусы: «Актуально» / «Неактуально»; неактуальные не удаляются —
 *    остаются в разделе, показываются ниже актуальных, серым;
 *  — обсуждений нет: без комментариев, лайков, оценок, подписок,
 *    уведомлений и форумных тем; система цветов ника не используется.
 */

export interface DatingCategory {
  key: string;
  label: string;
  short: string;
}

/** РОВНО ЧЕТЫРЕ категории (ТЗ Flat 2.0 — вкладки блока «Знакомства»,
 *  совпадают с FLAT_DATING_BOARD в flat-board.tsx). */
export const DATING_CATEGORIES: DatingCategory[] = [
  { key: "m4w", label: "Мужчина ищет женщину", short: "М → Ж" },
  { key: "w4m", label: "Женщина ищет мужчину", short: "Ж → М" },
  { key: "friendship", label: "Дружба / Общение", short: "Дружба" },
  { key: "person", label: "Ищу человека / Благодарность", short: "Поиск человека" },
];

export function isDatingCategory(key: string): boolean {
  return DATING_CATEGORIES.some((c) => c.key === key);
}

export function datingCategoryLabel(key: string): string {
  return DATING_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export const DATING_STATUSES = [
  { key: "actual", label: "Актуально" },
  { key: "stale", label: "Неактуально" },
] as const;

export function datingStatusLabel(status: string): string {
  return status === "stale" ? "Неактуально" : "Актуально";
}

export const DATING_MAX_PHOTOS = 5;
export const DATING_TITLE_MIN = 5;
export const DATING_TITLE_MAX = 150;
export const DATING_BODY_MIN = 10;
export const DATING_BODY_MAX = 8000;

/**
 * Причины жалоб (9). Это СИГНАЛ модерации, не голосование: количество
 * жалоб не показывается и само по себе не означает нарушение.
 * Кнопок «Ложь»/«Фейк»/«Не согласен» нет.
 */
export const DATING_COMPLAINT_REASONS = [
  { key: "spam", label: "Спам" },
  { key: "commercial", label: "Реклама" },
  { key: "fraud", label: "Мошенничество" },
  { key: "insult", label: "Оскорбления" },
  { key: "threat", label: "Угрозы" },
  { key: "exploitation", label: "Сексуальная эксплуатация или интим-услуги" },
  { key: "personal_data", label: "Чужие персональные данные или контакты" },
  { key: "illegal", label: "Незаконное предложение" },
  { key: "other", label: "Другое нарушение правил" },
] as const;

export function isDatingComplaintReason(key: string): boolean {
  return DATING_COMPLAINT_REASONS.some((r) => r.key === key);
}

export function datingComplaintLabel(key: string): string {
  return DATING_COMPLAINT_REASONS.find((r) => r.key === key)?.label ?? key;
}

/** Нормализация для поиска: нижний регистр + е/ё. */
function normalizeSearchText(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

/**
 * Простой поиск по объявлениям: заголовок и текст, частичное совпадение,
 * несколько слов (все должны найтись), без учёта регистра и е/ё.
 */
export function datingMatchesQuery(
  post: { title: string; body: string },
  query: string
): boolean {
  const q = normalizeSearchText(query.trim());
  if (!q) return true;
  const haystack = normalizeSearchText(`${post.title} ${post.body}`);
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

/**
 * Нормализация заголовка для защиты от повторной публикации того же
 * объявления: нижний регистр, е/ё, все пробельные последовательности в один
 * пробел, без знаков препинания.
 */
export function normalizedDatingTitle(title: string): string {
  return normalizeSearchText(title)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Порядок ленты: сначала актуальные (новые сверху), затем неактуальные
 * (тоже новые сверху). Неактуальные не удаляются и находятся поиском.
 */
export function feedOrder(
  a: { status: string; createdAt: Date; id: string },
  b: { status: string; createdAt: Date; id: string }
): number {
  const aActual = a.status === "actual" ? 0 : 1;
  const bActual = b.status === "actual" ? 0 : 1;
  if (aActual !== bActual) return aActual - bActual;
  const t = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (t !== 0) return t;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}
