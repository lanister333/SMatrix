"use client";

/**
 * 2026-10-01: экран профиля пользователя (роут /user/[nick]).
 * Каркас общий с другими страницами: Masthead + MainNav + 3 колонки + SiteFooter.
 * В центре — профиль (ник, дата регистрации, счётчики, списки тем и сообщений).
 * Источник: GET /api/users/[nick].
 */

import { useEffect, useState, useCallback } from "react";
import {
  DEFAULT_SETTINGS,
  isStaffRole,
  MainNav,
  Masthead,
  SiteFooter,
  useAuth,
  type SiteSettings,
} from "@/components/site/chrome";
import ForumSideNav from "@/components/site/left-nav";
import HomeRight from "@/components/site/home-right";
import { Nick, fmtDate, fmtDateTime } from "@/lib/ui";

/** Ключи навигации → URL. */
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
};

interface ProfileData {
  user: {
    id: string;
    nickname: string;
    gender: string;
    createdAt: string;
    city: string;
    phone: string;
    bio: string;
    email: string;
    newsletterSubscribed: boolean;
    notificationsSubscribed: boolean;
    orgRep: boolean;
    orgName: string;
  };
  topicsCount: number;
  messagesCount: number;
  topics: Array<{
    id: number;
    title: string;
    isArchived: boolean;
    isClosed: boolean;
    createdAt: string;
    views: number;
    rubricName?: string;
    answers?: number;
  }>;
  messages: Array<{
    id: string;
    num: number;
    snippet: string;
    createdAt: string;
    topicId: number;
    topicTitle: string;
  }>;
  topicsShown: number;
  messagesShown: number;
}

export default function UserScreen() {
  // 2026-10-01: ник читаем из URL (/user/[nick]) на стороне клиента —
  // не передаём через props из page.tsx (async server component вызывал
  // проблемы с гидрацией — страница застревала на «Загрузка профиля…»).
  const nick = typeof window !== "undefined"
    ? decodeURIComponent(window.location.pathname.split("/user/")[1] || "")
    : "";
  const { user, token } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [note, setNote] = useState("");

  // Edit form state
  const [eCity, setECity] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eBio, setEBio] = useState("");
  const [eGender, setEGender] = useState("unspecified");
  const [eNewsletter, setENewsletter] = useState(false);
  const [eNotif, setENotif] = useState(false);
  // Password form state
  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");

  const isOwn = !!(user && data && data.user.id === user.id);

  useEffect(() => {
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then((r) => {
        if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setError("");
    fetch(`/api/users/${encodeURIComponent(nick)}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error("Пользователь не найден"))))
      .then((d: ProfileData) => {
        setData(d);
        setECity(d.user.city);
        setEPhone(d.user.phone);
        setEBio(d.user.bio);
        setEGender(d.user.gender);
        setENewsletter(d.user.newsletterSubscribed);
        setENotif(d.user.notificationsSubscribed);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
        setData(null);
      });
  }, [nick]);

  const goNav = useCallback((k: string) => {
    window.location.href = NAV_ROUTES[k] ?? "/";
  }, []);

  const openTopic = (id: number) => {
    window.location.href = `/?topic=${id}`;
  };
  const openTopicAt = (topicId: number, num: number) => {
    window.location.href = `/?topic=${topicId}&msg=${num}`;
  };

  const submitEdit = async () => {
    setBusy(true);
    setFormErr("");
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(nick)}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          city: eCity,
          phone: ePhone,
          bio: eBio,
          gender: eGender,
          newsletterSubscribed: eNewsletter,
          notificationsSubscribed: eNotif,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка сохранения");
      setEditOpen(false);
      setNote(d.note || "Профиль обновлён");
      window.setTimeout(() => setNote(""), 4000);
      // Reload profile
      fetch(`/api/users/${encodeURIComponent(nick)}`)
        .then((r) => r.json())
        .then((d: ProfileData) => setData(d))
        .catch(() => {});
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async () => {
    setBusy(true);
    setFormErr("");
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(nick)}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, oldPassword: pwOld, newPassword: pwNew }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка");
      setPwOpen(false);
      setPwOld("");
      setPwNew("");
      setNote(d.note || "Пароль изменён");
      window.setTimeout(() => setNote(""), 4000);
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    if (token) {
      fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => {});
    }
    localStorage.removeItem("sm_auth");
    window.location.href = "/";
  };

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="home" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div className="sk-topbar">
          <span className="tb-title">Профиль пользователя</span>
        </div>
        <div className="sk-shell">
          <div className="sk-layout sk-layout-page main-grid-container">
            <ForumSideNav />
            <div className="sk-col-main center-column">
              <div className="sk-crumbs">
                <a onClick={() => (window.location.href = "/?view=forum")}>Форум</a>
                <span className="sep">→</span>
                <span className="cur">Профиль</span>
              </div>

              {error ? (
                <div className="sk-loading">{error}</div>
              ) : !data ? (
                <div className="sk-loading">Загрузка профиля…</div>
              ) : (
                <>
                  <div className="sk-profilebox">
                    <div className="pb-head">
                      <Nick
                        name={data.user.nickname}
                        gender={data.user.gender}
                        className="pb-nick"
                      />
                      <span className="pb-reg">
                        На форуме с {fmtDate(data.user.createdAt)}
                      </span>
                    </div>
                    <div className="pb-counts">
                      Тем: <b>{data.topicsCount}</b> · Сообщений:{" "}
                      <b>{data.messagesCount}</b>
                    </div>
                    {/* 2026-10-01: дополнительные поля профиля */}
                    <div className="pb-fields">
                      {data.user.city && (
                        <div className="pb-field"><b>Город:</b> {data.user.city}</div>
                      )}
                      {data.user.bio && (
                        <div className="pb-field"><b>О себе:</b> {data.user.bio}</div>
                      )}
                      {data.user.orgRep && data.user.orgName && (
                        <div className="pb-field"><b>Организация:</b> {data.user.orgName} (представитель)</div>
                      )}
                      {isOwn && (
                        <>
                          {data.user.email && (
                            <div className="pb-field"><b>Email:</b> {data.user.email}</div>
                          )}
                          {data.user.phone && (
                            <div className="pb-field"><b>Телефон:</b> {data.user.phone}</div>
                          )}
                          <div className="pb-field">
                            <b>Рассылка:</b> {data.user.newsletterSubscribed ? "✓ подписан" : "не подписан"}
                          </div>
                          <div className="pb-field">
                            <b>Уведомления:</b> {data.user.notificationsSubscribed ? "✓ включены" : "выключены"}
                          </div>
                        </>
                      )}
                    </div>
                    {/* Кнопки управления (только для своего профиля) */}
                    {isOwn && (
                      <div className="pb-actions">
                        <button className="pb-act" onClick={() => { setFormErr(""); setEditOpen(true); }}>
                          ✏️ Редактировать профиль
                        </button>
                        <button className="pb-act" onClick={() => { setFormErr(""); setPwOpen(true); }}>
                          🔑 Изменить пароль
                        </button>
                        <button className="pb-act pb-logout" onClick={handleLogout}>
                          Выйти
                        </button>
                      </div>
                    )}
                  </div>

                  {note && (
                    <div className="sk-loading" style={{ color: "#1e7b34", fontWeight: 700, padding: "8px 0" }}>{note}</div>
                  )}

                  {/* Форма редактирования */}
                  {editOpen && (
                    <div className="sk-modal-overlay" onClick={() => setEditOpen(false)}>
                      <div className="sk-modal" onClick={(e) => e.stopPropagation()} style={{ width: "500px", maxWidth: "100%" }}>
                        <div className="sk-modal-title">
                          <span>Редактировать профиль</span>
                          <button className="sk-modal-x" onClick={() => setEditOpen(false)}>×</button>
                        </div>
                        <div className="sk-modal-body">
                          <div className="sk-modal-row">
                            <label>Пол</label>
                            <select value={eGender} onChange={(e) => setEGender(e.target.value)}>
                              <option value="unspecified">Не указан</option>
                              <option value="male">Мужской</option>
                              <option value="female">Женский</option>
                            </select>
                          </div>
                          <div className="sk-modal-row">
                            <label>Город</label>
                            <input type="text" value={eCity} maxLength={100} onChange={(e) => setECity(e.target.value)} placeholder="Южно-Сахалинск" />
                          </div>
                          <div className="sk-modal-row">
                            <label>Телефон</label>
                            <input type="text" value={ePhone} maxLength={30} onChange={(e) => setEPhone(e.target.value)} placeholder="+7 924 XXX-XX-XX" />
                          </div>
                          <div className="sk-modal-row">
                            <label>О себе</label>
                            <textarea value={eBio} maxLength={500} onChange={(e) => setEBio(e.target.value)} placeholder="Краткая информация о себе" />
                          </div>
                          <div className="sk-modal-row">
                            <label className="complaint-option">
                              <input type="checkbox" checked={eNewsletter} onChange={(e) => setENewsletter(e.target.checked)} />
                              Подписаться на рассылку
                            </label>
                          </div>
                          <div className="sk-modal-row">
                            <label className="complaint-option">
                              <input type="checkbox" checked={eNotif} onChange={(e) => setENotif(e.target.checked)} />
                              Подписаться на уведомления
                            </label>
                          </div>
                          {formErr && <div className="sk-modal-err">{formErr}</div>}
                          <div className="sk-modal-actions">
                            <button className="sk-btn-classic" disabled={busy} onClick={submitEdit}>
                              {busy ? "Сохранение…" : "Сохранить"}
                            </button>
                            <button className="right" onClick={() => setEditOpen(false)}>Отмена</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Форма смены пароля */}
                  {pwOpen && (
                    <div className="sk-modal-overlay" onClick={() => setPwOpen(false)}>
                      <div className="sk-modal" onClick={(e) => e.stopPropagation()} style={{ width: "400px", maxWidth: "100%" }}>
                        <div className="sk-modal-title">
                          <span>Изменить пароль</span>
                          <button className="sk-modal-x" onClick={() => setPwOpen(false)}>×</button>
                        </div>
                        <div className="sk-modal-body">
                          <div className="sk-modal-row">
                            <label>Старый пароль</label>
                            <input type="password" value={pwOld} onChange={(e) => setPwOld(e.target.value)} />
                          </div>
                          <div className="sk-modal-row">
                            <label>Новый пароль (мин. 6 символов)</label>
                            <input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} />
                          </div>
                          {formErr && <div className="sk-modal-err">{formErr}</div>}
                          <div className="sk-modal-actions">
                            <button className="sk-btn-classic" disabled={busy || !pwOld || !pwNew} onClick={submitPassword}>
                              {busy ? "Сохранение…" : "Изменить пароль"}
                            </button>
                            <button className="right" onClick={() => setPwOpen(false)}>Отмена</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="sk-mainheader">Темы пользователя</div>
                  {data.topics.length === 0 ? (
                    <div className="sk-loading">
                      Пользователь пока не создавал тем.
                    </div>
                  ) : (
                    <div className="sk-profilelist">
                      {data.topics.map((t) => (
                        <div
                          key={t.id}
                          className="prow"
                          onClick={() => openTopic(t.id)}
                        >
                          <div className="prow-title">
                            <a>{t.title}</a>
                            {t.isArchived && (
                              <span className="sk-status-badge archived">
                                В архиве
                              </span>
                            )}
                            {!t.isArchived && t.isClosed && (
                              <span className="sk-status-badge closed">
                                Закрыта
                              </span>
                            )}
                          </div>
                          <div className="prow-meta">
                            {t.rubricName && <>{t.rubricName} · </>}
                            создана {fmtDate(t.createdAt)} · ответов:{" "}
                            {t.answers ?? 0} · просмотров: {t.views}
                          </div>
                        </div>
                      ))}
                      {data.topicsCount > data.topicsShown && (
                        <div className="prow-more">
                          Показаны последние {data.topicsShown} тем из{" "}
                          {data.topicsCount}.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="sk-mainheader">Сообщения пользователя</div>
                  {data.messages.length === 0 ? (
                    <div className="sk-loading">
                      Пользователь пока не оставлял сообщений.
                    </div>
                  ) : (
                    <div className="sk-profilelist">
                      {data.messages.map((m) => (
                        <div
                          key={m.id}
                          className="prow"
                          onClick={() => openTopicAt(m.topicId, m.num)}
                        >
                          <div className="prow-title">
                            <a>{m.topicTitle}</a>
                            <span className="sr-badge">
                              сообщение №{m.num}
                            </span>
                          </div>
                          <div className="prow-snippet">{m.snippet}</div>
                          <div className="prow-meta">
                            {fmtDateTime(m.createdAt)}
                          </div>
                        </div>
                      ))}
                      {data.messagesCount > data.messagesShown && (
                        <div className="prow-more">
                          Показаны последние {data.messagesShown} сообщений
                          из {data.messagesCount}.
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <HomeRight />
          </div>
        </div>
        <SiteFooter settings={settings} />
      </div>
    </div>
  );
}
