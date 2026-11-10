"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DEFAULT_SETTINGS,
  isStaffRole,
  MainNav,
  Masthead,
  SiteFooter,
  useAuth,
  type SiteSettings,
} from "@/components/site/chrome";

const NAV_ROUTES: Record<string, string> = {
  home: "/",
  forum: "/?view=forum",
  ads: "/obyavleniya",
  podslyshano: "/podslyshano",
  wheretobuy: "/gde-kupit",
  gdedeshevle: "/gde-deshevle",
  recommend: "/rekomenduyu",
  employers: "/o-rabotodatelyah",
  gkh: "/gkh",
  help: "/help",
  dating: "/znakomstva",
  weather: "/weather.php",
  currency: "/currency.php",
  disconnections: "/disconnections.php",
  traffic: "/traffic.php",
  transport: "/transport.php",
};

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
  const { user } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [house, setHouse] = useState<HouseInfo | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then((r) => {
        if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings });
      })
      .catch(() => {});
  }, []);

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

  const goNav = (k: string) => {
    window.location.href = NAV_ROUTES[k] ?? "/";
  };

  if (loading) {
    return (
      <div className="sm-page flex min-h-screen flex-col">
        <Masthead settings={settings} />
        <MainNav current="useful" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
        <div className="sk" style={{ minHeight: 0, flex: "1 0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontSize: "16px", color: "#56657a" }}>Загрузка…</p>
        </div>
        <SiteFooter settings={settings} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="sm-page flex min-h-screen flex-col">
        <Masthead settings={settings} />
        <MainNav current="useful" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
        <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
          <div className="sk-shell">
            <div className="sk-layout sk-layout-page main-grid-container">
              <div className="sk-col-main center-column" style={{ maxWidth: 800, margin: "0 auto", width: "100%" }}>
                <div className="sm-stub-home crt-back">Ошибка</div>
                <div className="crt-body" style={{ padding: "24px", textAlign: "center" }}>
                  <p style={{ color: "#c40000", fontSize: "16px" }}>{error}</p>
                  <button
                    onClick={() => router.push("/doma")}
                    style={{ marginTop: "16px", color: "#0a5caa", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "15px" }}
                  >
                    ← К списку домов
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <SiteFooter settings={settings} />
      </div>
    );
  }

  if (!house) return null;

  const fullAddress = `${house.city}, ${house.street}, ${house.houseNumber}`;

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="useful" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div className="sk-topbar">
          <span className="tb-title">Домовой ЧАТ</span>
        </div>
        <div className="sk-shell">
          <div className="sk-layout sk-layout-page main-grid-container">
            <div className="sk-col-main center-column" style={{ maxWidth: 800, margin: "0 auto", width: "100%" }}>
              <div className="sm-stub-home crt-back" style={{ borderBottom: "3px solid #0a7d75" }}>
                🏠 {fullAddress}
              </div>
              <div className="crt-body" style={{ padding: "16px" }}>
                {isModerator && (
                  <div style={{
                    display: "inline-block",
                    background: "#0a7d75",
                    color: "#fff",
                    padding: "4px 12px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    marginBottom: "16px",
                  }}>
                    ⚙ Вы модератор этого дома
                  </div>
                )}

                <p style={{ fontSize: "15px", color: "#475569", lineHeight: 1.7, marginBottom: "20px" }}>
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
                          alert(`Ветка «${b.title}» — в разработке`);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          padding: "16px 18px",
                          background: "#fff",
                          border: `1px solid ${colors[i % 3]}33`,
                          borderLeft: `4px solid ${colors[i % 3]}`,
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "16px",
                          fontFamily: "inherit",
                          textAlign: "left",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      >
                        <span style={{ fontSize: "28px" }}>{icons[i % 3]}</span>
                        <span style={{ fontWeight: 600, color: "#1E3A5F" }}>{b.title}</span>
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: "24px" }}>
                  <button
                    onClick={() => router.push("/doma")}
                    style={{ color: "#0a5caa", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "15px" }}
                  >
                    ← К списку домов
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <SiteFooter settings={settings} />
      </div>
    </div>
  );
}
