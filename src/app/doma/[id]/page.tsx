"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
interface Msg { id: string; body: string; authorNick: string; createdAt: string; }
interface TopicDetail {
  topic: { id: string; title: string; body: string; authorNick: string; pinned: boolean; closed: boolean; createdAt: string; houseId: string; branchId: string; };
  messages: Msg[];
  isModerator: boolean;
}

function getToken(): string {
  try { const raw = localStorage.getItem(AUTH_KEY); if (raw) { const s = JSON.parse(raw); return s.token || ""; } } catch {}
  return "";
}

function HousePageInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const topicId = searchParams.get("topic");
  const branchId = searchParams.get("branch");
  const { user } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [data, setData] = useState<HouseData | null>(null);
  const [topicData, setTopicData] = useState<TopicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qfBranch, setQfBranch] = useState("");
  const [qfTitle, setQfTitle] = useState("");
  const [qfBody, setQfBody] = useState("");
  const [qfBusy, setQfBusy] = useState(false);
  const [qfError, setQfError] = useState("");
  const [reply, setReply] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState("");

  useEffect(() => {
    fetch("/api/bootstrap").then((r) => r.json()).then((r) => { if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings }); }).catch(() => {});
  }, []);

  // Load house data or topic data depending on params
  useEffect(() => {
    setLoading(true);
    setError("");
    const t = getToken();
    if (topicId) {
      // Load topic detail
      fetch(`/api/houses/topics/${topicId}?token=${encodeURIComponent(t)}`)
        .then(async (r) => { const d = await r.json(); if (!r.ok) throw Error(d.error); return d; })
        .then(setTopicData)
        .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
        .finally(() => setLoading(false));
    } else {
      // Load house overview (with optional branch filter)
      setTopicData(null);
      fetch(`/api/houses/${params.id}/topics?token=${encodeURIComponent(t)}${branchId ? `&branchId=${branchId}` : ""}`)
        .then(async (r) => { const d = await r.json(); if (!r.ok) throw Error(d.error); return d; })
        .then((d) => { setData(d); if (d.branches.length > 0) setQfBranch(branchId || d.branches[0].id); })
        .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
        .finally(() => setLoading(false));
    }
  }, [params.id, topicId, branchId]);

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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t, branchId: qfBranch, title: qfTitle, body: qfBody }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка");
      // Reload to show new topic
      if (branchId) router.push(`/doma/${params.id}?branch=${branchId}`);
      else router.push(`/doma/${params.id}`);
    } catch (e) { setQfError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setQfBusy(false); }
  };

  const handleTopicAction = async (tid: string, action: string) => {
    const t = getToken();
    await fetch(`/api/houses/topics/${tid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t, action }),
    });
    if (topicId) router.push(`/doma/${params.id}?topic=${topicId}`);
    else router.refresh();
  };

  const handleTopicDelete = async (tid: string) => {
    if (!confirm("Удалить тему безвозвратно?")) return;
    const t = getToken();
    await fetch(`/api/houses/topics/${tid}?token=${encodeURIComponent(t)}`, { method: "DELETE" });
    router.push(`/doma/${params.id}`);
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    setReplyError("");
    const t = getToken();
    if (!t) { setReplyError("Войдите на форум, чтобы писать."); return; }
    if (!reply.trim()) return;
    setReplyBusy(true);
    try {
      const r = await fetch(`/api/houses/topics/${topicId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t, body: reply }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка");
      setReply("");
      // Reload topic
      router.push(`/doma/${params.id}?topic=${topicId}`);
    } catch (e) { setReplyError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setReplyBusy(false); }
  };

  const handleTopicActionDetail = async (action: string) => {
    if (!topicId) return;
    const t = getToken();
    await fetch(`/api/houses/topics/${topicId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t, action }),
    });
    router.push(`/doma/${params.id}?topic=${topicId}`);
  };

  // === LOADING ===
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

  // === ERROR ===
  if (error) return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="useful" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", padding: "16px" }}>
          <p style={{ color: "#c40000", fontSize: "16px" }}>{error}</p>
          <button onClick={() => router.push(`/doma/${params.id}`)} style={{ marginTop: "12px", color: "#0a5caa", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "15px" }}>← Назад в дом</button>
        </div>
      </div>
      <SiteFooter settings={settings} />
    </div>
  );

  const icons = ["🔧", "🌳", "💬"];
  const colors = ["#0a5caa", "#0a7d75", "#b45309"];

  // === TOPIC VIEW (?topic=ID) ===
  if (topicId && topicData) {
    const tp = topicData.topic;
    return (
      <div className="sm-page flex min-h-screen flex-col">
        <Masthead settings={settings} />
        <MainNav current="useful" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
        <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
          <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", padding: "16px", boxSizing: "border-box" }}>
            <button onClick={() => router.push(`/doma/${params.id}`)} style={{ color: "#0a5caa", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "15px", marginBottom: "12px" }}>← Назад в дом</button>
            <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#1E3A5F", margin: "0 0 8px", lineHeight: 1.3 }}>
              {tp.pinned && <span style={{ marginRight: "4px" }}>📌</span>}
              {tp.closed && <span style={{ marginRight: "4px" }}>🔒</span>}
              {tp.title}
            </h1>
            <div style={{ fontSize: "13px", color: "#56657a", marginBottom: "16px" }}>
              Автор: {tp.authorNick} · {new Date(tp.createdAt).toLocaleString("ru-RU")}
              {topicData.isModerator && (
                <span style={{ marginLeft: "12px", display: "inline-flex", gap: "6px" }}>
                  <button onClick={() => handleTopicActionDetail(tp.pinned ? "unpin" : "pin")} style={{ fontSize: "11px", color: "#0a7d75", background: "none", border: "1px solid #0a7d7544", borderRadius: "3px", cursor: "pointer", padding: "1px 6px", fontFamily: "inherit" }}>{tp.pinned ? "Открепить" : "Закрепить"}</button>
                  <button onClick={() => handleTopicActionDetail(tp.closed ? "open" : "close")} style={{ fontSize: "11px", color: "#b45309", background: "none", border: "1px solid #b4530944", borderRadius: "3px", cursor: "pointer", padding: "1px 6px", fontFamily: "inherit" }}>{tp.closed ? "Открыть" : "Закрыть"}</button>
                </span>
              )}
            </div>
            {tp.body && (
              <div style={{ background: "#fff", border: "1px solid #d0d9e6", borderRadius: "4px", padding: "14px 16px", marginBottom: "12px" }}>
                <div style={{ fontSize: "15px", color: "#2A3B50", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{tp.body}</div>
              </div>
            )}
            {topicData.messages.map((m) => (
              <div key={m.id} style={{ background: "#fff", border: "1px solid #d0d9e6", borderRadius: "4px", padding: "12px 16px", marginBottom: "8px" }}>
                <div style={{ fontSize: "13px", color: "#56657a", marginBottom: "4px" }}>
                  <b style={{ color: "#1E3A5F" }}>{m.authorNick}</b> · {new Date(m.createdAt).toLocaleString("ru-RU")}
                </div>
                <div style={{ fontSize: "15px", color: "#2A3B50", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.body}</div>
              </div>
            ))}
            {!tp.closed ? (
              <form onSubmit={handleReply} style={{ marginTop: "16px" }}>
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Ваш ответ…" rows={3} style={{ width: "100%", padding: "10px 12px", border: "1px solid #4A688C", borderRadius: "4px", fontSize: "15px", fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
                {replyError && <div style={{ color: "#c40000", fontSize: "13px", marginTop: "6px" }}>{replyError}</div>}
                <button type="submit" disabled={replyBusy} style={{ marginTop: "8px", padding: "10px 20px", background: "#0a7d75", color: "#fff", border: "none", borderRadius: "4px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: replyBusy ? "wait" : "pointer" }}>
                  {replyBusy ? "Отправка…" : "Ответить"}
                </button>
              </form>
            ) : (
              <div style={{ marginTop: "16px", padding: "12px", textAlign: "center", color: "#56657a", fontSize: "14px", background: "#f8fafc", borderRadius: "4px" }}>🔒 Тема закрыта для новых ответов</div>
            )}
          </div>
          <SiteFooter settings={settings} />
        </div>
      </div>
    );
  }

  // === HOUSE OVERVIEW / BRANCH VIEW ===
  if (!data) return null;
  const h = data.house;
  const fullAddress = `${h.city}, ${h.street}, ${h.houseNumber}`;
  const activeBranch = branchId ? data.branches.find((b) => b.id === branchId) : null;

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
            <div style={{ display: "inline-block", background: "#0a7d75", color: "#fff", padding: "4px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: 700, marginBottom: "16px" }}>⚙ Вы модератор этого дома</div>
          )}

          {/* Если просматриваем конкретную ветку — показываем кнопку «Назад» и заголовок ветки */}
          {activeBranch && (
            <div style={{ marginBottom: "16px" }}>
              <button onClick={() => router.push(`/doma/${params.id}`)} style={{ color: "#0a5caa", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "15px" }}>← Все ветки дома</button>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1E3A5F", marginTop: "8px" }}>{activeBranch.title}</h2>
            </div>
          )}

          {/* Ветки — только если не просматриваем конкретную ветку */}
          {!activeBranch && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {data.branches.map((b, i) => {
                const bc = data.branchCounts.find((c) => c.branchId === b.id);
                return (
                  <button key={b.id} onClick={() => router.push(`/doma/${params.id}?branch=${b.id}`)}
                    style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 18px", background: "#fff", border: `1px solid ${colors[i % 3]}33`, borderLeft: `4px solid ${colors[i % 3]}`, borderRadius: "4px", cursor: "pointer", fontSize: "16px", fontFamily: "inherit", textAlign: "left", width: "100%", boxSizing: "border-box" }}>
                    <span style={{ fontSize: "28px" }}>{icons[i % 3]}</span>
                    <span style={{ flex: 1, fontWeight: 600, color: "#1E3A5F" }}>{b.title}</span>
                    <span style={{ fontSize: "13px", color: "#56657a", flexShrink: 0 }}>{bc?.topicsCount ?? 0} тем</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Темы — все или конкретной ветки */}
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#1E3A5F", marginBottom: "10px" }}>
              {activeBranch ? `Темы в ветке «${activeBranch.title}»` : "Последние обсуждения в доме"}
            </h2>
            {data.topics.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#56657a", fontSize: "14px", background: "#f8fafc", borderRadius: "4px" }}>Пока нет ни одной темы. Создайте первую — форму ниже.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {data.topics.map((t) => {
                  const br = data.branches.find((b) => b.id === t.branchId);
                  return (
                    <div key={t.id} style={{ background: "#fff", border: "1px solid #d0d9e6", borderRadius: "4px", padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                        <button onClick={() => router.push(`/doma/${params.id}?topic=${t.id}`)}
                          style={{ fontWeight: 600, color: "#1E3A5F", fontSize: "15px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", flex: 1 }}>
                          {t.pinned && <span style={{ color: "#0a7d75", marginRight: "4px" }}>📌</span>}
                          {t.closed && <span style={{ color: "#c40000", marginRight: "4px" }}>🔒</span>}
                          {t.title}
                        </button>
                        {!activeBranch && <span style={{ fontSize: "12px", color: "#94a3b8", flexShrink: 0 }}>{br?.title || ""}</span>}
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
              {!activeBranch && (
                <select value={qfBranch} onChange={(e) => setQfBranch(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid #4A688C", borderRadius: "4px", fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box" }}>
                  {data.branches.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
              )}
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

export default function HousePage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center", color: "#56657a" }}>Загрузка…</div>}>
      <HousePageInner />
    </Suspense>
  );
}
