/**
 * /api/admin/topics/cleanup — массовое мягкое удаление тем форума со всеми сообщениями.
 *
 * Создан 2026-11-02. Удаляет (soft delete):
 *   - Topic.deletedAt = now()  для всех тем, где isPinned = false и deletedAt = null
 *   - Message.isDeleted = true для всех сообщений в этих темах
 *
 * Закреплённые темы (isPinned = true) и сообщения в них НЕ трогаются.
 * Уже удалённые темы и сообщения не трогаются (идемпотентность).
 *
 * POST /api/admin/topics/cleanup
 * body: { token: "..." }
 *
 * Возвращает: { ok, deletedTopics, deletedMessages, keptPinnedTopics, alreadyDeletedTopics }
 *
 * Откат — ручной SQL:
 *   UPDATE Topic SET deletedAt = NULL WHERE isPinned = 0;
 *   UPDATE Message SET isDeleted = 0 WHERE topicId IN (SELECT id FROM Topic WHERE isPinned = 0);
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isStaffRole } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token: string | undefined = body.token;

    if (!token) {
      return NextResponse.json({ error: "Не передан token" }, { status: 400 });
    }
    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json({ error: "Сессия не найдена — перезайдите" }, { status: 401 });
    }
    if (!isStaffRole(user.role)) {
      return NextResponse.json({ error: "Доступно только администратору" }, { status: 403 });
    }

    // Подсчёт «до» — для информативного ответа.
    const pinnedTopicsCount = await db.topic.count({ where: { isPinned: true, deletedAt: null } });
    const activeTopicsCount = await db.topic.count({ where: { isPinned: false, deletedAt: null } });
    const alreadyDeletedTopics = await db.topic.count({ where: { deletedAt: { not: null } } });

    // Транзакция: сначала soft-delete сообщений в незакреплённых активных темах,
    // потом soft-delete самих тем. Порядок важен — после deletedAt на Topic
    // фильтр `topic.deletedAt: null` уже не найдёт эти темы.
    const result = await db.$transaction(async (tx) => {
      // 1. Помечаем сообщения как удалённые.
      const msgUpdate = await tx.message.updateMany({
        where: {
          isDeleted: false,
          topic: { isPinned: false, deletedAt: null },
        },
        data: { isDeleted: true },
      });

      // 2. Soft-delete самих тем.
      const topicUpdate = await tx.topic.updateMany({
        where: { isPinned: false, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      return {
        deletedTopics: topicUpdate.count,
        deletedMessages: msgUpdate.count,
      };
    });

    return NextResponse.json({
      ok: true,
      deletedTopics: result.deletedTopics,
      deletedMessages: result.deletedMessages,
      keptPinnedTopics: pinnedTopicsCount,
      alreadyDeletedTopicsBefore: alreadyDeletedTopics,
      activeTopicsBefore: activeTopicsCount,
      note: `Удалено ${result.deletedTopics} тем и ${result.deletedMessages} сообщений (soft delete). Закреплённые темы (${pinnedTopicsCount}) не тронуты.`,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

// GET — заглушка для проверки доступности.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "/api/admin/topics/cleanup", method: "POST" });
}
