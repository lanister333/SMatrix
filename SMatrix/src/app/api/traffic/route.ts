/**
 * СТАДИЯ 2 (Шаг 8): балл загруженности улиц Южно-Сахалинска
 * (Яндекс.Пробки, 0-10) для панели «Пробки». Кеш 5 минут; если Яндекс
 * недоступен из этой сети — level:null, панель показывает нейтральный
 * круг и официальный слой пробок (iframe-виджет Яндекс Карт).
 */

import { getTraffic } from "@/lib/traffic";

export const runtime = "nodejs";

export async function GET() {
  const info = await getTraffic();
  return Response.json(info);
}
