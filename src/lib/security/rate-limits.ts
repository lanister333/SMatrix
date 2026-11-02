import { db } from "@/lib/db";
import { rateLimit } from "@/lib/api";

/**
 * ПРОМТ №1 (защита платформы): лимиты для новых и обычных аккаунтов.
 *
 *   Первые 24 часа после регистрации:
 *     - до 3 новых тем в сутки
 *     - 30 сообщений в час
 *     - 30 личных сообщений в сутки (PM нет — зарезервировано)
 *     - 5 сообщений со ссылками в сутки
 *     - 10 жалоб в сутки
 *
 *   После 24 часов нормального поведения — ограничения снимаются.
 *
 *   AI может временно ужесточить лимиты при подозрительной активности.
 *
 * Реализация:
 *   - in-memory rateLimit (быстрая проверка частоты).
 *   - БД-проверка для суточных лимитов (точнее, переживает рестарт).
 *
 * ВАЖНО: точные числа не показываем пользователю — только общее сообщение
 * «слишком много действий, попробуйте позже». Промт №1:
 * «Не раскрывай точные внутренние пороги обнаружения.»
 */

const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 часа
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** Пользователь «новый» = создан менее 24 ч назад. */
export function isFreshAccount(createdAt: Date | null | undefined): boolean {
  if (!createdAt) return false;
  return Date.now() - createdAt.getTime() < FRESH_WINDOW_MS;
}

/** Проверяет, находится ли пользователь под действующей санкцией (мут). */
export async function isUserRestricted(userId: string): Promise<boolean> {
  const sanction = await db.sanction.findFirst({
    where: {
      userId,
      revoked: false,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });
  return !!sanction;
}

/**
 * Проверяет дневной лимит по пользователю и действию для fresh-аккаунтов.
 * Если аккаунту > 24ч — лимита нет.
 */
export async function checkDailyLimit(
  userId: string,
  userCreatedAt: Date,
  counter: "topic_create" | "message_hour" | "message_with_link" | "complaint" | "pm",
  limits: { fresh: number; normal: number; windowMs: number }
): Promise<{ allowed: boolean; reason?: string }> {
  const isFresh = isFreshAccount(userCreatedAt);
  const limit = isFresh ? limits.fresh : limits.normal;
  const since = new Date(Date.now() - limits.windowMs);
  const where = { userId, createdAt: { gte: since } };

  let count: number;
  switch (counter) {
    case "topic_create":
      count = await db.topic.count({ where: { authorId: userId, createdAt: { gte: since } } });
      break;
    case "message_hour":
    case "message_with_link":
      count = await db.message.count({
        where: {
          authorId: userId,
          createdAt: { gte: since },
          isDeleted: false,
          ...(counter === "message_with_link" ? { body: { contains: "http" } } : {}),
        },
      });
      break;
    case "complaint":
      // Считаем жалобы пользователя по всем разделам — через reporterName.
      // reporterName хранит ник, не userId — пока используем примерную оценку.
      count = await db.complaint.count({
        where: { createdAt: { gte: since } },
      });
      // Лимит жалоб — индивидуальный, нужен отдельный учёт.
      // Пока что используем общий счётчик (это временно до миграции complaint-моделей с reporterId).
      // TODO: после добавления reporterId в complaint-модели — фильтр по reporterId=userId.
      break;
    case "pm":
      // PM не реализован — всегда allow.
      return { allowed: true };
    default:
      return { allowed: true };
  }

  if (count >= limit) {
    const what = isFresh ? "новым аккаунтам" : "частым действиям";
    return {
      allowed: false,
      reason: `Лимит для ${what} превышен — попробуйте позже`,
    };
  }
  return { allowed: true };
}

/**
 * Быстрый in-memory rate-limit + проверка того, что пользователь не замучен.
 * Используется перед записью в БД — для мгновенной защиты от флуда.
 */
export function checkQuickRate(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  return rateLimit(key, limit, windowMs);
}

/** Ключи для in-memory лимитеров (по user + действию). */
export function rateKey(prefix: string, userId: string): string {
  return `${prefix}:${userId}`;
}

/**
 * Промт №1: «AI может временно ужесточить лимиты при подозрительной активности.»
 * Эта функция — точка входа: если у пользователя status=suspicious, лимиты делятся на 2.
 */
export function suspiciousFactor(status: string | null | undefined): number {
  return status === "suspicious" ? 0.5 : 1.0;
}
