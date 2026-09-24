/**
 * ШАГ 19. Помощники раздела «ЖКХ и городские проблемы» (/gkh).
 *
 * Статусы (ТЗ №2 от 2026-09-23, структура карточки — «Текущий статус»):
 * active «В поиске решения», in_progress «Передано в УК»,
 * solved «Решено», rejected «Отклонено» (прежде по ТЗ «Жкх.docx» п.3
 * было три: «Проблема актуальна» / «Решается» / «Решено» — значения
 * полей БД не менялись, обновлены только метки; rejected добавлен).
 * Порядок ленты: актуальные (active/in_progress) выше, решённые и
 * отклонённые ниже, внутри групп новые сверху.
 * Поиск (ТЗ п.21): по заголовку, тексту проблемы, месту и тексту обновлений;
 * частичные совпадения, разные формы слова, «е» и «ё», распространённые
 * сокращения.
 */

/** Метки статусов проблемы (ТЗ №2 от 2026-09-23 — дословно). */
export const GKH_STATUS_LABELS: Record<string, string> = {
  active: "В поиске решения",
  in_progress: "Передано в УК",
  solved: "Решено",
  rejected: "Отклонено",
};

/** Краткие метки статуса (для компактных бейджей ленты). */
export const GKH_STATUS_SHORT: Record<string, string> = {
  active: "В поиске решения",
  in_progress: "Передано в УК",
  solved: "Решено",
  rejected: "Отклонено",
};

/** Порядок ленты: активные выше, затем решённые, затем отклонённые. */
export const GKH_STATUS_RANK: Record<string, number> = {
  active: 0,
  in_progress: 1,
  solved: 2,
  rejected: 3,
};

export const GKH_STATUSES = ["active", "in_progress", "solved", "rejected"] as const;

export function isGkhStatus(v: unknown): v is (typeof GKH_STATUSES)[number] {
  return typeof v === "string" && (GKH_STATUSES as readonly string[]).includes(v);
}

/**
 * Причины жалоб (ТЗ п.17 — ровно восемь). Кнопок «Ложь», «Фейк»,
 * «Не согласен» НЕТ: разногласие с содержанием — не жалоба.
 */
export const GKH_COMPLAINT_CATEGORIES = [
  "personal_data", // Персональные данные
  "insult", // Оскорбления
  "threat", // Угрозы
  "spam", // Спам
  "ad", // Реклама
  "fraud", // Мошенничество
  "offtopic", // Не по теме
  "other", // Другое
] as const;

export function isGkhComplaintCategory(v: string): boolean {
  return (GKH_COMPLAINT_CATEGORIES as readonly string[]).includes(v);
}

/* ------------------------------------------------------------------ */
/* Поиск (ТЗ п.21)                                                     */
/* ------------------------------------------------------------------ */

/**
 * Распространённые сокращения (ТЗ п.21) — слово запроса раскрывается в
 * дополнительные варианты для сопоставления. Список намеренно короткий:
 * только устойчивые сокращения, без которых поиск явно хуже.
 */
const ABBREVIATIONS: Record<string, string[]> = {
  юс: ["южносахалинск", "южно"],
  хмск: ["холмск"],
  крс: ["корсаков"],
  жкх: ["жилищно", "коммунальн"],
};

/** Нормализация текста: нижний регистр и «ё» → «е» (ТЗ п.21). */
function norm(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

/**
 * Основа слова для поиска по формам: грубо срезаем изменяемый хвост,
 * чтобы «дорогу» находило «дорога», «отопления» — «отопление»,
 * «яму» — «яма».
 */
function stem(word: string): string {
  if (word.length <= 2) return word;
  // срезаем до двух последних букв-окончаний, но не короче 2 знаков
  return word.slice(0, Math.max(2, word.length - 2));
}

/** Развёрнутые варианты слова запроса: само слово + основа + сокращения. */
function queryVariants(word: string): string[] {
  const variants = new Set<string>();
  const w = norm(word).replace(/^[-]+|[-]+$/g, "");
  if (!w) return [];
  variants.add(w);
  const st = stem(w);
  if (st.length >= 2) variants.add(st);
  for (const abbr of ABBREVIATIONS[w] ?? []) variants.add(abbr);
  return [...variants];
}

/** Компактный вариант текста: дефисы и пробелы убраны («южно-сахалинск» → «южносахалинск»). */
function compact(s: string): string {
  return norm(s).replace(/[-\s]+/g, "");
}

/**
 * Проверка попадания проблемы под поисковый запрос (ТЗ п.21).
 * Каждое слово запроса должно совпасть хотя бы одним вариантом
 * (слово / основа / сокращение) хотя бы в одном из полей:
 * заголовок, текст, место, тексты обновлений.
 * Haystack дополнительно содержит запись без дефисов — так «южно-сахалинск»
 * находится и по «южносахалинск», и по «юс» (сокращение).
 */
export function gkhMatchesQuery(
  p: { title: string; text: string; place: string },
  updateTexts: string[],
  q: string
): boolean {
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack =
    norm(`${p.title}\n${p.text}\n${p.place}\n${updateTexts.join("\n")}`) +
    "\n" +
    compact(`${p.title}\n${p.text}\n${p.place}\n${updateTexts.join("\n")}`);
  return words.every((raw) => {
    const variants = queryVariants(raw);
    if (variants.length === 0) return true;
    return variants.some((v) => haystack.includes(v));
  });
}

/** Фильтр по месту: подстрока без учёта регистра (компактный фильтр раздела). */
export function gkhMatchesPlace(place: string, filter: string): boolean {
  if (!filter) return true;
  return norm(place).includes(norm(filter));
}

/**
 * Точная копия собственной публикации автора (ТЗ п.28 — защита от повторов):
 * совпадает нормализованный заголовок.
 */
export function normalizedProblemTitle(title: string): string {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Текст одного элемента истории для поискового индекса обновлений. */
export function updateHaystacks(texts: { text: string }[]): string[] {
  return texts.map((t) => t.text);
}

/* ------------------------------------------------------------------ */
/* Медиа (ТЗ п.27)                                                     */
/* ------------------------------------------------------------------ */

export const GKH_PHOTO_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const GKH_VIDEO_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime", // .mov
]);

/** Лимиты (ТЗ п.27): до 5 фото и до 1 видео к публикации и к обновлению. */
export const GKH_MAX_PHOTOS = 5;
export const GKH_MAX_VIDEO = 1;
/** Пределы размера файла: фото 8 МБ, видео 60 МБ (проверка длительности ≤1 мин — на клиенте). */
export const GKH_PHOTO_MAX_SIZE = 8 * 1024 * 1024;
export const GKH_VIDEO_MAX_SIZE = 60 * 1024 * 1024;

/** Расширение файла по mime (для сохранения на диск). */
export function mediaExtension(mime: string, fallbackName: string): string {
  const byMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  if (byMime[mime]) return byMime[mime];
  const ext = fallbackName.includes(".") ? fallbackName.split(".").pop()! : "";
  return /^[a-z0-9]{2,5}$/i.test(ext) ? ext.toLowerCase() : "bin";
}
