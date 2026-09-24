import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { moderateNewText, restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction, handleConfirmedViolation } from "@/lib/moderation/sanctions";
import { isStaffRole } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

interface TopicRow {
  id: number;
  title: string;
  isPinned: boolean;
  isArchived: boolean;
  isClosed: boolean;
  author: string;
  authorGender: string;
  answers: number;
  views: number;
  lastActivityAt: Date;
  lastAuthor: string;
  lastAuthorGender: string | null;
  rubricName: string;
  rubricSlug: string;
  subName: string;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(sp.get("perPage") || "25", 10) || 25));
    const q = (sp.get("q") || "").trim();
    const sort = sp.get("sort") || "";
    const scope = sp.get("scope") || "";
    const token = sp.get("token");
    const rubricSlug = sp.get("rubric") || "";
    const idsParam = sp.get("ids") || "";

    const where: Record<string, unknown> = { deletedAt: null };

    // Рубрика (включая дочерние)
    if (rubricSlug) {
      const rubric = await db.rubric.findUnique({ where: { slug: rubricSlug } });
      if (rubric) {
        const children = await db.rubric.findMany({ where: { parentId: rubric.id } });
        where.rubricId = { in: [rubric.id, ...children.map((c) => c.id)] };
      }
    }

    // Область видимости
    // ТЗ: темы без активности 1 год автоматически считаются архивными
    const archiveCutoff = new Date(Date.now() - 365 * 24 * 3600 * 1000);
    if (scope === "archive") {
      where.OR = [{ isArchived: true }, { lastActivityAt: { lt: archiveCutoff } }];
    } else if (scope !== "favorites") {
      where.isArchived = false;
      where.lastActivityAt = { gte: archiveCutoff };
    }

    const user = token ? await userByToken(token) : null;

    if (scope === "mine") {
      if (!user) return NextResponse.json({ error: "Войдите на форум" }, { status: 401 });
      where.authorId = user.id;
    }
    if (scope === "participated") {
      if (!user) return NextResponse.json({ error: "Войдите на форум" }, { status: 401 });
      where.messages = { some: { authorId: user.id } };
    }
    if (scope === "favorites") {
      const ids = idsParam
        .split(",")
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isFinite(n));
      if (ids.length === 0) {
        return NextResponse.json({ topics: [], total: 0, pages: 1 });
      }
      where.id = { in: ids };
    }
    if (scope === "active") {
      where.lastActivityAt = { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) };
    }
    if (sort === "unanswered") {
      where.messages = { ...(where.messages as object | undefined), none: { num: { gt: 1 }, isDeleted: false } };
    }
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { messages: { some: { body: { contains: q }, isDeleted: false } } },
      ];
    }

    const orderBy: Record<string, string>[] = [];
    if (sort === "popular") {
      // ТЗ: популярные темы — только по просмотрам
      orderBy.push({ views: "desc" }, { id: "desc" });
    } else {
      orderBy.push({ isPinned: "desc" }, { lastActivityAt: "desc" });
    }

    const [total, topics] = await Promise.all([
      db.topic.count({ where }),
      db.topic.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          author: { select: { nickname: true, gender: true } },
          rubric: { include: { parent: true } },
          _count: { select: { messages: true } },
        },
      }),
    ]);

    // Пол автора последнего сообщения
    const lastActivityIds = topics.map((t) => t.id);
    const lastMsgs = lastActivityIds.length
      ? await db.message.findMany({
          where: { topicId: { in: lastActivityIds } },
          orderBy: { num: "desc" },
          select: { topicId: true, authorName: true, author: { select: { gender: true } } },
        })
      : [];
    const lastByTopic = new Map<number, { name: string; gender: string | null }>();
    for (const m of lastMsgs) {
      if (!lastByTopic.has(m.topicId)) {
        lastByTopic.set(m.topicId, { name: m.authorName, gender: m.author?.gender ?? null });
      }
    }

    const rows: TopicRow[] = topics.map((t) => {
      const isChild = !!t.rubric?.parentId;
      const last = lastByTopic.get(t.id);
      return {
        id: t.id,
        title: t.title,
        isPinned: t.isPinned,
        // ТЗ: неактивность 1 год = архив (в т.ч. для строк списка)
        isArchived: t.isArchived || t.lastActivityAt.getTime() < archiveCutoff.getTime(),
        isClosed: t.isClosed,
        author: t.authorName,
        authorGender: t.author?.gender ?? "unspecified",
        answers: Math.max(0, t._count.messages - 1),
        views: t.views,
        lastActivityAt: t.lastActivityAt,
        lastAuthor: last?.name ?? t.lastAuthorName ?? t.authorName,
        lastAuthorGender: last?.gender ?? null,
        rubricName: isChild ? (t.rubric?.parent?.name ?? "") : (t.rubric?.name ?? ""),
        rubricSlug: isChild ? (t.rubric?.parent?.slug ?? "") : (t.rubric?.slug ?? ""),
        subName: isChild ? (t.rubric?.name ?? "") : "",
      };
    });

    return NextResponse.json({
      topics: rows,
      total,
      pages: Math.max(1, Math.ceil(total / perPage)),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** Создание новой темы (с обязательной проверкой ИИ-модерации — ШАГ 10). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;
    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json(
        { error: "Чтобы создавать темы, войдите или зарегистрируйтесь" },
        { status: 401 }
      );
    }

    // ШАГ 11: активное ограничение аккаунта (мягкая система санкций).
    const restriction = await getActiveRestriction(user.id);
    if (restriction) {
      return NextResponse.json(
        {
          error: restrictionBlockMessage(restriction),
          restricted: true,
          restriction,
        },
        { status: 403 }
      );
    }

    // ШАГ 12: создание тем может быть приостановлено в настройках сайта.
    if (!isStaffRole(user.role)) {
      const topicsEnabled = await db.siteSetting.findUnique({ where: { key: "newTopicsEnabled" } });
      if (topicsEnabled && topicsEnabled.value === "0") {
        return NextResponse.json(
          { error: "Создание новых тем временно приостановлено администратором" },
          { status: 403 }
        );
      }
    }
    const rubricId = parseInt(String(body.rubricId ?? ""), 10);
    const title = String(body.title ?? "").trim();
    const text = String(body.body ?? "").trim();

    if (!Number.isFinite(rubricId) || rubricId <= 0) {
      return NextResponse.json({ error: "Выберите раздел, в котором публикуется тема" }, { status: 400 });
    }
    const rubric = await db.rubric.findUnique({ where: { id: rubricId } });
    if (!rubric) {
      return NextResponse.json({ error: "Раздел не найден" }, { status: 400 });
    }
    if (title.length < 5 || title.length > 150) {
      return NextResponse.json(
        { error: "Заголовок слишком короткий — минимум 5 символов" },
        { status: 400 }
      );
    }
    if (!text) {
      return NextResponse.json({ error: "Напишите текст сообщения — это суть темы" }, { status: 400 });
    }
    if (text.length > 20000) {
      return NextResponse.json({ error: "Текст сообщения слишком длинный (максимум 20000 символов)" }, { status: 400 });
    }

    // ШАГ 10: проверка всего текста (заголовок + сообщение, включая цитаты).
    const outcome = await moderateNewText(`${title}\n${text}`);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    const last = await db.topic.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    const number = (last?.number ?? 0) + 1;

    const topic = await db.topic.create({
      data: {
        number,
        title,
        authorName: user.nickname,
        authorId: user.id,
        rubricId,
        lastAuthorName: user.nickname,
      },
    });

    await db.message.create({
      data: {
        topicId: topic.id,
        num: 1,
        authorName: user.nickname,
        authorId: user.id,
        body: text,
        aiStatus: outcome.action === "hide" ? "hidden" : outcome.action === "human" ? "human" : "ok",
        aiNote: outcome.aiNote ?? "",
        needHuman: outcome.needHuman,
        isHiddenByAi: outcome.action === "hide",
        hiddenReason: outcome.hiddenReason ?? "",
      },
    });

    // ШАГ 11: мягкая лестница санкций при очевидном нарушении.
    let sanction: Record<string, unknown> | null = null;
    if (outcome.action === "hide") {
      const firstMsg = await db.message.findFirst({ where: { topicId: topic.id, num: 1 } });
      const violation = await handleConfirmedViolation({
        userId: user.id,
        messageId: firstMsg?.id,
        topicId: topic.id,
        category: outcome.category ?? "other",
        reason: outcome.hiddenReason ?? "нарушение правил форума",
      });
      sanction = { ...violation.sanction, note: violation.note, needsHumanDecision: violation.needsHumanDecision };
      if (violation.needsHumanDecision && firstMsg) {
        await db.message.update({ where: { id: firstMsg.id }, data: { needHuman: true } });
      }
    }

    return NextResponse.json({ id: topic.id, sanction });
  } catch (e) {
    return handleApiError(e);
  }
}
