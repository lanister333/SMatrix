import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isStaffRole } from "@/lib/admin";

export const runtime = "nodejs";

/**
 * ШАГ 11. Админ-раздел: санкции и апелляции.
 * Санкции ИИ помечены источником «ai» — человек может их отменить.
 * Апелляции в этом списке НИКОГДА не обрабатываются ИИ.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const user = await userByToken(sp.get("token"));
    if (!user) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    if (!isStaffRole(user.role)) {
      return NextResponse.json({ error: "Доступно только администратору" }, { status: 403 });
    }

    const sanctions = await db.sanction.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { nickname: true } },
        appeals: { where: { status: "open" }, select: { id: true } },
      },
    });

    const appeals = await db.decisionAppeal.findMany({
      orderBy: [{ status: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        sanction: { include: { user: { select: { nickname: true } } } },
      },
    });

    // Темы и номера сообщений для отображения целей апелляций
    const messageIds = appeals.map((a) => a.messageId).filter((x): x is string => !!x);
    const messages = messageIds.length
      ? await db.message.findMany({
          where: { id: { in: messageIds } },
          select: { id: true, num: true, authorName: true, hiddenReason: true, isHiddenByAi: true, topic: { select: { id: true, title: true } } },
        })
      : [];
    const msgById = new Map(messages.map((m) => [m.id, m]));

    return NextResponse.json({
      sanctions: sanctions.map((s) => ({
        id: s.id,
        user: s.user.nickname,
        kind: s.kind,
        reason: s.reason,
        source: s.source,
        messageId: s.messageId,
        expiresAt: s.expiresAt,
        revoked: s.revoked,
        revokedBy: s.revokedBy,
        revokedReason: s.revokedReason,
        createdAt: s.createdAt,
        hasOpenAppeal: s.appeals.length > 0,
      })),
      appeals: appeals.map((a) => ({
        id: a.id,
        userNick: a.userNick,
        sanction: a.sanction
          ? {
              id: a.sanction.id,
              kind: a.sanction.kind,
              reason: a.sanction.reason,
              source: a.sanction.source,
              user: a.sanction.user.nickname,
              revoked: a.sanction.revoked,
            }
          : null,
        message: a.messageId
          ? (() => {
              const m = msgById.get(a.messageId);
              return m
                ? {
                    id: m.id,
                    num: m.num,
                    author: m.authorName,
                    hiddenReason: m.hiddenReason,
                    isHiddenByAi: m.isHiddenByAi,
                    topic: { id: m.topic.id, title: m.topic.title },
                  }
                : null;
            })()
          : null,
        text: a.text,
        status: a.status,
        resolvedBy: a.resolvedBy,
        note: a.note,
        createdAt: a.createdAt,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
