import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ nick: string }> }) {
  try {
    const { nick } = await ctx.params;
    const nickname = decodeURIComponent(nick);
    const user = await db.user.findUnique({ where: { nickname } });
    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

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
        nickname: user.nickname,
        gender: user.gender,
        createdAt: user.createdAt,
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
    });
  } catch (e) {
    return handleApiError(e);
  }
}
