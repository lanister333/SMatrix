import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Публичный профиль пользователя (по нику).
 *
 * К-3 (аудит безопасности 2026-10-04): РАНЬШЕ этот endpoint без auth
 * возвращал phone, email, id — любому, кто знает ник. Это утечка PII.
 *
 * ТЕПЕРЬ: публично возвращаются только публичные поля (ник, пол,
 * дата регистрации, город, bio, orgName для представителей). Приватные
 * поля (phone, email, newsletterSubscribed, notificationsSubscribed, id)
 * возвращаются ТОЛЬКО самому владельцу — через token в query ?token=…
 * или в Authorization: Bearer … заголовке. Запрос без токена (или с
 * чужим токеном) видит только публичный профиль.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ nick: string }> }) {
  try {
    const { nick } = await ctx.params;
    const nickname = decodeURIComponent(nick);
    const user = await db.user.findUnique({ where: { nickname } });
    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    // K-3: token опциональный; если есть — проверяем, что это сам владелец.
    const sp = req.nextUrl.searchParams;
    const authHeader = req.headers.get("authorization") ?? "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
    const token = sp.get("token") || bearerToken;
    const requester = token ? await userByToken(token) : null;
    // K-3: приватные поля видит только сам владелец (не админ, не модератор —
    // для них есть отдельный endpoint /api/admin/user/[nick]).
    const isOwner = !!(requester && requester.id === user.id);

    const [topicsCount, messagesCount, topics, messages] = await Promise.all([
      db.topic.count({ where: { authorId: user.id, deletedAt: null } }),
      db.message.count({ where: { authorId: user.id, isDeleted: false } }),
      db.topic.findMany({
        where: { authorId: user.id, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { rubric: true, _count: { select: { messages: true } } },
      }),
      db.message.findMany({
        where: { authorId: user.id, isDeleted: false },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { topic: { select: { id: true, title: true } } },
      }),
    ]);

    return NextResponse.json({
      user: {
        // ПУБЛИЧНЫЕ поля (видны всем).
        nickname: user.nickname,
        gender: user.gender,
        createdAt: user.createdAt,
        city: user.city,
        bio: user.bio,
        orgRep: user.orgRep,
        orgName: user.orgName,
        // ПРИВАТНЫЕ поля — только владельцу (K-3).
        ...(isOwner
          ? {
              id: user.id,
              phone: user.phone,
              email: user.email,
              newsletterSubscribed: user.newsletterSubscribed,
              notificationsSubscribed: user.notificationsSubscribed,
              emailVerified: user.emailVerified,
            }
          : {}),
      },
      topicsCount,
      messagesCount,
      topicsShown: topics.length,
      messagesShown: messages.length,
      topics: topics.map((t) => ({
        id: t.id,
        title: t.title,
        isArchived: t.isArchived,
        isClosed: t.isClosed,
        rubricName: t.rubric?.name ?? "",
        createdAt: t.createdAt,
        answers: Math.max(0, t._count.messages - 1),
        views: t.views,
      })),
      messages: messages.map((m) => ({
        id: m.id,
        topicId: m.topicId,
        num: m.num,
        topicTitle: m.topic?.title ?? "",
        snippet: m.body.length > 160 ? `${m.body.slice(0, 160)}…` : m.body,
        createdAt: m.createdAt,
      })),
      // K-3: флаг для клиента — видны ли приватные поля.
      isOwner,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
