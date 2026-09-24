/**
 * Node-часть фоновых парсеров СТАДИИ 2 (Шаги 6-7): курсы банков ЮС и
 * коммунальные отключения. Импортируется ТОЛЬКО из src/instrumentation.ts
 * при NEXT_RUNTIME === "nodejs" (в Edge-рантайм node-модули запрещены).
 *
 * Шаг №7: расписания разведены — отключения РАЗ В 30 МИНУТ (Шаг №7,
 * PHP/Cron-семантика ТЗ); курсы — РАЗ В 30 МИНУТ (ТЗ 2026-09-23
 * «Замена источника»: темп обновления основного источника bankdep.ru;
 * прежде kovalut собирался ежечасно).
 *
 * РЕСТАВРАЦИЯ 2026-09-23: runCurrencyParse (kovalut) → runCurrencyAggregate
 * (bankdep/mainfin/banktop, src/lib/currency-sources.ts).
 */

import dns from "dns";

const EVERY_30MIN_MS = 30 * 60 * 1000; // отключения — раз в 30 минут (Шаг №7); курсы — раз в 30 минут (темп bankdep, ТЗ 2026-09-23)

// ФИКС 2026-09-21: в песочнице нет IPv6-маршрута (curl -6 мгновенный refusal),
// а DNS CDN-источников иногда отдаёт AAAA первым — тогда серверный fetch
// (open-meteo/marine, met.no…) уходил в ETIMEDOUT вместо соединения.
// Глобально предпочитаем IPv4 — чинит приливы, погоду, курсы и отключения.
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}

const g = globalThis as unknown as { __sakhInformersStarted?: boolean };

export async function startInformers() {
  if (g.__sakhInformersStarted) return;
  g.__sakhInformersStarted = true;

  const tick = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      console.warn(
        `[informers] ${name} failed:`,
        e instanceof Error ? e.message : e,
      );
    }
  };

  const runCurrency = async () => {
    // ТЗ 2026-09-23: многоисточниковый агрегатор вместо kovalut-парсера
    const { runCurrencyAggregate } = await import("@/lib/currency-sources");
    await tick("currency", runCurrencyAggregate);
  };
  const runOutages = async () => {
    const { runOutagesParse } = await import("@/lib/outages-parser");
    await tick("outages", runOutagesParse);
  };

  // первый сбор — через 20 секунд после старта; далее курсы — раз в 30
  // минут (темп bankdep, ТЗ 2026-09-23), отключения — каждые 30 минут (Шаг №7)
  const t = setTimeout(() => {
    void runCurrency();
    void runOutages();
    setInterval(() => void runCurrency(), EVERY_30MIN_MS);
    setInterval(() => void runOutages(), EVERY_30MIN_MS);
  }, 20_000);
  t.unref?.();
}
