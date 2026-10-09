/**
 * Node-часть фоновых парсеров СТАДИИ 2 (Шаги 6-7): курсы банков ЮС и
 * коммунальные отключения. Импортируется ТОЛЬКО из src/instrumentation.ts
 * при NEXT_RUNTIME === "nodejs" (в Edge-рантайм node-модули запрещены).
 *
 * 2026-10-08: отключения — РАЗ В ДНЯ (каждые 24 часа, достаточно для
 * плановых работ Сахалинэнерго — они публикуются заранее).
 * Курсы — раз в 30 минут (темп bankdep, ТЗ 2026-09-23).
 */

import dns from "dns";

const EVERY_8H_MS = 8 * 60 * 60 * 1000; // курсы — 3 раза в сутки
const EVERY_24H_MS = 24 * 60 * 60 * 1000; // отключения — раз в сутки

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
    const { runCurrencyAggregate } = await import("@/lib/currency-sources");
    await tick("currency", runCurrencyAggregate);
  };
  const runOutages = async () => {
    const { runOutagesParse } = await import("@/lib/outages-parser");
    await tick("outages", runOutagesParse);
  };

  // первый сбор — через 20 секунд после старта; далее курсы — раз в 30
  // минут, отключения — раз в 24 часа (достаточно для плановых работ)
  const t = setTimeout(() => {
    void runCurrency();
    void runOutages();
    setInterval(() => void runCurrency(), EVERY_8H_MS);
    setInterval(() => void runOutages(), EVERY_24H_MS);
  }, 20_000);
  t.unref?.();
}
