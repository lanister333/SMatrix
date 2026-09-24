/**
 * ЗАДАЧА «Замена источника курсов» (2026-09-23): ручной/крон-запуск
 * многоисточникового агрегатора курсов (bankdep → mainfin → banktop →
 * кэш CurrencyRate). Тот же код, что у планировщика
 * src/instrumentation-node.ts (раз в 30 минут) и догрева /api/home/rates.
 * РЕСТАВРАЦИЯ 2026-09-23: прежний kovalut-парсер удалён.
 */

import { runCurrencyAggregate } from "@/lib/currency-sources";

export const runtime = "nodejs";

export async function POST() {
  const res = await runCurrencyAggregate();
  return Response.json(res, { status: res.ok ? 200 : 502 });
}
