/**
 * Задача 13 (фикс информера «Пробки» на главной): РЕАЛЬНЫЙ балл
 * загруженности улиц Южно-Сахалинска (Яндекс.Пробки, шкала 1-10).
 *
 * Как это работает (разведка 16.09.2026, подтверждено замерами):
 *  — официальный «шарик» города Яндекс отдаёт только для ~80 крупнейших
 *    городов: страница yandex.com/maps/…/probki/ анонимно содержит
 *    "level":null, а виджетный api/traffic/getLevelInfo для региона
 *    пробок 11450 (Южно-Сахалинск) отвечает {"data":{"level":null}} —
 *    числового балла у города в системе Яндекса НЕТ;
 *  — НО сам слой пробок для города живой: PNG-тайлы l=trf на
 *    core-jams-rdr-cache.maps.yandex.net отдаются БЕЗ подписей и ключей
 *    и кодируют актуальные скорости улиц цветом (зелёный/жёлтый/красный)
 *    — тот же слой, что рисует карта ниже информера;
 *  — адаптер fromJamsTiles() собирает сетку тайлов по городской черте
 *    Южно-Сахалинска (z=13, bbox 142.64-142.86 / 46.90-47.05; пустые
 *    тайлы отдаются 204 и пропускаются), декодирует их sharp'ом и
 *    считает долю «стоящих» пикселей дороги:
 *      балл = round(10 · (красные + 0.5·жёлтые) / все окрашенные), 1..10.
 *    Это живые данные того же API слоя пробок — балл движется вместе с
 *    реальной обстановкой (ночью 1 «Дороги свободны», в час пик выше);
 *  — XML-информер export.yandex.ru/bar/reginfo/traffic мёртв (404 на все
 *    форматы), JS API 1.1 города не покрывает (coverage.js — 125
 *    городов, Сахалина нет), партнёрский ключ YANDEX_TRAFFIC_API_KEY
 *    остаётся контрактом на будущее (приоритетный источник).
 */

import sharp from "sharp";
import { levelLabel } from "./traffic-ui";

export interface TrafficInfo {
  level: number | null; // 1..10 (null — слой недоступен)
  label: string; // «Дороги свободны» … «Город стоит»
  updated: string;
  source: string;
}

const PROBKI_TILE_HOST = "https://core-jams-rdr-cache.maps.yandex.net/1.1/tiles";

/** Городская черта Южно-Сахалинска (с северной окраиной и выездом на
 *  Корсаковскую трассу): z=13 → 3-4 колонки × 6-7 рядов тайлов. */
const CITY_BBOX = { lonMin: 142.64, lonMax: 142.86, latMin: 46.9, latMax: 47.05 };
const TILE_Z = 13;

function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

/** Окрашенный пиксель дороги → класс загруженности. Отсекаем фон
 *  (прозрачный), белую подложку улиц и серые рамки: насыщенность ≥0.35
 *  и яркость ≤0.92, далее по тону: красный <20°/ >330°, жёлтый 20-75°,
 *  зелёный 75-200° (синие/прочие оттенки слоя не несут). */
function classifyPixel(r: number, g: number, b: number, a: number): 0 | 1 | 2 | 3 {
  if (a < 40) return 0;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx === 0) return 0;
  const sat = (mx - mn) / mx;
  const light = mx / 255;
  if (sat < 0.35 || light > 0.92) return 0;
  let h: number;
  if (mx === r) h = 60 * ((g - b) / (mx - mn));
  else if (mx === g) h = 60 * (2 + (b - r) / (mx - mn));
  else h = 60 * (4 + (r - g) / (mx - mn));
  if (h < 0) h += 360;
  if (h < 20 || h > 330) return 3; // красный — стоим
  if (h < 75) return 2; // жёлтый — затруднено
  if (h <= 200) return 1; // зелёный — свободно
  return 0;
}

/** Балл из живых PNG-тайлов слоя пробок (l=trf) по городской черте. */
async function fromJamsTiles(): Promise<number | null> {
  const x0 = lonToTileX(CITY_BBOX.lonMin, TILE_Z);
  const x1 = lonToTileX(CITY_BBOX.lonMax, TILE_Z);
  const y0 = latToTileY(CITY_BBOX.latMax, TILE_Z);
  const y1 = latToTileY(CITY_BBOX.latMin, TILE_Z);
  const jobs: Promise<{ green: number; yellow: number; red: number }>[] = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      jobs.push(
        (async () => {
          const url = `${PROBKI_TILE_HOST}?trf&l=trf&lang=ru&x=${x}&y=${y}&z=${TILE_Z}&scale=1`;
          const r = await fetch(url, {
            signal: AbortSignal.timeout(6000),
            cache: "no-store",
            headers: { "User-Agent": "Mozilla/5.0 (compatible; SakhMatrix-traffic/1.0)" },
          });
          if (!r.ok) return { green: 0, yellow: 0, red: 0 }; // 204 «нет данных» и прочее
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length < 100) return { green: 0, yellow: 0, red: 0 };
          const { data } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          let green = 0;
          let yellow = 0;
          let red = 0;
          for (let i = 0; i < data.length; i += 4) {
            const c = classifyPixel(data[i], data[i + 1], data[i + 2], data[i + 3]);
            if (c === 1) green++;
            else if (c === 2) yellow++;
            else if (c === 3) red++;
          }
          return { green, yellow, red };
        })().catch(() => ({ green: 0, yellow: 0, red: 0 })),
      );
    }
  }
  const tiles = await Promise.all(jobs);
  let green = 0;
  let yellow = 0;
  let red = 0;
  for (const t of tiles) {
    green += t.green;
    yellow += t.yellow;
    red += t.red;
  }
  const total = green + yellow + red;
  // Ниже порога — слой пуст (авария Яндекса/сеть): честный null
  if (total < 60) return null;
  const idx = (red + 0.5 * yellow) / total;
  return Math.min(10, Math.max(1, Math.round(idx * 10)));
}

/** Партнёрский ключ Яндекс (необязательный). Контракт адаптера оставлен
 *  под официальный доступ: балл = data.level из ответа API. */
async function fromPartnerKey(): Promise<number | null> {
  const key = process.env.YANDEX_TRAFFIC_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(
      `https://yandex.com/maps/api/traffic?lang=ru_RU&geoid=11310&apikey=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(6000), cache: "no-store" },
    );
    if (!r.ok) return null;
    const d = (await r.json()) as { data?: { level?: number } };
    const level = d.data?.level;
    return typeof level === "number" && level >= 1 && level <= 10 ? level : null;
  } catch {
    return null;
  }
}

let cache: { at: number; info: TrafficInfo } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function getTraffic(): Promise<TrafficInfo> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.info;
  let level: number | null = null;
  let source = "";
  level = await fromPartnerKey();
  if (level !== null) source = "API Яндекс.Пробок";
  if (level === null) {
    level = await fromJamsTiles();
    if (level !== null) source = "слой пробок Яндекс.Карт (балл по trf-тайлам)";
  }
  const info: TrafficInfo = {
    level,
    label: level !== null ? levelLabel(level) : "Данные недоступны",
    updated: new Date().toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    source,
  };
  cache = { at: Date.now(), info };
  return info;
}
