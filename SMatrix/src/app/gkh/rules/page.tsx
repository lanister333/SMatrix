import type { Metadata } from "next";
import { GKF_RULES, GKF_RULES_INTRO } from "@/lib/gkh-rules";

export const metadata: Metadata = {
  title: "Правила публикации — ЖКХ — SakhMatrix",
  description: "Правила публикации проблем ЖКХ на SakhMatrix.",
};

export default function GkhRulesPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 60px" }}>
      <div style={{ marginBottom: 16 }}>
        <a href="/gkh" style={{ color: "#0a5caa", fontSize: 14 }}>← Назад к проблемам</a>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1E3A5F", marginBottom: 20 }}>⚠️ Правила публикации</h1>

      <p style={{ fontSize: 15, lineHeight: 1.7, color: "#333", marginBottom: 16 }}>
        {GKF_RULES_INTRO}
      </p>

      <ul style={{ paddingLeft: 22, lineHeight: 1.9, fontSize: 15, color: "#333" }}>
        {GKF_RULES.map((r, i) => (
          <li key={i} style={{ marginBottom: 8 }}>{r}</li>
        ))}
      </ul>

      <div style={{ marginTop: 30, padding: 16, background: "#f0f4f8", borderRadius: 8, fontSize: 14, color: "#475569" }}>
        <a href="/gkh" style={{ color: "#0a5caa", fontWeight: 600 }}>← Вернуться к проблемам</a>
      </div>
    </div>
  );
}
