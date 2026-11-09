"use client";

import { useEffect, useState } from "react";

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

const TABS = [
  { id: "aviation" as const, emoji: "✈️", label: "Авиа" },
  { id: "water" as const, emoji: "🚢", label: "Вода" },
  { id: "railway" as const, emoji: "🚂", label: "ЖД" },
];

function statusInfo(status?: string) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes("по распис") || s.includes("по план")) return { icon: "✅", label: "по распл." };
  if (s.includes("задерж") || s.includes("опазд")) return { icon: "⏱", label: "задержка" };
  if (s.includes("погод") || s.includes("зависит")) return { icon: "🌧", label: "погода" };
  if (s.includes("отмен") || s.includes("не лет")) return { icon: "⛔", label: "отмена" };
  if (s.includes("посад") || s.includes("регистр")) return { icon: "🚪", label: "посадка" };
  if (s.includes("приб") || s.includes("прилет")) return { icon: "🛬", label: "прилёт" };
  if (s.includes("отпр") || s.includes("вылет")) return { icon: "🛫", label: "вылет" };
  return null;
}

function abbreviate(s: string): string {
  if (!s) return "";
  const replacements: Array<[string, string]> = [
    ["Южно-Сахалинск", "Ю-Сахалинск"],
    ["Москва (Шереметьево)", "МСК (ШРМ)"],
    ["Москва", "МСК"],
    ["Новосибирск", "НСК"],
    ["Владивосток", "ВЛД"],
    ["Хабаровск", "ХБК"],
    ["Якутск", "ЯКТ"],
    ["Южно-Курильск", "Ю-Курильск"],
    ["По расписанию", "по распл."],
    ["Зависит от погоды", "погода"],
  ];
  let r = s;
  for (const [from, to] of replacements) r = r.split(from).join(to);
  return r;
}

export default function TransportScheduleBlock() {
  const [data, setData] = useState<TransportResponse | null>(null);
  const [activeTab, setActiveTab] = useState<TransportSection["id"]>("aviation");
  const [expanded, setExpanded] = useState(false);
  const [expandedDepart, setExpandedDepart] = useState(false);
  const [expandedArrive, setExpandedArrive] = useState(false);

  useEffect(() => {
    fetch("/api/transport")
      .then(async (r) => (r.ok ? r.json() : { sections: [] }))
      .then(setData)
      .catch(() => {});
  }, []);

  const section = data?.sections.find((s) => s.id === activeTab);
  const allFlights = section?.flights ?? [];

  // 2026-11-10: для авиа — разделяем на вылеты/прилёты, показываем
  // в двух отдельных окнах с цветными заголовками (бирюзовый/оранжевый).
  // Для воды/ЖД — оставляем единый список (там только «отпр.»).
  const isAviation = activeTab === "aviation";
  const departures = isAviation
    ? allFlights.filter((f) => /вылет|отпр/i.test(f.type))
    : allFlights;
  const arrivals = isAviation
    ? allFlights.filter((f) => /прилёт|приб/i.test(f.type))
    : [];
  const useSplitView = isAviation && (departures.length > 0 || arrivals.length > 0);

  const flights = expanded ? allFlights : allFlights.slice(0, 5);
  const hiddenCount = Math.max(0, allFlights.length - 5);

  const cardStyle: React.CSSProperties = {
    backgroundColor: "#FFFFFF",
    border: "1px solid #4A688C",
    borderRadius: 0,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)",
    marginTop: "8px",
    marginBottom: "10px",
    overflow: "hidden",
    boxSizing: "border-box",
    width: "100%",
    fontFamily: "system-ui, -apple-system, sans-serif",
  };

  const headStyle: React.CSSProperties = {
    backgroundColor: "#1E3A5F",
    color: "#FFFFFF",
    padding: "3px 9px",
    fontWeight: 700,
    fontSize: "13px",
    textAlign: "center",
    borderBottom: "1px solid #16293F",
  };

  const bodyStyle: React.CSSProperties = {
    // 2026-11-08: padding-bottom 0 → 6px — раньше рамка таблицы (tableStyle
    // border 1px #1E3A5F) касалась нижней рамки карточки (cardStyle border
    // 1px #4A688C). Теперь между ними зазор 6px, как сверху/слева/справа.
    padding: "6px 9px 6px",
    backgroundColor: "#FFFFFF",
  };

  const tableStyle: React.CSSProperties = {
    border: "1px solid #1E3A5F",
    borderRadius: "4px",
    overflow: "hidden",
  };

  const tabsWrapStyle: React.CSSProperties = {
    display: "flex",
    gap: "4px",
    marginBottom: "6px",
    padding: "3px",
    background: "#e8eef5",
    borderRadius: "4px",
  };

  return (
    <section style={cardStyle} aria-label="Расписание транспорта">
      <div style={headStyle}>🚍 Расписание транспорта</div>

      <div style={bodyStyle}>
        <div style={tabsWrapStyle}>
          {TABS.map((t) => {
            const sec = data?.sections.find((s) => s.id === t.id);
            const count = sec?.flights.length ?? 0;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setExpanded(false); setExpandedDepart(false); setExpandedArrive(false); }}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  padding: "4px 6px",
                  background: active ? "#1E3A5F" : "#FFFFFF",
                  color: active ? "#fff" : "#475569",
                  border: "1px solid #1E3A5F",
                  borderRadius: "3px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 700,
                  fontFamily: "inherit",
                  lineHeight: 1.3,
                  boxShadow: active ? "0 1px 3px rgba(30,58,95,0.3)" : "none",
                }}
              >
                <span style={{ fontSize: "13px" }}>{t.emoji}</span>
                <span style={{ fontSize: "12px" }}>{t.label}</span>
                <span
                  style={{
                    display: "inline-block",
                    minWidth: "14px",
                    padding: "0 3px",
                    background: active ? "rgba(255,255,255,0.25)" : "rgba(30,58,95,0.15)",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 700,
                    lineHeight: 1.3,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {useSplitView ? (
          /* 2026-11-10: раздельные окна для вылетов и прилётов */
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* Окно ВЫЛЕТЫ — бирюзовый заголовок */}
            <SubFlightsCard
              title="✈ ВЫЛЕТЫ"
              count={departures.length}
              headerColor="#0a7d75"
              flights={departures}
              expanded={expandedDepart}
              onToggle={() => setExpandedDepart((v) => !v)}
            />
            {/* Окно ПРИЛЁТЫ — оранжевый заголовок */}
            <SubFlightsCard
              title="🛬 ПРИЛЁТЫ"
              count={arrivals.length}
              headerColor="#b45309"
              flights={arrivals}
              expanded={expandedArrive}
              onToggle={() => setExpandedArrive((v) => !v)}
            />
          </div>
        ) : (
        <div style={tableStyle}>
        <div
          className="ts-row ts-row-head"
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "#334155",
            textTransform: "uppercase" as const,
            letterSpacing: "0.5px",
            borderBottom: "2px solid #c0cad8",
            backgroundColor: "#e8eef5",
          }}
        >
          <span className="ts-col-time">Время</span>
          <span className="ts-col-type">Тип</span>
          <span className="ts-col-route">Рейс</span>
          <span className="ts-col-direction">Маршрут</span>
          <span className="ts-col-status">Статус</span>
        </div>

        {flights.length === 0 ? (
          <div style={{ padding: "10px", textAlign: "center", color: "#56657a", fontSize: "12px" }}>
            Рейсов нет
          </div>
        ) : (
          <div>
            {flights.map((f, i) => {
              const si = statusInfo(f.status);
              return (
                <div
                  key={i}
                  className="ts-row"
                  style={{
                    alignItems: "center",
                    fontSize: "12px",
                    color: "#2A3B50",
                    borderBottom: i < flights.length - 1 ? "1px solid #eef2f6" : "none",
                    minHeight: "26px",
                    background: i % 2 === 0 ? "transparent" : "#f7f9fb",
                  }}
                >
                  <span className="ts-col-time" style={{ fontWeight: 700, color: "#0a5caa", fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>
                    {f.time}
                  </span>
                  <span className="ts-col-type" style={{ color: "#334155", fontSize: "12px", whiteSpace: "normal", wordBreak: "break-word" }}>
                    {abbreviate(f.type)}
                  </span>
                  <span className="ts-col-route" style={{ fontWeight: 600, fontSize: "12px", color: "#1E3A5F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.route}>
                    {abbreviate(f.route)}
                  </span>
                  <span className="ts-col-direction" style={{ color: "#2A3B50", fontSize: "12.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.direction}>
                    {abbreviate(f.direction)}
                  </span>
                  <span className="ts-col-status" style={{ fontSize: "11px", color: "#334155" }}>
                    {si && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
                        <span>{si.icon}</span>
                        <span>{si.label}</span>
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        </div>
        )}

        {!useSplitView && (
          <>
        {hiddenCount > 0 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            style={{
              display: "block",
              width: "100%",
              margin: "2px 0 0",
              padding: "2px",
              background: "transparent",
              border: "none",
              borderTop: "1px dashed #d0d9e6",
              cursor: "pointer",
              fontSize: "11px",
              color: "#0a5caa",
              fontFamily: "inherit",
              fontWeight: 700,
            }}
          >
            ▼ Показать ещё {hiddenCount}
          </button>
        )}
        {expanded && (
          <button
            onClick={() => setExpanded(false)}
            style={{
              display: "block",
              width: "100%",
              margin: "2px 0 0",
              padding: "2px",
              background: "transparent",
              border: "none",
              borderTop: "1px dashed #d0d9e6",
              cursor: "pointer",
              fontSize: "11px",
              color: "#56657a",
              fontFamily: "inherit",
              fontWeight: 700,
            }}
          >
            ▲ Свернуть
          </button>
        )}
          </>
        )}
      </div>
    </section>
  );
}

/* 2026-11-10: Подкарточка для раздельного показа вылетов/прилётов.
   Заголовок цветной (бирюзовый для вылетов, оранжевый для прилётов),
   внутри — таблица с теми же ts-row/ts-col-* классами. */
function SubFlightsCard({
  title,
  count,
  headerColor,
  flights,
  expanded,
  onToggle,
}: {
  title: string;
  count: number;
  headerColor: string;
  flights: TransportFlight[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const PREVIEW = 5;
  const list = expanded ? flights : flights.slice(0, PREVIEW);
  const hidden = Math.max(0, flights.length - PREVIEW);

  return (
    <div style={{
      backgroundColor: "#FFFFFF",
      border: "1px solid #4A688C",
      borderRadius: 0,
      boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)",
      overflow: "hidden",
      boxSizing: "border-box",
      width: "100%",
      fontFamily: "inherit",
    }}>
      {/* Шапка — точно как у внешнего блока «🚍 Расписание транспорта»:
          тёмно-синяя, белый текст, по центру. */}
      <div style={{
        backgroundColor: "#1E3A5F",
        color: "#FFFFFF",
        padding: "3px 9px",
        fontWeight: 700,
        fontSize: "13px",
        textAlign: "center",
        borderBottom: "1px solid #16293F",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
      }}>
        <span>{title}</span>
        <span style={{
          display: "inline-block",
          minWidth: "14px",
          padding: "0 3px",
          background: "rgba(255,255,255,0.25)",
          borderRadius: "8px",
          fontSize: "11px",
          fontWeight: 700,
          lineHeight: 1.3,
        }}>
          {count}
        </span>
      </div>

      {/* Тонкая цветная полоска-индикатор (бирюзовая/оранжевая) —
          единственный визуальный отличитель вылетов от прилётов. */}
      <div style={{ height: "3px", backgroundColor: headerColor }} />

      {/* Картотека — каждый рейс как отдельная карточка */}
      {list.length === 0 ? (
        <div style={{ padding: "16px", textAlign: "center", color: "#56657a", fontSize: "12px" }}>
          Нет данных
        </div>
      ) : (
        <div style={{
          padding: "6px 9px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          backgroundColor: "#FFFFFF",
        }}>
          {list.map((f, i) => {
            const si = statusInfo(f.status);
            const isAlert = f.alert;
            return (
              <div
                key={i}
                style={{
                  backgroundColor: "#fff",
                  border: `1px solid ${headerColor}33`,
                  borderLeft: `4px solid ${headerColor}`,
                  borderRadius: "3px",
                  padding: "8px 10px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                }}
              >
                {/* Верх卡片: время + номер рейса + статус */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "6px",
                }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px", minWidth: 0, flex: 1 }}>
                    <span style={{
                      fontWeight: 700,
                      color: isAlert ? "#c40000" : "#0a5caa",
                      fontSize: "15px",
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}>
                      {f.time}
                    </span>
                    <span style={{
                      fontWeight: 700,
                      fontSize: "13px",
                      color: "#1E3A5F",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                    }} title={f.route}>
                      {abbreviate(f.route)}
                    </span>
                  </div>
                  {si && (
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "2px",
                      fontSize: "10px",
                      color: isAlert ? "#c40000" : "#64748b",
                      fontWeight: 600,
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}>
                      <span>{si.icon}</span>
                      <span>{si.label}</span>
                    </span>
                  )}
                </div>
                {/* Низ карточки: тип + полный маршрут */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  flexWrap: "wrap",
                }}>
                  <span style={{
                    display: "inline-block",
                    backgroundColor: headerColor,
                    color: "#fff",
                    fontSize: "9px",
                    fontWeight: 700,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.5px",
                    padding: "1px 6px",
                    borderRadius: "2px",
                    flexShrink: 0,
                  }}>
                    {abbreviate(f.type)}
                  </span>
                  <span style={{
                    fontSize: "12px",
                    color: "#0a5caa",
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                    flex: 1,
                  }} title={f.direction}>
                    {abbreviate(f.direction)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Кнопка «показать ещё» */}
      {hidden > 0 && !expanded && (
        <button
          onClick={onToggle}
          style={{
            display: "block",
            width: "100%",
            margin: "2px 0 0",
            padding: "4px",
            background: "transparent",
            border: "none",
            borderTop: "1px dashed #d0d9e6",
            cursor: "pointer",
            fontSize: "11px",
            color: headerColor,
            fontFamily: "inherit",
            fontWeight: 700,
          }}
        >
          ▼ Показать ещё {hidden}
        </button>
      )}
      {expanded && (
        <button
          onClick={onToggle}
          style={{
            display: "block",
            width: "100%",
            margin: "2px 0 0",
            padding: "4px",
            background: "transparent",
            border: "none",
            borderTop: "1px dashed #d0d9e6",
            cursor: "pointer",
            fontSize: "11px",
            color: "#56657a",
            fontFamily: "inherit",
            fontWeight: 700,
          }}
        >
          ▲ Свернуть
        </button>
      )}
    </div>
  );
}
