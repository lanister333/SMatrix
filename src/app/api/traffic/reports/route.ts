/**
 * Шаг 12: «Оперативные дорожные события» + «Состояние загородных трасс»
 * для /traffic.php.
 *
 * ТЗ: лента из 10 последних сообщений из базы данных с тегом/категорией
 * «Дороги» + таблица состояния трёх маршрутов (Открыта / Закрыта /
 * Тяжело) из базы данных. Сообщения — форумные (модель Message), тег
 * «Дороги» выводится внутренней логикой isRoadReport
 * (src/lib/roads-taxonomy.ts — та же таксономия, что Шаги №7.5/№10);
 * статусы трасс выводятся из тех же отчётов (src/lib/roads-status.ts):
 * свежайший отчёт по маршруту задаёт его статус, отчётов нет — статус
 * пустой («н/д» на странице).
 *
 * Окно выборки — всё видимое хранилище сообщений (isDeleted=false,
 * isHiddenByAi=false), из него фильтр тега берёт 10 самых свежих.
 * Кеш в памяти 60 секунд; при недоступности БД — честная деградация
 * source:"none" без выдуманных записей.
 */

import { db } from "@/lib/db";
import { isRoadReport, type RoadReportItem } from "@/lib/roads-taxonomy";
import { deriveRouteStatuses, type RouteStatusItem, type TrafficReportsData } from "@/lib/roads-status";

export const runtime = "nodejs";

const TTL_MS = 60 * 1000;
const WINDOW = 1000; // всё сообщение-хранилище (832): дорожные отчёты живут глубже последних сотен записей
const LIMIT = 10; // по ТЗ: лента из 10 последних сообщений тега «Дороги»

function fmtStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

let cache: { at: number; data: TrafficReportsData } | null = null;

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
    const roadMsgs = msgs.filter((m) => isRoadReport(m.body));
    const items: RoadReportItem[] = roadMsgs.slice(0, LIMIT).map((m) => ({
      id: m.id,
      author: m.authorName,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      topic: m.topic?.number ?? 0,
    }));
    const routes: RouteStatusItem[] = deriveRouteStatuses(roadMsgs);
    const data: TrafficReportsData = { source: "db", items, routes, updated: fmtStamp(new Date()) };
    cache = { at: Date.now(), data };
    return Response.json(data);
  } catch {
    // Честная деградация: без выдуманных отчётов и статусов.
    return Response.json({ source: "none", items: [], routes: [], updated: "" } satisfies TrafficReportsData);
  }
}
