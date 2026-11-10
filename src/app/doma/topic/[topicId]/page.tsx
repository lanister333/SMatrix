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
  home: "/", forum: "/?view=forum", ads: "/obyavleniya",
  podslyshano: "/podslyshano", wheretobuy: "/gde-kupit",
  gdedeshevle: "/gde-deshevle", recommend: "/rekomenduyu",
  employers: "/o-rabotodatelyah", gkh: "/gkh", help: "/help",
  dating: "/znakomstva", weather: "/weather.php", currency: "/currency.php",
  disconnections: "/disconnections.php", traffic: "/traffic.php", transport: "/transport.php",
};

function getToken(): string {
  try { const raw = localStorage.getItem(AUTH_KEY); if (raw) { const s = JSON.parse(raw); return s.token || ""; } } catch {}
  return "";
}

interface Msg { id: string; body: string; authorNick: string; createdAt: string; }
interface TopicData {
  topic: { id: string; title: string; body: string; authorNick: string; pinned: boolean; closed: boolean; createdAt: string; houseId: string; branchId: string; };
  messages: Msg[];
  isModerator: boolean;
}

export default function HouseTopicPage() {
  const params = useParams<{ topicId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [data, setData] = useState<TopicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyError, setReplyError] = useState("");

  useEffect(() => {
    fetch("/api/bootstrap").then((r) => r.json()).then((r) => { if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings }); }).catch(() => {});
  }, []);

  useEffect(() => {
    const t = getToken();
    fetch(`/api/houses/topics/${params.topicId}?token=${encodeURIComponent(t)}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw Error(d.error); return d; })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false));
  }, [params.topicId]);

  const goNav = (k: string) => { window.location.href = NAV_ROUTES[k] ?? "/"; };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    setReplyError("");
    const t = getToken();
    if (!t) { setReplyError("Войдите на форум, чтобы писать."); return; }
    if (!reply.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/houses/topics/${params.topicId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t, body: reply }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка");
      setReply("");
      // Reload
      const t2 = getToken();
      fetch(`/api/houses/topics/${params.topicId}?token=${encodeURIComponent(t2)}`)
        .then((r) => r.json()).then(setData);
    } catch (e) { setReplyError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setBusy(false); }
  };

  const handleAction = async (action: string) => {
    const t = getToken();
    await fetch(`/api/houses/topics/${params.topicId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t, action }),
    });
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
  const tp = data.topic;

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="useful" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", padding: "16px", boxSizing: "border-box" }}>
          <button onClick={() => router.push(`/doma/${tp.houseId}`)} style={{ color: "#0a5caa", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "15px", marginBottom: "12px" }}>
            ← Назад к веткам дома
          </button>

          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#1E3A5F", margin: "0 0 8px", lineHeight: 1.3 }}>
            {tp.pinned && <span style={{ color: "#0a7d75", marginRight: "4px" }}>📌</span>}
            {tp.closed && <span style={{ color: "#c40000", marginRight: "4px" }}>🔒</span>}
            {tp.title}
          </h1>

          <div style={{ fontSize: "13px", color: "#56657a", marginBottom: "16px" }}>
            Автор: {tp.authorNick} · {new Date(tp.createdAt).toLocaleString("ru-RU")}
            {data.isModerator && (
              <span style={{ marginLeft: "12px", display: "inline-flex", gap: "6px" }}>
                <button onClick={() => handleAction(tp.pinned ? "unpin" : "pin")} style={{ fontSize: "11px", color: "#0a7d75", background: "none", border: "1px solid #0a7d7544", borderRadius: "3px", cursor: "pointer", padding: "1px 6px", fontFamily: "inherit" }}>{tp.pinned ? "Открепить" : "Закрепить"}</button>
                <button onClick={() => handleAction(tp.closed ? "open" : "close")} style={{ fontSize: "11px", color: "#b45309", background: "none", border: "1px solid #b4530944", borderRadius: "3px", cursor: "pointer", padding: "1px 6px", fontFamily: "inherit" }}>{tp.closed ? "Открыть" : "Закрыть"}</button>
              </span>
            )}
          </div>

          {/* Первое сообщение */}
          {tp.body && (
            <div style={{ background: "#fff", border: "1px solid #d0d9e6", borderRadius: "4px", padding: "14px 16px", marginBottom: "12px" }}>
              <div style={{ fontSize: "15px", color: "#2A3B50", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{tp.body}</div>
            </div>
          )}

          {/* Сообщения */}
          {data.messages.map((m) => (
            <div key={m.id} style={{ background: "#fff", border: "1px solid #d0d9e6", borderRadius: "4px", padding: "12px 16px", marginBottom: "8px" }}>
              <div style={{ fontSize: "13px", color: "#56657a", marginBottom: "4px" }}>
                <b style={{ color: "#1E3A5F" }}>{m.authorNick}</b> · {new Date(m.createdAt).toLocaleString("ru-RU")}
              </div>
              <div style={{ fontSize: "15px", color: "#2A3B50", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.body}</div>
            </div>
          ))}

          {/* Форма ответа */}
          {!tp.closed ? (
            <form onSubmit={handleReply} style={{ marginTop: "16px" }}>
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Ваш ответ…" rows={3} style={{ width: "100%", padding: "10px 12px", border: "1px solid #4A688C", borderRadius: "4px", fontSize: "15px", fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
              {replyError && <div style={{ color: "#c40000", fontSize: "13px", marginTop: "6px" }}>{replyError}</div>}
              <button type="submit" disabled={busy} style={{ marginTop: "8px", padding: "10px 20px", background: "#0a7d75", color: "#fff", border: "none", borderRadius: "4px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: busy ? "wait" : "pointer" }}>
                {busy ? "Отправка…" : "Ответить"}
              </button>
            </form>
          ) : (
            <div style={{ marginTop: "16px", padding: "12px", textAlign: "center", color: "#56657a", fontSize: "14px", background: "#f8fafc", borderRadius: "4px" }}>
              🔒 Тема закрыта для новых ответов
            </div>
          )}
        </div>
        <SiteFooter settings={settings} />
      </div>
    </div>
  );
}
