/**
 * Шаг №7.5: ПОЛНЫЙ массив сводок коммунальных отключений для страницы
 * /disconnections.php. Читает db/outages.json — его пишут планировщик
 * (src/instrumentation.ts, раз в 30 минут по Шагу №7) и/или PHP-крон
 * scripts/cron-outages.php. В отличие от /api/home/outages (строго топ-3
 * «Варианта А» главной) здесь отдаётся ВЕСЬ массив — «выведи весь массив
 * данных, собранных парсерами», — свежие записи вверху: та же сортировка
 * по времени публикации (publishedAt, fallback fetchedAt).
 */

import { pickTopOutages, readOutages } from "@/lib/outages-parser";

export const runtime = "nodejs";

export async function GET() {
  const data = await readOutages();
  if (!data) {
    return Response.json({ source: "none", updated: "", items: [], errors: [] });
  }
  // весь массив без ограничения, по убыванию publishedAt (переиспользуем
  // проверенную сортировку pickTopOutages с n = длине массива)
  const items = pickTopOutages(data.items, Math.max(data.items.length, 1));
  return Response.json({
    source: items.length > 0 ? "aggregated" : "empty",
    updated: data.updated,
    items,
    errors: data.errors,
  });
}
