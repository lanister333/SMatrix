/**
 * ШАГ 11. Ограничения и апелляции — мягкая система санкций.
 *
 * Лестница (по ТЗ):
 *  — первое небольшое нарушение: предупреждение, без блокировки;
 *  — повторное нарушение: ограничение на 1 час;
 *  — продолжение нарушений: ограничение до 24 часов;
 *  — серьёзное нарушение: ограничение до 3 дней (решает человек-модератор);
 *  — постоянная блокировка — ТОЛЬКО в исключительных случаях и ТОЛЬКО человеком:
 *    систематический спам, мошенничество, постоянный обход ограничений,
 *    иные особо серьёзные систематические нарушения.
 *
 * ИИ может останавливать очевидно запрещённый контент (скрытие — ШАГ 10),
 * но ограничения аккаунта применяет ОСТОРОЖНО: автоматически — только
 * предупреждение и короткие ограничения по лестнице повторов. Серьёзные
 * и постоянные санкции применяет человек; любая санкция ИИ может быть
 * проверена и отменена человеком-модератором.
 */

import { db } from "@/lib/db";

export type SanctionKind = "warning" | "limit_1h" | "limit_24h" | "limit_3d" | "ban";

export const SANCTION_KINDS: SanctionKind[] = ["warning", "limit_1h", "limit_24h", "limit_3d", "ban"];

export const SANCTION_LABELS: Record<SanctionKind, string> = {
  warning: "Предупреждение",
  limit_1h: "Ограничение на 1 час",
  limit_24h: "Ограничение на 24 часа",
  limit_3d: "Ограничение на 3 дня",
  ban: "Постоянная блокировка",
};

/** Серьёзные категории нарушений — ограничение до 3 дней решает человек. */
export const SERIOUS_CATEGORIES = new Set(["threat", "fraud", "personal_data", "forbidden"]);

const LADDER_WINDOW_DAYS = 90;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Срок ограничения по виду санкции (null — бессрочно/не ограничивает). */
export function sanctionExpiresAt(kind: SanctionKind): Date | null {
  switch (kind) {
    case "limit_1h": return new Date(Date.now() + 1 * HOUR);
    case "limit_24h": return new Date(Date.now() + 1 * DAY);
    case "limit_3d": return new Date(Date.now() + 3 * DAY);
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
    where: { userId, kind: { in: ["ban", "limit_1h", "limit_24h", "limit_3d"] } },
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
    where: { userId, kind: { in: ["ban", "limit_1h", "limit_24h", "limit_3d"] } },
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
 * Серьёзные категории (угрозы, мошенничество, персданные, запрещённый контент)
 * автоматически НЕ ограничивают аккаунт — человек-модератор решает, применять
 * ли ограничение до 3 дней или постоянную блокировку.
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
      kind: { in: ["warning", "limit_1h", "limit_24h"] },
      createdAt: { gte: windowStart },
    },
    orderBy: { createdAt: "asc" },
  });
  const step = previous.length + 1; // 1 — первое, 2 — повторное, 3+ — продолжение

  let kind: SanctionKind;
  if (step === 1) kind = "warning";
  else if (step === 2) kind = "limit_1h";
  else kind = "limit_24h";

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
    needsHumanDecision: step >= 3,
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
