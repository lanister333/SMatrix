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
    nickname: string;
    gender: string;
    createdAt: string;
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
    rubric?: { name: string } | null;
    _count?: { messages: number };
  }>;
  messages: Array<{
    id: string;
    num: number;
    snippet: string;
    createdAt: string;
    topic: { id: number; title: string };
  }>;
  topicsShown: number;
  messagesShown: number;
}

export default function UserScreen(props: { nick: string }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [data, setData] = useState<ProfileData | null>(null);
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
    setError("");
    fetch(`/api/users/${encodeURIComponent(props.nick)}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error("Пользователь не найден"))))
      .then((d: ProfileData) => setData(d))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
        setData(null);
      });
  }, [props.nick]);

  const goNav = useCallback((k: string) => {
    window.location.href = NAV_ROUTES[k] ?? "/";
  }, []);

  const openTopic = (id: number) => {
    window.location.href = `/?topic=${id}`;
  };
  const openTopicAt = (topicId: number, num: number) => {
    window.location.href = `/?topic=${topicId}&msg=${num}`;
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
                  </div>

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
                            {t.rubric?.name && <>{t.rubric.name} · </>}
                            создана {fmtDate(t.createdAt)} · ответов:{" "}
                            {t._count?.messages ?? 0} · просмотров: {t.views}
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
                          onClick={() => openTopicAt(m.topic.id, m.num)}
                        >
                          <div className="prow-title">
                            <a>{m.topic.title}</a>
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
