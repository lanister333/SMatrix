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
import { AUTH_KEY } from "@/lib/ui";

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

interface Branch { id: string; title: string; }
interface BranchCount { branchId: string; title: string; topicsCount: number; }
interface Topic {
  id: string; title: string; body: string; authorNick: string;
  branchId: string; pinned: boolean; closed: boolean; createdAt: string; repliesCount: number;
}
interface HouseData {
  house: { id: string; city: string; street: string; houseNumber: string; };
  branches: Branch[];
  branchCounts: BranchCount[];
  topics: Topic[];
  isModerator: boolean;
}

function getToken(): string {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) { const s = JSON.parse(raw); return s.token || ""; }
  } catch {}
  return "";
}

export default function HousePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [data, setData] = useState<HouseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Quick form
  const [qfBranch, setQfBranch] = useState("");
  const [qfTitle, setQfTitle] = useState("");
  const [qfBody, setQfBody] = useState("");
  const [qfBusy, setQfBusy] = useState(false);
  const [qfError, setQfError] = useState("");

  useEffect(() => {
    fetch("/api/bootstrap").then((r) => r.json()).then((r) => {
      if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const t = getToken();
    fetch(`/api/houses/${params.id}/topics?token=${encodeURIComponent(t)}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw Error(d.error); return d; })
      .then((d) => { setData(d); if (d.branches.length > 0) setQfBranch(d.branches[0].id); })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const goNav = (k: string) => { window.location.href = NAV_ROUTES[k] ?? "/"; };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQfError("");
    const t = getToken();
    if (!t) { setQfError("Войдите на форум, чтобы создать тему."); return; }
    if (!qfBranch || !qfTitle.trim()) { setQfError("Выберите ветку и впишите заголовок."); return; }
    setQfBusy(true);
    try {
      const r = await fetch(`/api/houses/${params.id}/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t, branchId: qfBranch, title: qfTitle, body: qfBody }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка");
      // Reload
      window.location.reload();
    } catch (e) { setQfError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setQfBusy(false); }
  };

  const handleTopicAction = async (topicId: string, action: string) => {
    const t = getToken();
    await fetch(`/api/houses/topics/${topicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t, action }),
    });
    window.location.reload();
  };

  const handleTopicDelete = async (topicId: string) => {
    if (!confirm("Удалить тему безвозвратно?")) return;
    const t = getToken();
    await fetch(`/api/houses/topics/${topicId}?token=${encodeURIComponent(t)}`, { method: "DELETE" });
    window.location.reload();
  };

  if (loading) return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="useful" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", padding: "16px" }}>
          <p style={{ fontSize: "16px", color: "#56657a", textAlign: "center" }}>Загрузка…</p>
        </div>
      </div>
      <SiteFooter settings={settings} />
    </div>
  );

  if (error) return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="useful" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", padding: "16px" }}>
          <p style={{ color: "#c40000", fontSize: "16px" }}>{error}</p>
          <button onClick={() => router.push("/doma")} style={{ marginTop: "12px", color: "#0a5caa", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "15px" }}>← К списку домов</button>
        </div>
      </div>
      <SiteFooter settings={settings} />
    </div>
  );

  if (!data) return null;
  const h = data.house;
  const fullAddress = `${h.city}, ${h.street}, ${h.houseNumber}`;
  const icons = ["🔧", "🌳", "💬"];
  const colors = ["#0a5caa", "#0a7d75", "#b45309"];

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="useful" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", padding: "16px", boxSizing: "border-box" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#1E3A5F", margin: "0 0 16px", padding: "0 0 10px", borderBottom: "2px solid #0a7d75", lineHeight: 1.3 }}>
            🏠 {fullAddress}
          </h1>

          {data.isModerator && (
            <div style={{ display: "inline-block", background: "#0a7d75", color: "#fff", padding: "4px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: 700, marginBottom: "16px" }}>
              ⚙ Вы модератор этого дома
            </div>
          )}

          {/* Ветки — кликабельные, со счётчиком тем */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
            {data.branches.map((b, i) => {
              const bc = data.branchCounts.find((c) => c.branchId === b.id);
              return (
                <button key={b.id} onClick={() => router.push(`/doma/${params.id}/branch/${b.id}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: "14px",
                    padding: "16px 18px", background: "#fff",
                    border: `1px solid ${colors[i % 3]}33`, borderLeft: `4px solid ${colors[i % 3]}`,
                    borderRadius: "4px", cursor: "pointer", fontSize: "16px",
                    fontFamily: "inherit", textAlign: "left", width: "100%", boxSizing: "border-box",
                  }}>
                  <span style={{ fontSize: "28px" }}>{icons[i % 3]}</span>
                  <span style={{ flex: 1, fontWeight: 600, color: "#1E3A5F" }}>{b.title}</span>
                  <span style={{ fontSize: "13px", color: "#56657a", flexShrink: 0 }}>{bc?.topicsCount ?? 0} тем</span>
                </button>
              );
            })}
          </div>

          {/* Последние обсуждения */}
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#1E3A5F", marginBottom: "10px" }}>
              Последние обсуждения в доме
            </h2>
            {data.topics.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#56657a", fontSize: "14px", background: "#f8fafc", borderRadius: "4px" }}>
                Пока нет ни одной темы. Создайте первую — форму ниже.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {data.topics.map((t) => {
                  const br = data.branches.find((b) => b.id === t.branchId);
                  return (
                    <div key={t.id} style={{ background: "#fff", border: "1px solid #d0d9e6", borderRadius: "4px", padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                        <button onClick={() => router.push(`/doma/topic/${t.id}`)}
                          style={{ fontWeight: 600, color: "#1E3A5F", fontSize: "15px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", flex: 1 }}>
                          {t.pinned && <span style={{ color: "#0a7d75", marginRight: "4px" }}>📌</span>}
                          {t.closed && <span style={{ color: "#c40000", marginRight: "4px" }}>🔒</span>}
                          {t.title}
                        </button>
                        <span style={{ fontSize: "12px", color: "#94a3b8", flexShrink: 0 }}>{br?.title || ""}</span>
                      </div>
                      <div style={{ fontSize: "13px", color: "#56657a", marginTop: "4px", display: "flex", alignItems: "center", gap: "12px" }}>
                        <span>{t.authorNick}</span>
                        <span>{new Date(t.createdAt).toLocaleDateString("ru-RU")}</span>
                        <span>💬 {t.repliesCount}</span>
                        {data.isModerator && (
                          <span style={{ display: "flex", gap: "6px", marginLeft: "auto" }}>
                            <button onClick={() => handleTopicAction(t.id, t.pinned ? "unpin" : "pin")} style={{ fontSize: "11px", color: "#0a7d75", background: "none", border: "1px solid #0a7d7544", borderRadius: "3px", cursor: "pointer", padding: "1px 6px", fontFamily: "inherit" }}>{t.pinned ? "Открепить" : "Закрепить"}</button>
                            <button onClick={() => handleTopicAction(t.id, t.closed ? "open" : "close")} style={{ fontSize: "11px", color: "#b45309", background: "none", border: "1px solid #b4530944", borderRadius: "3px", cursor: "pointer", padding: "1px 6px", fontFamily: "inherit" }}>{t.closed ? "Открыть" : "Закрыть"}</button>
                            <button onClick={() => handleTopicDelete(t.id)} style={{ fontSize: "11px", color: "#c40000", background: "none", border: "1px solid #c4000044", borderRadius: "3px", cursor: "pointer", padding: "1px 6px", fontFamily: "inherit" }}>Удалить</button>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Быстрое создание темы */}
          <div style={{ background: "#f8fafc", border: "1px solid #d0d9e6", borderRadius: "6px", padding: "16px 20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1E3A5F", margin: "0 0 12px" }}>Создать тему</h3>
            <form onSubmit={handleQuickSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <select value={qfBranch} onChange={(e) => setQfBranch(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid #4A688C", borderRadius: "4px", fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box" }}>
                {data.branches.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
              </select>
              <input type="text" value={qfTitle} onChange={(e) => setQfTitle(e.target.value)} placeholder="Заголовок темы" style={{ width: "100%", padding: "8px 12px", border: "1px solid #4A688C", borderRadius: "4px", fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box" }} />
              <textarea value={qfBody} onChange={(e) => setQfBody(e.target.value)} placeholder="Текст сообщения (необязательно)" rows={3} style={{ width: "100%", padding: "8px 12px", border: "1px solid #4A688C", borderRadius: "4px", fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
              {qfError && <div style={{ color: "#c40000", fontSize: "13px", fontWeight: 600 }}>{qfError}</div>}
              <button type="submit" disabled={qfBusy} style={{ padding: "10px 20px", background: "#0a7d75", color: "#fff", border: "none", borderRadius: "4px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: qfBusy ? "wait" : "pointer", width: "100%", boxSizing: "border-box" }}>
                {qfBusy ? "Отправка…" : "Создать тему"}
              </button>
            </form>
          </div>

          <div style={{ marginTop: "20px" }}>
            <button onClick={() => router.push("/doma")} style={{ color: "#0a5caa", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "15px" }}>← К списку домов</button>
          </div>
        </div>
        <SiteFooter settings={settings} />
      </div>
    </div>
  );
}
