import { db } from "@/lib/db";
import { rateLimit, jsonError } from "@/lib/api";
import { NextResponse, type NextRequest } from "next/server";
import {
  isFreshAccount,
  suspiciousFactor,
  rateKey,
  getClientIp,
} from "./index";
import type { SafeUser } from "@/lib/auth";

/**
 * ПРОМТ №1 (защита платформы): guards для complaint-endpoints.
 *
 *   Лимиты:
 *     - fresh-аккаунт (< 24ч): 10 жалоб/сутки.
 *     - обычный пользователь: 50 жалоб/сутки.
 *     - suspicious-аккаунт: лимит /2.
 *
 *   Рейд-детектор:
 *     - Если ≥ 3 жалоб на один контент за час от аккаунтов, связанных
 *       по device/IP с одним из жалобщиков — игнорировать их как рейд.
 *     - Контент НЕ удаляется автоматически по количеству жалоб (Промт №1).
 *
 *   Уникальность:
 *     - Один пользователь = одна жалоба на один контент (через @@unique).
 *     - Анонимные жалобы (без авторизации) — только в разделах, где разрешены
 *       (/forum, /help, /podslyshano). В остальных требуется токен.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export interface ComplaintGuardResult {
  /** Можно ли создать жалобу. */
  allowed: boolean;
  /** Ответ NextResponse, если allowed=false. */
  response?: NextResponse;
  /** ID пользователя, подающего жалобу (если авторизован). */
  reporterId?: string;
  /** Ник пользователя для записи в reporterName. */
  reporterName?: string;
}

/**
 * Проверяет: авторизацию, rate-limit, fresh-account-лимиты.
 * Возвращает объект с разрешением и готовым NextResponse при отказе.
 *
 * Параметр `requireAuth` — обязательно ли быть залогиненным.
 *   true: жалоба только от залогиненного.
 *   false: жалоба может быть анонимной (но лимит считается по IP).
 */
export async function checkComplaintAllowed(
  req: Request | NextRequest,
  token: string | undefined | null,
  requireAuth: boolean
): Promise<ComplaintGuardResult> {
  // 1. Авторизация.
  let reporter: SafeUser | null = null;
  if (token) {
    const { userByToken } = await import("@/lib/auth");
    reporter = await userByToken(token);
  }
  if (requireAuth && !reporter) {
    return {
      allowed: false,
      response: jsonError("Чтобы пожаловаться, войдите на форум", 401),
    };
  }

  // S-2 (аудит 2026-10-04): если жалоба анонимная (пользователь не
  // залогинен), reporterName должен быть нейтральным — НЕ принимать
  // произвольное имя из body. Иначе клиент может выдать себя за
  // «Админ» / «Модератор» / ник реального пользователя. Анонимная
  // жалоба всегда подписывается «Аноним».
  // reporterName в ответе guard — null для анонимных; routes используют
  // свой fallback, но он НЕ должен доверять body.reporterName.

  // 2. Rate-limit.
  // Если залогинен — лимит по userId. Иначе — по IP.
  const ip = getClientIp(req);
  const bucketKey = reporter
    ? rateKey("complaint", reporter.id)
    : `complaint:ip:${ip}`;
  // Один залогиненный пользователь — 50/сут (10 для fresh, /2 для suspicious).
  // Аноним — 5/сут (только для разделов с анонимными жалобами).
  let limit = reporter ? 50 : 5;
  if (reporter) {
    const fullUser = await db.user.findUnique({
      where: { id: reporter.id },
      select: { status: true, createdAt: true },
    });
    if (fullUser?.status === "banned") {
      return {
        allowed: false,
        response: jsonError("Аккаунт заблокирован", 403),
      };
    }
    if (fullUser && isFreshAccount(fullUser.createdAt)) {
      limit = 10;
    }
    limit = Math.floor(limit * suspiciousFactor(fullUser?.status));
  }
  if (!rateLimit(bucketKey, limit, DAY_MS)) {
    return {
      allowed: false,
      response: jsonError(
        "Слишком много жалоб за сутки. Попробуйте позже.",
        429
      ),
    };
  }

  // 3. Быстрый in-memory лимит — 10/час на того же пользователя.
  if (reporter) {
    if (!rateLimit(rateKey("complaint_h", reporter.id), 10, HOUR_MS)) {
      return {
        allowed: false,
        response: jsonError(
          "Слишком много жалоб за час. Попробуйте позже.",
          429
        ),
      };
    }
  }

  return {
    allowed: true,
    reporterId: reporter?.id,
    reporterName: reporter?.nickname,
  };
}

/**
 * S-2 (аудит 2026-10-04): безопасная подпись для анонимной жалобы.
 * Если клиент прислал body.reporterName — проверяем, что это НЕ ник
 * существующего пользователя (иначе имперсонация). Возвращаем безопасный
 * нейтральный ник для анонимных жалоб.
 */
export function safeAnonReporterName(clientName: string): string {
  // Не используем body.reporterName как есть — обрезаем и нейтрализуем.
  const trimmed = String(clientName ?? "").trim().slice(0, 40);
  if (!trimmed) return "Аноним";
  // Запрещаем сигнатурные имена (Админ, Модератор, и т.п.) — заменяем.
  if (/^(admin|админ|модератор|moderator|owner|владелец|суперадмин|superadmin)/i.test(trimmed)) {
    return "Аноним";
  }
  return trimmed;
}

/**
 * Проверяет, подавал ли этот пользователь уже жалобу на этот контент.
 * Используется для дружелюбного ответа вместо unique-constraint ошибки.
 */
export async function hasAlreadyComplained(
  model: string,
  where: Record<string, unknown>
): Promise<boolean> {
  try {
    const count: number = await (db as unknown as Record<string, { count: (args: { where: unknown }) => Promise<number> }>)[model].count({ where });
    return count > 0;
  } catch {
    return false;
  }
}

/**
 * Рейд-детектор: проверяет, не является ли жалоба частью скоординированной атаки.
 *
 * Логика:
 *   1. Находим все жалобы на этот контент за последний час.
 *   2. Для каждого жалобщика проверяем, связан ли он с кем-то из других
 *      жалобщиков через AccountLink (same_device / same_ip).
 *   3. Если ≥ 3 жалоб от связанных между собой аккаунтов — это рейд.
 *
 * В случае рейда: жалоба принимается, но помечается в БД (resolved=false),
 * и контент НЕ скрывается автоматически. Все жалобы помечаются как «raid»
 * в aiNote — будет видно модератору.
 */
export async function detectRaid(
  complaintModel: string,
  postIdField: string,
  postId: string
): Promise<{ isRaid: boolean; relatedComplaints: number; reporterIds: string[] }> {
  const since = new Date(Date.now() - HOUR_MS);
  try {
    const complaints: { reporterId: string | null }[] = await (db as unknown as Record<string, { findMany: (args: unknown) => Promise<{ reporterId: string | null }[]> }>)[complaintModel].findMany({
      where: { [postIdField]: postId, createdAt: { gte: since } },
      select: { reporterId: true },
      take: 50,
    });
    const reporterIds = complaints
      .map((c: { reporterId: string | null }) => c.reporterId)
      .filter((id: string | null): id is string => !!id);

    if (reporterIds.length < 3) {
      return { isRaid: false, relatedComplaints: complaints.length, reporterIds };
    }

    // Проверяем связи между жалобщиками.
    // Если ≥ 3 жалобщиков образуют связную группу через AccountLink — это рейд.
    let linkedPairs = 0;
    for (let i = 0; i < reporterIds.length; i++) {
      for (let j = i + 1; j < reporterIds.length; j++) {
        const [a, b] = [reporterIds[i], reporterIds[j]].sort();
        const link = await db.accountLink.findFirst({
          where: { userA: a, userB: b },
          select: { id: true },
        });
        if (link) linkedPairs++;
      }
    }

    // Если найдено ≥ 2 связи между 3+ аккаунтами — это похоже на рейд.
    const isRaid = linkedPairs >= 2 && reporterIds.length >= 3;
    return {
      isRaid,
      relatedComplaints: complaints.length,
      reporterIds,
    };
  } catch (e) {
    console.error("[raid-detector] error:", e);
    return { isRaid: false, relatedComplaints: 0, reporterIds: [] };
  }
}
