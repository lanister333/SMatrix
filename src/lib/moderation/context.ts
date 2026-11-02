import { db } from "@/lib/db";
import type { AiModerationContext } from "./ai";

/**
 * ПРОМТ №2 (защита платформы): сборщики контекста для AI-модерации.
 *
 *   getAuthorHistory(userId)        — сводка нарушений автора.
 *   getRecentMessages(topicId, n)   — последние N сообщений темы (до).
 *   getComplaintsFor(postId/model)  — жалобы на конкретный контент.
 *
 * Все функции возвращают готовые объекты для AiModerationContext.
 */

const DAY = 24 * 60 * 60 * 1000;

/**
 * Сводка нарушений автора за последние 90 дней.
 * Включает: общее число нарушений, недавние (за 7 дней), категории, последнюю дату.
 */
export async function getAuthorHistory(
  userId: string
): Promise<AiModerationContext["authorHistory"]> {
  try {
    const since90 = new Date(Date.now() - 90 * DAY);
    const since7 = new Date(Date.now() - 7 * DAY);

    // Все неподтверждённые санкции автора за 90 дней.
    const sanctions = await db.sanction.findMany({
      where: {
        userId,
        revoked: false,
        createdAt: { gte: since90 },
      },
      select: { kind: true, reason: true, createdAt: true, source: true },
      orderBy: { createdAt: "desc" },
    });

    // Считаем по категориям (извлекаем из reason примерно — у нас нет отдельного поля category).
    // Простой подход: группируем по source.
    const categoriesBreakdown: Record<string, number> = {};
    for (const s of sanctions) {
      const key = s.source === "ai" ? "ai" : "human";
      categoriesBreakdown[key] = (categoriesBreakdown[key] ?? 0) + 1;
    }

    const recentViolations = sanctions.filter(
      (s) => s.createdAt >= since7
    ).length;

    return {
      totalViolations: sanctions.length,
      recentViolations,
      lastViolationAt: sanctions[0]?.createdAt,
      categoriesBreakdown,
    };
  } catch (e) {
    console.error("[context] getAuthorHistory error:", e);
    return undefined;
  }
}

/**
 * Последние N сообщений темы (для передачи в AI как «сообщения ДО»).
 * Берутся сообщения по убыванию num, переворачиваются в хронологическом порядке.
 */
export async function getRecentMessages(
  topicId: number,
  limit = 5
): Promise<AiModerationContext["before"]> {
  try {
    const msgs = await db.message.findMany({
      where: { topicId, isDeleted: false },
      orderBy: { num: "desc" },
      take: limit,
      select: {
        authorName: true,
        body: true,
        createdAt: true,
        isHiddenByAi: true,
      },
    });
    // Скрытые AI сообщения не передаём в контекст как видимый текст —
    // иначе AI может «оправдать» их повтор. Заменяем на заглушку.
    const cleaned = msgs
      .reverse()
      .map((m) => ({
        authorName: m.authorName,
        body: m.isHiddenByAi ? "[сообщение скрыто ИИ-модерацией]" : m.body,
        createdAt: m.createdAt,
      }));
    return cleaned;
  } catch (e) {
    console.error("[context] getRecentMessages error:", e);
    return undefined;
  }
}

/**
 * Жалобы на сообщение форума.
 */
export async function getMessageComplaints(
  messageId: string
): Promise<AiModerationContext["complaints"]> {
  try {
    const rows = await db.complaint.findMany({
      where: { messageId, resolved: false },
      select: { category: true, comment: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return rows.map((r) => ({
      category: r.category,
      comment: r.comment,
      createdAt: r.createdAt,
    }));
  } catch (e) {
    console.error("[context] getMessageComplaints error:", e);
    return undefined;
  }
}
