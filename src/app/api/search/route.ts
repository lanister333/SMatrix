import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";
import { safeAuthorGender } from "@/lib/nick-gender";

export const runtime = "nodejs";

interface SearchRow {
  type: "message" | "topic";
  topicId: number;
  title: string;
  messageNum: number | null;
  snippet: string;
  rubricName: string;
  author: string;
  authorGender: string;
  isArchived: boolean;
  isClosed: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") || "").trim();
    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const topicRows = await db.topic.findMany({
      where: {
        deletedAt: null,
        OR: [{ title: { contains: q } }, { messages: { some: { body: { contains: q }, isDeleted: false } } }],
      },
      orderBy: { lastActivityAt: "desc" },
      take: 40,
      include: {
        rubric: true,
        author: { select: { nickname: true, gender: true } },
        messages: {
          where: { body: { contains: q }, isDeleted: false, isHiddenByAi: false },
          orderBy: { num: "asc" },
          take: 1,
          include: { author: { select: { nickname: true, gender: true } } },
        },
      },
    });

    const results: SearchRow[] = [];
    for (const t of topicRows) {
      if (t.title.toLowerCase().includes(q.toLowerCase())) {
        results.push({
          type: "topic",
          topicId: t.id,
          title: t.title,
          messageNum: null,
          snippet: "",
          rubricName: t.rubric?.name ?? "",
          author: t.authorName,
          authorGender: safeAuthorGender(t.authorName, t.author as { nickname: string; gender: string | null } | null),
          isArchived: t.isArchived,
          isClosed: t.isClosed,
        });
      }
      const m = t.messages[0];
      if (m) {
        const idx = m.body.toLowerCase().indexOf(q.toLowerCase());
        const start = Math.max(0, idx - 60);
        const snippet =
          (start > 0 ? "…" : "") +
          m.body.slice(start, Math.min(m.body.length, start + 180)) +
          (start + 180 < m.body.length ? "…" : "");
        results.push({
          type: "message",
          topicId: t.id,
          title: t.title,
          messageNum: m.num,
          snippet,
          rubricName: t.rubric?.name ?? "",
          author: m.authorName,
          authorGender: safeAuthorGender(m.authorName, m.author as { nickname: string; gender: string | null } | null),
          isArchived: t.isArchived,
          isClosed: t.isClosed,
        });
      }
    }

    return NextResponse.json({ results: results.slice(0, 30) });
  } catch (e) {
    return handleApiError(e);
  }
}
