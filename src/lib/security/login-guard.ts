import { db } from "@/lib/db";
import { getClientIp, getClientAgent, getDeviceFingerprint } from "./client-info";
import type { NextRequest } from "next/server";

/**
 * ПРОМТ №1 (защита платформы): лимитер попыток входа.
 *
 * Правила:
 *   - До 5 неудачных попыток за 15 мин — обычный режим.
 *   - 5-10 неудачных — экспоненциальная задержка (1, 2, 4, 8, 16 с).
 *   - 10+ неудачных — блокировка 15 мин с возможным продлением при продолжении атаки.
 *
 *   Промт №1 явно: «После 5 неудачных попыток увеличивать задержку. После 10
 *   попыток — временная блокировка на 15 минут с возможным увеличением при
 *   продолжении атаки.»
 *
 * Учитываются попытки по email И по IP — атака может идти с разных email,
 * но с одного IP (или наоборот — с разных IP по одному email).
 *
 * ВАЖНО: точные внутренние пороги не раскрываются пользователю —
 *   промт №1: «Не раскрывай точные внутренние пороги обнаружения.»
 *   Поэтому в сообщениях пользователю мы говорим «Слишком много попыток,
 *   попробуйте позже», без конкретики «вы превысили лимит 5 за 15 минут».
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 минут
const THRESHOLD_DELAY = 5; // после 5 неудачных — задержка
const THRESHOLD_LOCK = 10; // после 10 — блокировка 15 мин
const BASE_LOCK_MS = 15 * 60 * 1000; // базовая блокировка 15 минут
const MAX_LOCK_MS = 4 * 60 * 60 * 1000; // макс. 4 часа (если атака продолжается)

export interface LoginGateResult {
  allowed: boolean;
  /** Задержка в секундах, которую клиент должен выждать перед повтором. */
  delaySec: number;
  /** Внутренняя причина для логирования (НЕ показывается пользователю). */
  internalReason: string;
  /** Человекочитаемое сообщение для пользователя (без точных порогов). */
  userMessage?: string;
}

/**
 * Проверяет, можно ли сейчас выполнять вход с данного email + IP.
 * НЕ записывает попытку — только проверяет текущее состояние.
 */
export async function checkLoginAllowed(email: string, ip: string): Promise<LoginGateResult> {
  const since = new Date(Date.now() - WINDOW_MS);
  // Считаем неудачные попытки по email и по IP за окно.
  const [byEmail, byIp] = await Promise.all([
    db.loginAttempt.count({ where: { email, success: false, createdAt: { gte: since } } }),
    db.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } }),
  ]);
  // Берём максимум — атака могла идти по одному из векторов.
  const fails = Math.max(byEmail, byIp);

  if (fails >= THRESHOLD_LOCK) {
    // Блокировка. Если были неудачи после порога — продлеваем.
    const lastFail = await db.loginAttempt.findFirst({
      where: { OR: [{ email }, { ip }], success: false },
      orderBy: { createdAt: "desc" },
    });
    const lockMultiplier = Math.min(
      Math.floor((fails - THRESHOLD_LOCK) / 5) + 1,
      Math.ceil(MAX_LOCK_MS / BASE_LOCK_MS)
    );
    const lockMs = BASE_LOCK_MS * lockMultiplier;
    if (lastFail) {
      const elapsed = Date.now() - lastFail.createdAt.getTime();
      const remaining = lockMs - elapsed;
      if (remaining > 0) {
        return {
          allowed: false,
          delaySec: Math.ceil(remaining / 1000),
          internalReason: `lockout: fails=${fails}, multiplier=${lockMultiplier}`,
          userMessage: "Слишком много неудачных попыток. Подождите немного и попробуйте снова.",
        };
      }
    }
    return {
      allowed: true,
      delaySec: 0,
      internalReason: `lockout_expired: fails=${fails}`,
    };
  }

  if (fails >= THRESHOLD_DELAY) {
    // Экспоненциальная задержка: 1, 2, 4, 8, 16, 32 секунды.
    const expIndex = fails - THRESHOLD_DELAY; // 0..4
    const delaySec = Math.min(2 ** expIndex, 60);
    return {
      allowed: false,
      delaySec,
      internalReason: `throttle: fails=${fails}, delay=${delaySec}s`,
      userMessage: "Слишком частые попытки входа. Подождите немного.",
    };
  }

  return { allowed: true, delaySec: 0, internalReason: "ok" };
}

/**
 * Записывает попытку входа (успешную или нет) и обновляет IP/устройство
 * пользователя при успехе.
 */
export async function recordLoginAttempt(params: {
  email: string;
  userId?: string | null;
  req: NextRequest | Request;
  success: boolean;
  reason?: string;
}): Promise<void> {
  const { email, userId, req, success, reason = "" } = params;
  const ip = getClientIp(req);
  const userAgent = getClientAgent(req);
  const fingerprint = getDeviceFingerprint(req);
  try {
    await db.loginAttempt.create({
      data: { email, userId: userId ?? null, ip, userAgent, success, reason },
    });
    if (success && userId) {
      await Promise.all([
        // Обновляем lastLoginAt
        db.user.update({
          where: { id: userId },
          data: { lastLoginAt: new Date() },
        }),
        // Upsert устройства пользователя
        db.userDevice.upsert({
          where: { userId_fingerprint: { userId, fingerprint } },
          update: {
            lastSeenAt: new Date(),
            ip,
            sessionCount: { increment: 1 },
          },
          create: {
            userId,
            fingerprint,
            userAgent,
            ip,
          },
        }),
        // Upsert IP-записи
        db.userIp.upsert({
          where: { userId_ip: { userId, ip } },
          update: {
            lastSeenAt: new Date(),
            hitCount: { increment: 1 },
          },
          create: { userId, ip },
        }),
        // Авто-связь аккаунтов по этому же fingerprint (если у других юзеров есть такое устройство)
        linkAccountsByDevice(userId, fingerprint, "same_device"),
        // Авто-связь по IP
        linkAccountsByIp(userId, ip, "same_ip"),
      ]);
    }
  } catch (e) {
    // Не даём аудиту ломать основной поток входа.
    console.error("[login-guard] recordLoginAttempt error:", e);
  }
}

/**
 * Находит других пользователей с тем же fingerprint/IP и создаёт AccountLink.
 * НЕ блокирует ник автоматически — только журнал связей для админа/детектора.
 */
async function linkAccountsByDevice(
  userId: string,
  fingerprint: string,
  reason: string
): Promise<void> {
  const others = await db.userDevice.findMany({
    where: { fingerprint, userId: { not: userId } },
    select: { userId: true },
    take: 20,
  });
  if (!others.length) return;
  for (const o of others) {
    // Сортируем ID, чтобы всегда userA < userB (для unique constraint).
    const [a, b] = [userId, o.userId].sort();
    if (a === b) continue;
    await db.accountLink
      .upsert({
        where: { userA_userB_reason: { userA: a, userB: b, reason } },
        update: { weight: { increment: 1.0 }, evidence: fingerprint },
        create: { userA: a, userB: b, reason, evidence: fingerprint, weight: 1.0 },
      })
      .catch(() => {});
  }
}

async function linkAccountsByIp(
  userId: string,
  ip: string,
  reason: string
): Promise<void> {
  if (!ip || ip === "::1" || ip === "127.0.0.1") return; // локальные адреса игнорируем
  const others = await db.userIp.findMany({
    where: { ip, userId: { not: userId } },
    select: { userId: true },
    take: 20,
  });
  if (!others.length) return;
  for (const o of others) {
    const [a, b] = [userId, o.userId].sort();
    if (a === b) continue;
    await db.accountLink
      .upsert({
        where: { userA_userB_reason: { userA: a, userB: b, reason } },
        update: { weight: { increment: 0.5 }, evidence: ip },
        create: { userA: a, userB: b, reason, evidence: ip, weight: 0.5 },
      })
      .catch(() => {});
  }
}
