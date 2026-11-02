/**
 * СТАДИЯ 2 (Шаг 7) + Шаг №7: сводки коммунальных отключений для панели
 * главной. Читает db/outages.json (его пишут планировщик src/instrumentation.ts
 * — РАЗ В 30 МИНУТ по Шагу №7 — и/или PHP-крон scripts/cron-outages.php).
 */

import { pickTopOutages, readOutages, runOutagesParse } from "@/lib/outages-parser";
import { NextRequest, NextResponse } from "next/server";
import { userByToken } from "@/lib/auth";
import { isStaffRole } from "@/lib/admin";

export const runtime = "nodejs";

export async function GET() {
  const data = await readOutages();
  if (!data) {
    return Response.json({ source: "none", updated: "", items: [], errors: [] });
  }
  const items = pickTopOutages(data.items, data.items.length);
  return Response.json({
    source: items.length > 0 ? "aggregated" : "empty",
    updated: data.updated,
    items,
    errors: data.errors,
  });
}

export async function POST(req: NextRequest) {
  // 2026-11-01: только админ может запускать парсинг
  const token = req.nextUrl.searchParams.get("token") || "";
  const user = await userByToken(token);
  if (!user || !isStaffRole(user.role)) {
    return NextResponse.json({ error: "Доступно только администратору" }, { status: 403 });
  }
  const res = await runOutagesParse();
  return Response.json({ ok: res.ok, count: res.count });
}
