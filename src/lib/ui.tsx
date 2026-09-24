"use client";

/** Общие типы, константы и утилиты клиентской части SakhMatrix. */

export interface Rubric {
  id: number;
  name: string;
  slug: string;
  isService: boolean;
  children: Rubric[];
}

export interface TopicRow {
  id: number;
  title: string;
  isPinned: boolean;
  isArchived: boolean;
  isClosed: boolean;
  author: string;
  authorGender: string;
  answers: number;
  views: number;
  lastActivityAt: string;
  lastAuthor: string;
  lastAuthorGender: string | null;
  rubricName: string;
  rubricSlug: string;
  subName: string;
}

export interface ForumUser {
  id?: string;
  nickname: string;
  gender?: string;
  role?: string;
  email?: string;
  token?: string;
  /** ШАГ 19: подтверждённый представитель организации (ЖКХ). */
  orgRep?: boolean;
  /** ШАГ 19: название организации представителя. */
  orgName?: string;
}

export interface Msg {
  id: string;
  num: number;
  author: string;
  authorGender: string;
  createdAt: string;
  body: string;
  parentId: string | null;
  parentAuthor: string | null;
  parentAuthorGender: string | null;
  parentNum: number | null;
  depth: number;
  isDeleted: boolean;
  deletedBy: string;
  isHiddenByAi: boolean;
  hiddenReason: string;
  aiNote: string;
  editedAt: string | null;
}

/** ШАГ 10: причины жалоб — ровно 7 по ТЗ. */
export const COMPLAINT_REASONS: [string, string][] = [
  ["insult", "Оскорбление / травля"],
  ["threat", "Угроза"],
  ["spam", "Спам / реклама"],
  ["fraud", "Мошенничество"],
  ["personal_data", "Персональные данные"],
  ["forbidden", "Запрещённый контент"],
  ["other", "Другое"],
];

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(COMPLAINT_REASONS);

export const AUTH_KEY = "sm_auth";
export const FAV_KEY = "sm_favorites";

export function fmtDate(e: string | Date): string {
  return (typeof e === "string" ? new Date(e) : e).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function fmtDateTime(e: string | Date): string {
  const s = typeof e === "string" ? new Date(e) : e;
  return (
    s.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) +
    " " +
    s.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  );
}

export function fmtRecent(e: string | Date): string {
  const s = typeof e === "string" ? new Date(e) : e;
  const a = new Date();
  if (s.getFullYear() === a.getFullYear() && s.getMonth() === a.getMonth() && s.getDate() === a.getDate()) {
    return s.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  return fmtDate(s);
}

export function fmtNum(e: number): string {
  return e.toLocaleString("ru-RU");
}

/** Компонент ника с цветом по полу. */
export function Nick({
  name,
  gender,
  onOpen,
  className,
  title,
}: {
  name: string;
  gender?: string | null;
  onOpen?: (name: string) => void;
  className?: string;
  title?: string;
}) {
  const g = gender === "male" || gender === "female" ? gender : "neutral";
  return (
    <a
      className={`sk-nick g-${g}${className ? ` ${className}` : ""}`}
      title={title ?? `Профиль: ${name}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.(name);
      }}
    >
      {name}
    </a>
  );
}
