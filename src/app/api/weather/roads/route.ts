/**
 * Шаг 10: «Оперативная обстановка на перевалах» для /weather.php.
 *
 * ТЗ: лог из 3 последних текстовых сообщений из базы данных, которые
 * публикуются пользователями с тегом или в категории «Дороги».
 * Сообщения — форумные (модель Message): пользователи публикуют их
 * сами; тег «Дороги» выводится внутренней логикой isRoadReport
 * (src/lib/roads-taxonomy.ts — тот же подход, что районы отключений
 * в Шаге №7.5): текст про дороги/перевалы/пробки/гололёд и т.п.
 *
 * Окно выборки — 300 последних видимых сообщений (isDeleted=false,
 * isHiddenByAi=false), из них фильтр тега берёт ровно 3 самых свежих.
 * Кеш в памяти 60 секунд; при недоступности БД — честная деградация
 * source:"none" без выдуманных записей.
 */

import { db } from "@/lib/db";
import { isRoadReport, type RoadReportItem, type RoadsData } from "@/lib/roads-taxonomy";

export const runtime = "nodejs";

const TTL_MS = 60 * 1000;
const WINDOW = 1000; // всё сообщение-хранилище на текущем объёме (832): дорожные отчёты живут глубже последних сотен записей
const LIMIT = 3;

function fmtStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

let cache: { at: number; data: RoadsData } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return Response.json(cache.data);
  }
  try {
    const msgs = await db.message.findMany({
      where: { isDeleted: false, isHiddenByAi: false },
      orderBy: { createdAt: "desc" },
      take: WINDOW,
      select: {
        id: true,
        body: true,
        authorName: true,
        createdAt: true,
        topic: { select: { number: true } },
      },
    });
    const items: RoadReportItem[] = msgs
      .filter((m) => isRoadReport(m.body))
      .slice(0, LIMIT)
      .map((m) => ({
        id: m.id,
        author: m.authorName,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        topic: m.topic?.number ?? 0,
      }));
    const data: RoadsData = { source: "db", items, updated: fmtStamp(new Date()) };
    cache = { at: Date.now(), data };
    return Response.json(data);
  } catch {
    // Честная деградация: без выдуманных отчётов.
    return Response.json({ source: "none", items: [], updated: "" } satisfies RoadsData);
  }
}
