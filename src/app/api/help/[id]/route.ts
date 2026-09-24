/**
 * ШАГ 16 (ТЗ п.6). Изменение публикации «Нужна помощь» — только автором.
 * Действия (action):
 *  — edit        — изменить заголовок/текст/контакты (с повторной ИИ-проверкой);
 *  — resolve     — статус «Вопрос решён»;
 *  — irrelevant  — статус «Неактуально»;
 *  — reopen      — снова сделать публикацию актуальной (status → active);
 *  — delete      — удалить свою публикацию (исчезает из общей ленты).
 * Публикация при смене статуса не удаляется и остаётся доступной для просмотра.
 * Другие пользователи не могут менять чужую публикацию (403).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { moderateNewHelpText } from "@/lib/moderation/help";

export const runtime = "nodejs";
export const maxDuration = 60;

const ACTIONS = new Set(["edit", "resolve", "irrelevant", "reopen", "delete"]);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { token, action } = body;

    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json({ error: "Публикации доступны только зарегистрированным пользователям" }, { status: 401 });
    }
    if (!ACTIONS.has(String(action))) {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }

    const publication = await db.helpPublication.findUnique({ where: { id } });
    if (!publication || publication.isDeleted) {
      return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
    }

    // Менять статус, редактировать и удалять может только автор (ТЗ п.6).
    if (publication.authorId !== user.id) {
      return NextResponse.json(
        { error: "Изменить публикацию может только её автор" },
        { status: 403 }
      );
    }

    if (action === "resolve" || action === "irrelevant") {
      const status = action === "resolve" ? "resolved" : "irrelevant";
      const updated = await db.helpPublication.update({
        where: { id },
        data: { status },
      });
      const label = status === "resolved" ? "Вопрос решён" : "Неактуально";
      return NextResponse.json({ ok: true, status: updated.status, note: `Статус обновлён: ${label}` });
    }

    if (action === "reopen") {
      const updated = await db.helpPublication.update({
        where: { id },
        data: { status: "active" },
      });
      return NextResponse.json({ ok: true, status: updated.status, note: "Публикация снова актуальна" });
    }

    if (action === "delete") {
      await db.helpPublication.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() },
      });
      return NextResponse.json({ ok: true, note: "Публикация удалена" });
    }

    // action === "edit"
    const title = String(body.title ?? "").trim();
    const text = String(body.text ?? body.body ?? "").trim();
    const contactData = String(body.contactData ?? body.contact ?? "").trim().slice(0, 200);

    if (title.length < 5 || title.length > 120) {
      return NextResponse.json(
        { error: "Заголовок должен быть от 5 до 120 символов" },
        { status: 400 }
      );
    }
    if (text.length < 10 || text.length > 4000) {
      return NextResponse.json(
        { error: "Текст публикации должен быть от 10 до 4000 символов" },
        { status: 400 }
      );
    }
    // Контактные данные — необязательное поле (ТЗ).

    // Изменённый текст повторно проходит проверку ИИ-модерации.
    const outcome = await moderateNewHelpText(title, text, contactData);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    const updated = await db.helpPublication.update({
      where: { id },
      data: {
        title,
        text,
        contactData,
        editedAt: new Date(),
        aiStatus: outcome.action === "hide" ? "hidden" : publication.aiStatus,
        aiNote: outcome.aiNote ?? publication.aiNote,
        isHiddenByAi: outcome.action === "hide" ? true : publication.isHiddenByAi,
        hiddenReason: outcome.action === "hide" ? outcome.hiddenReason ?? "" : publication.hiddenReason,
        needHuman: outcome.needHuman || publication.needHuman,
      },
    });

    const note =
      outcome.action === "hide"
        ? `Изменения сохранены, но публикация скрыта ИИ-модерацией: ${outcome.hiddenReason ?? "нарушение правил"}.`
        : "Публикация обновлена";

    return NextResponse.json({ ok: true, hidden: outcome.action === "hide", note, publication: { status: updated.status } });
  } catch (e) {
    return handleApiError(e);
  }
}
