/**
 * СТАДИЯ 2 (Шаг 7) + Шаг №7: сводки коммунальных отключений для панели
 * главной. Читает db/outages.json (его пишут планировщик src/instrumentation.ts
 * — РАЗ В 30 МИНУТ по Шагу №7 — и/или PHP-крон scripts/cron-outages.php).
 *
 * 2026-10-07: отдаём ВСЕ записи из кэша (раньше было строго 3) — пользователь
 * должен видеть все адреса плановых отключений, не только 3 последние.
 * Сортировка: по времени публикации по убыванию (свежие сверху).
 * Ручное обновление: POST /api/home/outages.
 */

import { pickTopOutages, readOutages, runOutagesParse } from "@/lib/outages-parser";

export const runtime = "nodejs";

export async function GET() {
  const data = await readOutages();
  if (!data) {
    return Response.json({ source: "none", updated: "", items: [], errors: [] });
  }
  // 2026-10-07: отдаём ВСЕ записи (pickTopOutages с большим лимитом).
  // Сортировка по времени публикации по убыванию сохраняется.
  const items = pickTopOutages(data.items, data.items.length);
  return Response.json({
    source: items.length > 0 ? "aggregated" : "empty",
    updated: data.updated,
    items,
    errors: data.errors,
  });
}

export async function POST() {
  // ручный/крон-запуск парсера (фоновые сборки дергают его по расписанию)
  const res = await runOutagesParse();
  return Response.json({ ok: res.ok, count: res.count });
}
