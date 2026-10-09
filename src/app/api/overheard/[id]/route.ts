/**
 * ШАГ 17 (ТЗ п.21). Изменение сообщения «Подслушано Сахалин» — только автором.
 * Действия (action):
 *  — edit   — изменить заголовок/текст/место (с повторной ИИ-проверкой);
 *  — delete — удалить своё сообщение (исчезает из общей ленты; связанная
 *             тема форума не удаляется, состояние кнопки — «Тема в архиве»,
 *             к «Обсудить на форуме» кнопка не возвращается).
 * Другие пользователи не могут менять чужое сообщение (403).
 * Никаких публичных рейтингов автора: карма/рейтинг/лайки/подписчики
 * не создаются и не показываются (ТЗ п.21).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { moderateNewOverheardText } from "@/lib/moderation/overheard";

export const runtime = "nodejs";
export const maxDuration = 60;

const ACTIONS = new Set(["edit", "delete"]);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { token, action } = body;

    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json({ error: "Доступно только зарегистрированным пользователям" }, { status: 401 });
    }
    if (!ACTIONS.has(String(action))) {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }

    const post = await db.overheardPost.findUnique({ where: { id } });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
    }

    // Редактировать и удалять может только автор (ТЗ п.21).
    if (post.authorId !== user.id) {
      return NextResponse.json(
        { error: "Изменить сообщение может только его автор" },
        { status: 403 }
      );
    }

    if (action === "delete") {
      await db.overheardPost.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() },
      });
      return NextResponse.json({ ok: true, note: "Сообщение удалено" });
    }

    // action === "edit"
    const title = String(body.title ?? "").trim();
    const text = String(body.text ?? body.body ?? "").trim();
    const place = String(body.place ?? "").trim().slice(0, 80);

    if (title.length < 5 || title.length > 150) {
      return NextResponse.json({ error: "Заголовок должен быть от 5 до 150 символов" }, { status: 400 });
    }
    if (text.length < 10 || text.length > 8000) {
      return NextResponse.json({ error: "Текст сообщения: от 10 до 8000 символов" }, { status: 400 });
    }

    const outcome = await moderateNewOverheardText(title, text, place);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    await db.overheardPost.update({
      where: { id },
      data: {
        title,
        text,
        place,
        editedAt: new Date(),
        aiStatus: outcome.action === "hide" ? "hidden" : outcome.action === "human" ? "human" : "ok",
        aiNote: outcome.aiNote ?? "",
        isHiddenByAi: outcome.action === "hide",
        hiddenReason: outcome.hiddenReason ?? "",
        needHuman: outcome.needHuman,
      },
    });

    const note =
      outcome.action === "hide"
        ? `Сообщение скрыто модерацией после правки: ${outcome.hiddenReason ?? "нарушение правил"}.`
        : outcome.needHuman
          ? "Правка отправлена на дополнительную проверку человеку-модератору."
          : "Сообщение обновлено";

    return NextResponse.json({ ok: true, hidden: outcome.action === "hide", note });
  } catch (e) {
    return handleApiError(e);
  }
}
