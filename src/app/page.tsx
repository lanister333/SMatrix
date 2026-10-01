"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { FolderOpen, MessageSquare } from "lucide-react";
import {
  FAV_KEY,
  Nick,
  fmtDate,
  fmtDateTime,
  fmtNum,
  type ForumUser,
  type Rubric,
} from "@/lib/ui";
import TopicList from "@/components/forum/topic-list";
import TopicView from "@/components/forum/topic-view";
import { AppealModal, AuthModal, NewTopicModal, ResetModal } from "@/components/forum/modals";
import { AboutPage, AppealPage, PlaceholderPage, ProfileView, RulesPage, SearchPage, SectionPage } from "@/components/forum/pages";
import { AdminPanel, type AdminSection } from "@/components/forum/admin";
// ШАГ 16 (исправление): шапка, навигация и авторизация общие с самостоятельной страницей /help
import { DEFAULT_SETTINGS, isStaffRole, MainNav, Masthead, SiteFooter, useAuth, type SiteSettings } from "@/components/site/chrome";
// ШАГ 27 (макет главной): центральный и правый столбцы главной по согласованному макету
import HomeCenter from "@/components/site/home-center";
import HomeRight from "@/components/site/home-right";
import SakhDatetimeBlock from "@/components/site/sakh-datetime-block";
// ЗАДАЧА 14 (Шаг №4): иконки скоупов и рубрик — единый источник с левой
// колонкой внутренних страниц (src/components/site/left-nav.tsx)
import { ForumDiscussCard, SCOPE_ICONS, rubricIcon } from "@/components/site/left-nav";

/** ШАГ 11: информация о санкции из /api/sanctions/me. */
interface SanctionInfoLite {
  id: string;
  kind: string;
  kindLabel: string;
  reason: string;
  source: string;
  expiresAt: string | null;
  permanent: boolean;
  createdAt: string;
  appealStatus: string;
}

function useFavorites() {
  const [ids, setIds] = useState<number[]>([]);
  useEffect(() => {
    let alive = false;
    Promise.resolve().then(() => {
      if (alive) return;
      try {
        const raw = localStorage.getItem(FAV_KEY);
        if (raw) setIds(JSON.parse(raw));
      } catch {}
    });
    return () => {
      alive = true;
    };
  }, []);
  const toggle = useCallback(
    (id: number) => {
      setIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        localStorage.setItem(FAV_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );
  const has = useCallback((id: number) => ids.includes(id), [ids]);
  return { ids, toggle, has };
}

const BANNERS = [
  { cls: "red", b1: "World Class", b2: "797-999" },
  { cls: "gray1", b1: "Дизайн Куле", b2: "ул. Есенина 15-А" },
  { cls: "gray2", b1: "Шиномонтаж и Балансировка колес", b2: "" },
  { cls: "yellow", b1: "Внимание!", b2: "Изготовление дубликатов номеров" },
];

function PinnedAndRules({ onOpenTopic }: { onOpenTopic: (id: number) => void }) {
  const [topics, setTopics] = useState<{ id: number; title: string; answers: number; views: number; lastActivityAt: string }[]>([]);
  useEffect(() => {
    fetch("/api/topics?scope=pinned&perPage=8")
      .then(async (r) => (r.ok ? r.json() : { topics: [] }))
      .then((r) => setTopics(r.topics || []))
      .catch(() => setTopics([]));
  }, []);
  // ТЗ 2026-09-21: поиск служебной темы правил больше не нужен —
  // ссылка «Читать правила полностью» ведёт на страницу /rules.php.
  return (
    <>
      <div className="sk-sidezone">
        <div className="sk-blocktitle">
          <span className="tri">▼</span>Закреплённые темы
        </div>
        <ul className="sk-navlist sk-pinned">
          {topics.length === 0 && <li className="sk-pinned-empty">Пока нет закреплённых тем</li>}
          {topics.map((t) => (
            <li key={t.id}>
              <a onClick={() => onOpenTopic(t.id)}>{t.title}</a>
              <span className="sk-pinned-meta">
                {t.answers} отв. · {fmtNum(t.views)} просм. · {fmtDate(t.lastActivityAt)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="sk-sidezone">
        <div className="sk-blocktitle">
          <span className="tri">▼</span>Правила форума
        </div>
        <ul className="sk-ruleslist">
          <li>Без оскорблений и переходов на личности</li>
          <li>Реклама — только в разделе «Товары и услуги» и без спама</li>
          <li>Политика — вне форума</li>
          <li>Один вопрос — одна тема, дубли удаляются</li>
          <li>За порядком следит ИИ-модерация: нарушения скрываются, решения можно обжаловать</li>
        </ul>
        {/* ТЗ 2026-09-21: ссылка ведёт на СТРАНИЦУ правил /rules.php
            (пункт меню «Ещё» №1), а не на служебную тему; страница правил
            существует постоянно — условие на закреплённую тему убрано */}
        <a className="sk-ruleslink" href="/rules.php">
          Читать правила полностью »
        </a>
      </div>
    </>
  );
}

/** Иконки скоупов/рубрик перенесены в src/components/site/left-nav.tsx
 *  (ЗАДАЧА 14, Шаг №4): единый источник для левой колонки Главной и
 *  внутренних страниц — вид колонок гарантированно не расходится. */

function Sidebar(props: {
  rubrics: Rubric[];
  user: ForumUser | null;
  scope: string;
  rubricFilter: { slug: string; name: string } | null;
  open: boolean;
  /** ШАГ 27: на главной левая колонка — без «Добавить тему» и строки входа (по макету). */
  homeMode?: boolean;
  onScope: (s: string) => void;
  onRubric: (r: { slug: string; name: string } | null) => void;
  onAddTopic: () => void;
  onNeedAuth: () => void;
  onLogout: () => void;
  onGoAdmin: () => void;
  onOpenProfile: (n: string) => void;
}) {
  const { rubrics, scope, rubricFilter } = props;
  const [expanded, setExpanded] = useState<string | null>(null);
  const service = rubrics.find((r) => r.isService);
  const modAsk = service?.children?.find((c) => c.name.toLowerCase().includes("модератору"));
  return (
    <aside className={`sk-col-left left-column ${props.open ? "open" : ""}`}>
      {/* ШАГ 27: на главной строки «Добавить тему» и «Вы не вошли…» нет — вход/регистрация
          только в верхней синей навигации (финальное уточнение макета); на форумных
          видах блок остаётся: быстрый доступ к созданию темы */}
      {/* ТЗ 2026-09-21: в блоке оставлена ТОЛЬКО ссылка «Добавить тему» (без »),
          строки «Вы вошли/Вы не вошли…» удалены; ссылка — строго по центру блока
          по горизонтали и вертикали (класс .sk-sideblock-addtopic в globals.css) */}
      {!props.homeMode && (
        <div className="sk-sideblock sk-sideblock-addtopic">
          <a className="sk-addtopic" onClick={props.onAddTopic}>
            Добавить тему
          </a>
        </div>
      )}
      <div className="sk-sideblock">
        <div className="sk-blocktitle">
          <span className="tri">▼</span>Навигация
        </div>
        <ul className="sk-navlist">
          {[
            { key: "new", label: "Новые сообщения" },
            { key: "popular", label: "Популярные темы" },
            { key: "active", label: "Активные темы" },
            { key: "mine", label: "Мои темы" },
            { key: "participated", label: "Мои сообщения" },
            { key: "favorites", label: "Избранное" },
            { key: "archive", label: "Архив тем" },
          ].map((s) => {
            const Ico = SCOPE_ICONS[s.key] ?? MessageSquare;
            return (
              <li key={s.key} className="sk-navico-row">
                <Ico size={13} strokeWidth={2.1} className="sk-navico" aria-hidden="true" />
                <a className={scope !== s.key || rubricFilter ? "" : "active"} onClick={() => props.onScope(s.key)}>
                  {s.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="sk-sideblock">
        <div className="sk-blocktitle">
          <span className="tri">▼</span>Рубрики форума
        </div>
        <ul className="sk-navlist">
          {rubrics
            .filter((r) => !r.isService)
            .map((r) => {
              const RIco = rubricIcon(r.name);
              return (
                /* ФИКС вертикальной раскладки рубрик: li — обычный блок.
                 Гибовая строка (иконка + название + стрелка) — только
                 .sk-rubric-header; ul.sk-sublist — БРАТ заголовка, поэтому
                 подрубрики опускаются ВНИЗ под названием и ничего не сдвигается. */
              <li key={r.id} className="sk-rubric-row">
                <div className="sk-rubric-header">
                  <RIco size={13} strokeWidth={2.1} className="sk-navico" aria-hidden="true" />
                  <button
                    className={`sk-rubric-name ${rubricFilter?.slug === r.slug ? "active" : ""}`}
                    onClick={() => {
                      if (rubricFilter?.slug === r.slug) {
                        props.onRubric(null);
                        setExpanded(null);
                        return;
                      }
                      props.onRubric({ slug: r.slug, name: r.name });
                      setExpanded(expanded === r.slug ? null : r.slug);
                    }}
                  >
                    {r.name}
                    {r.children.length > 0 && (
                      <span className={`arr ${expanded === r.slug ? "open" : ""}`}>▶</span>
                    )}
                  </button>
                </div>
                {expanded === r.slug && r.children.length > 0 && (
                  <ul className="sk-sublist">
                    {r.children.map((c) => (
                      <li key={c.id}>
                        <button
                          className={rubricFilter?.slug === c.slug ? "active" : ""}
                          onClick={() => props.onRubric({ slug: c.slug, name: `${r.name} → ${c.name}` })}
                        >
                          {c.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
              );
            })}
        </ul>
      </div>
      {/* Директива «Чистка навигации» + Stage 2 (поднятие блока): карточка
          «Обсудить на форуме» — под основным вертикальным меню рубрик,
          ВЫШЕ «Служебный раздел» (как и на внутренних страницах left-nav.tsx);
          в неё перенесены все рубрики, убранные из меню «Ещё» (кроме «Знакомств»).
          «Служебный раздел» — в самом низу левой колонки. */}
      <ForumDiscussCard />
      <div className="sk-sideblock">
        <div className="sk-blocktitle">
          <span className="tri">▼</span>Служебный раздел
        </div>
        <ul className="sk-navlist">
          {modAsk ? (
            <li className="sk-navico-row">
              <FolderOpen size={13} strokeWidth={2.1} className="sk-navico" aria-hidden="true" />
              <a className={rubricFilter?.slug === modAsk.slug ? "active" : ""} onClick={() => props.onRubric({ slug: modAsk.slug, name: modAsk.name })}>
                Предложения и вопросы модератору
              </a>
            </li>
          ) : null}
          {props.user && isStaffRole(props.user.role) && (
            <li className="sk-navico-row">
              <MessageSquare size={13} strokeWidth={2.1} className="sk-navico" aria-hidden="true" />
              <a onClick={props.onGoAdmin}>ИИ-модерация и защита</a>
            </li>
          )}
        </ul>
      </div>
    </aside>
  );
}

export default function App() {
  const [view, setView] = useState("home");
  const { user, token, login, logout } = useAuth();
  // ШАГ 27: запрос из навигационного поиска «Поиск по форуму...» для view="search"
  const [searchQ, setSearchQ] = useState("");
  const favorites = useFavorites();
  const [authOpen, setAuthOpen] = useState(false);
  // biz-rotator: баннер «Открыли новый бизнес на острове?» открывает окно сразу
  // на вкладке «Регистрация»; все прочие точки входа явно ставят вкладку «Вход».
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const openRegister = useCallback(() => {
    setAuthTab("register");
    setAuthOpen(true);
  }, []);
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [scope, setScope] = useState("new");
  const [rubricFilter, setRubricFilter] = useState<{ slug: string; name: string } | null>(null);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [topicId, setTopicId] = useState<number | null>(null);
  const [jumpMsg, setJumpMsg] = useState<number | null>(null);
  const [profileNick, setProfileNick] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  // ШАГ 11: санкции текущего пользователя + цель апелляции
  const [restriction, setRestriction] = useState<SanctionInfoLite | null>(null);
  const [warning, setWarning] = useState<SanctionInfoLite | null>(null);
  const [appealTarget, setAppealTarget] = useState<{ sanctionId?: string; label: string } | null>(null);
  // ШАГ 12: настройки сайта (шапка/подвал) и раздел админ-панели
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [adminSection, setAdminSection] = useState<AdminSection>("home");

  const refreshSanctions = useCallback(() => {
    if (!token) {
      setRestriction(null);
      setWarning(null);
      return;
    }
    fetch(`/api/sanctions/me?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        setRestriction(d.restriction ?? null);
        setWarning(d.warning ?? null);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    refreshSanctions();
  }, [refreshSanctions]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3500);
  }, []);
  const seenRef = useRef<number[]>([]);
  const rubricsRef = useRef<Rubric[]>([]);
  const scopeRef = useRef("new");
  const rubricFilterRef = useRef<{ slug: string; name: string } | null>(null);
  useEffect(() => {
    scopeRef.current = scope;
  }, [scope]);
  useEffect(() => {
    rubricFilterRef.current = rubricFilter;
  }, [rubricFilter]);

  const syncFromUrl = useCallback(() => {
    const sp = new URLSearchParams(window.location.search);
    const sc = sp.get("scope");
    setScope(sc && ["new", "popular", "active", "mine", "participated", "favorites", "unanswered", "archive"].includes(sc) ? sc : "new");
    const rub = sp.get("rubric") || "";
    if (rub) {
      const found = rubricsRef.current.flatMap((r) => [r, ...r.children]).find((r) => r.slug === rub);
      setRubricFilter(found ? { slug: found.slug, name: found.name } : null);
    } else {
      setRubricFilter(null);
    }
    const topic = sp.get("topic");
    if (topic) {
      setProfileNick(null);
      setTopicId(parseInt(topic, 10));
      setView("forum");
      setJumpMsg(parseInt(sp.get("msg") || "") || null);
      return;
    }
    const u = sp.get("user");
    if (u) {
      setTopicId(null);
      setJumpMsg(null);
      setProfileNick(u);
      return;
    }
    setProfileNick(null);
    setTopicId(null);
    setJumpMsg(null);
    // ШАГ 27: URL со scope/rubric (без ?view=) — это форумный список, не главная
    if (sc || rub) {
      setView("forum");
      return;
    }
    const v = sp.get("view") || "home";
    // ШАГ 16 (исправление): старые ссылки /?view=help ведут на отдельную страницу /help
    if (v === "help") {
      window.location.replace("/help");
      return;
    }
    // ШАГ 17: «Подслушано Сахалин» — только отдельная страница /podslyshano
    if (v === "podslyshano") {
      window.location.replace("/podslyshano");
      return;
    }
    // ШАГ 18: «Где купить» — только отдельная страница /gde-kupit
    if (v === "wheretobuy") {
      window.location.replace("/gde-kupit");
      return;
    }
    // ШАГ 19: «ЖКХ и городские проблемы» — только отдельная страница /gkh
    if (v === "gkh") {
      window.location.replace("/gkh");
      return;
    }
    // ШАГ 26: «Знакомства» — только отдельная страница /znakomstva
    if (v === "dating") {
      window.location.replace("/znakomstva");
      return;
    }
    // ШАГ 23: «Где дешевле» — только отдельная страница /gde-deshevle
    if (v === "gdedeshevle") {
      window.location.replace("/gde-deshevle");
      return;
    }
    // ШАГ 20: «Рекомендую / Не рекомендую» — только отдельная страница /rekomenduyu
    if (v === "recommend") {
      window.location.replace("/rekomenduyu");
      return;
    }
    // ШАГ 25: «О работодателях» — только отдельная страница /o-rabotodatelyah
    if (v === "employers") {
      window.location.replace("/o-rabotodatelyah");
      return;
    }
    // ШАГ 22 (восстановление): «Объявления» — только отдельная страница /obyavleniya
    if (v === "ads") {
      window.location.replace("/obyavleniya");
      return;
    }
    // ШАГ 24 (восстановление): «Полезное» — только отдельная страница /poleznoe
    if (v === "useful") {
      window.location.replace("/poleznoe");
      return;
    }
    // ШАГ 27: результаты поиска из навигационной строки «Поиск по форуму...»
    if (v === "search") {
      setView("search");
      setSearchQ(sp.get("q") || "");
      return;
    }
    setView(v);
    // ШАГ 12: подраздел админ-панели из URL (?view=admin&section=users)
    if (v === "admin") {
      const s = (sp.get("section") || "home") as AdminSection;
      setAdminSection(s);
    }
  }, []);

  useEffect(() => {
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [syncFromUrl]);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const verify = sp.get("verify");
    const reset = sp.get("reset");
    if (verify) {
      fetch(`/api/auth/verify?token=${encodeURIComponent(verify)}`)
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok) throw Error(data.error || "Не удалось подтвердить email");
          return data;
        })
        .then((data) => {
          login(data.user.token, data.user);
          notify("Email подтверждён — добро пожаловать на форум!");
        })
        .catch((e) => notify(e instanceof Error ? e.message : "Не удалось подтвердить email"))
        .finally(() => window.history.replaceState(null, "", "/"));
    } else if (reset) {
      setResetToken(reset);
      window.history.replaceState(null, "", "/");
    }
  }, [login, notify]);

  useEffect(() => {
    if (rubrics.length === 0) return;
    rubricsRef.current = rubrics;
    const rub = new URLSearchParams(window.location.search).get("rubric");
    if (rub) {
      const found = rubrics.flatMap((r) => [r, ...r.children]).find((r) => r.slug === rub);
      if (found) setRubricFilter({ slug: found.slug, name: found.name });
    }
  }, [rubrics]);

  useEffect(() => {
    if (rubrics.length === 0) {
      fetch("/api/bootstrap")
        .then((r) => r.json())
        .then((r) => {
          setRubrics(r.rubrics || []);
          // ШАГ 12: настройки сайта для шапки и подвала
          if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings });
        })
        .catch(() => {});
    }
  }, [rubrics.length]);

  // ШАГ 12: повторная загрузка настроек после сохранения в админ-панели
  const refreshSettings = useCallback(() => {
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then((r) => {
        if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings });
      })
      .catch(() => {});
  }, []);

  const navigate = useCallback((v: string) => {
    // ШАГ 16 (исправление): «Нужна помощь» — отдельная страница /help, а не вкладка форума
    if (v === "help") {
      window.location.href = "/help";
      return;
    }
    // ШАГ 17: «Подслушано Сахалин» — отдельная страница /podslyshano
    if (v === "podslyshano") {
      window.location.href = "/podslyshano";
      return;
    }
    // ШАГ 18: «Где купить» — отдельная страница /gde-kupit
    if (v === "wheretobuy") {
      window.location.href = "/gde-kupit";
      return;
    }
    // ШАГ 19: «ЖКХ и городские проблемы» — отдельная страница /gkh
    if (v === "gkh") {
      window.location.href = "/gkh";
      return;
    }
    // ШАГ 26: «Знакомства» — отдельная страница /znakomstva
    if (v === "dating") {
      window.location.href = "/znakomstva";
      return;
    }
    // ШАГ 23: «Где дешевле» — отдельная страница /gde-deshevle
    if (v === "gdedeshevle") {
      window.location.href = "/gde-deshevle";
      return;
    }
    // ШАГ 20: «Рекомендую / Не рекомендую» — отдельная страница /rekomenduyu
    if (v === "recommend") {
      window.location.href = "/rekomenduyu";
      return;
    }
    // ШАГ 25: «О работодателях» — отдельная страница /o-rabotodatelyah
    if (v === "employers") {
      window.location.href = "/o-rabotodatelyah";
      return;
    }
    // ШАГ 22 (восстановление): «Объявления» — отдельная страница /obyavleniya
    if (v === "ads") {
      window.location.href = "/obyavleniya";
      return;
    }
    // ШАГ 24 (восстановление): «Полезное» — отдельная страница /poleznoe
    if (v === "useful") {
      window.location.href = "/poleznoe";
      return;
    }
    setTopicId(null);
    setJumpMsg(null);
    setProfileNick(null);
    setView(v);
    window.history.pushState(null, "", v === "home" ? "/" : `/?view=${v}`);
    window.scrollTo(0, 0);
  }, []);

  const goForumHome = useCallback(() => {
    setTopicId(null);
    setJumpMsg(null);
    setProfileNick(null);
    setScope("new");
    setRubricFilter(null);
    // ШАГ 27: из форумных видов «на главную форума» = полный список тем; новая главная — по «Главная» в меню
    window.history.pushState(null, "", "/?view=forum");
    window.scrollTo(0, 0);
  }, []);

  const backParams = useCallback(() => {
    const p = new URLSearchParams();
    if (scopeRef.current !== "new") p.set("scope", scopeRef.current);
    if (rubricFilterRef.current) p.set("rubric", rubricFilterRef.current.slug);
    const s = p.toString();
    return s ? `&${s}` : "";
  }, []);

  const openTopic = useCallback(
    (id: number) => {
      setView("forum");
      setTopicId(id);
      setJumpMsg(null);
      window.history.pushState(null, "", `/?topic=${id}${backParams()}`);
      window.scrollTo(0, 0);
    },
    [backParams]
  );

  const openTopicAt = useCallback(
    (id: number, msg: number) => {
      setView("forum");
      setTopicId(id);
      setJumpMsg(msg);
      window.history.pushState(null, "", `/?topic=${id}${msg ? `&msg=${msg}` : ""}${backParams()}`);
      window.scrollTo(0, 0);
    },
    [backParams]
  );

  const openProfile = useCallback((nick: string) => {
    // 2026-10-01: отдельная страница профиля /user/[nick] (прежде SPA-вид ?user=).
    window.location.href = `/user/${encodeURIComponent(nick)}`;
  }, []);

  const needAuthGate = useCallback(() => {
    if (user) return true;
    setAuthTab("login");
    setAuthOpen(true);
    return false;
  }, [user]);

  const changeScope = useCallback(
    (s: string) => {
      if ((s === "mine" || s === "participated") && !user) {
        setMobileMenu(false);
        setAuthTab("login");
        setAuthOpen(true);
        return;
      }
      setScope(s);
      setRubricFilter(null);
      setTopicId(null);
      setJumpMsg(null);
      setProfileNick(null);
      setMobileMenu(false);
      // ШАГ 27: выбор области в левой колонке (в т.ч. с главной) показывает форумный список тем
      setView("forum");
      window.history.pushState(null, "", s === "new" ? "/?view=forum" : `/?scope=${s}`);
      window.scrollTo(0, 0);
    },
    [user]
  );

  const openRubric = useCallback((r: { slug: string; name: string } | null) => {
    setScope("new");
    setRubricFilter(r);
    setTopicId(null);
    setJumpMsg(null);
    setProfileNick(null);
    setMobileMenu(false);
    // ШАГ 27: выбор рубрики (в т.ч. с главной) показывает форумный список тем
    setView("forum");
    window.history.pushState(null, "", r ? `/?rubric=${encodeURIComponent(r.slug)}` : "/?view=forum");
    window.scrollTo(0, 0);
  }, []);

  const mainView = profileNick && !topicId ? (
    <ProfileView nick={profileNick} onOpenTopic={openTopic} onOpenTopicAt={openTopicAt} onGoForumHome={goForumHome} />
  ) : view === "forum" ? (
    topicId ? (
      <TopicView
        topicId={topicId}
        user={user}
        token={token}
        favorites={favorites}
        jumpMsg={jumpMsg}
        backParams={
          (() => {
            const p = new URLSearchParams();
            if (scope !== "new") p.set("scope", scope);
            if (rubricFilter) p.set("rubric", rubricFilter.slug);
            const s = p.toString();
            return s ? `&${s}` : "";
          })()
        }
        onJumpDone={() => setJumpMsg(null)}
        onBack={() => {
          setTopicId(null);
          setJumpMsg(null);
          const p = new URLSearchParams();
          if (scope !== "new") p.set("scope", scope);
          if (rubricFilter) p.set("rubric", rubricFilter.slug);
          const s = p.toString();
          // ШАГ 27: возврат из темы — в форумный список, а не на новую главную
          window.history.pushState(null, "", s ? `/?${s}` : "/?view=forum");
        }}
        onGoForumHome={goForumHome}
        onOpenRubric={openRubric}
        onNeedAuth={() => {
          setAuthTab("login");
          setAuthOpen(true);
        }}
        onNewTopic={() => needAuthGate() && setNewTopicOpen(true)}
        onOpenProfile={openProfile}
        notify={notify}
        onSanctionChange={refreshSanctions}
      />
    ) : (
      <TopicList
        scope={scope}
        onScope={changeScope}
        rubricFilter={rubricFilter}
        user={user}
        token={token}
        favorites={favorites}
        onOpenTopic={openTopic}
        onOpenTopicAt={openTopicAt}
        onAddTopic={() => (needAuthGate() ? setNewTopicOpen(true) : undefined)}
        onNeedAuth={() => {
          setAuthTab("login");
          setAuthOpen(true);
        }}
        onOpenRubric={openRubric}
        onOpenProfile={openProfile}
      />
    )
  ) : view === "rules" ? (
    <RulesPage onOpenTopic={openTopic} />
  ) : view === "search" ? (
    // ШАГ 27: результаты поиска из навигационной строки — единственного окна поиска сайта
    <SearchPage q={searchQ} onOpenTopic={openTopic} onOpenTopicAt={openTopicAt} onOpenProfile={openProfile} />
  ) : view === "appeal" ? (
    <AppealPage notify={notify} />
  ) : view === "about" ? (
    <AboutPage />
  ) : view === "admin" ? (
    <AdminPanel
      token={token}
      user={user}
      section={adminSection}
      onSection={(s) => {
        setAdminSection(s);
        window.history.pushState(null, "", `/?view=admin&section=${s}`);
        window.scrollTo(0, 0);
      }}
      notify={notify}
      onNeedAuth={() => {
          setAuthTab("login");
          setAuthOpen(true);
        }}
      onOpenTopic={openTopic}
      onOpenProfile={openProfile}
      onSettingsChanged={refreshSettings}
    />
  ) : view === "ads" || view === "info" || view === "directory" ? (
    <SectionPage section={view} onForum={() => navigate("forum")} />
  ) : (
    <PlaceholderPage view={view} onForum={() => navigate("forum")} />
  );

  // ШАГ 27: переход к результатам поиска из навигационной строки «Поиск по форуму...»
  const goSearch = useCallback((q: string) => {
    setTopicId(null);
    setJumpMsg(null);
    setProfileNick(null);
    setView("search");
    setSearchQ(q);
    window.history.pushState(null, "", `/?view=search&q=${encodeURIComponent(q)}`);
    window.scrollTo(0, 0);
  }, []);

  // ШАГ 27: главная по согласованному макету — свой центральный и правый столбцы;
  // профиль пользователя (?user=Ник) при этом остаётся в обычной раскладке
  const isHome = view === "home" && !profileNick && !topicId;

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      {/* ШАГ 27: в навигации — единственный поиск сайта и вход/регистрация; состояние
          входа синхронизируется с экраном через onLogin/onLogout */}
      <MainNav
        current={view}
        isAdmin={isStaffRole(user?.role)}
        onNavigate={navigate}
        onSearch={goSearch}
        onOpenProfile={openProfile}
        onLogin={(t, u) => {
          login(t, u);
          notify(`Вы вошли как ${u.nickname}`);
        }}
        onLogout={() => logout()}
      />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        {/* 2026-10-01 (мобайл): голубая шапка (sk-topbar) — ВСЕГДА
            показывается (на всех SPA-видах), с названием страницы по
            центру. На форуме также кнопка «☰ Категории форума» слева. */}
        <div className="sk-topbar" style={{ position: "relative", padding: "20px 8px !important" } as React.CSSProperties}>
          {view === "forum" && !topicId && (
            <button aria-label="Открыть меню" onClick={() => setMobileMenu(true)}>
              ☰ Категории форума
            </button>
          )}
          <span className="tb-title">
            {topicId ? "Тема форума" : view === "forum" ? "Форум" : view === "search" ? "Поиск" : view === "rules" ? "Правила" : view === "appeal" ? "Апелляция" : view === "about" ? "О проекте" : view === "admin" ? "Админка" : "Главная"}
          </span>
        </div>
        {mobileMenu && <div className="sk-menu-backdrop" onClick={() => setMobileMenu(false)} />}
        <div className="sk-shell">
        {/* ГЛОБАЛЬНАЯ СЕТКА ВСЕГО САЙТА (жёсткая директива «Фиксация 850px»):
            трёхколоночный каркас .main-grid-container
            (.left-column 240 / .center-column 850 !important / .right-column 300,
            от 1024px — flex по центру, каркас 1430px, зазор 20px) — БЕЗ УСЛОВИЙ,
            на Главной и на всех остальных видах (Форум, Справочник, Правила,
            Поиск, О проекте, Админ) — единый сквозной стандарт. */}
        <div className="sk-layout main-grid-container">
            <Sidebar
              rubrics={rubrics}
              user={user}
              scope={scope}
              rubricFilter={rubricFilter}
              open={mobileMenu}
              homeMode={isHome}
              onScope={changeScope}
              onRubric={openRubric}
              onAddTopic={() => {
                setMobileMenu(false);
                if (needAuthGate()) setNewTopicOpen(true);
              }}
              onNeedAuth={() => {
                setMobileMenu(false);
                setAuthTab("login");
                setAuthOpen(true);
              }}
              onLogout={() => {
                logout();
                setMobileMenu(false);
              }}
              onGoAdmin={() => {
                setMobileMenu(false);
                navigate("admin");
              }}
              onOpenProfile={openProfile}
            />
            <div className="sk-col-main center-column">
              {/* ШАГ 11: баннеры активного ограничения и предупреждения с кнопкой «Оспорить решение» */}
              {(restriction || warning) && (
                <div className="sk-sanction-banner">
                  {restriction && (
                    <div className="sb-row sb-restriction">
                      <div className="sb-text">
                        <b>Действует ограничение: {restriction.kindLabel}.</b>{" "}
                        Причина: {restriction.reason}.{" "}
                        {restriction.permanent
                          ? "Блокировка постоянная."
                          : restriction.expiresAt
                            ? `Действует до ${fmtDateTime(restriction.expiresAt)}.`
                            : ""}{" "}
                        Отправка сообщений и тем недоступна до снятия ограничения.
                      </div>
                      {restriction.appealStatus === "open" ? (
                        <div className="sb-appeal-state">Апелляция отправлена — её рассмотрит человек-модератор.</div>
                      ) : restriction.appealStatus === "rejected" ? (
                        <div className="sb-appeal-state">Апелляция рассмотрена человеком-модератором и отклонена.</div>
                      ) : restriction.appealStatus === "accepted" ? (
                        <div className="sb-appeal-state">Апелляция удовлетворена — решение отменено.</div>
                      ) : (
                        <button
                          className="sk-appeal-btn"
                          onClick={() => setAppealTarget({ sanctionId: restriction.id, label: `${restriction.kindLabel} — ${restriction.reason}` })}
                        >
                          Оспорить решение
                        </button>
                      )}
                      {restriction.source === "ai" && (
                        <div className="sb-source">Санкция применена ИИ автоматически — человек-модератор может её проверить и отменить.</div>
                      )}
                    </div>
                  )}
                  {warning && (
                    <div className="sb-row sb-warning">
                      <div className="sb-text">
                        <b>Модерация вынесла вам предупреждение.</b>{" "}
                        Причина: {warning.reason}. Без блокировки аккаунта. Критика и несогласное мнение нарушением не являются — предупреждение связано с нарушением правил форума.
                      </div>
                      {warning.appealStatus === "open" ? (
                        <div className="sb-appeal-state">Апелляция отправлена — её рассмотрит человек-модератор.</div>
                      ) : warning.appealStatus === "rejected" ? (
                        <div className="sb-appeal-state">Апелляция рассмотрена человеком-модератором и отклонена.</div>
                      ) : warning.appealStatus === "accepted" ? (
                        <div className="sb-appeal-state">Апелляция удовлетворена — предупреждение отменено.</div>
                      ) : (
                        <button
                          className="sk-appeal-btn"
                          onClick={() => setAppealTarget({ sanctionId: warning.id, label: `предупреждение — ${warning.reason}` })}
                        >
                          Оспорить решение
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* ШАГ 27: на главной — центральный столбец по макету (Подслушано, последние темы,
                  сетка разделов); на остальных видах — прежнее содержимое */}
              {isHome ? <HomeCenter onOpenTopic={openTopic} onOpenProfile={openProfile} onOpenRegister={openRegister} /> : mainView}
            </div>
            {isHome ? (
              <HomeRight />
            ) : (
              <aside className="sk-col-right right-column">
              {/* Часы на ВСЕХ страницах (не только на Главной): первым блоком
                  правой колонки — дословно как в HomeRight на Главной. */}
              <SakhDatetimeBlock />
              <PinnedAndRules onOpenTopic={openTopic} />
              {/* ТЗ 2026-09-21: блоки-входы самостоятельных разделов («Нужна помощь»,
                  «Подслушано Сахалин», «Где купить», «ЖКХ», «Знакомства», «Где дешевле»,
                  «Рекомендую / Не рекомендую», «О работодателях», «Объявления»,
                  «Полезное») УДАЛЕНЫ из правой колонки форума по требованию заказчика.
                  Сами разделы (/help, /podslyshano, /gde-kupit, /gkh, /znakomstva,
                  /gde-deshevle, /rekomenduyu, /o-rabotodatelyah, /obyavleniya,
                  /poleznoe) работают как прежде — доступны через меню «Ещё»
                  в синей навигации и футер. */}
              {BANNERS.map((b, i) => (
                <div key={i} className={`sk-banner ${b.cls}`}>
                  <span className="b1">{b.b1}</span>
                  {b.b2 && <span className="b2">{b.b2}</span>}
                </div>
              ))}
              </aside>
            )}
          </div>
        </div>
        {/* ШАГ 27: футер по согласованному макету — ссылки, сведения о проекте,
            дисклеймер о пользовательских публикациях, версия; компактный, светлый.
            Шаг «Единый футер как на Главной»: разметка вынесена в общий
            SiteFooter (chrome.tsx) — тот же футер рендерится на ВСЕХ страницах,
            размер/состав 1-в-1 с Главной; ссылки — SPA-навигация */}
        <SiteFooter settings={settings} onNavigate={navigate} />
      </div>
      {authOpen && (
        <AuthModal
          initialTab={authTab}
          onClose={() => setAuthOpen(false)}
          onLogin={(t, u) => {
            login(t, u);
            notify(`Вы вошли как ${u.nickname}`);
          }}
        />
      )}
      {resetToken && (
        <ResetModal
          token={resetToken}
          onClose={() => setResetToken(null)}
          onLogin={(t, u) => {
            login(t, u);
            notify("Пароль изменён. Вы вошли на форум");
          }}
        />
      )}
      {newTopicOpen && token && (
        <NewTopicModal
          token={token}
          initialRubric={rubricFilter}
          onClose={() => setNewTopicOpen(false)}
          onCreated={(id) => {
            setNewTopicOpen(false);
            openTopic(id);
            notify("Тема опубликована");
          }}
        />
      )}
      {appealTarget && (
        <AppealModal
          token={token}
          target={appealTarget}
          onClose={() => setAppealTarget(null)}
          onDone={(m) => {
            setAppealTarget(null);
            notify(m);
            refreshSanctions();
          }}
        />
      )}
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-[90] -translate-x-1/2 border-2 border-[#1E3A5F] bg-white px-4 py-2 text-[14px] font-semibold text-[#1E3A5F] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
