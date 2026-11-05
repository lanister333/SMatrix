"use client";

/**
 * HomeWeatherWidget — нативный компактный виджет «Прогноз по дням»
 * для правой колонки Главной (замена внешнего iframe meteoblue).
 *
 * 2026-11-05: meteoblue iframe не загружался на Android-планшете
 * (Cloudflare bot-detection / SameSite=None cookies в iframe-контексте).
 * Виджет использует собственный endpoint /api/home/weather (open-meteo +
 * резерв met.no), отдающий 7-дневный прогноз с min/max температурами,
 * кодами погоды и labels. Без внешних зависимостей, работает на всех
 * устройствах.
 *
 * 2026-11-05 v2: SVG-иконки (codeIcon из @/lib/weather-icons) вместо emoji.
 * 2026-11-05 v3: добавлены: текущая температура сверху, подпись погоды
 *   под иконкой каждого дня, крупные иконки, цветные карточки.
 *
 * Источник: /api/home/weather (TTL 20 мин, кэш + fallback на met.no).
 */

import { useEffect, useState } from "react";
import { codeIcon } from "@/lib/weather-icons";

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
      {/* Текущая температура + подпись (если есть) */}
      {typeof data.temp === "number" ? (
        <div className="mp-w-now">
          <span className="mp-w-now-t">{data.temp > 0 ? "+" : ""}{data.temp}°</span>
          {data.label ? <span className="mp-w-now-l">{data.label}</span> : null}
        </div>
      ) : null}
      <div className="mp-w-days">
        {data.days.map((d, i) => (
          <div key={`${d.day}-${d.date}-${i}`} className="mp-w-day" title={`${d.label}, днём ${d.tmax}° / ночью ${d.tmin}°`}>
            <div className="mp-w-day-daypart">
              <div className="mp-w-day-name">{d.day}</div>
              <div className="mp-w-day-date">{d.date}</div>
              <div className="mp-w-day-icon" aria-hidden="true">
                {codeIcon(d.code)}
              </div>
              <div className="mp-w-day-label">{d.label}</div>
              <div className="mp-w-day-tmax">
                <b>{d.tmax > 0 ? "+" : ""}{d.tmax}°</b>
              </div>
            </div>
            <div className="mp-w-day-nightpart">
              <span className="mp-w-night-icon" aria-hidden="true">🌙</span>
              <span className="mp-w-day-tmin">{d.tmin > 0 ? "+" : ""}{d.tmin}°</span>
            </div>
          </div>
        ))}
      </div>
      {data.updated ? (
        <div className="mp-w-updated">обновлено {data.updated}</div>
      ) : null}
    </div>
  );
}
