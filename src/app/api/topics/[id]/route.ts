import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { safeAuthorGender } from "@/lib/nick-gender";
import { handleApiError } from "@/lib/api";
import { isStaffRole } from "@/lib/admin";

export const runtime = "nodejs";

const PER_PAGE = 35;

async function loadTopic(id: number) {
  return db.topic.findUnique({
    where: { id },
    include: {
      author: { select: { nickname: true, gender: true } },
      rubric: { include: { parent: true } },
      _count: { select: { messages: true } },
      // ШАГ 17 (ТЗ п.4): тема «Подслушано» несёт ссылку обратно на публикацию
      overheardPost: { select: { id: true, title: true } },
      // ШАГ 18 (ТЗ п.12): тема «Где купить» несёт ссылку обратно на вопрос
      whereToBuyPost: { select: { id: true, title: true } },
      // ШАГ 19 (ТЗ п.14/16): тема «ЖКХ» несёт ссылку обратно на публикацию
      // (или пометку об удалении автором — тема не удаляется)
      gkhProblem: { select: { id: true, title: true, isDeleted: true } },
      // ШАГ 23: тема «Где дешевле» несёт ссылку обратно на вопрос
      cheapPost: { select: { id: true, title: true, isDeleted: true } },
      // ШАГ 20: тема «Рекомендую / Не рекомендую» несёт ссылку обратно
      recPost: { select: { id: true, title: true, isDeleted: true } },
      // ШАГ 25: тема «О работодателях» несёт ссылку обратно на отзыв
      empPost: { select: { id: true, title: true, isDeleted: true } },
    },
  });
}

function topicView(t: NonNullable<Awaited<ReturnType<typeof loadTopic>>>) {
  const isChild = !!t.rubric?.parentId;
  // ТЗ: тема без активности 1 год считается архивной
  const archivedNow = t.isArchived || t.lastActivityAt.getTime() < Date.now() - 365 * 24 * 3600 * 1000;
  return {
    id: t.id,
    number: t.number,
    title: t.title,
    isPinned: t.isPinned,
    isClosed: t.isClosed,
    isArchived: archivedNow,
    author: t.authorName,
    authorGender: safeAuthorGender(t.authorName, t.author as { nickname: string; gender: string | null } | null),
    createdAt: t.createdAt,
    views: t.views,
    answers: Math.max(0, t._count.messages - 1),
    lastActivityAt: t.lastActivityAt,
    rubricName: isChild ? (t.rubric?.parent?.name ?? "") : (t.rubric?.name ?? ""),
    rubricSlug: isChild ? (t.rubric?.parent?.slug ?? "") : (t.rubric?.slug ?? ""),
    subName: isChild ? (t.rubric?.name ?? "") : "",
    subSlug: isChild ? (t.rubric?.slug ?? "") : "",
    // ШАГ 17 (ТЗ п.4/25.15): источник — ссылка из темы обратно на публикацию «Подслушано»
    overheard: t.overheardPost ? { id: t.overheardPost.id, title: t.overheardPost.title } : null,
    // ШАГ 18 (ТЗ п.12): источник — ссылка из темы обратно на вопрос «Где купить»
    wheretobuy: t.whereToBuyPost ? { id: t.whereToBuyPost.id, title: t.whereToBuyPost.title } : null,
    // ШАГ 19 (ТЗ п.14/16): источник — ссылка из темы на проблему «ЖКХ»;
    // при удалении автором тема сохраняется, показывается пометка (п.16)
    gkh: t.gkhProblem
      ? { id: t.gkhProblem.id, title: t.gkhProblem.title, isDeleted: t.gkhProblem.isDeleted }
      : null,
    // ШАГ 23: источник — ссылка из темы обратно на вопрос «Где дешевле»
    gdedeshevle: t.cheapPost
      ? { id: t.cheapPost.id, title: t.cheapPost.title, isDeleted: t.cheapPost.isDeleted }
      : null,
    // ШАГ 20: источник — ссылка из темы обратно на публикацию «Рекомендую»
    recommend: t.recPost
      ? { id: t.recPost.id, title: t.recPost.title, isDeleted: t.recPost.isDeleted }
      : null,
    // ШАГ 25: источник — ссылка из темы обратно на отзыв «О работодателях»
    employers: t.empPost
      ? { id: t.empPost.id, title: t.empPost.title, isDeleted: t.empPost.isDeleted }
      : null,
  };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const topicId = parseInt(id, 10);
    if (!Number.isFinite(topicId)) {
      return NextResponse.json({ error: "Тема не найдена" }, { status: 404 });
    }
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const countView = sp.get("view") === "1";

    const topic = await loadTopic(topicId);
    if (!topic || topic.deletedAt) {
      return NextResponse.json(
        { error: "Тема не найдена или удалена" },
        { status: topic && topic.deletedAt ? 410 : 404 }
      );
    }

    if (countView) {
      await db.topic.update({ where: { id: topicId }, data: { views: { increment: 1 } } });
      topic.views += 1;
    }

    const total = topic._count.messages;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));

    // Настоящая глубина каждого сообщения в дереве ответов темы. Поле
    // depth в БД не поддерживается (везде 0), а лесенке нужен честный
    // уровень для ответов, чей родитель остался на другой странице
    // (цепочка предков в компоненте обрывается на границе страниц).
    // Считаем по всей теме лёгким select двух колонок с мемоизацией.
    const treeRows = await db.message.findMany({ where: { topicId }, select: { id: true, parentId: true } });
    const parentOf = new Map(treeRows.map((r) => [r.id, r.parentId]));
    const depthMemo = new Map<string, number>();
    const depthOf = (id: string): number => {
      const hit = depthMemo.get(id);
      if (hit !== undefined) return hit;
      depthMemo.set(id, 0); // страховка от цикла в parentId (схемой не предусмотрен)
      const p = parentOf.get(id);
      const d = p ? depthOf(p) + 1 : 0;
      depthMemo.set(id, d);
      return d;
    };

    const messages = await db.message.findMany({
      where: { topicId },
      orderBy: { num: "asc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      // ШАГ 28.09.2026 (правка п.е): подгружаем gender автора СООБЩЕНИЯ
      // (раньше включался только parent.author.gender — из-за этого
      // m.author?.gender всегда был undefined, в API уходил "unspecified",
      // и Nick компонент рисовал нейтрально-серый ник даже для тех
      // пользователей, у которых gender=male/female). Теперь авторы
      // ответов красятся по гендеру на всём форуме — и в существующих,
      // и в будущих темах, потому что правка в едином API-эндпоинте.
      include: {
        author: { select: { nickname: true, gender: true } },
        parent: { include: { author: { select: { nickname: true, gender: true } } } },
      },
    });

    return NextResponse.json({
      topic: topicView(topic),
      messages: messages.map((m) => ({
        id: m.id,
        num: m.num,
        author: m.authorName,
        authorGender: safeAuthorGender(m.authorName, m.author as { nickname: string; gender: string | null } | null),
        createdAt: m.createdAt,
        body: m.body,
        parentId: m.parentId,
        parentAuthor: m.parent?.authorName ?? null,
        parentAuthorGender: m.parent ? safeAuthorGender(m.parent.authorName ?? "", m.parent?.author as { nickname: string; gender: string | null } | null) : null,
        parentNum: m.parent?.num ?? null,
        depth: depthOf(m.id),
        isDeleted: m.isDeleted,
        deletedBy: m.deletedBy,
        isHiddenByAi: m.isHiddenByAi,
        hiddenReason: m.hiddenReason,
        aiNote: m.aiNote,
        editedAt: m.editedAt,
      })),
      page,
      pages,
      total,
      perPage: PER_PAGE,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** Действия модератора/автора над темой: close | open | delete. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const topicId = parseInt(id, 10);
    const body = await req.json();
    const user = await userByToken(body.token);
    if (!user) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    const topic = await db.topic.findUnique({ where: { id: topicId } });
    if (!topic || topic.deletedAt) {
      return NextResponse.json({ error: "Тема не найдена" }, { status: 404 });
    }
    const isAdmin = isStaffRole(user.role);
    const isAuthor = topic.authorId === user.id || topic.authorName === user.nickname;
    const action = String(body.action ?? "");

    if (action === "close" || action === "open") {
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Закрывать и открывать темы может только администратор" },
          { status: 403 }
        );
      }
      await db.topic.update({ where: { id: topicId }, data: { isClosed: action === "close" } });
      return NextResponse.json({ ok: true });
    }
    if (action === "delete") {
      if (!isAdmin && !isAuthor) {
        return NextResponse.json(
          { error: "Удалять тему может только автор или администратор" },
          { status: 403 }
        );
      }
      await db.topic.update({ where: { id: topicId }, data: { deletedAt: new Date() } });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (e) {
    return handleApiError(e);
  }
}
