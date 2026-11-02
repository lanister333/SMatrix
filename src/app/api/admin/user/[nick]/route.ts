import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isStaffRole, ROLE_LABELS } from "@/lib/admin";
import { SANCTION_LABELS } from "@/lib/moderation/sanctions";

export const runtime = "nodejs";

/**
 * ШАГ 12. Полный профиль пользователя для админ-панели:
 * ник/email, роль, дата регистрации, темы и сообщения,
 * текущие ограничения и вся история санкций.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ nick: string }> }) {
  try {
    const staff = await userByToken(req.nextUrl.searchParams.get("token"));
    if (!staff) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    if (!isStaffRole(staff.role)) {
      return NextResponse.json({ error: "Доступно только администратору" }, { status: 403 });
    }

    const { nick } = await ctx.params;
    const user = await db.user.findUnique({
      where: { nickname: decodeURIComponent(nick) },
      include: {
        _count: { select: { topics: true, messages: true } },
      },
    });
    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const now = new Date();
    const [sanctions, lastTopics, lastMessages] = await Promise.all([
      db.sanction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { appeals: { orderBy: { createdAt: "asc" }, select: { status: true } } },
      }),
      db.topic.findMany({
        where: { authorId: user.id, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { rubric: { select: { name: true } }, _count: { select: { messages: true } } },
      }),
      db.message.findMany({
        where: { authorId: user.id, isDeleted: false },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { topic: { select: { id: true, title: true } } },
      }),
    ]);

    return NextResponse.json({
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        role: user.role,
        roleLabel: ROLE_LABELS[user.role] ?? user.role,
        gender: user.gender,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        restrictedUntil: user.restrictedUntil,
        restrictedNow: !!(user.restrictedUntil && user.restrictedUntil.getTime() > now.getTime()),
        topicsCount: user._count.topics,
        messagesCount: user._count.messages,
      },
      sanctions: sanctions.map((s) => ({
        id: s.id,
        kind: s.kind,
        kindLabel: SANCTION_LABELS[s.kind as keyof typeof SANCTION_LABELS] ?? s.kind,
        reason: s.reason,
        source: s.source,
        expiresAt: s.expiresAt,
        revoked: s.revoked,
        revokedBy: s.revokedBy,
        revokedReason: s.revokedReason,
        createdAt: s.createdAt,
        appealStatus: s.appeals.length > 0 ? s.appeals[s.appeals.length - 1].status : "",
      })),
      topics: lastTopics.map((t) => ({
        id: t.id,
        title: t.title,
        rubricName: t.rubric?.name ?? "",
        answers: Math.max(0, t._count.messages - 1),
        createdAt: t.createdAt,
      })),
      messages: lastMessages.map((m) => ({
        id: m.id,
        topicId: m.topic.id,
        topicTitle: m.topic.title,
        body: m.body.slice(0, 200),
        createdAt: m.createdAt,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
