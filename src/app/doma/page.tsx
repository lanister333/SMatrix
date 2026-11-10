"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface HouseListItem {
  id: string;
  city: string;
  street: string;
  houseNumber: string;
  branchesCount: number;
}

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
  const [token, setToken] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [houses, setHouses] = useState<HouseListItem[]>([]);
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("forum_token") || "";
    setToken(t);
  }, []);

  // Load existing houses
  useEffect(() => {
    fetch("/api/houses")
      .then((r) => r.json())
      .then((d) => setHouses(d.houses || []))
      .catch(() => {});
  }, []);

  // Filter houses by search
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
      setError("Нужно войти на форум, чтобы создать или открыть чат дома.");
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
                Дома и СНТ — домовые чаты по требованию
              </div>
              <div className="crt-body" style={{ padding: "16px" }}>
                {/* Инструкция */}
                <div style={{
                  background: "#f0f9ff",
                  border: "1px solid #bae6fd",
                  borderRadius: "6px",
                  padding: "12px 16px",
                  marginBottom: "20px",
                  fontSize: "14px",
                  lineHeight: 1.6,
                  color: "#0c4a6e",
                }}>
                  <b>Как это работает:</b>
                  <ol style={{ margin: "8px 0 0 20px", padding: 0 }}>
                    <li>Введите свой адрес (город, улицу, номер дома).</li>
                    <li>Если чат дома уже создан соседом — вас перенаправит внутрь.</li>
                    <li>Если дома ещё нет — он создаётся автоматически, вы становитесь модератором.</li>
                    <li>Внутри дома 3 ветки: ЖКХ и УК, Благоустройство двора, Свободный чат.</li>
                  </ol>
                </div>

                {/* Форма */}
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1E3A5F", marginBottom: "4px" }}>
                      Город / населённый пункт
                    </label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        border: "1px solid #4A688C",
                        borderRadius: "4px",
                        fontSize: "14px",
                        fontFamily: "inherit",
                      }}
                    >
                      <option value="">— Выберите город —</option>
                      {CITIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1E3A5F", marginBottom: "4px" }}>
                      Улица
                    </label>
                    <input
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Например: Ленина"
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        border: "1px solid #4A688C",
                        borderRadius: "4px",
                        fontSize: "14px",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1E3A5F", marginBottom: "4px" }}>
                      Номер дома
                    </label>
                    <input
                      type="text"
                      value={houseNumber}
                      onChange={(e) => setHouseNumber(e.target.value)}
                      placeholder="Например: 15 или 15А"
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        border: "1px solid #4A688C",
                        borderRadius: "4px",
                        fontSize: "14px",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                  {error && (
                    <div style={{ color: "#c40000", fontSize: "13px", fontWeight: 600 }}>{error}</div>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: "10px 20px",
                      background: "#0a7d75",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      fontSize: "15px",
                      fontWeight: 700,
                      fontFamily: "inherit",
                      cursor: loading ? "wait" : "pointer",
                    }}
                  >
                    {loading ? "Обработка…" : "Перейти в чат дома →"}
                  </button>
                </form>

                {/* Список существующих домов */}
                <div style={{ marginTop: "28px" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1E3A5F", marginBottom: "10px" }}>
                    Уже созданные дома ({houses.length})
                  </h2>
                  <input
                    type="text"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="Поиск по адресу…"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid #c0cad8",
                      borderRadius: "4px",
                      fontSize: "14px",
                      marginBottom: "10px",
                      fontFamily: "inherit",
                    }}
                  />
                  {filtered.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "#56657a", fontSize: "13px" }}>
                      {houses.length === 0 ? "Пока ни один дом не создан. Будьте первым!" : "Ничего не найдено."}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {filtered.map((h) => (
                        <button
                          key={h.id}
                          onClick={() => router.push(`/doma/${h.id}`)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            background: "#fff",
                            border: "1px solid #d0d9e6",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "14px",
                            fontFamily: "inherit",
                            textAlign: "left",
                          }}
                        >
                          <span>
                            <b style={{ color: "#1E3A5F" }}>{h.city}</b>
                            {" — "}
                            {h.street}, {h.houseNumber}
                          </span>
                          <span style={{ fontSize: "12px", color: "#56657a" }}>
                            {h.branchesCount} ветки
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
