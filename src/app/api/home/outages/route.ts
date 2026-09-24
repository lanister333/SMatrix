/**
 * СТАДИЯ 2 (Шаг 7) + Шаг №7 («Вариант А»): сводки коммунальных отключений
 * для панели главной. Читает db/outages.json (его пишут планировщик
 * src/instrumentation.ts — РАЗ В 30 МИНУТ по Шагу №7 — и/или PHP-крон
 * scripts/cron-outages.php). Отдаёт СТРОГО 3 самые свежие записи,
 * отсортированные по времени публикации (publishedAt, fallback fetchedAt)
 * по убыванию: самое свежее отключение — всегда вверху, независимо от
 * того, свет это или вода. Ручное обновление: POST /api/home/outages.
 */

import { pickTopOutages, readOutages, runOutagesParse } from "@/lib/outages-parser";

export const runtime = "nodejs";

export async function GET() {
  const data = await readOutages();
  if (!data) {
    return Response.json({ source: "none", updated: "", items: [], errors: [] });
  }
  // Шаг №7, «Вариант А»: строго 3 самые свежие записи по времени публикации
  const items = pickTopOutages(data.items, 3);
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
