import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 30;
export const revalidate = 300;

interface TransportFlight {
  time: string;
  type: string;
  route: string;
  direction: string;
  status?: string;
  alert?: boolean;
}

interface TransportSection {
  id: "aviation" | "water" | "railway";
  emoji: string;
  title: string;
  flights: TransportFlight[];
}

interface TransportResponse {
  source: "yandex" | "stub";
  note: string;
  sections: TransportSection[];
}

/** Демонстрационные данные (типовое расписание; не реальные рейсы на сегодня). */
function stubData(): TransportResponse {
  return {
    source: "stub",
    note: "Демонстрационные данные на основе типового расписания. Реальное время сверяйте у перевозчиков.",
    sections: [
      {
        id: "aviation",
        emoji: "✈️",
        title: "Авиа (Хомутово / UUS)",
        flights: [
          { time: "06:05", type: "посадка",    route: "Аэрофлот SU1748",         direction: "Москва (Шереметьево) → Южно-Сахалинск" },
          { time: "09:30", type: "вылет",      route: "Аэрофлот SU1747",         direction: "Южно-Сахалинск → Москва (Шереметьево)" },
          { time: "11:15", type: "вылет",      route: "S7 Airlines S75224",     direction: "Южно-Сахалинск → Новосибирск" },
          { time: "13:00", type: "вылет",      route: "Aurora HZ552",           direction: "Южно-Сахалинск → Южно-Курильск" },
          { time: "15:40", type: "вылет",      route: "Aurora HZ582",           direction: "Южно-Сахалинск → Оха" },
          { time: "17:25", type: "вылет",      route: "Aurora HZ460",           direction: "Южно-Сахалинск → Владивосток" },
        ],
      },
      {
        id: "water",
        emoji: "🚢",
        title: "Водный транспорт (паромы)",
        flights: [
          { time: "08:00", type: "отпр.",  route: "Паром «Сахалин-8»",        direction: "Холмск → Ванино" },
          { time: "15:30", type: "отпр.",  route: "Паром «Бригадир Ульчев»",  direction: "Ванино → Холмск" },
          { time: "22:00", type: "отпр.",  route: "Паром «Сахалин-9»",        direction: "Холмск → Ванино" },
          { time: "07:00", type: "отпр.",  route: "Катер «Нева»",             direction: "Корсаков → Курильск (о. Итуруп)", status: "погода", alert: true },
        ],
      },
      {
        id: "railway",
        emoji: "🚂",
        title: "ЖД (Сахалинская железная дорога)",
        flights: [
          { time: "06:30", type: "отпр.",  route: "Поезд №001 «Сахалин»", direction: "Южно-Сахалинск → Ноглики" },
          { time: "07:50", type: "отпр.",  route: "Электропоезд",        direction: "Южно-Сахалинск → Томари" },
          { time: "08:15", type: "отпр.",  route: "Электропоезд",        direction: "Южно-Сахалинск → Корсаков" },
          { time: "20:10", type: "приб.",  route: "Поезд №002 «Сахалин»", direction: "Ноглики → Южно-Сахалинск" },
        ],
      },
    ],
  };
}

/** Реальные данные через Яндекс.Расписания (нужен env YANDEX_RASP_KEY). */
async function yandexData(): Promise<TransportResponse> {
  const apiKey = process.env.YANDEX_RASP_KEY;
  if (!apiKey) throw new Error("YANDEX_RASP_KEY не задан");

  const fetchSchedule = async (
    station: string,
    event: "departure" | "arrival",
    typeLabel: string,
  ): Promise<TransportFlight[]> => {
    const url = `https://api.rasp.yandex.net/v3.0/schedule/?api_key=${encodeURIComponent(apiKey)}&station=${encodeURIComponent(station)}&event=${event}&transport_subtype=main&lang=ru`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`Yandex API ${r.status}`);
    const d = (await r.json()) as Array<{
      thread?: { title?: string; number?: string; transport_subtype?: { title?: string } };
      stations?: Array<{ title?: string }>;
      arrival?: string;
      departure?: string;
      days?: string;
    }>;
    const list = Array.isArray(d) ? d : [];
    return list.slice(0, 8).map((it) => {
      const transport = it.thread?.transport_subtype?.title || "Рейс";
      const num = it.thread?.number || "";
      const dirStation = it.stations?.[it.stations.length - 1]?.title || "";
      const t = (it.departure || it.arrival || "").slice(0, 5);
      return {
        time: t,
        type: typeLabel,
        route: `${transport} ${num}`.trim(),
        direction: event === "departure" ? `→ ${dirStation}` : `← ${dirStation}`,
        status: it.days,
      };
    });
  };

  const [aviation, water, railway] = await Promise.allSettled([
    fetchSchedule("YUZ",   "departure", "вылет").catch(() => []),
    fetchSchedule("KHMSK", "departure", "отпр.").catch(() => []),
    fetchSchedule("YUZH",  "departure", "отпр.").catch(() => []),
  ]);

  return {
    source: "yandex",
    note: `Данные на ${new Date().toLocaleString("ru-RU")}.`,
    sections: [
      { id: "aviation", emoji: "✈️", title: "Авиа (Хомутово / UUS)", flights: aviation.status === "fulfilled" ? aviation.value : [] },
      { id: "water",    emoji: "🚢", title: "Водный транспорт (паромы Холмск — Ванино)", flights: water.status === "fulfilled" ? water.value : [] },
      { id: "railway",  emoji: "🚂", title: "ЖД (Сахалинская железная дорога)", flights: railway.status === "fulfilled" ? railway.value : [] },
    ],
  };
}

export async function GET() {
  try {
    if (process.env.YANDEX_RASP_KEY) {
      try {
        const data = await yandexData();
        return NextResponse.json(data);
      } catch {
        // упало — откатываемся к заглушке
      }
    }
    return NextResponse.json(stubData());
  } catch (e) {
    return handleApiError(e);
  }
}
