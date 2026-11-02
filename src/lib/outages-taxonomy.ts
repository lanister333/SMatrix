/**
 * Шаг №7.5: чистая таксономия сводок коммунальных отключений для страницы
 * /disconnections.php — районный фильтр и разбивка всего массива на три
 * блока служб. Файл БЕЗ node-зависимостей: импортируется и API-роутом,
 * и клиентским экраном, и тестами. Тип OutageItem берётся из
 * outages-parser через import type (стирается при компиляции).
 *
 * Шаг №11 («полноценное наполнение», финальное ТЗ): чипы фильтра —
 * [Все районы], Южно-Сахалинск, Корсаков, Холмск, Анива, Оха
 * (круглые бабблы, «Все районы» — первый и активный по умолчанию);
 * справочник «Телефоны экстренных служб» — ФРС/СКК/Водоканал
 * tel:-ссылками в компактной таблице.
 */

import type { OutageItem } from "@/lib/outages-parser";

/** Районы фильтра — порядок из ТЗ Шага №7.5/№11 (без «Все районы»). */
export const OUTAGE_DISTRICTS = [
  "Южно-Сахалинск",
  "Корсаков",
  "Холмск",
  "Анива",
  "Оха",
];

/**
 * Чипы фильтра по ТЗ Шага №11 — точный ряд: [Все районы], [Южно-Сахалинск],
 * [Корсаков], [Холмск], [Анива], [Оха]. «Все районы» — явный первый чип
 * (значение фильтра "" = весь массив без отбора); повторный клик по
 * выбранному городу тоже возвращает к «Все районы».
 */
export const FILTER_CHIPS: string[] = ["Все районы", ...OUTAGE_DISTRICTS];

/** Строка справочника «Телефоны экстренные службы» (Шаг №11). */
export interface EmergencyPhone {
  label: string;
  number: string;
}

/**
 * Телефоны экстренных служб по ТЗ Шага №11: ФРС 782-782, СКК 72-30-13,
 * Водоканал 72-32-40 (в отличие от Шага №7.5 — именно «Водоканал»,
 * а не «РВК»). Рендерятся как href="tel:..." в компактной таблице.
 */
export const EMERGENCY_PHONES: EmergencyPhone[] = [
  { label: "ФРС", number: "782-782" },
  { label: "СКК", number: "72-30-13" },
  { label: "Водоканал", number: "72-32-40" },
];

/**
 * Район сводки: явное упоминание города (Корсаков/Холмск/Анива/Оха) в
 * заголовке или адресах — этот город; иначе Южно-Сахалинск — домашний
 * регион всех трёх источников (Сахалинэнерго, СКК, Городской водоканал
 * Южно-Сахалинска). Регистр не важен; «ул. Сахалинская» городом не считается
 * (ищется точное название района, а не подстрока «сахалинск»).
 * Фильтру соответствует чип с тем же названием; пустое значение "" —
 * чип «Все районы» (весь массив).
 */
export function outageDistrict(item: Pick<OutageItem, "title" | "addresses">): string {
  const text = [item.title ?? "", ...(item.addresses ?? [])].join(" ").toLowerCase();
  for (const d of OUTAGE_DISTRICTS) {
    if (d === "Южно-Сахалинск") continue; // умолчание — см. ниже
    if (text.includes(d.toLowerCase())) return d;
  }
  return "Южно-Сахалинск";
}

export interface OutageGroups {
  /** «⚡ Электроэнергия» — Сахалинэнерго (и любой неизвестный источник). */
  electro: OutageItem[];
  /** «💧 Горячая вода и Тепло» — СКК. */
  hot: OutageItem[];
  /** «🚰 Холодная вода» — Городской водоканал. */
  cold: OutageItem[];
}

/**
 * Разбивка массива на три чётких блока по ТЗ Шага №7.5. Порядок внутри
 * блока сохраняется: /api/outages уже отсортировал весь массив по времени
 * публикации (свежие — вверху), группы лишь фильтруют его.
 */
export function groupOutagesByUtility(items: OutageItem[]): OutageGroups {
  const electro: OutageItem[] = [];
  const hot: OutageItem[] = [];
  const cold: OutageItem[] = [];
  for (const it of items) {
    const s = (it.source ?? "").toLowerCase();
    if (s.includes("скк")) hot.push(it);
    else if (s.includes("водоканал")) cold.push(it);
    else electro.push(it); // Сахалинэнерго; неизвестные источники — тоже свет
  }
  return { electro, hot, cold };
}

/* ==================== ЗАДАЧА №4 (ТЗ) ==================== */

/** Смещение Сахалина от UTC (Asia/Sakhalin, летнего времени нет). */
const SAKHALIN_OFFSET_MS = 11 * 60 * 60 * 1000;

/**
 * Ведомственный бейдж строки информера на Главной (формат ТЗ Задачи №4:
 * [Иконка/Название ведомства] …): ⚡ Сахалинэнерго (электросети ФРС),
 * 🔥 СКК (тепло/ГВС), 🚰 Водоканал (холодная вода).
 */
export function outageOrgBadge(source: string): { icon: string; name: string } {
  const s = (source ?? "").toLowerCase();
  if (s.includes("скк")) return { icon: "🔥", name: source || "СКК" };
  if (s.includes("водоканал")) return { icon: "🚰", name: source || "Водоканал" };
  return { icon: "⚡", name: source || "Сахалинэнерго" };
}

/**
 * Время публикации для строки ТЗ: сегодня по сахалинскому времени —
 * только «ЧЧ:ММ»; раньше — «ДД.ММ ЧЧ:ММ»; у записей с датой без
 * времени (Водоканал публикует 00:00) — только «ДД.ММ». Пустая строка,
 * если время публикации не распознано.
 */
export function outageWhenLabel(publishedAt?: string): string {
  if (!publishedAt) return "";
  const t = new Date(publishedAt).getTime();
  if (isNaN(t)) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const loc = new Date(t + SAKHALIN_OFFSET_MS);
  const hm = `${pad(loc.getUTCHours())}:${pad(loc.getUTCMinutes())}`;
  const nowLoc = new Date(Date.now() + SAKHALIN_OFFSET_MS);
  const sameDay =
    loc.getUTCDate() === nowLoc.getUTCDate() &&
    loc.getUTCMonth() === nowLoc.getUTCMonth();
  const day = `${pad(loc.getUTCDate())}.${pad(loc.getUTCMonth() + 1)}`;
  if (hm === "00:00") return day;
  return sameDay ? hm : `${day} ${hm}`;
}
