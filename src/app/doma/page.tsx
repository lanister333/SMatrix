"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_SETTINGS,
  isStaffRole,
  MainNav,
  Masthead,
  SiteFooter,
  useAuth,
  type SiteSettings,
} from "@/components/site/chrome";
import { AUTH_KEY } from "@/lib/ui";

interface HouseListItem {
  id: string;
  city: string;
  street: string;
  houseNumber: string;
  branchesCount: number;
}

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

const CITIES = [
  "Южно-Сахалинск",
  "Холмск",
  "Корсаков",
  "Оха",
  "Поронайск",
  "Долинск",
  "Невельск",
  "Александровск-Сахалинский",
  "Углегорск",
  "Макаров",
  "Томари",
  "Анива",
  "Смирных",
  "Ноглики",
  "Красногорск",
  "Южно-Курильск",
  "Курильск",
  "Северо-Курильск",
  "Лесогорск",
  "Вахрушев",
];

export default function DomaPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [token, setToken] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [houses, setHouses] = useState<HouseListItem[]>([]);
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then((r) => {
        if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.token) setToken(saved.token);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/houses")
      .then((r) => r.json())
      .then((d) => setHouses(d.houses || []))
      .catch(() => {});
  }, []);

  const goNav = (k: string) => {
    window.location.href = NAV_ROUTES[k] ?? "/";
  };

  const filtered = houses.filter((h) => {
    if (!searchQ.trim()) return true;
    const q = searchQ.trim().toLowerCase();
    return (
      h.city.includes(q) ||
      h.street.includes(q) ||
      h.houseNumber.includes(q)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Чтобы создать новый чат дома, нужно войти на форум. Уже созданные дома доступны для просмотра всем.");
      return;
    }
    if (!city || !street || !houseNumber) {
      setError("Заполните город, улицу и номер дома.");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/houses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, city, street, houseNumber }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка");
      router.push(`/doma/${d.houseId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #4A688C",
    borderRadius: "4px",
    fontSize: "15px",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "14px",
    fontWeight: 700,
    color: "#1E3A5F",
    marginBottom: "5px",
  };

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="useful" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div className="sk-shell">
          {/* Полноширинный контейнер — без левой/правой колонки */}
          <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", padding: "16px", boxSizing: "border-box" }}>

            {/* Заголовок страницы (единственный — синюю плашку убрали, чтобы не дублировалось) */}
            <h1 style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "#1E3A5F",
              margin: "0 0 16px",
              padding: "0 0 10px",
              borderBottom: "2px solid #0a7d75",
              lineHeight: 1.3,
            }}>
              Дома и СНТ — домовые чаты по требованию
            </h1>

            {/* Две колонки на широких экранах, одна под другой на узких */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: "16px",
              marginBottom: "20px",
            }}>
              {/* Левая колонка — инструкция */}
              <div style={{
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                borderRadius: "6px",
                padding: "16px 20px",
                fontSize: "14px",
                lineHeight: 1.7,
                color: "#0c4a6e",
                boxSizing: "border-box",
              }}>
                <b style={{ fontSize: "16px", display: "block", marginBottom: "10px" }}>Как это работает:</b>
                <ul style={{ margin: "0", padding: "0 0 0 18px", listStyle: "disc" }}>
                  <li style={{ marginBottom: "8px" }}>Введите свой адрес — город, улицу и номер дома.</li>
                  <li style={{ marginBottom: "8px" }}>Если чат дома уже создан соседом — вас перенаправит внутрь.</li>
                  <li style={{ marginBottom: "8px" }}>Если дома ещё нет — он создаётся автоматически, вы становитесь модератором.</li>
                  <li style={{ marginBottom: "0" }}>Внутри дома 3 ветки: «ЖКХ и УК», «Благоустройство двора», «Свободный чат».</li>
                </ul>
              </div>

              {/* Правая колонка — форма */}
              <form onSubmit={handleSubmit} style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                background: "#fff",
                border: "1px solid #4A688C",
                borderRadius: "6px",
                padding: "16px 20px",
                boxSizing: "border-box",
              }}>
                <div>
                  <label style={labelStyle}>Город / населённый пункт</label>
                  <select value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle}>
                    <option value="">— Выберите город —</option>
                    {CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Улица</label>
                  <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Например: Ленина" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Номер дома</label>
                  <input type="text" value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} placeholder="Например: 15 или 15А" style={inputStyle} />
                </div>
                {error && (
                  <div style={{ color: "#c40000", fontSize: "14px", fontWeight: 600 }}>{error}</div>
                )}
                <button type="submit" disabled={loading} style={{
                  padding: "12px 24px",
                  background: "#0a7d75",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "16px",
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: loading ? "wait" : "pointer",
                  width: "100%",
                  boxSizing: "border-box",
                  marginTop: "4px",
                }}>
                  {loading ? "Обработка…" : "Перейти в чат дома →"}
                </button>
              </form>
            </div>

            {/* Список существующих домов — на всю ширину */}
            <div>
              <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#1E3A5F", marginBottom: "10px" }}>
                Уже созданные дома ({houses.length})
              </h2>
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Поиск по адресу…"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #c0cad8",
                  borderRadius: "4px",
                  fontSize: "15px",
                  marginBottom: "10px",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
              {/* Бирюзовая полоса с количеством домов — как .sk-pager на форуме */}
              <div className="sk-pager">
                <span>Дома {filtered.length ? 1 : 0} - {filtered.length} из <b>{houses.length}</b>{searchQ ? ` · найдено ${filtered.length}` : ""}</span>
              </div>
              {filtered.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "#56657a", fontSize: "14px" }}>
                  {houses.length === 0 ? "Пока ни один дом не создан. Будьте первым!" : "Ничего не найдено."}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {filtered.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => router.push(`/doma/${h.id}`)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        background: "#fff",
                        border: "1px solid #d0d9e6",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "15px",
                        fontFamily: "inherit",
                        textAlign: "left",
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    >
                      <span>
                        <b style={{ color: "#1E3A5F" }}>{h.city}</b>
                        {" — "}
                        {h.street}, {h.houseNumber}
                      </span>
                      <span style={{ fontSize: "13px", color: "#56657a", flexShrink: 0, marginLeft: "8px" }}>
                        {h.branchesCount} ветки
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {/* Вторая бирюзовая полоса снизу — как на форуме */}
              <div className="sk-pager">
                <span>Дома {filtered.length ? 1 : 0} - {filtered.length} из <b>{houses.length}</b>{searchQ ? ` · найдено ${filtered.length}` : ""}</span>
              </div>
            </div>
          </div>
        </div>
        <SiteFooter settings={settings} />
      </div>
    </div>
  );
}
