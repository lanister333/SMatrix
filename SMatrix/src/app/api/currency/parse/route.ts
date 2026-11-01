/**
 * ЗАДАЧА «Замена источника курсов» (2026-09-23): ручной/крон-запуск
 * многоисточникового агрегатора курсов (bankdep → mainfin → banktop →
 * кэш CurrencyRate). Тот же код, что у планировщика
 * src/instrumentation-node.ts (раз в 30 минут) и догрева /api/home/rates.
 * РЕСТАВРАЦИЯ 2026-09-23: прежний kovalut-парсер удалён.
 */

import { runCurrencyAggregate } from "@/lib/currency-sources";
import { NextRequest, NextResponse } from "next/server";
import { userByToken } from "@/lib/auth";
import { isStaffRole } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // 2026-11-01: только админ может запускать парсинг
  const token = req.nextUrl.searchParams.get("token") || "";
  const user = await userByToken(token);
  if (!user || !isStaffRole(user.role)) {
    return NextResponse.json({ error: "Доступно только администратору" }, { status: 403 });
  }
  const res = await runCurrencyAggregate();
  return Response.json(res, { status: res.ok ? 200 : 502 });
}
