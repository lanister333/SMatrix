"use client";

import { useEffect, useState } from "react";

interface Flight {
  time: string;
  type: string;
  route: string;
  direction: string;
  status?: string;
  alert?: boolean;
}

interface Section {
  id: string;
  emoji: string;
  title: string;
  color: string;
  flights: Flight[];
}

const TABS = [
  { id: "aviation", emoji: "✈️", label: "Авиа", color: "#0ea5e9" },
  { id: "water", emoji: "🚢", label: "Вода", color: "#3b82f6" },
  { id: "railway", emoji: "🚂", label: "ЖД", color: "#f97316" },
];

function statusBadge(status?: string) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes("по распис")) return { icon: "✅", bg: "#dcfce7", fg: "#16a34a" };
  if (s.includes("задерж") || s.includes("опазд")) return { icon: "⏱", bg: "#fef3c7", fg: "#d97706" };
  if (s.includes("погод")) return { icon: "🌧", bg: "#dbeafe", fg: "#2563eb" };
  if (s.includes("отмен")) return { icon: "⛔", bg: "#fee2e2", fg: "#dc2626" };
  if (s.includes("посад") || s.includes("регистр")) return { icon: "🚪", bg: "#f3e8ff", fg: "#9333ea" };
  return { icon: "•", bg: "#f1f5f9", fg: "#64748b" };
}

export default function TestTransportPage() {
  const [data, setData] = useState<{ sections: Section[] } | null>(null);
  const [activeTab, setActiveTab] = useState("aviation");

  useEffect(() => {
    fetch("/api/transport")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const section = data?.sections.find((s) => s.id === activeTab);
  const tabColor = TABS.find((t) => t.id === activeTab)?.color || "#1e3a5f";

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "22px", marginBottom: "16px", color: "#1e3a5f" }}>
        🚍 Расписание транспорта
      </h1>

      {/* Вкладки */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        {TABS.map((t) => {
          const sec = data?.sections.find((s) => s.id === t.id);
          const count = sec?.flights.length ?? 0;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "12px 16px",
                background: active ? t.color : "#f8fafc",
                color: active ? "#fff" : "#475569",
                border: "1px solid #e2e8f0",
                borderBottom: active ? "none" : "3px solid transparent",
                borderRadius: "8px 8px 0 0",
                cursor: "pointer",
                fontSize: "15px",
                fontWeight: "700",
                transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: "20px" }}>{t.emoji}</span>
              <span>{t.label}</span>
              <span
                style={{
                  background: active ? "rgba(255,255,255,0.3)" : "#e2e8f0",
                  color: active ? "#fff" : "#475569",
                  borderRadius: "12px",
                  padding: "2px 8px",
                  fontSize: "12px",
                  fontWeight: "700",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Таблица */}
      <div
        style={{
          border: `2px solid ${tabColor}`,
          borderRadius: "0 8px 8px 8px",
          overflow: "hidden",
          background: "#fff",
        }}
      >
        {/* Заголовок */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "70px 100px 1fr 1.5fr 120px",
            gap: "12px",
            padding: "10px 16px",
            background: "#f8fafc",
            borderBottom: `2px solid ${tabColor}`,
            fontSize: "13px",
            fontWeight: "600",
            color: "#475569",
          }}
        >
          <span>Время</span>
          <span>Тип</span>
          <span>Рейс</span>
          <span>Маршрут</span>
          <span>Статус</span>
        </div>

        {/* Строки */}
        {section?.flights.map((f, i) => {
          const sb = statusBadge(f.status);
          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "70px 100px 1fr 1.5fr 120px",
                gap: "12px",
                padding: "10px 16px",
                background: i % 2 === 0 ? "#fff" : "#f8fafc",
                borderBottom: "1px solid #f1f5f9",
                fontSize: "13px",
                color: "#334155",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: "600", color: tabColor, fontSize: "15px", fontVariantNumeric: "tabular-nums" }}>
                {f.time}
              </span>
              <span style={{ color: "#64748b", whiteSpace: "normal" }}>
                {f.type}
              </span>
              <span style={{ fontWeight: "600", color: "#1e3a5f" }}>
                {f.route}
              </span>
              <span style={{ color: "#334155" }}>
                {f.direction}
              </span>
              <span>
                {sb && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "3px 8px",
                      borderRadius: "12px",
                      background: sb.bg,
                      color: sb.fg,
                      fontSize: "11px",
                      fontWeight: "600",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span>{sb.icon}</span>
                    <span>{f.status}</span>
                  </span>
                )}
              </span>
            </div>
          );
        })}

        {!section && (
          <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
            Загрузка...
          </div>
        )}
      </div>

      <div style={{ marginTop: "12px", fontSize: "12px", color: "#94a3b8", textAlign: "center" }}>
        Источник: Яндекс.Расписания / демо-данные
      </div>
    </div>
  );
}
