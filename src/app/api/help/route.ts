/**
 * ШАГ 16 (ТЗ п.10). «Нужна помощь» — самостоятельная доска бесплатной взаимопомощи.
 * Сущность HelpPublication — НЕ ForumTopic/ForumPost, никакой связи с форумом.
 * GET  — публичная лента (активные → решённые → неактуальные, внутри группы новые выше);
 *        ?mine=1&token=… — «Мои публикации» автора (включая скрытые ИИ, без удалённых).
 * POST — создание публикации (только зарегистрированные, анонимные запрещены;
 *        проверка лексики + ИИ-модерация раздела). Тему форума не создаёт.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import { restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction, handleConfirmedViolation } from "@/lib/moderation/sanctions";
import { moderateNewHelpText } from "@/lib/moderation/help";
import { safeAuthorGender } from "@/lib/nick-gender";

export const runtime = "nodejs";
export const maxDuration = 60;

const STATUS_ORDER: Record<string, number> = { active: 0, resolved: 1, irrelevant: 2 };

/** Публичный вид публикации. */
function publicShape(r: {
  id: string;
  title: string;
  text: string;
  contactData: string;
  status: string;
  authorId: string;
  authorName: string;
  editedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: r.id,
    title: r.title,
    text: r.text,
    contactData: r.contactData,
    status: r.status,
    authorId: r.authorId,
    authorName: r.authorName,
    authorGender: safeAuthorGender(r.authorName, r.author as { nickname: string; gender: string | null } | null),
    editedAt: r.editedAt,
    createdAt: r.createdAt,
  };
}

/** Сортировка: active → resolved → irrelevant, внутри группы новые выше. */
function sortByStatusThenNew<T extends { status: string; createdAt: Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pa = STATUS_ORDER[a.status] ?? 3;
    const pb = STATUS_ORDER[b.status] ?? 3;
    if (pa !== pb) return pa - pb;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const mine = sp.get("mine") === "1";
    const token = sp.get("token");

    if (mine) {
      const user = await userByToken(token);
      if (!user) {
        return NextResponse.json({ error: "Войдите в аккаунт, чтобы увидеть свои публикации." }, { status: 401 });
      }
      const rows = await db.helpPublication.findMany({
        where: { authorId: user.id, isDeleted: false },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { author: { select: { nickname: true, gender: true } } },
      });
      // В «Моих публикациях» автор видит и скрытые ИИ — с объяснением причины.
      return NextResponse.json({
        requests: sortByStatusThenNew(rows).map((r) => ({
          ...publicShape(r),
          isHiddenByAi: r.isHiddenByAi,
          hiddenReason: r.hiddenReason,
          needHuman: r.needHuman,
        })),
      });
    }

    const rows = await db.helpPublication.findMany({
      where: { isDeleted: false, isHiddenByAi: false },
      orderBy: { createdAt: "desc" },
      take: 300,
        include: { author: { select: { nickname: true, gender: true } } },
    });
    return NextResponse.json({ requests: sortByStatusThenNew(rows).map(publicShape) });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;
    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json(
        { error: "Чтобы опубликовать — войдите в аккаунт." },
        { status: 401 }
      );
    }

    // Общий механизм сайта: активное ограничение аккаунта блокирует публикацию.
    const restriction = await getActiveRestriction(user.id);
    if (restriction) {
      return NextResponse.json(
        { error: restrictionBlockMessage(restriction), restricted: true, restriction },
        { status: 403 }
      );
    }

    if (!rateLimit(`help:${user.id}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Слишком много публикаций за час. Попробуйте позже." },
        { status: 429 }
      );
    }

    const title = String(body.title ?? "").trim();
    const text = String(body.text ?? body.body ?? "").trim();
    const contactData = String(body.contactData ?? body.contact ?? "").trim().slice(0, 200);

    if (title.length < 5 || title.length > 120) {
      return NextResponse.json(
        { error: "Заголовок должен быть от 5 до 120 символов — кратко опишите, какая помощь нужна" },
        { status: 400 }
      );
    }
    if (text.length < 10 || text.length > 4000) {
      return NextResponse.json(
        { error: "Опишите ситуацию подробнее: от 10 до 4000 символов" },
        { status: 400 }
      );
    }
    // Контактные данные — необязательное поле (ТЗ), можно указать и в тексте.

    // Проверка текста: лексика + ИИ-модерация раздела «Нужна помощь».
    const outcome = await moderateNewHelpText(title, text, contactData);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    const created = await db.helpPublication.create({
      data: {
        title,
        text,
        contactData,
        authorId: user.id,
        authorName: user.nickname,
        aiStatus: outcome.action === "hide" ? "hidden" : outcome.action === "human" ? "human" : "ok",
        aiNote: outcome.aiNote ?? "",
        isHiddenByAi: outcome.action === "hide",
        hiddenReason: outcome.hiddenReason ?? "",
        needHuman: outcome.needHuman,
      },
    });

    // Очевидное нарушение скрыто — мягкая лестница санкций (общий механизм сайта).
    let sanction: Record<string, unknown> | null = null;
    if (outcome.action === "hide" && outcome.source === "ai") {
      const violation = await handleConfirmedViolation({
        userId: user.id,
        category: outcome.category ?? "other",
        reason: outcome.hiddenReason ?? "нарушение правил раздела «Нужна помощь»",
      });
      sanction = { ...violation.sanction, note: violation.note, needsHumanDecision: violation.needsHumanDecision };
    }

    const note =
      outcome.action === "hide"
        ? `Публикация скрыта модерацией: ${outcome.hiddenReason ?? "нарушение правил"}. Её проверит человек-модератор.`
        : outcome.needHuman
          ? "Публикация отправлена на дополнительную проверку человеку-модератору."
          : "Публикация опубликована. Спасибо!";

    return NextResponse.json({ ok: true, id: created.id, hidden: outcome.action === "hide", note, sanction });
  } catch (e) {
    return handleApiError(e);
  }
}
