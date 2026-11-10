"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface HouseInfo {
  id: string;
  city: string;
  street: string;
  houseNumber: string;
  createdAt: string;
}

interface Branch {
  id: string;
  title: string;
}

export default function HousePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [house, setHouse] = useState<HouseInfo | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("forum_token") || "";
    fetch(`/api/houses/${params.id}?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Ошибка");
        setHouse(d.house);
        setBranches(d.branches);
        setIsModerator(d.isModerator);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", fontSize: "15px", color: "#56657a" }}>
        Загрузка…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center", fontSize: "15px", color: "#c40000" }}>
        {error}
        <div style={{ marginTop: "12px" }}>
          <button
            onClick={() => router.push("/doma")}
            style={{ color: "#0a5caa", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            ← К списку домов
          </button>
        </div>
      </div>
    );
  }

  if (!house) return null;

  const fullAddress = `${house.city}, ${house.street}, ${house.houseNumber}`;

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <div className="sk">
        <div className="sk-topbar">
          <span className="tb-title">Дома и СНТ</span>
        </div>
        <div className="sk-shell">
          <div className="sk-layout sk-layout-page main-grid-container">
            <div className="sk-col-main center-column" style={{ maxWidth: 700, margin: "0 auto" }}>
              <div className="sm-stub-home crt-back" style={{ borderBottom: "3px solid #0a7d75" }}>
                🏠 {fullAddress}
              </div>
              <div className="crt-body" style={{ padding: "16px" }}>
                {isModerator && (
                  <div style={{
                    display: "inline-block",
                    background: "#0a7d75",
                    color: "#fff",
                    padding: "3px 10px",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: 700,
                    marginBottom: "16px",
                  }}>
                    ⚙ Вы модератор этого дома
                  </div>
                )}

                <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.6, marginBottom: "20px" }}>
                  Чат дома создан {new Date(house.createdAt).toLocaleDateString("ru-RU")}.
                  Выберите ветку для обсуждения:
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {branches.map((b, i) => {
                    const icons = ["🔧", "🌳", "💬"];
                    const colors = ["#0a5caa", "#0a7d75", "#b45309"];
                    return (
                      <button
                        key={b.id}
                        onClick={() => {
                          // TODO: перейти в ветку/топик дома
                          alert(`Ветка «${b.title}» — в разработке`);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "14px 16px",
                          background: "#fff",
                          border: `1px solid ${colors[i % 3]}33`,
                          borderLeft: `4px solid ${colors[i % 3]}`,
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "15px",
                          fontFamily: "inherit",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ fontSize: "24px" }}>{icons[i % 3]}</span>
                        <span style={{ fontWeight: 600, color: "#1E3A5F" }}>{b.title}</span>
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: "24px" }}>
                  <button
                    onClick={() => router.push("/doma")}
                    style={{ color: "#0a5caa", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "14px" }}
                  >
                    ← К списку домов
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
