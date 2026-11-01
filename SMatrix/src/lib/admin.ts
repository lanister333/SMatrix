/**
 * ШАГ 12. Административная панель: роли, права и журнал действий.
 *
 * Роли (User.role):
 *  — owner     «Главный администратор / Владелец» — полный доступ ко всем разделам;
 *  — admin     «Администратор» — легаси-роль с полным доступом (совпадает с owner);
 *  — moderator «Модератор» — ограниченные права: модерация, жалобы, просмотр
 *    пользователей и тем, журнал. Не может: настройки сайта, разделы
 *    (объявления/информация/справочник), удаление и перенос тем,
 *    блокировки пользователей.
 *
 * Журнал действий (AdminLog) хранится внутренне: каждое действие
 * модерации и администрирования записывается с исполнителем и объектом.
 */

import { db } from "@/lib/db";
import { AuthError, requireUser, type SafeUser } from "@/lib/auth";

export type StaffRole = "owner" | "admin" | "moderator";

export const ROLE_LABELS: Record<string, string> = {
  owner: "Главный администратор / Владелец",
  admin: "Администратор",
  moderator: "Модератор",
  user: "Участник форума",
};

/** Все роли с доступом в админ-панель. */
export function isStaffRole(role: string): role is StaffRole {
  return role === "owner" || role === "admin" || role === "moderator";
}

/** Полный доступ (владелец/администратор) — в отличие от модератора. */
export function isOwnerRole(role: string): boolean {
  return role === "owner" || role === "admin";
}

/** Любой сотрудник (owner/admin/moderator). */
export async function requireStaff(token?: string | null): Promise<SafeUser> {
  const u = await requireUser(token);
  if (!isStaffRole(u.role)) throw new AuthError("Доступно только администратору", 403);
  return u;
}

/** Только полный доступ: Главный администратор / Владелец. */
export async function requireOwner(token?: string | null): Promise<SafeUser> {
  const u = await requireUser(token);
  if (!isOwnerRole(u.role)) throw new AuthError("Доступно только Главному администратору (Владельцу)", 403);
  return u;
}

export interface LogInput {
  actor: string;
  actorRole: string;
  action: string;
  targetType?: string;
  targetLabel?: string;
  details?: string;
}

/** Запись во внутренний журнал действий модерации/администрирования. */
export async function logAdminAction(input: LogInput): Promise<void> {
  try {
    await db.adminLog.create({
      data: {
        actor: input.actor,
        actorRole: input.actorRole,
        action: input.action,
        targetType: input.targetType ?? "",
        targetLabel: (input.targetLabel ?? "").slice(0, 300),
        details: (input.details ?? "").slice(0, 1000),
      },
    });
  } catch {
    // журнал не должен ломать основное действие
  }
}
