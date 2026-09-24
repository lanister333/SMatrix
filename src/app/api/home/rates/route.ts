/**
 * ЗАДАЧА «Замена источника курсов» (2026-09-23): курсы НАЛИЧНОЙ валюты
 * касс банков Южно-Сахалинска для панели и большой таблицы.
 *
 * РЕСТАВРАЦИЯ 2026-09-23: файл пересоздан по записям worklog после
 * отката воркспейса (детали — в шапке src/lib/currency-banks.ts).
 *
 * Источник — многоисточниковый агрегатор runCurrencyAggregate()
 * (src/lib/currency-sources.ts: bankdep → mainfin → banktop → кэш БД).
 * ПРЕЖНИЙ kovalut-парсер (src/lib/currency-parser.ts) удалён.
 *
 * Ответ v2:
 * {
 *   source: "multi" | "cache" | "none",
 *   updated: "23.09.2026 03:28",
 *   sources: { bankdep: ok|empty|error, mainfin: …, banktop: … },
 *   banks: [{ bank, usd..thb: { buy, sell, status, ts, src } }]  // порядок ТЗ
 * }
 *
 * Статусы ячеек (4 состояния ТЗ):
 *   ok          — значение из свежайшей серии (текущий сбор);
 *   stale       — кэш последнего успеха по паре «банк+валюта»
 *                 (первая строка по batch desc; UI рисует обычным
 *                 числом — плашки «устарело» упразднены);
 *   unpublished — источники живы, но курса нет («—»);
 *   error       — упали все источники или mainfin («Ошибка»).
 *
 * Догрев: серия старше 30 минут (темп bankdep) → фоновый запуск
 * агрегатора (троттлинг 10 минут, глобальный счётчик); если серий нет
 * вовсе — первый сбор синхронно. Диагнозы источников при свежем кэше
 * восстанавливаются из полей source строк серии (bankdep/banktop
 * сегодня «empty» — «нет курсов по городу»; mainfin даёт курсы).
 */

import { runCurrencyAggregate, latestCurrencyBatch, SOURCE_IDS, type SourceId } from "@/lib/currency-sources";
import { filterTargetBankRows, TARGET_BANK_NAMES } from "@/lib/currency-banks";
import type { RateCell, RateCellStatus } from "@/lib/currency-table";

export const runtime = "nodejs";

function fmtStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Троттлинг фонового догрева: не чаще раза в 10 минут. */
const g = globalThis as unknown as { __ratesLastWarm?: number };

type CellMap = Record<string, RateCell | null>;
interface BankRowV2 {
  bank: string;
  usd: RateCell | null;
  eur: RateCell | null;
  cny: RateCell | null;
  jpy: RateCell | null;
  krw: RateCell | null;
  thb: RateCell | null;
}
const CELL_KEYS = ["usd", "eur", "cny", "jpy", "krw", "thb"] as const;

/** Собирает строку банка v2 с null-ячейками заданного статуса. */
function emptyRow(bank: string, status: RateCellStatus): BankRowV2 {
  const row = { bank } as BankRowV2;
  for (const k of CELL_KEYS) {
    (row[k] as RateCell | null) = { buy: null, sell: null, status };
  }
  return row;
}

export async function GET() {
  try {
    let rows = await latestCurrencyBatch();

    // Серия старше 30 минут (темп обновления bankdep) — догреваем
    // агрегатор в фоне (не чаще раза в 10 минут). Полностью пустой
    // кэш — первый сбор синхронно, чтобы панель не была пустой.
    const batchAge = rows && rows.length > 0 ? Date.now() - new Date(rows[0].batch).getTime() : Infinity;
    if (batchAge > 30 * 60 * 1000) {
      if (!g.__ratesLastWarm || Date.now() - g.__ratesLastWarm > 10 * 60 * 1000) {
        g.__ratesLastWarm = Date.now();
        void runCurrencyAggregate().catch(() => {});
      }
      if (!rows || rows.length === 0) {
        await runCurrencyAggregate().catch(() => {});
        rows = await latestCurrencyBatch();
      }
    }

    if (rows && rows.length > 0) {
      const batchDate = new Date(rows[0].batch);
      const stamp = fmtStamp(batchDate);
      const batchFresh = Date.now() - batchDate.getTime() <= 30 * 60 * 1000;

      // Ячейки свежайшей серии (статус ok).
      const byBank = new Map<string, BankRowV2>();
      const seenSources = new Set<SourceId>();
      for (const r of rows) {
        let b = byBank.get(r.bank);
        if (!b) {
          b = emptyRow(r.bank, "ok");
          byBank.set(r.bank, b);
        }
        const key = r.currency.toLowerCase();
        if (!(CELL_KEYS as readonly string[]).includes(key)) continue;
        (b[key as (typeof CELL_KEYS)[number]] as RateCell | null) = {
          buy: r.buy,
          sell: r.sell,
          status: "ok",
          ts: stamp,
          src: r.source,
        };
        if ((SOURCE_IDS as string[]).includes(r.source)) seenSources.add(r.source as SourceId);
      }

      // Кэш последнего успеха по каждой паре, которой нет в свежайшей
      // серии (статус stale; значение — обычное число в UI).
      const missing: { bank: string; currency: string }[] = [];
      for (const name of TARGET_BANK_NAMES) {
        if (!byBank.has(name)) byBank.set(name, emptyRow(name, "ok"));
        const b = byBank.get(name)!;
        for (const k of CELL_KEYS) {
          if (b[k] === null || (b[k] as RateCell).status !== "ok") {
            missing.push({ bank: name, currency: k.toUpperCase() });
          }
        }
      }
      if (missing.length > 0) {
        const { db } = await import("@/lib/db");
        for (const m of missing) {
          const last = await db.currencyRate.findFirst({
            where: { bank: m.bank, currency: m.currency as never },
            orderBy: { batch: "desc" },
          });
          if (last) {
            const b = byBank.get(m.bank)!;
            (b[m.currency.toLowerCase() as (typeof CELL_KEYS)[number]] as RateCell | null) = {
              buy: last.buy,
              sell: last.sell,
              status: "stale",
              ts: fmtStamp(new Date(last.batch)),
              src: last.source,
            };
            if ((SOURCE_IDS as string[]).includes(last.source ?? "")) {
              seenSources.add(last.source as SourceId);
            }
          }
        }
      }

      // Диагнозы источников: при живом прогоне — фактические, при
      // свежем кэше — восстановление из source-строк серии
      // (нет ни одной строки источника → он «empty», а не «error»).
      const sources: Record<SourceId, "ok" | "empty" | "error"> = {
        bankdep: "empty",
        mainfin: "empty",
        banktop: "empty",
      };
      for (const id of SOURCE_IDS) sources[id] = seenSources.has(id) ? "ok" : "empty";

      // Состав строк — СТРОГО 15 банков ТЗ в порядке ТЗ; банки без
      // публикаций отдают ячейки: «—» (unpublished), если источники
      // живы, или «Ошибка», если не ответил даже mainfin.
      const anyValue = rows.length > 0;
      const mainfinDown = !batchFresh && sources.mainfin === "empty" && !anyValue;
      const banks = filterTargetBankRows(Array.from(byBank.values())).map((b) => {
        for (const k of CELL_KEYS) {
          const cell = b[k] as RateCell | null;
          if (cell && cell.status === "ok" && cell.buy === null) {
            cell.status = mainfinDown ? "error" : "unpublished";
          }
          if (!cell) (b[k] as RateCell | null) = { buy: null, sell: null, status: mainfinDown ? "error" : "unpublished" };
        }
        return b;
      });

      return Response.json({
        source: batchFresh ? "multi" : "cache",
        updated: stamp,
        sources,
        banks,
      });
    }

    // Источники недоступны и исторических серий нет — честно без данных
    return Response.json({ source: "none", updated: "", banks: [] });
  } catch {
    return Response.json({ source: "none", updated: "", banks: [] });
  }
}
