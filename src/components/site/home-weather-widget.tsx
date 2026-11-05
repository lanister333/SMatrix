"use client";

/**
 * HomeWeatherWidget — нативный компактный виджет «Прогноз по дням»
 * для правой колонки Главной (замена внешнему iframe meteoblue).
 *
 * 2026-11-05: meteoblue iframe не загружался на Android-планшете
 * (Cloudflare bot-detection / SameSite=None cookies в iframe-контексте).
 * Виджет использует собственный endpoint /api/home/weather (open-meteo +
 * резерв met.no), отдающий 7-дневный прогноз с min/max температурами,
 * кодами погоды и labels. Без внешних зависимостей, работает на всех
 * устройствах.
 *
 * Источник: /api/home/weather (TTL 20 мин, кэш + fallback на met.no).
 */

import { useEffect, useState } from "react";

interface WeatherDay {
  day: string;
  date: string;
  tmax: number;
  tmin: number;
  code: number;
  label: string;
}

interface WeatherData {
  source: "live" | "none" | string;
  temp?: number;
  label?: string;
  city: string;
  days: WeatherDay[];
  updated: string;
}

/** Emoji-иконка по WMO weather code (open-meteo).
 *  Группы — как в codeLabel() из lib/weather-data.ts. */
function emojiForCode(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "⛅";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "🌧️";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "🌨️";
  if (code >= 95) return "⛈️";
  return "⛅";
}

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: WeatherData }
  | { kind: "empty" }
  | { kind: "error" };

export default function HomeWeatherWidget() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const timeoutId = window.setTimeout(() => ac.abort(), 8000);

    fetch("/api/home/weather", { signal: ac.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((d: WeatherData) => {
        if (cancelled) return;
        if (d && Array.isArray(d.days) && d.days.length > 0) {
          setState({ kind: "ok", data: d });
        } else {
          setState({ kind: "empty" });
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Retry once after 2s — иногда первый запрос после деплоя идёт
        // в холодный кэш и таймаутится на медленном 3G планшета.
        window.setTimeout(() => {
          if (cancelled) return;
          fetch("/api/home/weather", { cache: "no-store" })
            .then((r) => r.json())
            .then((d: WeatherData) => {
              if (cancelled) return;
              if (d && Array.isArray(d.days) && d.days.length > 0) {
                setState({ kind: "ok", data: d });
              } else {
                setState({ kind: "empty" });
              }
            })
            .catch(() => {
              if (!cancelled) setState({ kind: "error" });
            });
        }, 2000);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      ac.abort();
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <div className="mp-w-native mp-w-loading" role="status" aria-live="polite">
        <span>Загрузка прогноза…</span>
      </div>
    );
  }

  if (state.kind === "empty" || state.kind === "error") {
    return (
      <div className="mp-w-native mp-w-error">
        <span>Прогноз временно обновляется…</span>
        {state.kind === "ok" && state.data?.updated ? null : null}
      </div>
    );
  }

  const { data } = state;
  return (
    <div
      className="mp-w-native"
      role="region"
      aria-label="Прогноз погоды по дням, Южно-Сахалинск"
    >
      <div className="mp-w-days">
        {data.days.map((d, i) => (
          <div key={`${d.day}-${d.date}-${i}`} className="mp-w-day" title={`${d.label}, ${d.tmax}° / ${d.tmin}°`}>
            <div className="mp-w-day-name">{d.day}</div>
            <div className="mp-w-day-date">{d.date}</div>
            <div className="mp-w-day-icon" aria-hidden="true">
              {emojiForCode(d.code)}
            </div>
            <div className="mp-w-day-tmax">
              <b>{d.tmax}°</b>
            </div>
            <div className="mp-w-day-tmin">{d.tmin}°</div>
          </div>
        ))}
      </div>
      {data.updated ? (
        <div className="mp-w-updated">обновлено {data.updated}</div>
      ) : null}
    </div>
  );
}
