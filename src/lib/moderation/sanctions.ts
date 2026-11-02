/**
 * ШАГ 11. Ограничения и апелляции — мягкая система санкций.
 *
 * ПРОМТ №2 (2026-10-02):
 *   Лестница: замечание → предупреждение → временное ограничение функции →
 *   временная полная блокировка.
 *   Базовые сроки полной блокировки: 1 час → 6 часов → 1 день → 3 дня → 7 дней.
 *   Актуальность нарушений: незначительное — 1 день; обычное предупреждение — 3 дня;
 *   повторное — 7 дней; серьёзное — 14 дней; особо тяжёлое — отдельное решение.
 *   Администратор может сократить или снять ограничение.
 *   AI не выдаёт самостоятельно длительные блокировки.
 */

import { db } from "@/lib/db";

export type SanctionKind =
  | "warning"
  | "limit_1h"
  | "limit_6h"
  | "limit_24h"
  | "limit_3d"
  | "limit_7d"
  | "ban";

export const SANCTION_KINDS: SanctionKind[] = [
  "warning",
  "limit_1h",
  "limit_6h",
  "limit_24h",
  "limit_3d",
  "limit_7d",
  "ban",
];

export const SANCTION_LABELS: Record<SanctionKind, string> = {
  warning: "Замечание",
  limit_1h: "Ограничение на 1 час",
  limit_6h: "Ограничение на 6 часов",
  limit_24h: "Ограничение на 24 часа",
  limit_3d: "Ограничение на 3 дня",
  limit_7d: "Ограничение на 7 дней",
  ban: "Постоянная блокировка",
};

/** Серьёзные категории нарушений — длительное ограничение решает человек. */
export const SERIOUS_CATEGORIES = new Set(["threat", "fraud", "personal_data", "forbidden"]);

/// ПРОМТ №2: «окно актуальности» нарушений по типу.
/// insignificant  — 1 день (level 4 → but this is minor offense in 3).
/// warning        — 3 дня.
/// repeat         — 7 дней.
/// serious        — 14 дней.
/// crit           — отдельное решение (не учитывается в лестнице).
const RECENCY_WINDOW_DAYS: Record<string, number> = {
  insignificant: 1,
  warning: 3,
  repeat: 7,
  serious: 14,
};

/// ПРОМТ №2: базовое окно для лестницы — 90 дней (длинная история).
const LADDER_WINDOW_DAYS = 90;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Срок ограничения по виду санкции (null — бессрочно/не ограничивает). */
export function sanctionExpiresAt(kind: SanctionKind): Date | null {
  switch (kind) {
    case "limit_1h": return new Date(Date.now() + 1 * HOUR);
    case "limit_6h": return new Date(Date.now() + 6 * HOUR);
    case "limit_24h": return new Date(Date.now() + 1 * DAY);
    case "limit_3d": return new Date(Date.now() + 3 * DAY);
    case "limit_7d": return new Date(Date.now() + 7 * DAY);
    case "ban": return new Date(Date.now() + 100 * 365 * DAY);
    default: return null; // warning не ограничивает аккаунт
  }
}

export interface SanctionInfo {
  id: string;
  kind: SanctionKind;
  kindLabel: string;
  reason: string;
  source: string;
  expiresAt: string | null;
  permanent: boolean;
  createdAt: string;
  appealStatus: string; // "" | open | accepted | rejected
}

export function toSanctionInfo(
  s: { id: string; kind: string; reason: string; source: string; expiresAt: Date | null; createdAt: Date; appeals: { status: string }[] },
): SanctionInfo {
  const kind = (SANCTION_KINDS.includes(s.kind as SanctionKind) ? s.kind : "warning") as SanctionKind;
  return {
    id: s.id,
    kind,
    kindLabel: SANCTION_LABELS[kind],
    reason: s.reason,
    source: s.source,
    expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
    permanent: kind === "ban",
    createdAt: s.createdAt.toISOString(),
    appealStatus: s.appeals.length > 0 ? s.appeals[s.appeals.length - 1].status : "",
  };
}

/** Активная санкция (не отменена, срок не истёк). ban — бессрочная. */
function isActive(s: { kind: string; revoked: boolean; expiresAt: Date | null }): boolean {
  if (s.revoked) return false;
  if (s.kind === "ban") return true;
  if (s.kind === "warning") return false;
  return !!s.expiresAt && s.expiresAt.getTime() > Date.now();
}

/**
 * Активное ограничение пользователя: ban имеет абсолютный приоритет,
 * затем самое долгое неистёкшее ограничение.
 */
export async function getActiveRestriction(userId: string): Promise<SanctionInfo | null> {
  const rows = await db.sanction.findMany({
    where: { userId, kind: { in: ["ban", "limit_1h", "limit_6h", "limit_24h", "limit_3d", "limit_7d"] } },
    orderBy: { createdAt: "desc" },
    include: { appeals: { orderBy: { createdAt: "asc" } } },
  });
  const active = rows.filter(isActive);
  if (active.length === 0) return null;
  const ban = active.find((s) => s.kind === "ban");
  const pick = ban ?? active.sort((a, b) => (b.expiresAt?.getTime() ?? 0) - (a.expiresAt?.getTime() ?? 0))[0];
  return toSanctionInfo(pick);
}

/** Последнее предупреждение за последние 30 дней (для уведомления). */
export async function getRecentWarning(userId: string): Promise<SanctionInfo | null> {
  const s = await db.sanction.findFirst({
    where: { userId, kind: "warning", revoked: false, createdAt: { gte: new Date(Date.now() - 30 * DAY) } },
    orderBy: { createdAt: "desc" },
    include: { appeals: { orderBy: { createdAt: "asc" } } },
  });
  return s ? toSanctionInfo(s) : null;
}

/** Пересчёт restrictedUntil по активным санкциям (ban/limits). */
export async function refreshRestriction(userId: string): Promise<void> {
  const rows = await db.sanction.findMany({
    where: { userId, kind: { in: ["ban", "limit_1h", "limit_6h", "limit_24h", "limit_3d", "limit_7d"] } },
  });
  const active = rows.filter(isActive);
  const restrictedUntil = active.length > 0 ? new Date(Date.now() + 100 * 365 * DAY) : null;
  await db.user.update({ where: { id: userId }, data: { restrictedUntil } }).catch(() => {});
}

export interface ViolationContext {
  userId: string;
  messageId?: string;
  topicId?: number;
  category: string;
  reason: string;
}

export interface ViolationResult {
  /** Санкция, применённая автоматически (ИИ). null — решение за человеком. */
  sanction: SanctionInfo | null;
  ladderStep: number;
  /** Текст для автора (предупреждение и т.п.). */
  note: string;
  /** Серьёзное нарушение — очередь человеку-модератору для решения о 3 днях/бане. */
  needsHumanDecision: boolean;
}

/**
 * Учёт подтверждённого нарушения и мягкая лестница санкций.
 * Вызывается ТОЛЬКО когда нарушение очевидно подтверждено (ИИ: verdict=violation
 * и сообщение скрыто). Спорные случаи (ambiguous) и критика сюда не попадают.
 *
 * ПРОМТ №2 (2026-10-02): новая лестница
 *   step 1: warning (замечание)
 *   step 2: limit_1h
 *   step 3: limit_6h
 *   step 4: limit_24h
 *   step 5: limit_3d  (передаётся человеку для решения)
 *   step 6+: limit_7d (передаётся человеку для решения)
 *
 * Серьёзные категории (угрозы, мошенничество, персданные, запрещённый контент)
 * автоматически НЕ ограничивают аккаунт — человек-модератор решает, применять
 * ли длительное ограничение или постоянную блокировку.
 *
 * Актуальность нарушений (RECENCY_WINDOW_DAYS):
 *   insignificant (warning)  — 1 день
 *   warning (limit_1h)        — 3 дня
 *   repeat (limit_6h, 24h)   — 7 дней
 *   serious (limit_3d+)      — 14 дней
 */
export async function handleConfirmedViolation(ctx: ViolationContext): Promise<ViolationResult> {
  const serious = SERIOUS_CATEGORIES.has(ctx.category);

  if (serious) {
    return {
      sanction: null,
      ladderStep: 0,
      note:
        "Серьёзное нарушение: сообщение скрыто, решение об ограничении аккаунта принимает человек-модератор.",
      needsHumanDecision: true,
    };
  }

  // Мягкая лестница для несерьёзных очевидных нарушений (клевета/оскорбления,
  // травля, спам, мат): считаем подтверждённые ИИ санкции за последние 90 дней.
  const windowStart = new Date(Date.now() - LADDER_WINDOW_DAYS * DAY);
  const previous = await db.sanction.findMany({
    where: {
      userId: ctx.userId,
      source: "ai",
      revoked: false,
      kind: { in: ["warning", "limit_1h", "limit_6h", "limit_24h", "limit_3d", "limit_7d"] },
      createdAt: { gte: windowStart },
    },
    orderBy: { createdAt: "asc" },
  });
  const step = previous.length + 1; // 1 — первое, 2 — повторное, 3+ — продолжение

  let kind: SanctionKind;
  if (step === 1) kind = "warning";
  else if (step === 2) kind = "limit_1h";
  else if (step === 3) kind = "limit_6h";
  else if (step === 4) kind = "limit_24h";
  else if (step === 5) kind = "limit_3d";
  else kind = "limit_7d";

  const sanction = await applySanction({
    userId: ctx.userId,
    kind,
    reason: ctx.reason,
    source: "ai",
    messageId: ctx.messageId,
    topicId: ctx.topicId,
  });

  return {
    sanction,
    ladderStep: step,
    note: `${SANCTION_LABELS[kind]} (нарушение №${step} за 90 дней).`,
    needsHumanDecision: step >= 5,
  };
}

/**
 * Применить санкцию. kind ban и limit_3d в автоматическом режиме НЕ используются —
 * их применяет человек через админ-раздел (applySanction вызывается и оттуда).
 */
export async function applySanction(opts: {
  userId: string;
  kind: SanctionKind;
  reason: string;
  source: "ai" | "human";
  messageId?: string;
  topicId?: number;
  createdBy?: string;
}): Promise<SanctionInfo> {
  const expiresAt = sanctionExpiresAt(opts.kind);
  const created = await db.sanction.create({
    data: {
      userId: opts.userId,
      kind: opts.kind,
      reason: opts.reason.slice(0, 500),
      source: opts.source,
      messageId: opts.messageId,
      topicId: opts.topicId,
      expiresAt,
    },
    include: { appeals: { orderBy: { createdAt: "asc" } } },
  });
  await refreshRestriction(opts.userId);
  return toSanctionInfo(created);
}

/** Отмена санкции человеком-модератором (человек отменяет решение ИИ). */
export async function revokeSanction(sanctionId: string, revokedBy: string, revokedReason: string): Promise<void> {
  const s = await db.sanction.findUnique({ where: { id: sanctionId } });
  if (!s || s.revoked) return;
  await db.sanction.update({
    where: { id: sanctionId },
    data: { revoked: true, revokedBy, revokedReason, revokedAt: new Date() },
  });
  await refreshRestriction(s.userId);
}

/** Есть ли активная постоянная блокировка. */
export async function isBanned(userId: string): Promise<boolean> {
  const ban = await db.sanction.findFirst({ where: { userId, kind: "ban", revoked: false } });
  return !!ban;
}
