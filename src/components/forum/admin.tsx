"use client";

/**
 * ШАГ 12. Административная панель SakhMatrix.
 *
 * Владелец проекта имеет отдельную роль «Главный администратор / Владелец»
 * (owner) с полным доступом. Модератор — ограниченные права: модерация,
 * жалобы, просмотр пользователей и тем, журнал. Разделы «Объявления»,
 * «Практическая информация», «Справочник», «Настройки сайта», а также
 * удаление/перенос тем и блокировки пользователей — только владелец.
 */

import { useCallback, useEffect, useState } from "react";
import { CATEGORY_LABELS, fmtDate, fmtDateTime, fmtNum, type ForumUser } from "@/lib/ui";
import { nickGenderClass } from "@/lib/nick-gender";

const KIND_LABELS: Record<string, string> = {
  warning: "Замечание",
  limit_1h: "Ограничение на 1 час",
  limit_6h: "Ограничение на 6 часов",
  limit_24h: "Ограничение на 24 часа",
  limit_3d: "Ограничение на 3 дня",
  limit_7d: "Ограничение на 7 дней",
  ban: "Постоянная блокировка",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Главный администратор / Владелец",
  admin: "Администратор",
  moderator: "Модератор",
  user: "Участник форума",
};

const ACTION_LABELS: Record<string, string> = {
  "message.publish": "сообщение опубликовано",
  "message.hide": "сообщение скрыто",
  "message.delete": "сообщение удалено",
  "sanction.apply": "применена санкция",
  "sanction.revoke": "санкция отменена",
  "sanction.unblock": "ограничение снято",
  "appeal.accept": "апелляция удовлетворена",
  "appeal.reject": "апелляция отклонена",
  "complaint.resolve": "жалоба рассмотрена",
  "topic.rename": "изменён заголовок темы",
  "topic.move": "тема перенесена",
  "topic.pin": "тема закреплена",
  "topic.unpin": "тема откреплена",
  "topic.close": "тема закрыта",
  "topic.open": "тема открыта",
  "topic.delete": "тема удалена",
  "topic.restore": "тема восстановлена",
  "settings.save": "сохранены настройки сайта",
  "section.create": "добавлена запись",
  "section.update": "изменена запись",
  "section.toggle": "скрыта/опубликована запись",
  "section.delete": "удалена запись",
};

const VERDICT_LABELS: Record<string, string> = {
  violation: "Авто: нарушение подтверждено",
  ambiguous: "Авто: спорный случай",
  ok: "Авто: нарушений не нашёл",
  "": "Авто: проверка выполняется",
};

export type AdminSection =
  | "home"
  | "ai"
  | "complaints"
  | "users"
  | "topics"
  | "ads"
  | "info"
  | "directory"
  | "settings"
  | "log";

const MENU: { key: AdminSection; label: string; ownerOnly: boolean }[] = [
  { key: "home", label: "Главная", ownerOnly: false },
  { key: "ai", label: "Авто-модерация", ownerOnly: false },
  { key: "complaints", label: "Жалобы", ownerOnly: false },
  { key: "users", label: "Пользователи", ownerOnly: false },
  { key: "topics", label: "Темы форума", ownerOnly: false },
  { key: "ads", label: "Объявления", ownerOnly: true },
  { key: "info", label: "Практическая информация", ownerOnly: true },
  { key: "directory", label: "Справочник", ownerOnly: true },
  { key: "settings", label: "Настройки сайта", ownerOnly: true },
  { key: "log", label: "Журнал действий", ownerOnly: false },
];

const SECTION_TITLES: Record<AdminSection, string> = {
  home: "Главная · состояние и дела",
  ai: "Авто-модерация",
  complaints: "Жалобы",
  users: "Пользователи",
  topics: "Темы форума",
  ads: "Объявления",
  info: "Практическая информация",
  directory: "Справочник",
  settings: "Настройки сайта",
  log: "Журнал действий",
};

function isOwnerRole(role?: string): boolean {
  return role === "owner" || role === "admin";
}
function isStaffRole(role?: string): boolean {
  return role === "owner" || role === "admin" || role === "moderator";
}

/** Красивая метка действия журнала. */
function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function AdminPanel(props: {
  token: string | null;
  user: ForumUser | null;
  section: AdminSection;
  onSection: (s: AdminSection) => void;
  notify: (m: string) => void;
  onNeedAuth: () => void;
  onOpenTopic: (id: number) => void;
  onOpenProfile: (n: string) => void;
  onSettingsChanged: () => void;
}) {
  const owner = isOwnerRole(props.user?.role);
  const staff = isStaffRole(props.user?.role);

  if (!props.user) {
    return (
      <div className="sm-frame-2 mx-auto max-w-[520px] p-6 text-center">
        <p className="text-[15px]">Административная панель. Требуется вход.</p>
        <button className="sm-btn sm-btn-primary mt-3 px-4 py-2" onClick={props.onNeedAuth}>
          Войти
        </button>
      </div>
    );
  }
  if (!staff) {
    return <div className="sm-frame-2 mx-auto max-w-[520px] p-6 text-center text-[15px]">Доступно только администратору.</div>;
  }

  const menu = MENU.filter((m) => owner || !m.ownerOnly);
  const section: AdminSection = MENU.some((m) => m.key === props.section) && (owner || !MENU.find((m) => m.key === props.section)!.ownerOnly)
    ? props.section
    : "home";

  return (
    <div className="sm-frame-2 mx-auto max-w-[1120px]">
      <div className="sm-frame-title flex flex-wrap items-center justify-between gap-2">
        <span>Административная панель</span>
        <span className="text-[12px] font-normal opacity-85">
          {props.user.nickname} · {ROLE_LABELS[props.user.role ?? "user"] ?? props.user.role}
        </span>
      </div>
      <div className="flex flex-col md:flex-row">
        {/* Меню разделов */}
        <nav className="shrink-0 border-b-2 border-r-0 border-[#C9D4E2] bg-[#F7FAFD] p-2 md:w-[228px] md:border-b-0 md:border-r-2" aria-label="Меню админ-панели">
          <ul className="flex flex-wrap gap-1 md:flex-col md:flex-nowrap">
            {menu.map((m) => (
              <li key={m.key} className="md:w-full">
                <button
                  className={`w-full border border-transparent px-2.5 py-1.5 text-left text-[13.5px] font-semibold text-[#1E3A5F] hover:bg-white ${section === m.key ? "border-[#1E3A5F] bg-white shadow-inner" : ""}`}
                  aria-current={section === m.key ? "page" : undefined}
                  onClick={() => props.onSection(m.key)}
                >
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
          {!owner && (
            <p className="mt-2 hidden px-1 text-[12.5px] leading-snug text-[#56657a] md:block">
              Права модератора ограничены: настройки, разделы сайта и блокировки доступны Главному администратору.
            </p>
          )}
        </nav>

        {/* Содержимое раздела */}
        <div className="min-w-0 flex-1">
          <div className="border-b border-[#C9D4E2] bg-[#FDFEFF] px-3 py-2 text-[14px] font-bold text-[#1E3A5F]">
            {SECTION_TITLES[section]}
          </div>
          {section === "home" && <AdminHome token={props.token} notify={props.notify} onOpenTopic={props.onOpenTopic} onSection={props.onSection} />}
          {section === "ai" && <ModerationSection token={props.token} notify={props.notify} onOpenTopic={props.onOpenTopic} />}
          {section === "complaints" && <ComplaintsSection token={props.token} notify={props.notify} onOpenTopic={props.onOpenTopic} />}
          {section === "users" && <UsersSection token={props.token} isOwner={owner} notify={props.notify} onOpenProfile={props.onOpenProfile} />}
          {section === "topics" && <TopicsSection token={props.token} isOwner={owner} notify={props.notify} onOpenTopic={props.onOpenTopic} />}
          {(section === "ads" || section === "info" || section === "directory") && (
            <SectionManager token={props.token} section={section} notify={props.notify} />
          )}
          {section === "settings" && <SettingsSection token={props.token} notify={props.notify} onSaved={props.onSettingsChanged} />}
          {section === "log" && <LogSection token={props.token} />}
        </div>
      </div>
    </div>
  );
}

/* ================= Главная админ-панели ================= */

interface OverviewData {
  attention: {
    needHuman: number;
    openComplaints: number;
    openAppeals: number;
    items: {
      id: string;
      author: string;
      topic: { id: number; title: string };
      body: string;
      isHiddenByAi: boolean;
      hiddenReason: string;
      needHuman: boolean;
      complaints: { id: string; category: string; comment: string; aiVerdict: string }[];
      createdAt: string;
    }[];
  };
  disputed: {
    appeals: { id: string; userNick: string; text: string; sanction: { kind: string; reason: string } | null; createdAt: string }[];
    aiSanctions: { id: string; user: string; kind: string; reason: string; createdAt: string }[];
    hiddenByAi: number;
  };
  recentActions: { id: string; actor: string; actorRole: string; action: string; targetLabel: string; details: string; createdAt: string }[];
  site: {
    users: number;
    topics: number;
    messages: number;
    topicsToday: number;
    messagesToday: number;
    hiddenByAi: number;
    activeSanctions: number;
    aiSanctions: number;
    restrictedUsers: number;
    needHuman: number;
    openComplaints: number;
    openAppeals: number;
  };
}

function AdminHome(props: { token: string | null; notify: (m: string) => void; onOpenTopic: (id: number) => void; onSection: (s: AdminSection) => void }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!props.token) return;
    fetch(`/api/admin/overview?token=${encodeURIComponent(props.token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Ошибка загрузки");
        return d;
      })
      .then(setData)
      .catch((e) => setError(e.message || "Ошибка"));
  }, [props.token]);

  if (error) return <p className="p-4 text-[14px] text-[#B22335]">{error}</p>;
  if (!data) return <p className="p-4 text-[14px] text-[#56657a]">Загрузка…</p>;

  const s = data.site;
  /**
   * ТЗ 2026-09-24 «Кликабельные счётчики админки»: каждый из 8 блоков
   * становится ссылкой, переключающей активный раздел админ-панели.
   * 4-й элемент массива — целевой AdminSection, куда вести при клике:
   *   • Участников        → users (список пользователей)
   *   • Тем               → topics (список тем форума)
   *   • Сообщений         → topics (нет отдельного раздела «сообщения»;
   *                          сообщения видны внутри каждой темы — открываем
   *                          список тем, админ выбирает нужную тему)
   *   • Спорных у ИИ      → ai (ИИ-модерация, очередь «нужен человек»)
   *   • Нерешённых жалоб  → complaints (жалобы)
   *   • Открытых апелляций → ai (апелляции рассматриваются в ИИ-модерации)
   *   • Скрыто ИИ сейчас   → ai (скрытые сообщения в ИИ-модерации)
   *   • Активных санкций   → log (журнал действий — там видны применённые
   *                          санкции; прямого раздела «санкции» нет)
   */
  const tiles: [string, string | number, boolean, AdminSection][] = [
    ["Участников", fmtNum(s.users), false, "users"],
    ["Тем", fmtNum(s.topics), false, "topics"],
    ["Сообщений", fmtNum(s.messages), false, "topics"],
    ["Спорных случаев (нужен человек)", s.needHuman, s.needHuman > 0, "ai"],
    ["Нерешённых жалоб", s.openComplaints, s.openComplaints > 0, "complaints"],
    ["Открытых апелляций", s.openAppeals, s.openAppeals > 0, "ai"],
    ["Скрыто авто сейчас", s.hiddenByAi, s.hiddenByAi > 0, "ai"],
    ["Активных санкций", s.activeSanctions, s.activeSanctions > 0, "log"],
  ];

  return (
    <div className="p-3">
      {/* Базовое состояние сайта — только счётчики, без раздутой аналитики.
          ТЗ 2026-09-24: каждый блок обёрнут в <a> с onClick, переключающим
          раздел админки. href="#" + preventDefault — семантически ссылка
          (cursor:pointer, hover-эффект), но реальной навигации нет (SPA). */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {tiles.map(([label, value, alert, section]) => (
          <a
            key={label}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              props.onSection(section);
            }}
            title={`Перейти к разделу «${SECTION_TITLES[section]}»`}
            className={`block min-w-0 break-words border p-2.5 no-underline transition-colors duration-150 hover:bg-[#E6EEF7] ${alert ? "border-[#B22335] bg-[#FBF2F3] hover:border-[#8a1a28] hover:bg-[#F6E0E3]" : "border-[#C9D4E2] bg-[#F7FAFD] hover:border-[#1E3A5F]"}`}
          >
            <div className={`text-[20px] font-bold leading-tight ${alert ? "text-[#B22335]" : "text-[#1E3A5F]"}`}>{value}</div>
            <div className="text-[12px] leading-snug text-[#4a5b6d] break-words hyphens-auto">{label}</div>
          </a>
        ))}
      </div>
      <p className="mt-1.5 text-[12px] text-[#56657a] break-words">За сутки: новых тем — {s.topicsToday}, сообщений — {s.messagesToday}. Ограничений действует: {s.restrictedUsers}, из них автоматических санкций — {s.aiSanctions}.</p>

      {/* Дела, требующие внимания */}
      <div className="sk-blocktitle mt-4">
        <span className="tri">▼</span>Дела, требующие внимания
      </div>
      {data.attention.items.length === 0 ? (
        <p className="mt-1 text-[13.5px] text-[#56657a]">Все спокойно: спорных случаев и нерешённых жалоб нет.</p>
      ) : (
        <ul className="mt-1 divide-y divide-[#D8DEE7] border border-[#C9D4E2]">
          {data.attention.items.map((item) => (
            <li key={item.id} className="px-2.5 py-2 text-[13.5px]">
              <div className="flex flex-wrap items-center gap-1.5">
                <b className={nickGenderClass(item.author)}>{item.author}</b>
                <a className="text-[#0A5CAA] underline break-words min-w-0 max-w-full" onClick={() => props.onOpenTopic(item.topic.id)}>
                  «{item.topic.title}»
                </a>
                {item.needHuman && <span className="border border-[#B22335] px-1.5 text-[12px] font-bold text-[#B22335]">спорный случай — нужно решение человека</span>}
                {item.isHiddenByAi && <span className="border border-[#1E3A5F] px-1.5 text-[12px] font-bold">скрыто авто</span>}
                {item.complaints.map((c) => (
                  <span key={c.id} className="border border-[#8a6d1a] px-1.5 text-[12px] font-bold text-[#8a6d1a]">
                    жалоба: {CATEGORY_LABELS[c.category] ?? c.category}
                  </span>
                ))}
              </div>
              <p className="mt-0.5 line-clamp-2 text-[13.5px]">{item.body}</p>
              {item.complaints.some((c) => c.comment) && (
                <p className="mt-0.5 text-[12px] text-[#5a3a3a]">
                  Комментарий жалобы: «{item.complaints.filter((c) => c.comment).map((c) => c.comment).join("; ")}»
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button className="sm-btn" onClick={() => props.onSection("ai")}>
          Перейти в авто-модерацию
        </button>
        <button className="sm-btn" onClick={() => props.onSection("complaints")}>
          Все жалобы
        </button>
      </div>

      {/* Спорные AI-решения */}
      <div className="sk-blocktitle mt-4">
        <span className="tri">▼</span>Спорные AI-решения
      </div>
      {data.disputed.appeals.length === 0 && data.disputed.aiSanctions.length === 0 ? (
        <p className="mt-1 text-[13.5px] text-[#56657a]">Спорных автоматических решений нет. Открытых апелляций: 0.</p>
      ) : (
        <div className="mt-1 space-y-2">
          {data.disputed.appeals.length > 0 && (
            <div className="border border-[#C9D4E2] p-2">
              <p className="text-[13px] font-bold text-[#1E3A5F]">Открытые апелляции (рассматривает человек)</p>
              <ul className="mt-1 space-y-1 text-[13.5px]">
                {data.disputed.appeals.map((a) => (
                  <li key={a.id}>
                    <b>{a.userNick || "пользователь"}</b>
                    {a.sanction ? ` оспаривает «${KIND_LABELS[a.sanction.kind] ?? a.sanction.kind}» (${a.sanction.reason})` : " оспаривает скрытие сообщения"}: «{a.text}»
                    <span className="text-[12.5px] text-[#56657a]"> · {fmtDateTime(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
              <button className="sm-btn mt-1.5" onClick={() => props.onSection("ai")}>
                Рассмотреть
              </button>
            </div>
          )}
          {data.disputed.aiSanctions.length > 0 && (
            <div className="border border-[#C9D4E2] p-2">
              <p className="text-[13px] font-bold text-[#1E3A5F]">Автоматические санкции (можно отменить человеку)</p>
              <ul className="mt-1 space-y-1 text-[13.5px]">
                {data.disputed.aiSanctions.map((sa) => (
                  <li key={sa.id}>
                    <b>{sa.user}</b> — {KIND_LABELS[sa.kind] ?? sa.kind}: {sa.reason}
                    <span className="text-[12.5px] text-[#56657a]"> · {fmtDateTime(sa.createdAt)}</span>
                  </li>
                ))}
              </ul>
              <button className="sm-btn mt-1.5" onClick={() => props.onSection("users")}>
                К пользователям
              </button>
            </div>
          )}
        </div>
      )}

      {/* Последние действия модерации */}
      <div className="sk-blocktitle mt-4">
        <span className="tri">▼</span>Последние действия модерации
      </div>
      {data.recentActions.length === 0 ? (
        <p className="mt-1 text-[13.5px] text-[#56657a]">Журнал пуст — действий ещё не было.</p>
      ) : (
        <ul className="mt-1 divide-y divide-[#D8DEE7] border border-[#C9D4E2]">
          {data.recentActions.map((l) => (
            <li key={l.id} className="px-2.5 py-1.5 text-[13.5px]">
              <b>{l.actor}</b>
              <span className="text-[12.5px] text-[#4a5b6d]"> — {actionLabel(l.action)}</span>
              {l.targetLabel && <span className="text-[12.5px]">: {l.targetLabel}</span>}
              {l.details && <span className="text-[12px] text-[#56657a]"> ({l.details})</span>}
              <span className="ml-1 text-[12.5px] text-[#56657a]">{fmtDateTime(l.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
      <button className="sm-btn mt-1.5" onClick={() => props.onSection("log")}>
        Весь журнал действий
      </button>
    </div>
  );
}

/* ================= ИИ-модерация ================= */

interface ModerationEntry {
  id: string;
  author: string;
  topic: { id: number; title: string };
  body: string;
  isHiddenByAi: boolean;
  hiddenReason: string;
  isDeleted: boolean;
  needHuman: boolean;
  aiNote: string;
  complaintsCount: number;
  complaints: { id: string; category: string; comment: string; aiVerdict: string; aiNote: string; createdAt: string }[];
  /** 2026-10-01: новые поля для карточки проверки */
  modLevel?: number;
  aiAction?: string;
  aiConfidence?: number;
  aiSignal?: string;
  num?: number;
  createdAt?: string;
}

/** 2026-10-01: Метки уровней нарушения (1-4). */
const LEVEL_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "Уровень 1 — критическая опасность", color: "#fff", bg: "#b91c1c" },
  2: { label: "Уровень 2 — серьёзное нарушение", color: "#fff", bg: "#d97706" },
  3: { label: "Уровень 3 — нарушение правил общения", color: "#1a2433", bg: "#fde68a" },
  4: { label: "Уровень 4 — нарушения нет", color: "#1a2433", bg: "#d1fae5" },
};

/** 2026-10-01: Метки технического статуса AI. */
const AI_ACTION_LABELS: Record<string, string> = {
  WATCH: "наблюдение",
  LIMIT: "рекомендуется ограничение",
  STOP: "остановить публикацию",
  ALERT: "срочно уведомить администратора",
};

/** 2026-10-01: Метки действий администратора. */
const ADMIN_ACTIONS: { key: string; label: string; color: string; confirm?: boolean }[] = [
  { key: "publish", label: "Оставить", color: "#16a34a" },
  { key: "hide", label: "Скрыть", color: "#d97706" },
  { key: "delete", label: "Удалить", color: "#dc2626", confirm: true },
  { key: "warn", label: "Предупредить", color: "#eab308", confirm: true },
  { key: "limit", label: "Ограничить", color: "#f97316", confirm: true },
  { key: "ban", label: "Заблокировать", color: "#991b1b", confirm: true },
  { key: "escalate", label: "На доп. проверку", color: "#6366f1" },
  { key: "emergency_stop", label: "Срочно остановить", color: "#7f1d1d", confirm: true },
];

interface AdminSanction {
  id: string;
  user: string;
  kind: string;
  reason: string;
  source: string;
  messageId: string | null;
  expiresAt: string | null;
  revoked: boolean;
  revokedBy: string;
  revokedReason: string;
  createdAt: string;
  hasOpenAppeal: boolean;
}

interface AdminAppeal {
  id: string;
  userNick: string;
  sanction: { id: string; kind: string; reason: string; source: string; user: string; revoked: boolean } | null;
  message: {
    id: string;
    num: number;
    author: string;
    hiddenReason: string;
    isHiddenByAi: boolean;
    topic: { id: number; title: string };
  } | null;
  text: string;
  status: string;
  resolvedBy: string;
  note: string;
  createdAt: string;
}


/* ================= 2026-10-01: Карточка проверки сообщения ================= */

interface AdminComplaint {
  id: string;
  category: string;
  comment: string;
  reporter: string;
  aiVerdict: string;
  aiNote: string;
  resolved: boolean;
  createdAt: string;
  message: {
    id: string;
    num: number;
    author: string;
    body: string;
    isHiddenByAi: boolean;
    isDeleted: boolean;
    hiddenReason: string;
    topic: { id: number; title: string };
  };
}

const HELP_COMPLAINT_LABELS: Record<string, string> = {
  fraud: "Мошенничество",
  paid: "Скрытая платная услуга",
  ad: "Реклама",
  spam: "Спам",
  personal_data: "Чужие персональные данные",
  forbidden: "Запрещённый контент",
  other: "Другое",
};

function ModerationSection(props: { token: string | null; notify: (m: string) => void; onOpenTopic: (id: number) => void }) {
  const [tab, setTab] = useState<"queue" | "sanctions" | "appeals">("queue");
  const [entries, setEntries] = useState<ModerationEntry[]>([]);
  const [sanctions, setSanctions] = useState<AdminSanction[]>([]);
  const [appeals, setAppeals] = useState<AdminAppeal[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [saNick, setSaNick] = useState("");
  const [saKind, setSaKind] = useState("warning");
  const [saReason, setSaReason] = useState("");
  const [checkId, setCheckId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!props.token) return;
    const sp = new URLSearchParams({ token: props.token, limit: "60" });
    if (q.trim()) sp.set("q", q.trim());
    fetch(`/api/moderation?${sp}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw Error(d.error); return d; })
      .then((d) => setEntries(d.entries || []))
      .catch((e) => setError(e.message));
  }, [props.token, q]);

  const loadSanctions = useCallback(() => {
    if (!props.token) return;
    fetch(`/api/admin/sanctions?token=${encodeURIComponent(props.token)}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw Error(d.error); return d; })
      .then((d) => { setSanctions(d.sanctions || []); setAppeals(d.appeals || []); })
      .catch((e) => setError(e.message));
  }, [props.token]);

  useEffect(() => { const t = window.setTimeout(load, 0); return () => window.clearTimeout(t); }, [load]);
  useEffect(() => { if (tab === "sanctions" || tab === "appeals") loadSanctions(); }, [tab, loadSanctions]);

  if (checkId) {
    return <ModerationCheckCard messageId={checkId} token={props.token} notify={props.notify} onClose={() => { setCheckId(null); load(); }} onOpenTopic={props.onOpenTopic} />;
  }

  return (
    <div>
      <div className="border-b border-[#C9D4E2] p-2">
        <div className="flex flex-wrap gap-1.5">
          <button className={`sm-btn ${tab === "queue" ? "sm-btn-primary" : ""}`} onClick={() => setTab("queue")}>Очередь ({entries.length})</button>
          <button className={`sm-btn ${tab === "sanctions" ? "sm-btn-primary" : ""}`} onClick={() => setTab("sanctions")}>Санкции</button>
          <button className={`sm-btn ${tab === "appeals" ? "sm-btn-primary" : ""}`} onClick={() => setTab("appeals")}>Апелляции</button>
        </div>
        {tab === "queue" && (
          <div className="mt-2 flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск…" className="flex-1 border border-[#1E3A5F] px-2.5 py-1.5 text-[14px] outline-none" />
            <button className="sm-btn" onClick={load}>Обновить</button>
          </div>
        )}
        {error && <p className="mt-2 text-[13.5px] text-[#B22335]">{error}</p>}
      </div>

      {tab === "queue" && (
        <div className="max-h-[70vh] overflow-y-auto">
          {entries.length === 0 && <p className="p-4 text-center text-[14px] text-[#56657a]">Записей нет.</p>}
          {entries.map((e) => {
            const lvl = e.modLevel ?? 4; const li = LEVEL_LABELS[lvl] ?? LEVEL_LABELS[4]; const cp = Math.round((e.aiConfidence ?? 0) * 100);
            return (
              <div key={e.id} className="border-b border-[#D8DEE7] px-3 py-2.5 text-[14px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded" style={{ color: li.color, background: li.bg }}>{li.label}</span>
                  {e.needHuman && <span className="border border-[#B22335] px-1.5 text-[11px] font-bold text-[#B22335]">требует решения</span>}
                  {e.isHiddenByAi && <span className="border border-[#1E3A5F] px-1.5 text-[11px] font-bold">скрыто авто</span>}
                  {e.isDeleted && <span className="border border-[#1E3A5F] bg-[#F2F6FA] px-1.5 text-[11px] font-bold">удалено</span>}
                  {e.complaintsCount > 0 && <span className="text-[11px] text-[#B22335]">жалоб: {e.complaintsCount}</span>}
                  <b className={`text-[13px] ${nickGenderClass(e.author)}`}>{e.author}</b>
                  {e.createdAt && <span className="text-[11px] text-[#56657a]">{fmtDateTime(e.createdAt)}</span>}
                </div>
                <p className="mt-1 line-clamp-2 text-[13.5px] text-[#334155]">{e.body}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-[#56657a]">AI: {AI_ACTION_LABELS[e.aiAction ?? "WATCH"] ?? e.aiAction}{cp > 0 && ` · ${cp}%`}</span>
                  <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    <button className="sm-btn" onClick={() => props.onOpenTopic(e.topic.id)}>Открыть тему</button>
                    <button className="sm-btn sm-btn-primary" onClick={() => setCheckId(e.id)}>Открыть проверку</button>
                    <button className="sm-btn" style={{ color: "#1e7e34", borderColor: "#1e7e34" }} onClick={async () => {
                      try {
                        const r = await fetch(`/api/moderation/${e.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: props.token, action: "publish" }) });
                        const d = await r.json();
                        if (!r.ok) throw Error(d.error);
                        props.notify(d.note || "Опубликовано");
                        load();
                      } catch (err) { props.notify(err instanceof Error ? err.message : "Ошибка"); }
                    }}>✓ Оставить</button>
                    <button className="sm-btn" style={{ color: "#B22335", borderColor: "#B22335" }} onClick={async () => {
                      if (!window.confirm("Удалить сообщение?")) return;
                      try {
                        const r = await fetch(`/api/moderation/${e.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: props.token, action: "delete", reason: "удалено администратором" }) });
                        const d = await r.json();
                        if (!r.ok) throw Error(d.error);
                        props.notify(d.note || "Удалено");
                        load();
                      } catch (err) { props.notify(err instanceof Error ? err.message : "Ошибка"); }
                    }}>✕ Удалить</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "sanctions" && (
        <div className="max-h-[70vh] overflow-y-auto p-3">
          <div className="mb-3 flex flex-wrap items-center gap-1.5 border border-[#C9D4E2] bg-[#F7FAFD] p-2">
            <input value={saNick} onChange={(e) => setSaNick(e.target.value)} placeholder="Ник" className="w-[170px] border border-[#1E3A5F] px-2 py-1.5 text-[13.5px] outline-none" />
            <select value={saKind} onChange={(e) => setSaKind(e.target.value)} className="border border-[#1E3A5F] px-2 py-1.5 text-[13.5px]">{Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <input value={saReason} onChange={(e) => setSaReason(e.target.value)} placeholder="Причина" className="min-w-[180px] flex-1 border border-[#1E3A5F] px-2 py-1.5 text-[13.5px] outline-none" />
            <button className="sm-btn sm-btn-primary" onClick={async () => {
              if (!saNick.trim() || saReason.trim().length < 5) { props.notify("Укажите ник и причину"); return; }
              try { const r = await fetch("/api/admin/sanction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "apply", nick: saNick.trim(), kind: saKind, reason: saReason.trim(), token: props.token }) }); const d = await r.json(); if (!r.ok) throw Error(d.error); props.notify(d.note || "Санкция применена"); setSaNick(""); setSaReason(""); loadSanctions(); } catch (e) { props.notify(e instanceof Error ? e.message : "Ошибка"); }
            }}>Применить</button>
          </div>
          {sanctions.length === 0 && <p className="p-2 text-center text-[14px] text-[#56657a]">Санкций нет.</p>}
          {sanctions.map((s) => (
            <div key={s.id} className="border-b border-[#D8DEE7] px-1 py-2 text-[14px]">
              <div className="flex flex-wrap items-center gap-2">
                <b>{s.user}</b>
                <span className="border border-[#1E3A5F] bg-[#F2F6FA] px-1.5 text-[12px] font-bold">{KIND_LABELS[s.kind] ?? s.kind}</span>
                <span className={`text-[12px] ${s.source === "ai" ? "text-[#8a6d1a]" : "text-[#1e7e34]"}`}>{s.source === "ai" ? "авто" : "человек"}</span>
                {s.revoked && <span className="text-[12px] text-[#56657a]">отменена</span>}
                {!s.revoked && s.expiresAt && s.kind !== "ban" && <span className="text-[12px] text-[#56657a]">до {fmtDateTime(s.expiresAt)}</span>}
              </div>
              <p className="text-[12.5px] text-[#56657a] mt-0.5">{s.reason}</p>
              {!s.revoked && <button className="sm-btn mt-1" onClick={async () => { const r2 = window.prompt("Причина отмены:"); if (!r2 || r2.trim().length < 5) return; try { const r = await fetch("/api/admin/sanction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revoke", id: s.id, reason: r2.trim(), token: props.token }) }); const d = await r.json(); if (!r.ok) throw Error(d.error); props.notify(d.note || "Отменена"); loadSanctions(); } catch (e) { props.notify(e instanceof Error ? e.message : "Ошибка"); } }}>Отменить</button>}
            </div>
          ))}
        </div>
      )}

      {tab === "appeals" && (
        <div className="max-h-[70vh] overflow-y-auto p-3">
          {appeals.length === 0 && <p className="p-2 text-center text-[14px] text-[#56657a]">Апелляций нет.</p>}
          {appeals.map((a) => (
            <div key={a.id} className="border border-[#C9D4E2] p-3 mb-2">
              <div className="flex flex-wrap items-center gap-2">
                <b>{a.userNick}</b>
                <span className={`text-[12px] font-bold ${a.status === "open" ? "text-[#B22335]" : "text-[#1e7e34]"}`}>{a.status === "open" ? "открыта" : a.status === "accepted" ? "принята" : "отклонена"}</span>
                <span className="text-[12px] text-[#56657a]">{fmtDateTime(a.createdAt)}</span>
              </div>
              <p className="mt-1 text-[13.5px]">{a.text}</p>
              {a.status === "open" && (
                <div className="mt-2 flex gap-1.5">
                  <button className="sm-btn sm-btn-primary" onClick={async () => { try { const r = await fetch("/api/admin/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "appeal", id: a.id, decision: "accept", token: props.token }) }); const d = await r.json(); if (!r.ok) throw Error(d.error); props.notify(d.note || "Принята"); loadSanctions(); } catch (e) { props.notify(e instanceof Error ? e.message : "Ошибка"); } }}>Принять</button>
                  <button className="sm-btn" onClick={async () => { try { const r = await fetch("/api/admin/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "appeal", id: a.id, decision: "reject", token: props.token }) }); const d = await r.json(); if (!r.ok) throw Error(d.error); props.notify(d.note || "Отклонена"); loadSanctions(); } catch (e) { props.notify(e instanceof Error ? e.message : "Ошибка"); } }}>Отклонить</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* 2026-10-01: Карточка проверки сообщения */
interface CheckCardData {
  message: { id: string; num: number; authorName: string; authorId: string | null; body: string; createdAt: string; isDeleted: boolean; isHiddenByAi: boolean; hiddenReason: string; needHuman: boolean; aiStatus: string; aiNote: string; modLevel: number; aiAction: string; aiConfidence: number; aiSignal: string; };
  topic: { id: number; title: string };
  rubric: { id: number; name: string; slug: string } | null;
  context: { id: string; num: number; authorName: string; body: string; createdAt: string; isDeleted: boolean; isHiddenByAi: boolean; isCurrent: boolean }[];
  complaints: { id: string; category: string; comment: string; reporterName: string; aiVerdict: string; aiNote: string; resolved: boolean; createdAt: string }[];
  history: { id: string; actor: string; actorRole: string; action: string; reason: string; result: string; confidence: number; createdAt: string }[];
  userSanctions: { id: string; kind: string; reason: string; source: string; expiresAt: string | null; revoked: boolean; createdAt: string }[];
}

function ModerationCheckCard(props: { messageId: string; token: string | null; notify: (m: string) => void; onClose: () => void; onOpenTopic: (id: number) => void; }) {
  const [data, setData] = useState<CheckCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [confirmReason, setConfirmReason] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/moderation/${props.messageId}?token=${encodeURIComponent(props.token ?? "")}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw Error(d.error); return d; })
      .then((d: CheckCardData) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [props.messageId, props.token]);

  const doAction = async (action: string, reason: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/moderation/${props.messageId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: props.token, action, reason }) });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      props.notify(d.note || "Готово");
      setConfirmAction(null); setConfirmReason("");
      const r2 = await fetch(`/api/moderation/${props.messageId}?token=${encodeURIComponent(props.token ?? "")}`);
      const d2 = await r2.json();
      if (r2.ok) setData(d2);
    } catch (e) { props.notify(e instanceof Error ? e.message : "Ошибка"); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="p-6 text-center text-[14px] text-[#56657a]">Загрузка проверки…</div>;
  if (error) return <div className="p-6 text-center text-[14px] text-[#B22335]">{error}</div>;
  if (!data) return null;

  const m = data.message; const lvl = m.modLevel ?? 4; const li = LEVEL_LABELS[lvl] ?? LEVEL_LABELS[4]; const cp = Math.round((m.aiConfidence ?? 0) * 100);

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center gap-3">
        <button className="sm-btn" onClick={props.onClose}>← Назад</button>
        <h2 className="text-[16px] font-bold text-[#1E3A5F]">Проверка сообщения №{m.num}</h2>
      </div>

      {/* 1. Сообщение */}
      <div className="border border-[#1E3A5F] bg-[#F8FAFD] p-3 mb-3">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <b className={`text-[14px] ${nickGenderClass(m.authorName)}`}>{m.authorName}</b>
          <span className="text-[12px] text-[#56657a]">{fmtDateTime(m.createdAt)}</span>
          <a className="text-[12px] text-[#0A5CAA] underline" onClick={() => props.onOpenTopic(data.topic.id)}>тема: «{data.topic.title}»</a>
          {data.rubric && <span className="text-[12px] text-[#56657a]">рубрика: {data.rubric.name}</span>}
        </div>
        <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{m.body}</p>
        {m.isHiddenByAi && <p className="mt-2 text-[12px] text-[#8a6d1a]">⚠️ Скрыто авто: {m.hiddenReason}</p>}
        {m.isDeleted && <p className="mt-2 text-[12px] text-[#B22335]">⚠️ Удалено</p>}
      </div>

      {/* 2. Контекст */}
      {data.context.length > 0 && (
        <div className="mb-3">
          <h3 className="text-[13px] font-bold text-[#1E3A5F] mb-1">Контекст</h3>
          <div className="space-y-1">
            {data.context.map((c) => (
              <div key={c.id} className={`p-2 text-[12.5px] ${c.isCurrent ? "border border-[#1E3A5F] bg-[#EEF3F8]" : "bg-[#F8FAFD]"}`}>
                <b className={nickGenderClass(c.authorName)}>№{c.num} {c.authorName}</b>
                {c.isCurrent && <span className="ml-2 text-[10px] text-[#1E3A5F] font-bold">← текущее</span>}
                <p className="mt-0.5 text-[#334155]">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Жалобы */}
      <div className="mb-3">
        <h3 className="text-[13px] font-bold text-[#1E3A5F] mb-1">Жалобы</h3>
        {data.complaints.length === 0 ? <p className="text-[13px] text-[#56657a]">Жалоб нет</p> : (
          <div className="space-y-1">
            {data.complaints.map((c) => (
              <div key={c.id} className="border border-[#E2D4D4] bg-[#FDF8F8] p-2 text-[12.5px]">
                <b>⚑ {c.category}</b>
                {c.comment && <span> — «{c.comment}»</span>}
                <span className="text-[#8a6d6d] ml-2">{fmtDateTime(c.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Решение AI */}
      <div className="border border-[#1E3A5F] p-3 mb-3">
        <h3 className="text-[13px] font-bold text-[#1E3A5F] mb-2">Решение AI</h3>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="px-2 py-0.5 text-[11px] font-bold rounded" style={{ color: li.color, background: li.bg }}>{li.label}</span>
          <span className="text-[12px] text-[#4a5b6d]">статус: <b>{AI_ACTION_LABELS[m.aiAction ?? "WATCH"] ?? m.aiAction}</b></span>
          {cp > 0 && <span className="text-[12px] text-[#4a5b6d]">уверенность: <b>{cp}%</b></span>}
        </div>
        {m.aiSignal && <p className="text-[12.5px] text-[#56657a]">сигнал: {m.aiSignal}</p>}
        {m.aiNote && <p className="text-[12.5px] text-[#56657a] mt-1">причина: {m.aiNote}</p>}
      </div>

      {/* 5. История нарушений */}
      {data.userSanctions.length > 0 && (
        <div className="mb-3">
          <h3 className="text-[13px] font-bold text-[#1E3A5F] mb-1">История нарушений</h3>
          <div className="space-y-1">
            {data.userSanctions.map((s) => (
              <div key={s.id} className="border border-[#E2D4D4] bg-[#FDF8F8] p-2 text-[12.5px]">
                <b>{KIND_LABELS[s.kind] ?? s.kind}</b>
                <span className="text-[#8a6d6d] ml-2">{s.source === "ai" ? "авто" : "человек"}</span>
                <span className="text-[#56657a] ml-2">{fmtDateTime(s.createdAt)}</span>
                {s.revoked && <span className="text-[#1e7e34] ml-2">отменена</span>}
                <p className="text-[#56657a] mt-0.5">{s.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. История решений */}
      {data.history.length > 0 && (
        <div className="mb-3">
          <h3 className="text-[13px] font-bold text-[#1E3A5F] mb-1">История решений</h3>
          <div className="space-y-1">
            {data.history.map((h) => (
              <div key={h.id} className="border-l-2 border-[#1E3A5F] pl-3 py-1 text-[12.5px]">
                <span className="text-[#56657a]">{fmtDateTime(h.createdAt)}</span> — <b>{h.actor === "ai" ? "AI" : h.actor}</b> — {ADMIN_ACTIONS.find((a) => a.key === h.action)?.label ?? h.action}
                {h.reason && <span className="text-[#56657a]"> — {h.reason}</span>}
                {h.result && <span className="text-[#1e7e34]"> → {h.result}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Действия администратора */}
      <div className="border-t border-[#C9D4E2] pt-3">
        <h3 className="text-[13px] font-bold text-[#1E3A5F] mb-2">Действия</h3>
        {confirmAction ? (
          <div className="border border-[#1E3A5F] bg-[#F8FAFD] p-3">
            <p className="text-[13px] mb-2">Подтвердите: <b>{ADMIN_ACTIONS.find((a) => a.key === confirmAction)?.label}</b></p>
            <textarea value={confirmReason} onChange={(e) => setConfirmReason(e.target.value)} placeholder="Причина (обязательно)" className="w-full border border-[#1E3A5F] px-2.5 py-1.5 text-[13.5px] outline-none mb-2" rows={2} />
            <div className="flex gap-1.5">
              <button className="sm-btn sm-btn-primary" disabled={busy} onClick={() => doAction(confirmAction, confirmReason.trim())}>{busy ? "Выполняется…" : "Подтвердить"}</button>
              <button className="sm-btn" onClick={() => { setConfirmAction(null); setConfirmReason(""); }}>Отмена</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {ADMIN_ACTIONS.map((a) => (
              <button key={a.key} className="px-3 py-1.5 text-[12.5px] font-bold border rounded transition-colors" style={{ color: a.color, borderColor: a.color, background: "transparent" }} disabled={busy} onClick={() => { if (a.confirm) setConfirmAction(a.key); else doAction(a.key, ""); }}>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HelpModerationBlock(props: { token: string | null; notify: (m: string) => void }) {
  const [data, setData] = useState<{
    complaints: {
      id: string;
      category: string;
      comment: string;
      reporterName: string;
      aiVerdict: string;
      aiNote: string;
      publication: { id: string; title: string; status: string; isHiddenByAi: boolean; authorName: string };
    }[];
    queue: {
      id: string;
      title: string;
      text: string;
      authorName: string;
      isHiddenByAi: boolean;
      hiddenReason: string;
      needHuman: boolean;
      aiNote: string;
      status: string;
    }[];
    openCount: number;
  } | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    if (!props.token) return;
    fetch(`/api/admin/help?token=${encodeURIComponent(props.token)}&show=open`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Ошибка");
        return d;
      })
      .then((d) => setData(d))
      .catch((e) => setErr(e.message || "Ошибка"));
  }, [props.token]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const act = async (action: string, id: string, confirmText?: string) => {
    if (!props.token) return;
    if (confirmText && !window.confirm(confirmText)) return;
    const r = await fetch("/api/admin/help", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: props.token, action, id }),
    });
    const d = await r.json();
    props.notify(r.ok ? d.note || "Готово" : d.error || "Ошибка");
    load();
  };

  return (
    <div className="border-b border-[#C9D4E2] bg-[#FAFBFC] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-[13.5px]">Раздел «Нужна помощь»</b>
        <span className="text-[12.5px] text-[#56657a]">
          нерешённых жалоб: {data?.openCount ?? "…"} · скрытых/спорных объявлений: {data?.queue.length ?? "…"}
        </span>
        <button className="sm-btn ml-auto" onClick={load}>
          Обновить
        </button>
      </div>
      {err && <p className="mt-1 text-[13px] text-[#B22335]">{err}</p>}
      {data && data.complaints.length === 0 && data.queue.length === 0 && (
        <p className="mt-1 text-[12.5px] text-[#56657a]">Нерешённых жалоб и скрытых объявлений в разделе нет.</p>
      )}
      {data && data.complaints.length > 0 && (
        <ul className="mt-1.5 divide-y divide-[#E4E8EE]">
          {data.complaints.map((c) => (
            <li key={c.id} className="py-1.5 text-[13px] leading-snug">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="border border-[#8a6d1a] px-1.5 text-[11.5px] font-bold text-[#8a6d1a]">
                  {HELP_COMPLAINT_LABELS[c.category] ?? c.category}
                </span>
                <b>«{c.publication.title}»</b>
                <span className="text-[12px] text-[#56657a]">
                  автор: {c.publication.authorName} · статус: {c.publication.status === "resolved" ? "Вопрос решён" : c.publication.status === "irrelevant" ? "Неактуально" : "активная"}
                  {c.publication.isHiddenByAi ? " (скрыто авто)" : ""}
                </span>
              </div>
              {c.comment && <div className="mt-0.5 text-[12.5px] text-[#3d4a5c]">Комментарий: «{c.comment}»</div>}
              {c.aiNote && (
                <div className="mt-0.5 text-[12px] text-[#56657a]">
                  Авто: {c.aiVerdict || "проверка идёт"} — {c.aiNote}
                </div>
              )}
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button className="sm-btn" onClick={() => act("hide-publication", c.publication.id)}>
                  Скрыть публикацию
                </button>
                <button
                  className="sm-btn"
                  onClick={() => act("delete-publication", c.publication.id, "Удалить публикацию из раздела «Нужна помощь»?")}
                >
                  Удалить публикацию
                </button>
                <button className="sm-btn" onClick={() => act("resolve-complaint", c.id)}>
                  Жалоба решена
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && data.queue.length > 0 && (
        <ul className="mt-1.5 divide-y divide-[#E4E8EE]">
          {data.queue.map((q) => (
            <li key={q.id} className="py-1.5 text-[13px] leading-snug">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="border border-[#5b4a72] px-1.5 text-[11.5px] font-bold text-[#5b4a72]">
                  {q.isHiddenByAi ? "скрыто авто" : "спорный случай"}
                </span>
                <b>«{q.title}»</b>
                <span className="text-[12px] text-[#56657a]">
                  автор: <b className={nickGenderClass(q.authorName)}>{q.authorName}</b> · статус: {q.status === "resolved" ? "Вопрос решён" : q.status === "irrelevant" ? "Неактуально" : "активная"}
                </span>
              </div>
              {(q.hiddenReason || q.aiNote) && (
                <div className="mt-0.5 text-[12px] text-[#56657a]">Причина: {q.hiddenReason || q.aiNote}</div>
              )}
              <div className="mt-0.5 text-[12.5px] text-[#3d4a5c]">{q.text.slice(0, 220)}{q.text.length > 220 ? "…" : ""}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {q.isHiddenByAi && (
                  <button className="sm-btn" onClick={() => act("restore-publication", q.id)}>
                    Вернуть в ленту
                  </button>
                )}
                {!q.isHiddenByAi && (
                  <button className="sm-btn" onClick={() => act("hide-publication", q.id)}>
                    Скрыть
                  </button>
                )}
                <button
                  className="sm-btn"
                  onClick={() => act("delete-publication", q.id, "Удалить публикацию из раздела «Нужна помощь»?")}
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * ШАГ 17. Блок модерации самостоятельного раздела «Подслушано Сахалин»:
 * нерешённые жалобы на сообщения + очередь (скрытые ИИ и спорные случаи).
 * Слух/неподтверждённая информация сама по себе НЕ нарушение — модератор
 * оценивает содержание и реальные нарушения (ТЗ п.15/16).
 */
const OVERHEARD_COMPLAINT_LABELS: Record<string, string> = {
  insult: "Оскорбления",
  threat: "Угрозы",
  bullying: "Травля",
  fraud: "Мошенничество",
  spam: "Спам",
  ad: "Реклама",
  personal_data: "Персональные данные",
  forbidden: "Запрещённое содержание",
  other: "Другие нарушения",
};

const WTB_COMPLAINT_LABELS: Record<string, string> = {
  ad: "Реклама",
  spam: "Спам",
  fraud: "Мошенничество",
  personal_data: "Личные данные",
  other: "Другое",
};

/** ШАГ 23/20/25. Причины жалоб в «Где дешевле», «Рекомендую» и «О работодателях»
 *  (в каждом разделе ровно пять — одинаковый состав). */
const CD_COMPLAINT_LABELS: Record<string, string> = {
  ad: "Реклама",
  spam: "Спам",
  fraud: "Мошенничество",
  personal_data: "Личные данные",
  other: "Другое",
};
const RC_COMPLAINT_LABELS: Record<string, string> = {
  ad: "Реклама",
  spam: "Спам",
  fraud: "Мошенничество",
  personal_data: "Личные данные",
  other: "Другое",
};
const EP_COMPLAINT_LABELS: Record<string, string> = {
  ad: "Реклама",
  spam: "Спам",
  fraud: "Мошенничество",
  personal_data: "Личные данные",
  other: "Другое",
};
/** ШАГ 22 (восстановление). Причины жалоб в «Объявлениях» — рекламы в списке
 *  нет: объявления сами по себе являются рекламой товаров/услуг автора. */
const AD_COMPLAINT_LABELS: Record<string, string> = {
  spam: "Спам",
  fraud: "Мошенничество",
  forbidden: "Запрещённый товар",
  personal_data: "Личные данные",
  other: "Другое",
};

/**
 * ШАГ 23/20/25. Универсальный блок модерации самостоятельного раздела
 * (жалобы + скрытые ИИ/спорные случаи). Действия человека-модератора:
 * скрыть / вернуть в ленту / удалить / отметить жалобу решённой.
 * Параметризуется базой API, заголовком, склонением существительного
 * и метками причин жалоб — у трёх новых разделов одинаковая механика.
 */
function BlockSectionModerationBlock(props: {
  token: string | null;
  notify: (m: string) => void;
  apiBase: string;
  title: string;
  noun: string; // «вопрос» | «публикацию» | «отзыв»
  complaintLabels: Record<string, string>;
}) {
  const [data, setData] = useState<{
    complaints: {
      id: string;
      category: string;
      comment: string;
      reporterName: string;
      aiVerdict: string;
      aiNote: string;
      post: { id: string; title: string; isHiddenByAi: boolean; authorName: string };
    }[];
    queue: {
      id: string;
      title: string;
      text: string;
      place: string;
      authorName: string;
      isHiddenByAi: boolean;
      hiddenReason: string;
      needHuman: boolean;
      aiNote: string;
    }[];
    openCount: number;
  } | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    if (!props.token) return;
    fetch(`${props.apiBase}?token=${encodeURIComponent(props.token)}&show=open`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Ошибка");
        return d;
      })
      .then((d) => setData(d))
      .catch((e) => setErr(e.message || "Ошибка"));
  }, [props.token, props.apiBase]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const act = async (action: string, id: string, confirmText?: string) => {
    if (!props.token) return;
    if (confirmText && !window.confirm(confirmText)) return;
    const r = await fetch(props.apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: props.token, action, id }),
    });
    const d = await r.json();
    props.notify(r.ok ? d.note || "Готово" : d.error || "Ошибка");
    load();
  };

  const nounAcc = props.noun.endsWith("ю") ? props.noun : props.noun; // «вопрос»/«публикацию»/«отзыв»
  return (
    <div className="border-b border-[#C9D4E2] bg-[#FAFBFC] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-[13.5px]">{props.title}</b>
        <span className="text-[12.5px] text-[#56657a]">
          нерешённых жалоб: {data?.openCount ?? "…"} · скрытых/спорных: {data?.queue.length ?? "…"}
        </span>
        <button className="sm-btn ml-auto" onClick={load}>
          Обновить
        </button>
      </div>
      {err && <p className="mt-1 text-[13px] text-[#B22335]">{err}</p>}
      {data && data.complaints.length === 0 && data.queue.length === 0 && (
        <p className="mt-1 text-[12.5px] text-[#56657a]">Нерешённых жалоб и скрытых публикаций в разделе нет.</p>
      )}
      {data && data.complaints.length > 0 && (
        <ul className="mt-1.5 divide-y divide-[#E4E8EE]">
          {data.complaints.map((c) => (
            <li key={c.id} className="py-1.5 text-[13px] leading-snug">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="border border-[#8a6d1a] px-1.5 text-[11.5px] font-bold text-[#8a6d1a]">
                  {props.complaintLabels[c.category] ?? c.category}
                </span>
                <b>«{c.post.title}»</b>
                <span className="text-[12px] text-[#56657a]">
                  автор: {c.post.authorName}
                  {c.post.isHiddenByAi ? " (скрыто авто)" : ""}
                </span>
              </div>
              {c.comment && <div className="mt-0.5 text-[12.5px] text-[#3d4a5c]">Комментарий: «{c.comment}»</div>}
              {c.aiNote && (
                <div className="mt-0.5 text-[12px] text-[#56657a]">
                  Авто: {c.aiVerdict || "проверка идёт"} — {c.aiNote}
                </div>
              )}
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button className="sm-btn" onClick={() => act("hide-post", c.post.id)}>
                  Скрыть
                </button>
                <button
                  className="sm-btn"
                  onClick={() => act("delete-post", c.post.id, `Удалить ${nounAcc} из раздела?`)}
                >
                  Удалить
                </button>
                <button className="sm-btn" onClick={() => act("resolve-complaint", c.id)}>
                  Жалоба решена
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && data.queue.length > 0 && (
        <ul className="mt-1.5 divide-y divide-[#E4E8EE]">
          {data.queue.map((q) => (
            <li key={q.id} className="py-1.5 text-[13px] leading-snug">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="border border-[#5b4a72] px-1.5 text-[11.5px] font-bold text-[#5b4a72]">
                  {q.isHiddenByAi ? "скрыто авто" : "спорный случай"}
                </span>
                <b>«{q.title}»</b>
                <span className="text-[12px] text-[#56657a]">
                  автор: <b className={nickGenderClass(q.authorName)}>{q.authorName}</b>
                  {q.place ? ` · место: ${q.place}` : ""}
                </span>
              </div>
              {(q.hiddenReason || q.aiNote) && (
                <div className="mt-0.5 text-[12px] text-[#56657a]">Причина: {q.hiddenReason || q.aiNote}</div>
              )}
              <div className="mt-0.5 text-[12.5px] text-[#3d4a5c]">{q.text.slice(0, 220)}{q.text.length > 220 ? "…" : ""}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {q.isHiddenByAi && (
                  <button className="sm-btn" onClick={() => act("restore-post", q.id)}>
                    Вернуть в ленту
                  </button>
                )}
                {!q.isHiddenByAi && (
                  <button className="sm-btn" onClick={() => act("hide-post", q.id)}>
                    Скрыть
                  </button>
                )}
                <button
                  className="sm-btn"
                  onClick={() => act("delete-post", q.id, `Удалить ${nounAcc} из раздела?`)}
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** ШАГ 26. Причины жалоб в «Знакомствах» (ровно девять). */
const DK_COMPLAINT_LABELS: Record<string, string> = {
  spam: "Спам",
  commercial: "Реклама",
  fraud: "Мошенничество",
  insult: "Оскорбления",
  threat: "Угрозы",
  exploitation: "Сексуальная эксплуатация или интим-услуги",
  personal_data: "Чужие персональные данные или контакты",
  illegal: "Незаконное предложение",
  other: "Другое нарушение правил",
};

/** ШАГ 26. Категории «Знакомств» (ровно две). */
const DK_CATEGORY_LABELS: Record<string, string> = {
  m4w: "Мужчина ищет женщину",
  w4m: "Женщина ищет мужчину",
};

/** ШАГ 19. Причины жалоб в «ЖКХ и городские проблемы» (ТЗ п.17 — ровно восемь). */
const GKH_COMPLAINT_LABELS: Record<string, string> = {
  personal_data: "Персональные данные",
  insult: "Оскорбления",
  threat: "Угрозы",
  spam: "Спам",
  ad: "Реклама",
  fraud: "Мошенничество",
  offtopic: "Не по теме",
  other: "Другое",
};

const GKH_STATUS_LABELS: Record<string, string> = {
  active: "Проблема актуальна",
  in_progress: "Решается",
  solved: "Решено",
};

function OverheardModerationBlock(props: { token: string | null; notify: (m: string) => void }) {
  const [data, setData] = useState<{
    complaints: {
      id: string;
      category: string;
      comment: string;
      reporterName: string;
      aiVerdict: string;
      aiNote: string;
      post: { id: string; title: string; isHiddenByAi: boolean; authorName: string };
    }[];
    queue: {
      id: string;
      title: string;
      text: string;
      place: string;
      authorName: string;
      isHiddenByAi: boolean;
      hiddenReason: string;
      needHuman: boolean;
      aiNote: string;
    }[];
    openCount: number;
  } | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    if (!props.token) return;
    fetch(`/api/admin/overheard?token=${encodeURIComponent(props.token)}&show=open`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Ошибка");
        return d;
      })
      .then((d) => setData(d))
      .catch((e) => setErr(e.message || "Ошибка"));
  }, [props.token]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const act = async (action: string, id: string, confirmText?: string) => {
    if (!props.token) return;
    if (confirmText && !window.confirm(confirmText)) return;
    const r = await fetch("/api/admin/overheard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: props.token, action, id }),
    });
    const d = await r.json();
    props.notify(r.ok ? d.note || "Готово" : d.error || "Ошибка");
    load();
  };

  return (
    <div className="border-b border-[#C9D4E2] bg-[#FAFBFC] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-[13.5px]">Раздел «Подслушано Сахалин»</b>
        <span className="text-[12.5px] text-[#56657a]">
          нерешённых жалоб: {data?.openCount ?? "…"} · скрытых/спорных сообщений: {data?.queue.length ?? "…"}
        </span>
        <button className="sm-btn ml-auto" onClick={load}>
          Обновить
        </button>
      </div>
      {err && <p className="mt-1 text-[13px] text-[#B22335]">{err}</p>}
      {data && data.complaints.length === 0 && data.queue.length === 0 && (
        <p className="mt-1 text-[12.5px] text-[#56657a]">Нерешённых жалоб и скрытых сообщений в разделе нет.</p>
      )}
      {data && data.complaints.length > 0 && (
        <ul className="mt-1.5 divide-y divide-[#E4E8EE]">
          {data.complaints.map((c) => (
            <li key={c.id} className="py-1.5 text-[13px] leading-snug">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="border border-[#8a6d1a] px-1.5 text-[11.5px] font-bold text-[#8a6d1a]">
                  {OVERHEARD_COMPLAINT_LABELS[c.category] ?? c.category}
                </span>
                <b>«{c.post.title}»</b>
                <span className="text-[12px] text-[#56657a]">
                  автор: {c.post.authorName}
                  {c.post.isHiddenByAi ? " (скрыто авто)" : ""}
                </span>
              </div>
              {c.comment && <div className="mt-0.5 text-[12.5px] text-[#3d4a5c]">Комментарий: «{c.comment}»</div>}
              {c.aiNote && (
                <div className="mt-0.5 text-[12px] text-[#56657a]">
                  Авто: {c.aiVerdict || "проверка идёт"} — {c.aiNote}
                </div>
              )}
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button className="sm-btn" onClick={() => act("hide-post", c.post.id)}>
                  Скрыть сообщение
                </button>
                <button
                  className="sm-btn"
                  onClick={() => act("delete-post", c.post.id, "Удалить сообщение из раздела «Подслушано Сахалин»?")}
                >
                  Удалить сообщение
                </button>
                <button className="sm-btn" onClick={() => act("resolve-complaint", c.id)}>
                  Жалоба решена
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && data.queue.length > 0 && (
        <ul className="mt-1.5 divide-y divide-[#E4E8EE]">
          {data.queue.map((q) => (
            <li key={q.id} className="py-1.5 text-[13px] leading-snug">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="border border-[#5b4a72] px-1.5 text-[11.5px] font-bold text-[#5b4a72]">
                  {q.isHiddenByAi ? "скрыто авто" : "спорный случай"}
                </span>
                <b>«{q.title}»</b>
                <span className="text-[12px] text-[#56657a]">
                  автор: <b className={nickGenderClass(q.authorName)}>{q.authorName}</b>
                  {q.place ? ` · место: ${q.place}` : ""}
                </span>
              </div>
              {(q.hiddenReason || q.aiNote) && (
                <div className="mt-0.5 text-[12px] text-[#56657a]">Причина: {q.hiddenReason || q.aiNote}</div>
              )}
              <div className="mt-0.5 text-[12.5px] text-[#3d4a5c]">{q.text.slice(0, 220)}{q.text.length > 220 ? "…" : ""}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {q.isHiddenByAi && (
                  <button className="sm-btn" onClick={() => act("restore-post", q.id)}>
                    Вернуть в ленту
                  </button>
                )}
                {!q.isHiddenByAi && (
                  <button className="sm-btn" onClick={() => act("hide-post", q.id)}>
                    Скрыть
                  </button>
                )}
                <button
                  className="sm-btn"
                  onClick={() => act("delete-post", q.id, "Удалить сообщение из раздела «Подслушано Сахалин»?")}
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WhereToBuyModerationBlock(props: { token: string | null; notify: (m: string) => void }) {
  const [data, setData] = useState<{
    complaints: {
      id: string;
      category: string;
      comment: string;
      reporterName: string;
      aiVerdict: string;
      aiNote: string;
      post: { id: string; title: string; isHiddenByAi: boolean; authorName: string };
    }[];
    queue: {
      id: string;
      title: string;
      text: string;
      place: string;
      authorName: string;
      isHiddenByAi: boolean;
      hiddenReason: string;
      needHuman: boolean;
      aiNote: string;
    }[];
    openCount: number;
  } | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    if (!props.token) return;
    fetch(`/api/admin/wheretobuy?token=${encodeURIComponent(props.token)}&show=open`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Ошибка");
        return d;
      })
      .then((d) => setData(d))
      .catch((e) => setErr(e.message || "Ошибка"));
  }, [props.token]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const act = async (action: string, id: string, confirmText?: string) => {
    if (!props.token) return;
    if (confirmText && !window.confirm(confirmText)) return;
    const r = await fetch("/api/admin/wheretobuy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: props.token, action, id }),
    });
    const d = await r.json();
    props.notify(r.ok ? d.note || "Готово" : d.error || "Ошибка");
    load();
  };

  return (
    <div className="border-b border-[#C9D4E2] bg-[#FAFBFC] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-[13.5px]">Раздел «Где купить»</b>
        <span className="text-[12.5px] text-[#56657a]">
          нерешённых жалоб: {data?.openCount ?? "…"} · скрытых/спорных вопросов: {data?.queue.length ?? "…"}
        </span>
        <button className="sm-btn ml-auto" onClick={load}>
          Обновить
        </button>
      </div>
      {err && <p className="mt-1 text-[13px] text-[#B22335]">{err}</p>}
      {data && data.complaints.length === 0 && data.queue.length === 0 && (
        <p className="mt-1 text-[12.5px] text-[#56657a]">Нерешённых жалоб и скрытых вопросов в разделе нет.</p>
      )}
      {data && data.complaints.length > 0 && (
        <ul className="mt-1.5 divide-y divide-[#E4E8EE]">
          {data.complaints.map((c) => (
            <li key={c.id} className="py-1.5 text-[13px] leading-snug">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="border border-[#8a6d1a] px-1.5 text-[11.5px] font-bold text-[#8a6d1a]">
                  {WTB_COMPLAINT_LABELS[c.category] ?? c.category}
                </span>
                <b>«{c.post.title}»</b>
                <span className="text-[12px] text-[#56657a]">
                  автор: {c.post.authorName}
                  {c.post.isHiddenByAi ? " (скрыто авто)" : ""}
                </span>
              </div>
              {c.comment && <div className="mt-0.5 text-[12.5px] text-[#3d4a5c]">Комментарий: «{c.comment}»</div>}
              {c.aiNote && (
                <div className="mt-0.5 text-[12px] text-[#56657a]">
                  Авто: {c.aiVerdict || "проверка идёт"} — {c.aiNote}
                </div>
              )}
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button className="sm-btn" onClick={() => act("hide-post", c.post.id)}>
                  Скрыть вопрос
                </button>
                <button
                  className="sm-btn"
                  onClick={() => act("delete-post", c.post.id, "Удалить вопрос из раздела «Где купить»?")}
                >
                  Удалить вопрос
                </button>
                <button className="sm-btn" onClick={() => act("resolve-complaint", c.id)}>
                  Жалоба решена
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && data.queue.length > 0 && (
        <ul className="mt-1.5 divide-y divide-[#E4E8EE]">
          {data.queue.map((q) => (
            <li key={q.id} className="py-1.5 text-[13px] leading-snug">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="border border-[#5b4a72] px-1.5 text-[11.5px] font-bold text-[#5b4a72]">
                  {q.isHiddenByAi ? "скрыто авто" : "спорный случай"}
                </span>
                <b>«{q.title}»</b>
                <span className="text-[12px] text-[#56657a]">
                  автор: <b className={nickGenderClass(q.authorName)}>{q.authorName}</b>
                  {q.place ? ` · место: ${q.place}` : ""}
                </span>
              </div>
              {(q.hiddenReason || q.aiNote) && (
                <div className="mt-0.5 text-[12px] text-[#56657a]">Причина: {q.hiddenReason || q.aiNote}</div>
              )}
              <div className="mt-0.5 text-[12.5px] text-[#3d4a5c]">{q.text.slice(0, 220)}{q.text.length > 220 ? "…" : ""}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {q.isHiddenByAi && (
                  <button className="sm-btn" onClick={() => act("restore-post", q.id)}>
                    Вернуть в ленту
                  </button>
                )}
                {!q.isHiddenByAi && (
                  <button className="sm-btn" onClick={() => act("hide-post", q.id)}>
                    Скрыть
                  </button>
                )}
                <button
                  className="sm-btn"
                  onClick={() => act("delete-post", q.id, "Удалить вопрос из раздела «Где купить»?")}
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * ШАГ 19. Блок модерации раздела «ЖКХ и городские проблемы» (ТЗ п.18):
 * жалобы на публикации и обновления, скрытые ИИ и спорные случаи;
 * действия: вернуть/скрыть/удалить, сменить статус (ТЗ п.3 — модератор
 * может проверить ситуацию и изменить статус), указать организацию (п.10),
 * подтвердить/снять статус представителя организации (п.11).
 */
function GkhModerationBlock(props: { token: string | null; notify: (m: string) => void }) {
  const [data, setData] = useState<{
    complaints: {
      id: string;
      category: string;
      comment: string;
      reporterName: string;
      aiVerdict: string;
      aiNote: string;
      problem: { id: string; title: string; isHiddenByAi: boolean; authorName: string } | null;
      update: { id: string; text: string; isHiddenByAi: boolean; authorName: string } | null;
    }[];
    problems: {
      id: string;
      title: string;
      authorName: string;
      isHiddenByAi: boolean;
      hiddenReason: string;
      needHuman: boolean;
      aiNote: string;
      status: string;
    }[];
    updates: {
      id: string;
      text: string;
      authorName: string;
      isHiddenByAi: boolean;
      hiddenReason: string;
      needHuman: boolean;
      aiNote: string;
      problem: { id: string; title: string };
    }[];
    openComplaints: number;
  } | null>(null);
  const [err, setErr] = useState("");
  const [repNick, setRepNick] = useState("");
  const [repOrg, setRepOrg] = useState("");

  const load = useCallback(() => {
    if (!props.token) return;
    fetch(`/api/admin/gkh?token=${encodeURIComponent(props.token)}&show=open`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Ошибка");
        return d;
      })
      .then((d) => setData(d))
      .catch((e) => setErr(e.message || "Ошибка"));
  }, [props.token]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const act = async (payload: Record<string, unknown>, confirmText?: string) => {
    if (!props.token) return;
    if (confirmText && !window.confirm(confirmText)) return;
    const r = await fetch("/api/admin/gkh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: props.token, ...payload }),
    });
    const d = await r.json();
    props.notify(r.ok ? d.note || "Готово" : d.error || "Ошибка");
    load();
  };

  const setStatus = (problemId: string, status: string) => {
    if (status) act({ action: "set-status", problemId, status });
  };

  const setOrganization = (problemId: string) => {
    const organization = window.prompt("Название ответственной организации (пусто — убрать):");
    if (organization === null) return;
    act({ action: "set-organization", problemId, organization });
  };

  return (
    <div className="border-b border-[#C9D4E2] bg-[#FAFBFC] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-[13.5px]">Раздел «ЖКХ и городские проблемы»</b>
        <span className="text-[12.5px] text-[#56657a]">
          нерешённых жалоб: {data?.openComplaints ?? "…"} · скрытых/спорных публикаций: {data?.problems.length ?? "…"} ·
          обновлений: {data?.updates.length ?? "…"}
        </span>
        <button className="sm-btn ml-auto" onClick={load}>
          Обновить
        </button>
      </div>
      {err && <p className="mt-1 text-[13px] text-[#B22335]">{err}</p>}
      {data && data.complaints.length === 0 && data.problems.length === 0 && data.updates.length === 0 && (
        <p className="mt-1 text-[12.5px] text-[#56657a]">Нерешённых жалоб и скрытых материалов в разделе нет.</p>
      )}
      {data && data.complaints.length > 0 && (
        <ul className="mt-1.5 divide-y divide-[#E4E8EE]">
          {data.complaints.map((c) => (
            <li key={c.id} className="py-1.5 text-[13px] leading-snug">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="border border-[#8a6d1a] px-1.5 text-[11.5px] font-bold text-[#8a6d1a]">
                  {GKH_COMPLAINT_LABELS[c.category] ?? c.category}
                </span>
                {c.problem && (
                  <>
                    <b>«{c.problem.title}»</b>
                    <span className="text-[12px] text-[#56657a]">
                      автор: {c.problem.authorName}
                      {c.problem.isHiddenByAi ? " (скрыто авто)" : ""}
                    </span>
                  </>
                )}
                {c.update && (
                  <>
                    <b>Обновление {c.update.authorName}</b>
                    <span className="text-[12px] text-[#56657a]">
                      {c.update.text.slice(0, 80)}
                      {c.update.isHiddenByAi ? " (скрыто авто)" : ""}
                    </span>
                  </>
                )}
              </div>
              {c.comment && <div className="mt-0.5 text-[12.5px] text-[#3d4a5c]">Комментарий: «{c.comment}»</div>}
              {c.aiNote && (
                <div className="mt-0.5 text-[12px] text-[#56657a]">
                  Авто: {c.aiVerdict || "проверка идёт"} — {c.aiNote}
                </div>
              )}
              <div className="mt-1 flex flex-wrap gap-1.5">
                {c.problem && (
                  <>
                    <button className="sm-btn" onClick={() => act({ action: "hide-problem", problemId: c.problem!.id })}>
                      Скрыть публикацию
                    </button>
                    <button
                      className="sm-btn"
                      onClick={() => act({ action: "delete-problem", problemId: c.problem!.id }, "Удалить публикацию? Тема форума сохранится.")}
                    >
                      Удалить публикацию
                    </button>
                  </>
                )}
                {c.update && (
                  <>
                    <button className="sm-btn" onClick={() => act({ action: "hide-update", updateId: c.update!.id })}>
                      Скрыть обновление
                    </button>
                    <button
                      className="sm-btn"
                      onClick={() => act({ action: "delete-update", updateId: c.update!.id }, "Удалить обновление?")}
                    >
                      Удалить обновление
                    </button>
                  </>
                )}
                <button className="sm-btn" onClick={() => act({ action: "resolve-complaint", complaintId: c.id })}>
                  Жалоба решена
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && data.problems.length > 0 && (
        <ul className="mt-1.5 divide-y divide-[#E4E8EE]">
          {data.problems.map((p) => (
            <li key={p.id} className="py-1.5 text-[13px] leading-snug">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="border border-[#5b4a72] px-1.5 text-[11.5px] font-bold text-[#5b4a72]">
                  {p.isHiddenByAi ? "скрыто авто" : "спорный случай"}
                </span>
                <b>«{p.title}»</b>
                <span className="text-[12px] text-[#56657a]">автор: <b className={nickGenderClass(p.authorName)}>{p.authorName}</b> · статус: {GKH_STATUS_LABELS[p.status] ?? p.status}</span>
              </div>
              {(p.hiddenReason || p.aiNote) && <div className="mt-0.5 text-[12px] text-[#56657a]">Причина: {p.hiddenReason || p.aiNote}</div>}
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {p.isHiddenByAi && (
                  <button className="sm-btn" onClick={() => act({ action: "restore-problem", problemId: p.id })}>
                    Вернуть в ленту
                  </button>
                )}
                {!p.isHiddenByAi && (
                  <button className="sm-btn" onClick={() => act({ action: "hide-problem", problemId: p.id })}>
                    Скрыть
                  </button>
                )}
                <button
                  className="sm-btn"
                  onClick={() => act({ action: "delete-problem", problemId: p.id }, "Удалить публикацию? Тема форума сохранится.")}
                >
                  Удалить
                </button>
                <button className="sm-btn" onClick={() => setOrganization(p.id)}>
                  Организация…
                </button>
                <select
                  className="sm-btn"
                  value={p.status}
                  onChange={(e) => setStatus(p.id, e.target.value)}
                  title="Модератор может проверить ситуацию и изменить статус (ТЗ п.3)"
                >
                  {Object.entries(GKH_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && data.updates.length > 0 && (
        <ul className="mt-1.5 divide-y divide-[#E4E8EE]">
          {data.updates.map((u) => (
            <li key={u.id} className="py-1.5 text-[13px] leading-snug">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="border border-[#5b4a72] px-1.5 text-[11.5px] font-bold text-[#5b4a72]">
                  {u.isHiddenByAi ? "скрыто авто" : "спорный случай"}
                </span>
                <span className="text-[12px] text-[#56657a]">
                  обновление <b className={nickGenderClass(u.authorName)}>{u.authorName}</b> к «{u.problem.title}»
                </span>
              </div>
              <div className="mt-0.5 text-[12.5px] text-[#3d4a5c]">
                {u.text.slice(0, 200)}
                {u.text.length > 200 ? "…" : ""}
              </div>
              {(u.hiddenReason || u.aiNote) && <div className="mt-0.5 text-[12px] text-[#56657a]">Причина: {u.hiddenReason || u.aiNote}</div>}
              <div className="mt-1 flex flex-wrap gap-1.5">
                {u.isHiddenByAi && (
                  <button className="sm-btn" onClick={() => act({ action: "restore-update", updateId: u.id })}>
                    Вернуть
                  </button>
                )}
                {!u.isHiddenByAi && (
                  <button className="sm-btn" onClick={() => act({ action: "hide-update", updateId: u.id })}>
                    Скрыть
                  </button>
                )}
                <button className="sm-btn" onClick={() => act({ action: "delete-update", updateId: u.id }, "Удалить обновление?")}>
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {/* ТЗ п.11: статус представителя организации подтверждается отдельно. */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[#E4E8EE] pt-2">
        <b className="text-[12.5px]">Представитель организации:</b>
        <input
          className="sm-btn"
          style={{ maxWidth: 170 }}
          placeholder="Ник пользователя"
          value={repNick}
          onChange={(e) => setRepNick(e.target.value)}
        />
        <input
          className="sm-btn"
          style={{ maxWidth: 200 }}
          placeholder="Организация"
          value={repOrg}
          onChange={(e) => setRepOrg(e.target.value)}
        />
        <button
          className="sm-btn"
          onClick={() => {
            if (!repNick.trim()) {
              props.notify("Укажите ник пользователя");
              return;
            }
            act({ action: "set-org-rep", nickname: repNick.trim(), orgName: repOrg.trim(), orgRep: true });
          }}
        >
          Подтвердить
        </button>
        <button
          className="sm-btn"
          onClick={() => {
            if (!repNick.trim()) {
              props.notify("Укажите ник пользователя");
              return;
            }
            act({ action: "set-org-rep", nickname: repNick.trim(), orgRep: false });
          }}
        >
          Снять
        </button>
      </div>
    </div>
  );
}

/**
 * ШАГ 26. Блок модерации раздела «Знакомства»: жалобы + скрытые ИИ / спорные
 * объявления. ТЗ: модерация ВИДИТ АВТОРА анонимного объявления (публичная
 * анонимность действует только для посетителей).
 */
function DatingModerationBlock(props: { token: string | null; notify: (m: string) => void }) {
  const [data, setData] = useState<{
    complaints: {
      id: string;
      category: string;
      comment: string;
      reporterName: string;
      aiVerdict: string;
      aiNote: string;
      post: { id: string; title: string; isHiddenByAi: boolean; authorName: string };
    }[];
    queue: {
      id: string;
      category: string;
      title: string;
      body: string;
      authorName: string;
      isHiddenByAi: boolean;
      hiddenReason: string;
      needHuman: boolean;
      aiNote: string;
    }[];
    openCount: number;
  } | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    if (!props.token) return;
    fetch(`/api/admin/znakomstva?token=${encodeURIComponent(props.token)}&show=open`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Ошибка");
        return d;
      })
      .then((d) => setData(d))
      .catch((e) => setErr(e.message || "Ошибка"));
  }, [props.token]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const act = async (action: string, id: string, confirmText?: string) => {
    if (!props.token) return;
    if (confirmText && !window.confirm(confirmText)) return;
    const r = await fetch("/api/admin/znakomstva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: props.token, action, id }),
    });
    const d = await r.json();
    props.notify(r.ok ? d.note || "Готово" : d.error || "Ошибка");
    load();
  };

  return (
    <div className="border-b border-[#C9D4E2] bg-[#FAFBFC] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-[13.5px]">Раздел «Знакомства»</b>
        <span className="text-[12.5px] text-[#56657a]">
          нерешённых жалоб: {data?.openCount ?? "…"} · скрытых/спорных объявлений: {data?.queue.length ?? "…"}
        </span>
        <button className="sm-btn ml-auto" onClick={load}>
          Обновить
        </button>
      </div>
      {err && <p className="mt-1 text-[13px] text-[#B22335]">{err}</p>}
      {data && data.complaints.length === 0 && data.queue.length === 0 && (
        <p className="mt-1 text-[12.5px] text-[#56657a]">Нерешённых жалоб и скрытых объявлений в разделе нет.</p>
      )}
      {data && data.complaints.length > 0 && (
        <ul className="mt-1.5 divide-y divide-[#E4E8EE]">
          {data.complaints.map((c) => (
            <li key={c.id} className="py-1.5 text-[13px] leading-snug">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="border border-[#8a6d1a] px-1.5 text-[11.5px] font-bold text-[#8a6d1a]">
                  {DK_COMPLAINT_LABELS[c.category] ?? c.category}
                </span>
                <b>«{c.post.title}»</b>
                <span className="text-[12px] text-[#56657a]">
                  автор: {c.post.authorName}
                  {c.post.isHiddenByAi ? " (скрыто авто)" : ""}
                </span>
              </div>
              {c.comment && <div className="mt-0.5 text-[12.5px] text-[#3d4a5c]">Комментарий: «{c.comment}»</div>}
              {c.aiNote && (
                <div className="mt-0.5 text-[12px] text-[#56657a]">
                  Авто: {c.aiVerdict || "проверка идёт"} — {c.aiNote}
                </div>
              )}
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button className="sm-btn" onClick={() => act("hide-post", c.post.id)}>
                  Скрыть объявление
                </button>
                <button
                  className="sm-btn"
                  onClick={() => act("delete-post", c.post.id, "Удалить объявление из раздела «Знакомства»?")}
                >
                  Удалить объявление
                </button>
                <button className="sm-btn" onClick={() => act("resolve-complaint", c.id)}>
                  Жалоба решена
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && data.queue.length > 0 && (
        <ul className="mt-1.5 divide-y divide-[#E4E8EE]">
          {data.queue.map((q) => (
            <li key={q.id} className="py-1.5 text-[13px] leading-snug">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="border border-[#5b4a72] px-1.5 text-[11.5px] font-bold text-[#5b4a72]">
                  {q.isHiddenByAi ? "скрыто авто" : "спорный случай"}
                </span>
                <b>«{q.title}»</b>
                <span className="text-[12px] text-[#56657a]">
                  категория: {DK_CATEGORY_LABELS[q.category] ?? q.category} · автор: <b className={nickGenderClass(q.authorName)}>{q.authorName}</b>
                </span>
              </div>
              {(q.hiddenReason || q.aiNote) && (
                <div className="mt-0.5 text-[12px] text-[#56657a]">Причина: {q.hiddenReason || q.aiNote}</div>
              )}
              <div className="mt-0.5 text-[12.5px] text-[#3d4a5c]">{q.body.slice(0, 220)}{q.body.length > 220 ? "…" : ""}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {q.isHiddenByAi && (
                  <button className="sm-btn" onClick={() => act("restore-post", q.id)}>
                    Вернуть в ленту
                  </button>
                )}
                {!q.isHiddenByAi && (
                  <button className="sm-btn" onClick={() => act("hide-post", q.id)}>
                    Скрыть
                  </button>
                )}
                <button
                  className="sm-btn"
                  onClick={() => act("delete-post", q.id, "Удалить объявление из раздела «Знакомства»?")}
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ComplaintsSection(props: { token: string | null; notify: (m: string) => void; onOpenTopic: (id: number) => void }) {
  const [show, setShow] = useState<"open" | "all">("open");
  const [items, setItems] = useState<AdminComplaint[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!props.token) return;
    fetch(`/api/admin/complaints?token=${encodeURIComponent(props.token)}&show=${show}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Ошибка");
        return d;
      })
      .then((d) => {
        setItems(d.complaints || []);
        setOpenCount(d.openCount ?? 0);
      })
      .catch((e) => setError(e.message || "Ошибка"));
  }, [props.token, show]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const resolve = async (id: string) => {
    if (!props.token) return;
    const r = await fetch("/api/admin/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, token: props.token }),
    });
    const d = await r.json();
    props.notify(r.ok ? d.note || "Готово" : d.error || "Ошибка");
    load();
  };

  const decide = async (id: string, decision: string) => {
    if (!props.token) return;
    const r = await fetch("/api/admin/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "message", id, decision, token: props.token }),
    });
    const d = await r.json();
    props.notify(r.ok ? `Решение применено: ${decision}` : d.error || "Ошибка");
    load();
  };

  return (
    <div>
      <HelpModerationBlock token={props.token} notify={props.notify} />
      {/* ШАГ 17: блок модерации самостоятельного раздела «Подслушано Сахалин» */}
      <OverheardModerationBlock token={props.token} notify={props.notify} />
      {/* ШАГ 18: блок модерации самостоятельного раздела «Где купить» */}
      <WhereToBuyModerationBlock token={props.token} notify={props.notify} />
      {/* ШАГ 19: блок модерации самостоятельного раздела «ЖКХ и городские проблемы» */}
      <GkhModerationBlock token={props.token} notify={props.notify} />
      {/* ШАГ 26: блок модерации самостоятельного раздела «Знакомства» —
          модерация видит автора анонимных объявлений (ТЗ), посетители — нет */}
      <DatingModerationBlock token={props.token} notify={props.notify} />
      {/* ШАГ 23/20/25: блоки модерации самостоятельных разделов
          «Где дешевле», «Рекомендую / Не рекомендую», «О работодателях»
          (жалобы + скрытые ИИ/спорные; действия: скрыть/вернуть/удалить/решено) */}
      <BlockSectionModerationBlock
        token={props.token}
        notify={props.notify}
        apiBase="/api/admin/gdedeshevle"
        title="Раздел «Где дешевле»"
        noun="вопрос"
        complaintLabels={CD_COMPLAINT_LABELS}
      />
      <BlockSectionModerationBlock
        token={props.token}
        notify={props.notify}
        apiBase="/api/admin/recommend"
        title="Раздел «Рекомендую / Не рекомендую»"
        noun="публикацию"
        complaintLabels={RC_COMPLAINT_LABELS}
      />
      <BlockSectionModerationBlock
        token={props.token}
        notify={props.notify}
        apiBase="/api/admin/employers"
        title="Раздел «О работодателях»"
        noun="отзыв"
        complaintLabels={EP_COMPLAINT_LABELS}
      />
      {/* ШАГ 22 (восстановление): блок модерации самостоятельного раздела
          «Объявления» — доска объявлений (жалобы + скрытые ИИ/спорные) */}
      <BlockSectionModerationBlock
        token={props.token}
        notify={props.notify}
        apiBase="/api/admin/obyavleniya"
        title="Раздел «Объявления»"
        noun="объявление"
        complaintLabels={AD_COMPLAINT_LABELS}
      />
      <div className="border-b border-[#C9D4E2] p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button className={`sm-btn ${show === "open" ? "sm-btn-primary" : ""}`} onClick={() => setShow("open")}>
            Нерешённые ({openCount})
          </button>
          <button className={`sm-btn ${show === "all" ? "sm-btn-primary" : ""}`} onClick={() => setShow("all")}>
            Все
          </button>
          <button className="sm-btn" onClick={load}>
            Обновить
          </button>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-snug text-[#4a5b6d]">
          Количество жалоб никогда не блокирует аккаунт автоматически — каждая жалоба разбирается индивидуально.
        </p>
        {error && <p className="mt-1 text-[13.5px] text-[#B22335]">{error}</p>}
      </div>
      <ul className="max-h-[70vh] divide-y divide-[#D8DEE7] overflow-y-auto">
        {items.length === 0 && (
          <li className="p-4 text-center text-[14px] text-[#56657a]">{show === "open" ? "Нерешённых жалоб нет." : "Жалоб нет."}</li>
        )}
        {items.map((c) => (
          <li key={c.id} className="px-3 py-2.5 text-[14px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="border border-[#8a6d1a] px-1.5 text-[12px] font-bold text-[#8a6d1a]">{CATEGORY_LABELS[c.category] ?? c.category}</span>
              <b>{c.message.author}</b>
              <span className="text-[12.5px] text-[#56657a]">
                сообщение №{c.message.num} в теме{" "}
                <a className="text-[#0A5CAA] underline" onClick={() => props.onOpenTopic(c.message.topic.id)}>
                  «{c.message.topic.title}»
                </a>
              </span>
              {c.message.isHiddenByAi && <span className="border border-[#1E3A5F] px-1.5 text-[12px] font-bold">скрыто</span>}
              {c.message.isDeleted && <span className="border border-[#1E3A5F] bg-[#F2F6FA] px-1.5 text-[12px] font-bold">удалено</span>}
              {c.resolved && <span className="text-[12px] text-[#1e7e34]">рассмотрена</span>}
              <span className="ml-auto text-[12.5px] text-[#56657a]">{fmtDateTime(c.createdAt)}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-[14px]">{c.message.body}</p>
            {c.comment && <p className="mt-0.5 text-[12.5px] text-[#5a3a3a]">Комментарий жалобы{c.reporter ? ` (${c.reporter})` : ""}: «{c.comment}»</p>}
            <p className="mt-0.5 text-[12px] text-[#56657a]">
              {VERDICT_LABELS[c.aiVerdict] ?? c.aiVerdict}
              {c.aiNote ? `: ${c.aiNote}` : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button className="sm-btn" onClick={() => decide(c.message.id, "publish")}>
                опубликовать
              </button>
              <button className="sm-btn" onClick={() => decide(c.message.id, "hide")}>
                скрыть
              </button>
              <button className="sm-btn" onClick={() => decide(c.message.id, "delete")}>
                удалить
              </button>
              {!c.resolved && (
                <button className="sm-btn" onClick={() => resolve(c.id)}>
                  отметить рассмотренной
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ================= Пользователи ================= */

interface AdminUserRow {
  id: string;
  nickname: string;
  email: string;
  role: string;
  gender: string;
  emailVerified: boolean;
  restrictedNow: boolean;
  restrictedUntil: string | null;
  createdAt: string;
  topicsCount: number;
  messagesCount: number;
  sanctionsCount: number;
}

interface AdminUserProfile {
  user: AdminUserRow & { roleLabel: string };
  sanctions: {
    id: string;
    kind: string;
    kindLabel: string;
    reason: string;
    source: string;
    expiresAt: string | null;
    revoked: boolean;
    revokedBy: string;
    revokedReason: string;
    createdAt: string;
    appealStatus: string;
  }[];
  topics: { id: number; title: string; rubricName: string; answers: number; createdAt: string }[];
  messages: { id: string; topicId: number; topicTitle: string; body: string; createdAt: string }[];
}

function UsersSection(props: { token: string | null; isOwner: boolean; notify: (m: string) => void; onOpenProfile: (n: string) => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AdminUserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saKind, setSaKind] = useState("warning");
  const [saReason, setSaReason] = useState("");
  const [busy, setBusy] = useState(false);

  const search = useCallback(() => {
    if (!props.token) return;
    fetch(`/api/admin/users?token=${encodeURIComponent(props.token)}&q=${encodeURIComponent(q.trim())}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Ошибка");
        return d;
      })
      .then((d) => {
        setRows(d.users || []);
        setTotal(d.total ?? 0);
        setError("");
      })
      .catch((e) => setError(e.message || "Ошибка"));
  }, [props.token, q]);

  useEffect(() => {
    const t = window.setTimeout(search, 0);
    return () => window.clearTimeout(t);
  }, [search]);

  const openUser = useCallback(
    (nick: string) => {
      if (!props.token) return;
      setLoadingProfile(true);
      setSelected(null);
      fetch(`/api/admin/user/${encodeURIComponent(nick)}?token=${encodeURIComponent(props.token)}`)
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw Error(d.error || "Ошибка");
          return d;
        })
        .then((d) => setSelected(d))
        .catch((e) => props.notify(e.message || "Ошибка"))
        .finally(() => setLoadingProfile(false));
    },
    [props.token]
  );

  const sanction = async (payload: Record<string, unknown>, okMsg?: string) => {
    if (!props.token || !selected) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/sanction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, token: props.token }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка");
      props.notify(okMsg || d.note || "Готово");
      openUser(selected.user.nickname);
      search();
    } catch (e) {
      props.notify(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const applySanction = async () => {
    if (!selected) return;
    if (saReason.trim().length < 5) {
      props.notify("Укажите причину (минимум 5 символов)");
      return;
    }
    await sanction(
      { action: "apply", nick: selected.user.nickname, kind: saKind, reason: saReason.trim() },
      `${KIND_LABELS[saKind]} применена для ${selected.user.nickname}`
    );
    setSaReason("");
  };

  return (
    <div>
      <div className="border-b border-[#C9D4E2] p-2">
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по нику или email…"
            className="flex-1 border border-[#1E3A5F] px-2.5 py-1.5 text-[14px] outline-none"
          />
          <button className="sm-btn" onClick={search}>
            Найти
          </button>
        </div>
        {error && <p className="mt-1.5 text-[13.5px] text-[#B22335]">{error}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        {/* Список */}
        <div className="max-h-[64vh] overflow-y-auto border-b border-[#C9D4E2] lg:border-b-0 lg:border-r">
          <table className="w-full text-left text-[13px]">
            <thead className="sticky top-0 bg-[#F7FAFD] text-[12px] text-[#4a5b6d]">
              <tr>
                <th className="px-2 py-1.5 font-semibold">Ник</th>
                <th className="px-2 py-1.5 font-semibold">Регистрация</th>
                <th className="px-2 py-1.5 font-semibold">Тем / сообщ.</th>
                <th className="px-2 py-1.5 font-semibold">Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr
                  key={u.id}
                  className={`cursor-pointer border-t border-[#E4E9F0] hover:bg-[#F2F6FA] ${selected?.user.id === u.id ? "bg-[#EEF3F8]" : ""}`}
                  onClick={() => openUser(u.nickname)}
                >
                  <td className="px-2 py-1.5">
                    <b className={nickGenderClass(u.nickname)}>{u.nickname}</b>
                    <div className="text-[12.5px] text-[#56657a]">{u.email}</div>
                  </td>
                  <td className="px-2 py-1.5 text-[12px]">{fmtDate(u.createdAt)}</td>
                  <td className="px-2 py-1.5 text-[12px]">
                    {u.topicsCount} / {u.messagesCount}
                  </td>
                  <td className="px-2 py-1.5 text-[12px]">
                    {u.role !== "user" ? <span className="mr-1 font-bold text-[#0A5CAA]">{ROLE_LABELS[u.role] ?? u.role}</span> : null}
                    {u.restrictedNow ? <span className="font-bold text-[#B22335]">ограничен</span> : <span className="text-[#1e7e34]">активен</span>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-center text-[13.5px] text-[#56657a]">
                    Пользователей не найдено ({total} всего).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Профиль */}
        <div className="max-h-[64vh] overflow-y-auto p-2.5">
          {loadingProfile && <p className="text-[13.5px] text-[#56657a]">Загрузка профиля…</p>}
          {!loadingProfile && !selected && <p className="text-[13.5px] text-[#56657a]">Выберите пользователя из списка слева.</p>}
          {selected && (
            <div className="text-[13.5px]">
              <div className="flex flex-wrap items-center gap-1.5">
                <b className="text-[15px]">{selected.user.nickname}</b>
                <span className="border border-[#1E3A5F] bg-[#F2F6FA] px-1.5 text-[12px] font-bold">{selected.user.roleLabel}</span>
                {selected.user.emailVerified ? (
                  <span className="text-[12.5px] text-[#1e7e34]">email подтверждён</span>
                ) : (
                  <span className="text-[12.5px] text-[#8a6d1a]">email не подтверждён</span>
                )}
              </div>
              <div className="mt-0.5 text-[12.5px] text-[#4a5b6d]">
                Email: {selected.user.email} · Регистрация: {fmtDateTime(selected.user.createdAt)} · Тем: {selected.user.topicsCount} · Сообщений: {selected.user.messagesCount}
              </div>
              <a className="text-[12.5px] text-[#0A5CAA] underline" onClick={() => props.onOpenProfile(selected.user.nickname)}>
                Открыть публичный профиль »
              </a>

              <div className={`mt-2 border p-2 ${selected.user.restrictedNow ? "border-[#B22335] bg-[#FBF2F3]" : "border-[#C9D4E2] bg-[#F7FAFD]"}`}>
                {selected.user.restrictedNow ? (
                  <>
                    <b className="text-[#B22335]">Действует ограничение</b>
                    {selected.user.restrictedUntil && (
                      <span className="text-[12.5px]"> — до {fmtDateTime(selected.user.restrictedUntil)}</span>
                    )}
                  </>
                ) : (
                  <b>Ограничений нет</b>
                )}
              </div>

              {/* Действия — владелец; модератор только смотрит */}
              {props.isOwner && selected.user.role === "user" && (
                <div className="mt-2 border border-[#C9D4E2] bg-[#FDFEFF] p-2">
                  <p className="text-[12.5px] font-bold text-[#1E3A5F]">Действия с пользователем</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <select value={saKind} onChange={(e) => setSaKind(e.target.value)} className="border border-[#1E3A5F] px-1.5 py-1 text-[12.5px]">
                      {Object.entries(KIND_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <input
                      value={saReason}
                      onChange={(e) => setSaReason(e.target.value)}
                      placeholder="Причина (мин. 5 символов)"
                      className="min-w-[160px] flex-1 border border-[#1E3A5F] px-1.5 py-1 text-[12.5px] outline-none"
                    />
                    <button className="sm-btn sm-btn-primary" disabled={busy} onClick={applySanction}>
                      применить
                    </button>
                  </div>
                  {selected.sanctions.some((s) => !s.revoked && s.kind !== "warning") && (
                    <button
                      className="sm-btn mt-1.5"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Снять все ограничения с ${selected.user.nickname}?`))
                          sanction({ action: "unblock", nick: selected.user.nickname }, `Ограничения с ${selected.user.nickname} сняты`);
                      }}
                    >
                      снять ограничение / разблокировать
                    </button>
                  )}
                </div>
              )}
              {props.isOwner && selected.user.role !== "user" && (
                <p className="mt-2 text-[12.5px] text-[#56657a]">К сотрудникам проекта санкции не применяются.</p>
              )}
              {!props.isOwner && <p className="mt-2 text-[12.5px] text-[#56657a]">Санкции применяет Главный администратор (Владелец).</p>}

              {/* История санкций */}
              <p className="mt-2.5 text-[12.5px] font-bold text-[#1E3A5F]">Санкции</p>
              {selected.sanctions.length === 0 ? (
                <p className="text-[12.5px] text-[#56657a]">Санкций не было.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {selected.sanctions.map((s) => (
                    <li key={s.id} className="border border-[#E4E9F0] bg-[#FDFEFF] px-2 py-1 text-[12.5px]">
                      <b>{s.kindLabel}</b>
                      <span className={s.source === "ai" ? " text-[#8a6d1a]" : " text-[#1e7e34]"}>
                        {" "}
                        · {s.source === "ai" ? "авто" : "человек-модератор"}
                      </span>
                      {s.revoked ? (
                        <span className="text-[#56657a]"> · отменена ({s.revokedBy})</span>
                      ) : s.kind !== "warning" ? (
                        <span className="text-[#B22335]"> · активна{s.expiresAt && s.kind !== "ban" ? ` до ${fmtDateTime(s.expiresAt)}` : s.kind === "ban" ? " (бессрочно)" : ""}</span>
                      ) : (
                        <span className="text-[#56657a]"> · без ограничения</span>
                      )}
                      <div className="text-[12px] text-[#4a5b6d]">Причина: {s.reason}</div>
                      <div className="text-[12px] text-[#56657a]">{fmtDateTime(s.createdAt)}</div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Последние темы и сообщения */}
              <p className="mt-2.5 text-[12.5px] font-bold text-[#1E3A5F]">Последние темы</p>
              {selected.topics.length === 0 ? (
                <p className="text-[12.5px] text-[#56657a]">Тем нет.</p>
              ) : (
                <ul className="mt-1 space-y-0.5 text-[12.5px]">
                  {selected.topics.map((t) => (
                    <li key={t.id}>
                      <a className="text-[#0A5CAA] underline" onClick={() => window.open(`/?topic=${t.id}`, "_blank")}>
                        «{t.title}»
                      </a>{" "}
                      <span className="text-[#56657a]">
                        {t.rubricName} · {t.answers} отв. · {fmtDate(t.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2.5 text-[12.5px] font-bold text-[#1E3A5F]">Последние сообщения</p>
              {selected.messages.length === 0 ? (
                <p className="text-[12.5px] text-[#56657a]">Сообщений нет.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-[12.5px]">
                  {selected.messages.map((m) => (
                    <li key={m.id} className="border-b border-[#EEF1F5] pb-1">
                      <a className="text-[#0A5CAA] underline" onClick={() => window.open(`/?topic=${m.topicId}`, "_blank")}>
                        «{m.topicTitle}»
                      </a>{" "}
                      <span className="text-[12px] text-[#56657a]">{fmtDateTime(m.createdAt)}</span>
                      <div className="line-clamp-2 text-[#4a5b6d]">{m.body}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= Темы форума ================= */

interface AdminTopicRow {
  id: number;
  number: number;
  title: string;
  author: string;
  rubricId: number | null;
  rubricName: string;
  answers: number;
  views: number;
  isPinned: boolean;
  isClosed: boolean;
  isDeleted: boolean;
  createdAt: string;
  lastActivityAt: string;
}

interface RubricOption {
  id: number;
  name: string;
  slug: string;
  isService: boolean;
  children: { id: number; name: string; slug: string; isService: boolean }[];
}

function TopicsSection(props: { token: string | null; isOwner: boolean; notify: (m: string) => void; onOpenTopic: (id: number) => void }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [rows, setRows] = useState<AdminTopicRow[]>([]);
  const [selected, setSelected] = useState<AdminTopicRow | null>(null);
  const [history, setHistory] = useState<{ id: string; actor: string; actorRole: string; action: string; details: string; createdAt: string }[]>([]);
  const [rubrics, setRubrics] = useState<RubricOption[]>([]);
  const [moveTo, setMoveTo] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!props.token) return;
    fetch(`/api/admin/topics?token=${encodeURIComponent(props.token)}&q=${encodeURIComponent(q.trim())}&filter=${filter}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Ошибка");
        return d;
      })
      .then((d) => setRows(d.topics || []))
      .catch((e) => props.notify(e.message || "Ошибка"));
  }, [props.token, q, filter]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  useEffect(() => {
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then((d) => setRubrics(d.rubrics || []))
      .catch(() => {});
  }, []);

  const selectTopic = useCallback(
    (t: AdminTopicRow) => {
      setSelected(t);
      setEditing(false);
      setNewTitle(t.title);
      setMoveTo(t.rubricId ? String(t.rubricId) : "");
      if (props.token) {
        fetch(`/api/admin/topics/${t.id}?token=${encodeURIComponent(props.token)}`)
          .then(async (r) => (r.ok ? r.json() : { history: [] }))
          .then((d) => setHistory(d.history || []))
          .catch(() => setHistory([]));
      }
    },
    [props.token]
  );

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!props.token || !selected) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/topics/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token: props.token, ...extra }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка");
      props.notify(d.note || "Готово");
      load();
      if (props.token) {
        fetch(`/api/admin/topics/${selected.id}?token=${encodeURIComponent(props.token)}`)
          .then(async (r) => (r.ok ? r.json() : { history: [] }))
          .then((d) => {
            setHistory(d.history || []);
            if (d.topic) setSelected(d.topic);
          })
          .catch(() => {});
      }
    } catch (e) {
      props.notify(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const flatRubrics = rubrics.flatMap((r) => [{ id: r.id, name: r.name, isService: r.isService }, ...r.children.map((c) => ({ id: c.id, name: `${r.name} → ${c.name}`, isService: c.isService }))]);

  return (
    <div>
      <div className="border-b border-[#C9D4E2] p-2">
        <div className="flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по заголовку или автору…"
            className="min-w-[180px] flex-1 border border-[#1E3A5F] px-2.5 py-1.5 text-[14px] outline-none"
          />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border border-[#1E3A5F] px-2 py-1.5 text-[13.5px]">
            <option value="all">Все темы</option>
            <option value="open">Открытые</option>
            <option value="closed">Закрытые</option>
            <option value="pinned">Закреплённые</option>
            <option value="deleted">Удалённые</option>
          </select>
          <button className="sm-btn" onClick={load}>
            Обновить
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        {/* Список тем */}
        <div className="max-h-[62vh] overflow-y-auto border-b border-[#C9D4E2] lg:border-b-0 lg:border-r">
          <ul className="divide-y divide-[#E4E9F0] text-[13px]">
            {rows.map((t) => (
              <li
                key={t.id}
                className={`cursor-pointer px-2.5 py-1.5 hover:bg-[#F2F6FA] ${selected?.id === t.id ? "bg-[#EEF3F8]" : ""}`}
                onClick={() => selectTopic(t)}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <b>{t.title}</b>
                  {t.isPinned && <span className="border border-[#1E3A5F] px-1 text-[12px] font-bold">закреплена</span>}
                  {t.isClosed && <span className="border border-[#8a6d1a] px-1 text-[12px] font-bold text-[#8a6d1a]">закрыта</span>}
                  {t.isDeleted && <span className="border border-[#B22335] px-1 text-[12px] font-bold text-[#B22335]">удалена</span>}
                </div>
                <div className="text-[12.5px] text-[#56657a]">
                  #{t.number} · {t.rubricName || "без раздела"} · автор <b className={nickGenderClass(t.author)}>{t.author}</b> · {t.answers} отв. · {fmtNum(t.views)} просм. · активность {fmtDateTime(t.lastActivityAt)}
                </div>
              </li>
            ))}
            {rows.length === 0 && <li className="px-2 py-4 text-center text-[13.5px] text-[#56657a]">Тем не найдено.</li>}
          </ul>
        </div>

        {/* Карточка темы */}
        <div className="max-h-[62vh] overflow-y-auto p-2.5 text-[13.5px]">
          {!selected && <p className="text-[#56657a]">Выберите тему из списка слева.</p>}
          {selected && (
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <b className="text-[15px]">{selected.title}</b>
                {selected.isDeleted && <span className="border border-[#B22335] px-1.5 text-[12px] font-bold text-[#B22335]">удалена</span>}
              </div>
              <div className="mt-0.5 text-[12.5px] text-[#4a5b6d]">
                Раздел: {selected.rubricName || "—"} · автор <b className={nickGenderClass(selected.author)}>{selected.author}</b> · создана {fmtDateTime(selected.createdAt)} · {selected.answers} ответов · {fmtNum(selected.views)} просмотров
              </div>
              <a className="text-[12.5px] text-[#0A5CAA] underline" onClick={() => props.onOpenTopic(selected.id)}>
                Открыть тему на форуме »
              </a>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <button className="sm-btn" disabled={busy} onClick={() => act(selected.isClosed ? "open" : "close")}>
                  {selected.isClosed ? "открыть" : "закрыть"}
                </button>
                <button className="sm-btn" disabled={busy} onClick={() => act(selected.isPinned ? "unpin" : "pin")}>
                  {selected.isPinned ? "открепить" : "закрепить"}
                </button>
                <button className="sm-btn" disabled={busy} onClick={() => setEditing((v) => !v)}>
                  изменить заголовок
                </button>
                {props.isOwner && selected.isDeleted && (
                  <button className="sm-btn" disabled={busy} onClick={() => act("restore")}>
                    восстановить
                  </button>
                )}
                {props.isOwner && !selected.isDeleted && (
                  <button
                    className="sm-btn"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Удалить тему «${selected.title}»? Обсуждение можно будет восстановить.`)) act("delete");
                    }}
                  >
                    удалить
                  </button>
                )}
              </div>

              {editing && (
                <div className="mt-1.5 flex flex-wrap gap-1.5 border border-[#C9D4E2] bg-[#F7FAFD] p-2">
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="min-w-[200px] flex-1 border border-[#1E3A5F] px-2 py-1 text-[13px] outline-none"
                  />
                  <button
                    className="sm-btn sm-btn-primary"
                    disabled={busy}
                    onClick={() => {
                      if (newTitle.trim() && newTitle.trim() !== selected.title) act("rename", { title: newTitle.trim() });
                      else setEditing(false);
                    }}
                  >
                    сохранить
                  </button>
                </div>
              )}

              {/* Перенос темы */}
              <div className="mt-2 border border-[#C9D4E2] bg-[#FDFEFF] p-2">
                <p className="text-[12.5px] font-bold text-[#1E3A5F]">Перенос темы в другой раздел</p>
                <p className="mt-0.5 text-[12.5px] text-[#56657a]">Обсуждение, счётчики и ссылки на тему сохраняются — изменяется только раздел.</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="min-w-[220px] flex-1 border border-[#1E3A5F] px-1.5 py-1 text-[12.5px]">
                    <option value="">— выберите раздел —</option>
                    {flatRubrics
                      .filter((r) => !r.isService)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                  <button
                    className="sm-btn"
                    disabled={busy || props.isOwner === false}
                    onClick={() => {
                      if (!moveTo) {
                        props.notify("Выберите раздел для переноса");
                        return;
                      }
                      act("move", { rubricId: parseInt(moveTo, 10) });
                    }}
                  >
                    перенести
                  </button>
                </div>
                {!props.isOwner && <p className="mt-1 text-[12.5px] text-[#B22335]">Перенос доступен только Главному администратору (Владельцу).</p>}
              </div>

              {/* История действий по теме */}
              <p className="mt-2.5 text-[12.5px] font-bold text-[#1E3A5F]">История действий</p>
              {history.length === 0 ? (
                <p className="text-[12.5px] text-[#56657a]">Действий по теме не было.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-[12.5px]">
                  {history.map((h) => (
                    <li key={h.id} className="border-b border-[#EEF1F5] pb-1">
                      <b>{h.actor}</b>
                      <span className="text-[#4a5b6d]"> — {actionLabel(h.action)}</span>
                      {h.details && <span className="text-[#56657a]"> ({h.details})</span>}
                      <span className="ml-1 text-[12px] text-[#56657a]">{fmtDateTime(h.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= Разделы: Объявления / Практическая информация / Справочник ================= */

interface ContentItemRow {
  id: string;
  section: string;
  title: string;
  body: string;
  contact: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const SECTION_INFO: Record<string, { title: string; hint: string; contactLabel: string }> = {
  ads: { title: "Объявления", hint: "Объявления жителей: куплю/продам, услуги, поиск. Записи видны в разделе «Объявления» на портале.", contactLabel: "Контакт (телефон/email)" },
  info: { title: "Практическая информация", hint: "Полезные сведения: графики работы, телефоны служб, транспорт, дежурные аптеки.", contactLabel: "Телефон / адрес" },
  directory: { title: "Справочник", hint: "Проверенный справочник мастеров и организаций Сахалина.", contactLabel: "Контакт" },
};

function SectionManager(props: { token: string | null; section: "ads" | "info" | "directory"; notify: (m: string) => void }) {
  const info = SECTION_INFO[props.section];
  const [items, setItems] = useState<ContentItemRow[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [contact, setContact] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!props.token) return;
    fetch(`/api/admin/sections?section=${props.section}&token=${encodeURIComponent(props.token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Ошибка");
        return d;
      })
      .then((d) => setItems(d.items || []))
      .catch((e) => props.notify(e.message || "Ошибка"));
  }, [props.token, props.section]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const post = async (payload: Record<string, unknown>, ok: string) => {
    if (!props.token) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: props.section, token: props.token, ...payload }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка");
      props.notify(d.note || ok);
      load();
    } catch (e) {
      props.notify(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (i: ContentItemRow) => {
    setEditingId(i.id);
    setTitle(i.title);
    setBody(i.body);
    setContact(i.contact);
  };
  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setContact("");
  };

  return (
    <div className="p-3">
      <p className="text-[12.5px] leading-snug text-[#4a5b6d]">{info.hint}</p>

      <div className="mt-2 border border-[#C9D4E2] bg-[#F7FAFD] p-2">
        <p className="text-[12.5px] font-bold text-[#1E3A5F]">{editingId ? "Изменить запись" : "Новая запись"}</p>
        <div className="mt-1 space-y-1.5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок" className="w-full border border-[#1E3A5F] px-2 py-1.5 text-[13.5px] outline-none" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Текст" rows={3} className="w-full border border-[#1E3A5F] px-2 py-1.5 text-[13.5px] outline-none" />
          <div className="flex flex-wrap gap-1.5">
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={info.contactLabel} className="min-w-[200px] flex-1 border border-[#1E3A5F] px-2 py-1.5 text-[13.5px] outline-none" />
            <button
              className="sm-btn sm-btn-primary"
              disabled={busy}
              onClick={async () => {
                if (title.trim().length < 3) {
                  props.notify("Заголовок — минимум 3 символа");
                  return;
                }
                if (editingId) {
                  await post({ action: "update", id: editingId, title: title.trim(), body: body.trim(), contact: contact.trim() }, "Запись сохранена");
                  resetForm();
                } else {
                  await post({ action: "create", title: title.trim(), body: body.trim(), contact: contact.trim() }, "Запись добавлена");
                  resetForm();
                }
              }}
            >
              {editingId ? "сохранить" : "добавить"}
            </button>
            {editingId && (
              <button className="sm-btn" onClick={resetForm}>
                отмена
              </button>
            )}
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-center text-[14px] text-[#56657a]">Записей пока нет.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#D8DEE7]">
          {items.map((i) => (
            <li key={i.id} className="py-2 text-[13.5px]">
              <div className="flex flex-wrap items-center gap-1.5">
                <b>{i.title}</b>
                {i.status === "hidden" && <span className="border border-[#8a6d1a] px-1.5 text-[12px] font-bold text-[#8a6d1a]">скрыто</span>}
                {i.contact && <span className="text-[12.5px] text-[#4a5b6d]">· {i.contact}</span>}
                <span className="ml-auto text-[12.5px] text-[#56657a]">обновлено {fmtDateTime(i.updatedAt)}</span>
              </div>
              {i.body && <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-[#4a5b6d]">{i.body}</p>}
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button className="sm-btn" onClick={() => startEdit(i)}>
                  изменить
                </button>
                <button className="sm-btn" disabled={busy} onClick={() => post({ action: "toggle", id: i.id }, "Статус изменён")}>
                  {i.status === "published" ? "скрыть" : "опубликовать"}
                </button>
                <button
                  className="sm-btn"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Удалить запись «${i.title}»?`)) post({ action: "delete", id: i.id }, "Запись удалена");
                  }}
                >
                  удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ================= Настройки сайта ================= */

function SettingsSection(props: { token: string | null; notify: (m: string) => void; onSaved: () => void }) {
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!props.token) return;
    fetch(`/api/admin/settings?token=${encodeURIComponent(props.token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Ошибка");
        return d;
      })
      .then((d) => setSettings(d.settings))
      .catch((e) => setError(e.message || "Ошибка"));
  }, [props.token]);

  if (error) return <p className="p-4 text-[14px] text-[#B22335]">{error}</p>;
  if (!settings) return <p className="p-4 text-[14px] text-[#56657a]">Загрузка…</p>;

  const set = (k: string, v: string) => setSettings((s) => ({ ...(s ?? {}), [k]: v }));

  const save = async () => {
    if (!props.token) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, settings }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка");
      props.notify(d.note || "Сохранено");
      if (d.settings) setSettings(d.settings);
      // ШАГ 12: обновить шапку/подвал портала сразу после сохранения
      props.onSaved();
    } catch (e) {
      props.notify(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-[640px] p-3 text-[13.5px]">
      <p className="mb-2 text-[12.5px] leading-snug text-[#4a5b6d]">
        Настройки сайта меняет только Главный администратор / Владелец. Изменения сразу отражаются в шапке и подвале портала.
      </p>
      <label className="mt-2 block text-[12.5px] font-bold text-[#1E3A5F]">Слоган в шапке</label>
      <input value={settings.siteSlogan ?? ""} onChange={(e) => set("siteSlogan", e.target.value)} className="mt-0.5 w-full border border-[#1E3A5F] px-2 py-1.5 outline-none" />
      <label className="mt-2 block text-[12.5px] font-bold text-[#1E3A5F]">Подзаголовок в шапке</label>
      <input value={settings.siteSubtitle ?? ""} onChange={(e) => set("siteSubtitle", e.target.value)} className="mt-0.5 w-full border border-[#1E3A5F] px-2 py-1.5 outline-none" />
      <label className="mt-2 block text-[12.5px] font-bold text-[#1E3A5F]">Описание проекта в шапке</label>
      <textarea value={settings.siteDescription ?? ""} onChange={(e) => set("siteDescription", e.target.value)} rows={3} className="mt-0.5 w-full border border-[#1E3A5F] px-2 py-1.5 outline-none" />
      <label className="mt-2 block text-[12.5px] font-bold text-[#1E3A5F]">Подпись в подвале</label>
      <input value={settings.footerNote ?? ""} onChange={(e) => set("footerNote", e.target.value)} className="mt-0.5 w-full border border-[#1E3A5F] px-2 py-1.5 outline-none" />

      <div className="mt-3 space-y-1.5 border border-[#C9D4E2] bg-[#F7FAFD] p-2.5">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={(settings.registrationEnabled ?? "1") === "1"} onChange={(e) => set("registrationEnabled", e.target.checked ? "1" : "0")} />
          <span>
            <b>Регистрация открыта</b>
            <span className="text-[12px] text-[#56657a]"> — при выключении новые пользователи не могут зарегистрироваться</span>
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={(settings.newTopicsEnabled ?? "1") === "1"} onChange={(e) => set("newTopicsEnabled", e.target.checked ? "1" : "0")} />
          <span>
            <b>Создание новых тем открыто</b>
            <span className="text-[12px] text-[#56657a]"> — при выключении участники не могут создавать темы (сотрудники могут)</span>
          </span>
        </label>
      </div>

      <button className="sm-btn sm-btn-primary mt-3 px-4 py-1.5" disabled={busy} onClick={save}>
        Сохранить настройки
      </button>
    </div>
  );
}

/* ================= Журнал действий ================= */

function LogSection(props: { token: string | null }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [entries, setEntries] = useState<{ id: string; actor: string; actorRole: string; action: string; targetLabel: string; details: string; createdAt: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!props.token) return;
    fetch(`/api/admin/log?token=${encodeURIComponent(props.token)}&q=${encodeURIComponent(q.trim())}&type=${type}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Ошибка");
        return d;
      })
      .then((d) => {
        setEntries(d.entries || []);
        setTotal(d.total ?? 0);
      })
      .catch((e) => setError(e.message || "Ошибка"));
  }, [props.token, q, type]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  return (
    <div>
      <div className="border-b border-[#C9D4E2] p-2">
        <div className="flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по журналу (ник, действие, объект)…"
            className="min-w-[180px] flex-1 border border-[#1E3A5F] px-2.5 py-1.5 text-[14px] outline-none"
          />
          <select value={type} onChange={(e) => setType(e.target.value)} className="border border-[#1E3A5F] px-2 py-1.5 text-[13.5px]">
            <option value="all">Все действия</option>
            <option value="moderation">Модерация сообщений</option>
            <option value="sanctions">Санкции</option>
            <option value="topics">Темы</option>
            <option value="users">Пользователи</option>
            <option value="admin">Настройки и разделы</option>
          </select>
          <button className="sm-btn" onClick={load}>
            Обновить
          </button>
        </div>
        <p className="mt-1 text-[12px] text-[#56657a]">Всего записей: {fmtNum(total)}. Журнал хранится внутри панели и не виден участникам форума.</p>
        {error && <p className="mt-1 text-[13.5px] text-[#B22335]">{error}</p>}
      </div>
      <ul className="max-h-[68vh] divide-y divide-[#D8DEE7] overflow-y-auto">
        {entries.length === 0 && <li className="p-4 text-center text-[14px] text-[#56657a]">Записей нет.</li>}
        {entries.map((l) => (
          <li key={l.id} className="px-3 py-2 text-[13.5px]">
            <b>{l.actor}</b>
            <span className="ml-1.5 border border-[#C9D4E2] bg-[#F7FAFD] px-1.5 text-[12px] font-semibold text-[#4a5b6d]">{ROLE_LABELS[l.actorRole] ?? l.actorRole}</span>
            <span className="ml-1.5 text-[#1E3A5F]">{actionLabel(l.action)}</span>
            {l.targetLabel && <span>: {l.targetLabel}</span>}
            {l.details && <span className="text-[#56657a]"> — {l.details}</span>}
            <span className="float-right text-[12.5px] text-[#56657a]">{fmtDateTime(l.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
