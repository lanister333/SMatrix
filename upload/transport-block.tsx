"use client";

/**
 * ТЗ 2026-09-26 (правка 3) «Блок „Расписание транспорта“ — компактный с вкладками».
 *
 * Структура:
 *   ┌──────────────────────────────────────────────────┐
 *   │ 🚍 Расписание транспорта [⚠ демо-данные]         │ ← синяя шапка
 *   ├──────────────────────────────────────────────────┤
 *   │ [✈️ Авиа] [🚢 Вода] [🚂 ЖД]                      │ ← вкладки
 *   ├──────────────────────────────────────────────────┤
 *   │ Время | Тип | Рейс        | Маршрут  | Статус   │ ← строка-заголовок
 *   │ 09:30 | вылет | Aeroflot.. | Ю-Сах.. | По рас.. │
 *   │ 11:15 | вылет | S7 Airli.. | Ю-Сах.. | По рас.. │
 *   │ ... (макс. 5 строк, далее «Показать ещё N»)      │
 *   ├──────────────────────────────────────────────────┤
 *   │                          Источник: Яндекс.API   │
 *   └──────────────────────────────────────────────────┘
 *
 * КОМПАКТНОСТЬ — главное требование:
 *   - padding ячеек 2-3px, не больше;
 *   - line-height 1.2;
 *   - font-size: 12px body, 11px headers;
 *   - 5 строк в видимой части, далее кнопка «Показать ещё».
 *
 * Сокращения для длинных текстов:
 *   «Южно-Сахалинск» → «Ю-Сахалинск»
 *   «Москва (Шереметьево)» → «МСК (ШРМ)»
 *   «Южно-Курильск» → «Ю-Курильск»
 *   «Новосибирск» → «НСК»
 *   «Ванино» / «Холмск» — без сокращений
 */

import { useEffect, useMemo, useState } from "react";

export interface TransportFlight {
  time: string;
  type: string;
  route: string;
  direction: string;
  status?: string;
  alert?: boolean;
}

export interface TransportSection {
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

const INITIAL_ROWS = 5; // сколько строк показывать сразу

const TABS: Array<{ id: TransportSection["id"]; emoji: string; label: string }> = [
  { id: "aviation", emoji: "✈️", label: "Авиа" },
  { id: "water",    emoji: "🚢", label: "Вода" },
  { id: "railway",  emoji: "🚂", label: "ЖД" },
];

/** Сокращает длинные имена для компактной таблицы. */
function abbreviate(s: string): string {
  if (!s) return "";
  const replacements: Array<[string, string]> = [
    ["Южно-Сахалинск", "Ю-Сахалинск"],
    ["Южно-Курильск",  "Ю-Курильск"],
    ["Москва (Шереметьево)", "МСК (ШРМ)"],
    ["Москва", "МСК"],
    ["Новосибирск", "НСК"],
    ["Владивосток", "ВЛД"],
    ["Хабаровск", "ХБК"],
    ["Якутск", "ЯКТ"],
    ["(Шереметьево)", "(ШРМ)"],
    ["(Домодедово)", "(ДМД)"],
    ["(Внуково)", "(ВНК)"],
    ["отправление", "отпр."],
    ["прибытие", "приб."],
    ["посадка", "посад."],
    ["вылет", "вылет"],
    ["По расписанию", "по распл."],
    ["Зависит от погоды", "погода"],
  ];
  let r = s;
  for (const [from, to] of replacements) r = r.split(from).join(to);
  return r;
}

export default function TransportScheduleBlock() {
  const [data, setData] = useState<TransportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TransportSection["id"]>("aviation");
  const [expanded, setExpanded] = useState<Record<TransportSection["id"], boolean>>({
    aviation: false,
    water: false,
    railway: false,
  });

  useEffect(() => {
    let alive = false;
    fetch("/api/transport")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<TransportResponse>;
      })
      .then((d) => {
        if (!alive) setData(d);
      })
      .catch((e) => {
        if (!alive) setError(e.message || "Не удалось загрузить расписание");
      });
    return () => {
      alive = true;
    };
  }, []);

  const section = useMemo<TransportSection | null>(() => {
    if (!data) return null;
    return data.sections.find((s) => s.id === activeTab) || data.sections[0] || null;
  }, [data, activeTab]);

  const visibleFlights = useMemo<TransportFlight[]>(() => {
    if (!section) return [];
    const limit = expanded[section.id] ? 999 : INITIAL_ROWS;
    return section.flights.slice(0, limit);
  }, [section, expanded]);

  const hiddenCount = section ? Math.max(0, section.flights.length - INITIAL_ROWS) : 0;

  return (
    <section className="transport-block" aria-label="Расписание транспорта">
      {/* Синяя шапка */}
      <div className="transport-block-head">
        <span className="transport-block-head-title">🚍 Расписание транспорта</span>
        {data?.source === "stub" && (
          <span className="transport-block-head-badge" title="Реального бесплатного API для Сахалина нет — показываем демонстрационные данные. Подключение Яндекс.Расписаний возможно после получения API-ключа.">
            ⚠ демо
          </span>
        )}
        {data?.source === "yandex" && (
          <span className="transport-block-head-badge transport-block-head-badge-real" title={`Источник: Яндекс.Расписания. ${data.note}`}>
            ✓ реально
          </span>
        )}
      </div>

      {/* Тело */}
      <div className="transport-block-body">
        {error ? (
          <div className="transport-empty">Не удалось загрузить: {error}</div>
        ) : !data ? (
          <div className="transport-empty">Загрузка…</div>
        ) : (
          <>
            {/* Вкладки */}
            <div className="transport-tabs" role="tablist">
              {TABS.map((t) => {
                const sec = data.sections.find((s) => s.id === t.id);
                const count = sec?.flights.length ?? 0;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={isActive}
                    className={isActive ? "transport-tab transport-tab-active" : "transport-tab"}
                    onClick={() => setActiveTab(t.id)}
                    title={`${t.label}: ${count} рейсов`}
                  >
                    <span className="transport-tab-emoji">{t.emoji}</span>
                    <span className="transport-tab-label">{t.label}</span>
                    <span className="transport-tab-count">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Таблица активной вкладки */}
            {section && (
              <div className="transport-table-wrap">
                {/* Заголовок таблицы */}
                <div className="transport-row transport-row-head" role="row">
                  <span className="transport-cell transport-cell-time">Время</span>
                  <span className="transport-cell transport-cell-type">Тип</span>
                  <span className="transport-cell transport-cell-route">Рейс</span>
                  <span className="transport-cell transport-cell-direction">Маршрут</span>
                  <span className="transport-cell transport-cell-status">Статус</span>
                </div>

                {visibleFlights.length === 0 ? (
                  <div className="transport-empty transport-empty-row">Рейсов нет</div>
                ) : (
                  <ul className="transport-flights">
                    {visibleFlights.map((f, i) => (
                      <li
                        key={i}
                        className={
                          f.alert
                            ? "transport-flight transport-flight-alert"
                            : "transport-flight"
                        }
                      >
                        <span className="transport-cell transport-cell-time">{f.time}</span>
                        <span className="transport-cell transport-cell-type">{abbreviate(f.type)}</span>
                        <span className="transport-cell transport-cell-route" title={f.route}>{abbreviate(f.route)}</span>
                        <span className="transport-cell transport-cell-direction" title={f.direction}>{abbreviate(f.direction)}</span>
                        <span className="transport-cell transport-cell-status" title={f.status}>{f.status ? abbreviate(f.status) : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Кнопка «Показать ещё» */}
                {hiddenCount > 0 && !expanded[section.id] && (
                  <button
                    className="transport-show-more"
                    onClick={() => setExpanded((p) => ({ ...p, [section.id]: true }))}
                  >
                    Показать ещё {hiddenCount} {hiddenCount === 1 ? "рейс" : hiddenCount >= 5 ? "рейсов" : "рейса"}
                  </button>
                )}
                {expanded[section.id] && section.flights.length > INITIAL_ROWS && (
                  <button
                    className="transport-show-more"
                    onClick={() => setExpanded((p) => ({ ...p, [section.id]: false }))}
                  >
                    Свернуть ↑
                  </button>
                )}
              </div>
            )}

            {/* Подвал */}
            <div className="transport-footer">
              {data.source === "stub" && (
                <span className="transport-footer-note">
                  ⚠ Демонстрационные данные. Подключение реального расписания — через Яндекс.Расписания API (нужна заявка на ключ).
                </span>
              )}
              {data.source === "yandex" && (
                <span className="transport-footer-note transport-footer-note-real">
                  ✓ Источник: Яндекс.Расписания. {data.note}
                </span>
              )}
              <a className="transport-footer-link" href="https://yandex.ru/dev/rasp/raspapi/" target="_blank" rel="noopener noreferrer">
                Яндекс.Расписания API →
              </a>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
