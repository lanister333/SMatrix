/**
 * ЗАДАЧА «Замена источника курсов» (2026-09-23): единый реестр банков ТЗ
 * для трёх источников агрегатора (bankdep.ru / mainfin.ru / banktop.ru),
 * API /api/home/rates и UI — модуль без серверных зависимостей.
 *
 * РЕСТАВРАЦИЯ 2026-09-23 (воркспейс откатился платформой к снапшоту
 * 09-21; файл пересоздан по записям worklog — состав и регэкспы 1-в-1).
 *
 * 15 банков ТЗ в строгом порядке ТЗ (компактная таблица 09-23 добавила
 * девятку к исходной шестёрке; «Дальневосточный банк» сокращён до
 * официального короткого бренда «ДВ банк» по ТЗ 2026-09-23 — экономия
 * ширины колонки; matchBank ловит ОБА написания агрегаторов).
 *
 * matchBank — регэксп по написаниям источника (полное имя, alias,
 * латиница). matchTargetBank(raw) — входная точка парсеров: сперва
 * отсечение ПриоВТБ (самарский банк «ПриоВТБ» содержит подстроку «втб»
 * и без guard'а протекал бы в колонку ВТБ), затем первый подходящий
 * банк реестра в порядке ТЗ.
 */

export interface TargetBank {
  /** Каноническое имя в таблице/панели (порядок = порядок ТЗ). */
  name: string;
  /** Регэксп написаний банка у источников (RU + латиница + alias). */
  matchBank: RegExp;
}

export const TARGET_BANKS: TargetBank[] = [
  { name: "АТБ", matchBank: /атб|atb/i },
  { name: "Солид Банк", matchBank: /солид|solid/i },
  { name: "Сбербанк", matchBank: /сбер|sber/i },
  { name: "ВТБ", matchBank: /втб|vtb/i },
  { name: "Приморье", matchBank: /приморье|primorie|primorye/i },
  { name: "Долинск", matchBank: /долинск|dolinsk/i },
  { name: "Экспобанк", matchBank: /экспо|expobank|expo/i },
  { name: "Газпромбанк", matchBank: /газпром|gazprombank/i },
  { name: "Совкомбанк", matchBank: /совком|sovcombank/i },
  { name: "Россельхозбанк", matchBank: /россельхоз|рсхб|rshb|rossel/i },
  { name: "Альфа-Банк", matchBank: /альфа|alfabank|alfa/i },
  { name: "МТС-Банк", matchBank: /мтс|mts/i },
  {
    name: "ДВ банк",
    // ТЗ 2026-09-23 «ДВ банк»: полное написание («Дальневосточный банк»,
    // dalnevost) + сокращённое («ДВ банк», dvbank) — каноничное короткое.
    matchBank: /дальневосточ|dalnevost|дв[- ]?банк|dv[- ]?bank/i,
  },
  { name: "Банк «Итуруп»", matchBank: /итуруп|iturup/i },
  // /т-?банк/ не матчит «дв банк» (нет буквы «т») — порядок безопасен
  { name: "Т-Банк", matchBank: /т-?банк|t-?bank|тин(ь)?кофф|tinkoff/i },
];

/** Имена банков ТЗ — ровно в порядке ТЗ (API строит из него строки). */
export const TARGET_BANK_NAMES = TARGET_BANKS.map((b) => b.name);

/** ПриоВТБ (самарский) отсекается ДО проверки ВТБ: подстрока «втб»
 *  внутри «ПриоВТБ» иначе даёт ложный матч. */
const BANK_NAME_GUARD = /прио\s*[- ]?\s*втб|priovtb/i;

/** Каноническое имя банка ТЗ по сырому написанию источника
 *  (имя/alias/латиница) — или null, если банк не из списка ТЗ. */
export function matchTargetBank(raw: string): string | null {
  if (!raw) return null;
  if (BANK_NAME_GUARD.test(raw)) return null;
  for (const b of TARGET_BANKS) {
    if (b.matchBank.test(raw)) return b.name;
  }
  return null;
}

/** Оставляет только банки ТЗ и сортирует их в порядке ТЗ
 *  (15 строк панели/таблицы всегда в одном порядке; серии с банками
 *  вне реестра в панель не попадают). */
export function filterTargetBankRows<T extends { bank: string }>(rows: T[]): T[] {
  const order = new Map(TARGET_BANK_NAMES.map((n, i) => [n, i]));
  return rows
    .filter((r) => order.has(r.bank))
    .sort((a, b) => (order.get(a.bank) ?? 0) - (order.get(b.bank) ?? 0));
}
