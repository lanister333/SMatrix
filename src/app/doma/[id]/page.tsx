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
interface Msg { id: string; body: string; authorNick: string; parentId: string; createdAt: string; }
interface TopicDetail {
  topic: { id: string; title: string; body: string; authorNick: string; pinned: boolean; closed: boolean; createdAt: string; houseId: string; branchId: string; };
  messages: Msg[];
  isModerator: boolean;
}
interface ChatMsg { id: string; body: string; authorNick: string; authorId: string; parentId?: string; createdAt: string; }
interface ChatData { messages: ChatMsg[]; isModerator: boolean; }

function getToken(): string {
  try { const raw = localStorage.getItem(AUTH_KEY); if (raw) { const s = JSON.parse(raw); return s.token || ""; } } catch {}
  return "";
}

/** Правильное склонение: 0 тем, 1 тема, 2 темы, 5 тем */
function pluralTopics(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} тема`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} темы`;
  return `${n} тем`;
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
  const [replyTo, setReplyTo] = useState("");
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [chatMsg, setChatMsg] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  // Поле «перейти к №» в бирюзовой полосе под темой (как на форуме)
  const [gotoNum, setGotoNum] = useState("");
  // Ответ на конкретное сообщение в свободном чате
  const [chatReplyTo, setChatReplyTo] = useState<{ id: string; nick: string } | null>(null);
  const [chatReplyText, setChatReplyText] = useState("");
  const [chatReplyBusy, setChatReplyBusy] = useState(false);
  const [chatReplyError, setChatReplyError] = useState("");

  useEffect(() => {
    fetch("/api/bootstrap").then((r) => r.json()).then((r) => { if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings }); }).catch(() => {});
  }, []);

  // Load house data, topic data, or chat data depending on params
  useEffect(() => {
    setLoading(true);
    setError("");
    const t = getToken();
    if (topicId) {
      setChatData(null);
      fetch(`/api/houses/topics/${topicId}?token=${encodeURIComponent(t)}`)
        .then(async (r) => { const d = await r.json(); if (!r.ok) throw Error(d.error); return d; })
        .then(setTopicData)
        .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
        .finally(() => setLoading(false));
    } else if (branchId) {
      // Check if this is the free chat branch
      fetch(`/api/houses/${params.id}/topics?token=${encodeURIComponent(t)}&branchId=${branchId}`)
        .then(async (r) => { const d = await r.json(); if (!r.ok) throw Error(d.error); return d; })
        .then(async (d) => {
          setData(d);
          const br = d.branches.find((b: Branch) => b.id === branchId);
          if (br && br.title === "Свободный чат жителей") {
            // Load chat messages
            const cr = await fetch(`/api/houses/${params.id}/chat?token=${encodeURIComponent(t)}`);
            const cd = await cr.json();
            setChatData(cd);
          } else {
            setChatData(null);
          }
          if (d.branches.length > 0) setQfBranch(branchId || d.branches[0].id);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
        .finally(() => setLoading(false));
    } else {
      setTopicData(null);
      setChatData(null);
      fetch(`/api/houses/${params.id}/topics?token=${encodeURIComponent(t)}`)
        .then(async (r) => { const d = await r.json(); if (!r.ok) throw Error(d.error); return d; })
        .then((d) => { setData(d); if (d.branches.length > 0) setQfBranch(d.branches[0].id); })
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
    if (!qfBranch || !qfBody.trim()) { setQfError("Выберите ветку и напишите сообщение."); return; }
    setQfBusy(true);
    try {
      const r = await fetch(`/api/houses/${params.id}/topics`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t, branchId: qfBranch, title: qfBody.slice(0, 50), body: qfBody }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка");
      // Reload to show new topic
      if (branchId) window.location.href = `/doma/${params.id}?branch=${branchId}`;
      else window.location.href = `/doma/${params.id}`;
    } catch (e) { setQfError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setQfBusy(false); }
  };

  const handleTopicAction = async (tid: string, action: string) => {
    const t = getToken();
    await fetch(`/api/houses/topics/${tid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t, action }),
    });
    if (topicId) window.location.href = `/doma/${params.id}?topic=${topicId}`;
    else router.refresh();
  };

  const handleTopicDelete = async (tid: string) => {
    if (!confirm("Удалить тему безвозвратно?")) return;
    const t = getToken();
    await fetch(`/api/houses/topics/${tid}?token=${encodeURIComponent(t)}`, { method: "DELETE" });
    window.location.href = `/doma/${params.id}`;
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
        body: JSON.stringify({ token: t, body: reply, parentId: replyTo }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка");
      setReply("");
      setReplyTo("");
      // Reload topic
      window.location.href = `/doma/${params.id}?topic=${topicId}`;
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
    window.location.href = `/doma/${params.id}?topic=${topicId}`;
  };

  // === GOTO MESSAGE BY NUMBER (бирюзовая полоса «перейти к №» как на форуме) ===
  const handleGotoMsg = (n: number) => {
    if (!n || n < 1) return;
    const el = document.querySelector(`.sk-msg[data-msgnum="${n}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Краткая подсветка целевого сообщения
      const prevBg = el.style.background;
      el.style.transition = "background 0.3s ease";
      el.style.background = "#fff7d6";
      setTimeout(() => { el.style.background = prevBg; }, 1200);
    }
    setGotoNum("");
  };

  // === CHAT HANDLERS ===
  const handleChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setChatError("");
    const t = getToken();
    if (!t) { setChatError("Войдите на форум, чтобы писать."); return; }
    if (!chatMsg.trim()) return;
    setChatBusy(true);
    try {
      const r = await fetch(`/api/houses/${params.id}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t, body: chatMsg }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка");
      setChatMsg("");
      // Reload chat
      const cr = await fetch(`/api/houses/${params.id}/chat?token=${encodeURIComponent(t)}`);
      const cd = await cr.json();
      setChatData(cd);
    } catch (e) { setChatError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setChatBusy(false); }
  };

  const handleChatDelete = async (msgId: string) => {
    if (!confirm("Удалить сообщение?")) return;
    const t = getToken();
    await fetch(`/api/houses/${params.id}/chat?msgId=${msgId}&token=${encodeURIComponent(t)}`, { method: "DELETE" });
    const cr = await fetch(`/api/houses/${params.id}/chat?token=${encodeURIComponent(t)}`);
    const cd = await cr.json();
    setChatData(cd);
  };

  // Ответ на конкретное сообщение в свободном чате (с parentId)
  const handleChatReply = async (e: React.FormEvent) => {
    e.preventDefault();
    setChatReplyError("");
    const t = getToken();
    if (!t) { setChatReplyError("Войдите на форум, чтобы писать."); return; }
    if (!chatReplyText.trim() || !chatReplyTo) return;
    setChatReplyBusy(true);
    try {
      const r = await fetch(`/api/houses/${params.id}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t, body: chatReplyText, parentId: chatReplyTo.id }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка");
      setChatReplyText("");
      setChatReplyTo(null);
      // Reload chat
      const cr = await fetch(`/api/houses/${params.id}/chat?token=${encodeURIComponent(t)}`);
      const cd = await cr.json();
      setChatData(cd);
    } catch (e) { setChatReplyError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setChatReplyBusy(false); }
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
          <button onClick={() => window.location.href = `/doma/${params.id}`} style={{ marginTop: "12px", color: "#0a5caa", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "15px" }}>← Назад в дом</button>
        </div>
      </div>
      <SiteFooter settings={settings} />
    </div>
  );

  const icons = ["🔧", "🌳", "💬"];
  const colors = ["#0a5caa", "#0a7d75", "#b45309"];

  // === TOPIC VIEW (?topic=ID) — один в один как на форуме ===
  if (topicId && topicData) {
    const tp = topicData.topic;
    const TEAL = "#249790";
    const PAD = 30;
    // Дерево: topic body = корневой узел, messages = ответы
    const childrenMap = new Map<string, Msg[]>();
    for (const m of topicData.messages) {
      const key = m.parentId || "";
      if (!childrenMap.has(key)) childrenMap.set(key, []);
      childrenMap.get(key)!.push(m);
    }
    // Карта ID → автор (для пометки «ответ на сообщение от Автор»)
    const authorById = new Map(topicData.messages.map(m => [m.id, m.authorNick]));
    // Нумерация #1, #2, #3...
    const sortedMsgs = [...topicData.messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const numById = new Map(sortedMsgs.map((m, i) => [m.id, i + 1]));
    // Границы видимых номеров для подписи в бирюзовой полосе «Ответы 1 - N из N»
    const totalMsgs = sortedMsgs.length;
    const firstNum = totalMsgs ? 1 : 0;
    const lastNum = totalMsgs;

    function renderMsg(msg: Msg, level: number): React.ReactNode {
      const children = childrenMap.get(msg.id) || [];
      const num = numById.get(msg.id) || "?";
      const parentAuthor = msg.parentId ? authorById.get(msg.parentId) : null;
      const parentNum = msg.parentId ? numById.get(msg.parentId) : null;
      return (
        <div key={msg.id} style={{ position: "relative", marginBottom: "8px" }}>
          <div className="sk-msg" data-msgnum={num} style={{ position: "relative", zIndex: 1 }}>
            <div className="sk-msg-head">
              <a className="sk-msg-num" title="Ссылка на это сообщение">#{num}</a>
              <span className="sk-msg-author" style={{ fontWeight: 700, color: "#1E3A5F", fontSize: "13px" }}>{msg.authorNick}</span>
              <span className="sk-msg-time" style={{ fontSize: "12px", color: "#56657a" }}>{new Date(msg.createdAt).toLocaleString("ru-RU")}</span>
              <span className="sk-msg-spacer" />
              <div className="sk-msg-actions">
                <button className="sk-btn-answer sk-btn-answer-in-msg" onClick={() => setReplyTo(msg.id)} title="Ответить на это сообщение">Ответить</button>
                {topicData.isModerator && (
                  <button className="sk-flood-btn sk-msg-del" onClick={async () => {
                    if (!confirm("Удалить сообщение?")) return;
                    const t = getToken();
                    await fetch(`/api/houses/topics/${topicId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: t, msgId: msg.id }) });
                    window.location.href = `/doma/${params.id}?topic=${topicId}`;
                  }}>Удалить</button>
                )}
              </div>
            </div>
            <div className="sk-msg-body">
              {parentAuthor ? (
                <a className="sk-msg-parent sk-msg-parent-in-body" title={`Ответ на сообщение №${parentNum} от ${parentAuthor}`}>
                  └ ответ на #{parentNum} от {parentAuthor}
                </a>
              ) : (
                <span className="sk-msg-parent sk-msg-parent-in-body" style={{ color: "#0a5caa", fontSize: "12px", fontWeight: 600 }}>
                  └ ответ на тему
                </span>
              )}
              {msg.body}
            </div>
          </div>
          {children.length > 0 && (
            <div style={{ position: "relative", marginTop: "4px" }}>
              {children.map((child, idx) => {
                const isLast = idx === children.length - 1;
                return (
                  <div key={child.id} style={{ position: "relative", paddingLeft: PAD + "px", marginBottom: "4px" }}>
                    <div style={{ position: "absolute", left: "12px", top: "-16px", height: isLast ? "28px" : "calc(100% + 20px)", width: "2px", background: TEAL, zIndex: 0 }} />
                    <div style={{ position: "absolute", left: "12px", top: "10px", width: "20px", height: "2px", background: TEAL, zIndex: 0 }} />
                    {renderMsg(child, Math.min(level + 1, 4))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="sm-page flex min-h-screen flex-col">
        <Masthead settings={settings} />
        <MainNav current="useful" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
        <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
          <div className="doma-topic" style={{ width: "100%", maxWidth: 900, margin: "0 auto", padding: "16px", boxSizing: "border-box" }}>
            {/* Хлебные крошки — как на форуме */}
            <div className="sk-crumbs forum-cat-crumbs">
              <a onClick={() => window.location.href = "/doma"} style={{ cursor: "pointer" }}>Дома и СНТ</a>
              <span className="sep"> → </span>
              <a onClick={() => window.location.href = `/doma/${params.id}`} style={{ cursor: "pointer" }}>{data?.house ? `${data.house.city}, ${data.house.street}, ${data.house.houseNumber}` : "Дом"}</a>
              <span className="sep"> → </span>
              <span>{tp.title}</span>
            </div>

            {/* Шапка темы — один в один как .sk-topicbox на форуме */}
            <div className="sk-topicbox">
              <div className="t-title">
                <span className="t-title-text">
                  {tp.title}
                  {tp.pinned && <span className="sk-tstatus pinned">Закреплена</span>}
                  {tp.closed && <span className="sk-tstatus closed">Тема закрыта</span>}
                </span>
                <button className="sk-btn-answer sk-btn-answer-in-title" onClick={() => { if (tp.closed) return; document.getElementById("reply-form")?.scrollIntoView({ behavior: "smooth" }); }}>Ответить</button>
              </div>
              <div className="t-meta">
                Автор: <b style={{ color: "#1E3A5F" }}>{tp.authorNick}</b> · создана {new Date(tp.createdAt).toLocaleDateString("ru-RU")} · ответов: {topicData.messages.length}
              </div>
            </div>

            {/* Админ-кнопки темы — как .sk-topicactions на форуме */}
            {topicData.isModerator && (
              <div className="sk-topicactions">
                <button onClick={() => handleTopicActionDetail(tp.pinned ? "unpin" : "pin")}>{tp.pinned ? "Открепить тему" : "Закрепить тему"}</button>
                <button onClick={() => handleTopicActionDetail(tp.closed ? "open" : "close")}>{tp.closed ? "Открыть тему" : "Закрыть тему"}</button>
                <button className="sk-topicdel" onClick={() => { if (confirm("Удалить тему?")) handleTopicDelete(topicId || ""); }}>Удалить тему</button>
              </div>
            )}

            {/* Бирюзовая полоса с количеством ответов — как .sk-pager на форуме */}
            <div className="sk-pager">
              <span>Ответы {firstNum} - {lastNum} из <b>{totalMsgs}</b></span>
              <span className="pg-goto">
                <span>перейти к №</span>
                <input
                  value={gotoNum}
                  onChange={(e) => setGotoNum(e.target.value.replace(/[^0-9]/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && gotoNum) handleGotoMsg(parseInt(gotoNum));
                  }}
                  aria-label="Перейти к сообщению по номеру"
                />
                <a
                  onClick={() => { if (gotoNum) handleGotoMsg(parseInt(gotoNum)); }}
                  title="Перейти к сообщению"
                >»</a>
              </span>
            </div>

            {/* Дерево ответов — лесница с бирюзовыми линиями */}
            <div className="sakh-comments-container cc-container" style={{ position: "relative" }}>
              {(() => {
                const roots = childrenMap.get("") || [];
                if (roots.length === 0) return <div style={{ padding: "20px", textAlign: "center", color: "#56657a", fontSize: "14px" }}>Нет ответов. Напишите первым!</div>;
                return roots.map(root => renderMsg(root, 0));
              })()}
            </div>

            {/* Вторая бирюзовая полоса снизу — как на форуме (для симметрии) */}
            <div className="sk-pager">
              <span>Ответы {firstNum} - {lastNum} из <b>{totalMsgs}</b></span>
              <span className="pg-goto">
                <span>перейти к №</span>
                <input
                  value={gotoNum}
                  onChange={(e) => setGotoNum(e.target.value.replace(/[^0-9]/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && gotoNum) handleGotoMsg(parseInt(gotoNum));
                  }}
                  aria-label="Перейти к сообщению по номеру"
                />
                <a
                  onClick={() => { if (gotoNum) handleGotoMsg(parseInt(gotoNum)); }}
                  title="Перейти к сообщению"
                >»</a>
              </span>
            </div>

            {/* Форма быстрого ответа — как .sk-qr на форуме */}
            <div className="sk-qr" id="reply-form">
              <div className="sk-qr-label">Быстрый ответ в теме:</div>
              {!tp.closed ? (
                <>
                  {replyTo && (
                    <div className="sk-qr-target">
                      Ответ на сообщение
                      <button onClick={() => setReplyTo("")}>отменить ×</button>
                    </div>
                  )}
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Напишите ваше мнение…" maxLength={10000} />
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <button className="sk-btn-classic" disabled={replyBusy || !reply.trim()} onClick={handleReply as any}>{replyBusy ? "Проверка…" : "Отправить мнение"}</button>
                  </div>
                  {replyError && <div style={{ color: "#c40000", fontSize: "13px", marginTop: "6px" }}>{replyError}</div>}
                </>
              ) : (
                <div className="sk-note">Тема закрыта для новых сообщений.</div>
              )}
            </div>
          </div>
          <SiteFooter settings={settings} />
        </div>
      </div>
    );
  }

  // === FREE CHAT VIEW (?branch=freeChatBranchId) ===
  if (chatData && branchId) {
    const chatTotal = chatData.messages.length;
    const chatFirst = chatTotal ? 1 : 0;
    const chatLast = chatTotal;
    return (
      <div className="sm-page flex min-h-screen flex-col">
        <Masthead settings={settings} />
        <MainNav current="useful" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
        <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
          <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", padding: "16px", boxSizing: "border-box" }}>
            <button onClick={() => window.location.href = `/doma/${params.id}`} style={{ color: "#0a5caa", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "15px", marginBottom: "12px" }}>← Все ветки дома</button>
            <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#1E3A5F", margin: "0 0 16px" }}>💬 Свободный чат жителей</h1>

            {/* Бирюзовая полоса с количеством сообщений — как .sk-pager на форуме */}
            <div className="sk-pager">
              <span>Сообщения {chatFirst} - {chatLast} из <b>{chatTotal}</b></span>
            </div>

            {/* Лента сообщений */}
            <div style={{ marginBottom: "20px" }}>
              {chatData.messages.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "#56657a", fontSize: "14px", background: "#f8fafc", borderRadius: "4px" }}>Пока нет сообщений. Напишите первое!</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {/* Карта ID → ник для пометки «ответ на @Ник» */}
                  {(() => {
                    const nickById = new Map(chatData.messages.map((m) => [m.id, m.authorNick]));
                    return chatData.messages.map((m) => {
                      const parentNick = m.parentId ? nickById.get(m.parentId) : null;
                      const isReplyTarget = chatReplyTo?.id === m.id;
                      return (
                        <div key={m.id} style={{
                          background: isReplyTarget ? "#fff7d6" : "#fff",
                          border: isReplyTarget ? "2px solid #b45309" : "1px solid #d0d9e6",
                          borderRadius: "4px", padding: "12px 16px",
                        }}>
                          <div style={{ fontSize: "13px", color: "#56657a", marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <b style={{ color: "#1E3A5F" }}>{m.authorNick}</b>
                            <span>{new Date(m.createdAt).toLocaleString("ru-RU")}</span>
                            {/* Пометка «↪ ответ на @Ник» */}
                            {parentNick && (
                              <span style={{ color: "#0a7d75", fontSize: "12px", fontWeight: 600 }}>
                                ↪ ответ на @{parentNick}
                              </span>
                            )}
                            {/* Кнопки */}
                            <span style={{ display: "flex", gap: "6px", marginLeft: "auto", flexShrink: 0 }}>
                              <button
                                onClick={() => { setChatReplyTo({ id: m.id, nick: m.authorNick }); setChatReplyText(""); setChatReplyError(""); }}
                                style={{ fontSize: "11px", color: "#0a5caa", background: "none", border: "1px solid #0a5caa44", borderRadius: "3px", cursor: "pointer", padding: "1px 8px", fontFamily: "inherit" }}
                              >Ответить</button>
                              {chatData.isModerator && (
                                <button onClick={() => handleChatDelete(m.id)} style={{ fontSize: "11px", color: "#c40000", background: "none", border: "1px solid #c4000044", borderRadius: "3px", cursor: "pointer", padding: "1px 6px", fontFamily: "inherit" }}>Удалить</button>
                              )}
                            </span>
                          </div>
                          <div style={{ fontSize: "15px", color: "#2A3B50", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.body}</div>
                          {/* Inline-форма ответа — открывается под сообщением */}
                          {isReplyTarget && (
                            <form onSubmit={handleChatReply} style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed #c0cad8" }}>
                              <div style={{ fontSize: "12px", color: "#56657a", marginBottom: "6px" }}>
                                Ответ на сообщение от <b style={{ color: "#1E3A5F" }}>{m.authorNick}</b>
                                <button type="button" onClick={() => { setChatReplyTo(null); setChatReplyText(""); setChatReplyError(""); }} style={{ marginLeft: "8px", fontSize: "11px", color: "#c40000", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>отменить ×</button>
                              </div>
                              <textarea
                                value={chatReplyText}
                                onChange={(e) => setChatReplyText(e.target.value)}
                                placeholder={`Ответ @${m.authorNick}…`}
                                rows={2}
                                autoFocus
                                maxLength={5000}
                                style={{ width: "100%", padding: "8px 12px", border: "1px solid #4A688C", borderRadius: "4px", fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }}
                              />
                              {chatReplyError && <div style={{ color: "#c40000", fontSize: "12px", marginTop: "4px" }}>{chatReplyError}</div>}
                              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
                                <button type="submit" disabled={chatReplyBusy || !chatReplyText.trim()} style={{ padding: "6px 16px", background: "#0a7d75", color: "#fff", border: "none", borderRadius: "4px", fontSize: "14px", fontWeight: 700, fontFamily: "inherit", cursor: chatReplyBusy || !chatReplyText.trim() ? "wait" : "pointer" }}>
                                  {chatReplyBusy ? "…" : "Отправить ответ"}
                                </button>
                              </div>
                            </form>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* Вторая бирюзовая полоса снизу — как на форуме */}
            <div className="sk-pager">
              <span>Сообщения {chatFirst} - {chatLast} из <b>{chatTotal}</b></span>
            </div>

            {/* Форма отправки */}
            <form onSubmit={handleChatSend} style={{ position: "sticky", bottom: "0", background: "#fff", padding: "12px 0", borderTop: "2px solid #eef2f6" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="text" value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} placeholder="Написать сообщение…" style={{ flex: 1, padding: "10px 14px", border: "1px solid #4A688C", borderRadius: "4px", fontSize: "15px", fontFamily: "inherit" }} />
                <button type="submit" disabled={chatBusy} style={{ padding: "10px 20px", background: "#0a7d75", color: "#fff", border: "none", borderRadius: "4px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: chatBusy ? "wait" : "pointer", flexShrink: 0 }}>
                  {chatBusy ? "…" : "Отправить"}
                </button>
              </div>
              {chatError && <div style={{ color: "#c40000", fontSize: "13px", marginTop: "6px" }}>{chatError}</div>}
            </form>
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
              <button onClick={() => window.location.href = `/doma/${params.id}`} style={{ color: "#0a5caa", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "15px" }}>← Все ветки дома</button>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1E3A5F", marginTop: "8px" }}>{activeBranch.title}</h2>
            </div>
          )}

          {/* Ветки — только если не просматриваем конкретную ветку */}
          {!activeBranch && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {data.branches.map((b, i) => {
                const bc = data.branchCounts.find((c) => c.branchId === b.id);
                return (
                  <button key={b.id} onClick={() => window.location.href = `/doma/${params.id}?branch=${b.id}`}
                    style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 18px", background: "#fff", border: `1px solid ${colors[i % 3]}33`, borderLeft: `4px solid ${colors[i % 3]}`, borderRadius: "4px", cursor: "pointer", fontSize: "16px", fontFamily: "inherit", textAlign: "left", width: "100%", boxSizing: "border-box" }}>
                    <span style={{ fontSize: "28px" }}>{icons[i % 3]}</span>
                    <span style={{ flex: 1, fontWeight: 600, color: "#1E3A5F" }}>{b.title}</span>
                    <span style={{ fontSize: "13px", color: "#56657a", flexShrink: 0 }}>{pluralTopics(bc?.topicsCount ?? 0)}</span>
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
            {/* Бирюзовая полоса с количеством тем — как .sk-pager на форуме */}
            <div className="sk-pager">
              <span>Темы {data.topics.length ? 1 : 0} - {data.topics.length} из <b>{data.topics.length}</b></span>
            </div>
            {data.topics.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#56657a", fontSize: "14px", background: "#f8fafc", borderRadius: "4px" }}>Пока нет ни одной темы. Создайте первую — форму ниже.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {data.topics.map((t) => {
                  const br = data.branches.find((b) => b.id === t.branchId);
                  return (
                    <div key={t.id} style={{ background: "#fff", border: "1px solid #d0d9e6", borderRadius: "4px", padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                        <button onClick={() => window.location.href = `/doma/${params.id}?topic=${t.id}`}
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
            {/* Вторая бирюзовая полоса снизу — как на форуме */}
            <div className="sk-pager">
              <span>Темы {data.topics.length ? 1 : 0} - {data.topics.length} из <b>{data.topics.length}</b></span>
            </div>
          </div>

          {/* Форма создания темы — только внутри ветки (не на главной) и не в свободном чате */}
          {activeBranch && activeBranch.title !== "Свободный чат жителей" && (
            <div style={{ background: "#f8fafc", border: "1px solid #d0d9e6", borderRadius: "6px", padding: "16px 20px", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1E3A5F", margin: "0 0 12px" }}>Создать тему</h3>
              <form onSubmit={handleQuickSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <textarea value={qfBody} onChange={(e) => setQfBody(e.target.value)} placeholder="Напишите сообщение…" rows={3} style={{ width: "100%", padding: "8px 12px", border: "1px solid #4A688C", borderRadius: "4px", fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
                {qfError && <div style={{ color: "#c40000", fontSize: "13px", fontWeight: 600 }}>{qfError}</div>}
                <button type="submit" disabled={qfBusy} style={{ padding: "10px 20px", background: "#0a7d75", color: "#fff", border: "none", borderRadius: "4px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: qfBusy ? "wait" : "pointer", width: "100%", boxSizing: "border-box" }}>
                  {qfBusy ? "Отправка…" : "Создать тему"}
                </button>
              </form>
            </div>
          )}

          {/* Кнопка возврата */}
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
