import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { moderateNewText, restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction, handleConfirmedViolation } from "@/lib/moderation/sanctions";
import { isStaffRole } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Редактирование сообщения автором. Текст повторно проходит ИИ-модерацию. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const user = await userByToken(body.token);
    if (!user) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    const message = await db.message.findUnique({ where: { id } });
    if (!message || message.isDeleted) {
      return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
    }
    const isAuthor = message.authorId === user.id || message.authorName === user.nickname;
    if (!isAuthor && !isStaffRole(user.role)) {
      return NextResponse.json(
        { error: "Редактировать может только автор сообщения" },
        { status: 403 }
      );
    }
    // ШАГ 11: активное ограничение аккаунта — редактирование недоступно.
    if (!isStaffRole(user.role)) {
      const restriction = await getActiveRestriction(user.id);
      if (restriction) {
        return NextResponse.json(
          { error: restrictionBlockMessage(restriction), restricted: true, restriction },
          { status: 403 }
        );
      }
    }
    const text = String(body.body ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "Введите текст сообщения" }, { status: 400 });
    }
    if (text.length > 10000) {
      return NextResponse.json(
        { error: "Сообщение слишком длинное (максимум 10000 символов)" },
        { status: 400 }
      );
    }

    // ШАГ 10: повторная проверка, включая цитаты
    const outcome = await moderateNewText(text);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    await db.message.update({
      where: { id },
      data: {
        body: text,
        editedAt: new Date(),
        aiStatus: outcome.action === "hide" ? "hidden" : outcome.action === "human" ? "human" : "ok",
        aiNote: outcome.aiNote ?? "",
        needHuman: outcome.needHuman,
        isHiddenByAi: outcome.action === "hide",
        hiddenReason: outcome.hiddenReason ?? "",
      },
    });

    // ШАГ 11: мягкая лестница санкций при подтверждённом ИИ нарушении в правке.
    let sanction: Record<string, unknown> | null = null;
    if (outcome.action === "hide") {
      const violation = await handleConfirmedViolation({
        userId: user.id,
        messageId: message.id,
        topicId: message.topicId,
        category: outcome.category ?? "other",
        reason: outcome.hiddenReason ?? "нарушение правил форума",
      });
      sanction = { ...violation.sanction, note: violation.note, needsHumanDecision: violation.needsHumanDecision };
    }

    return NextResponse.json({ ok: true, sanction });
  } catch (e) {
    return handleApiError(e);
  }
}

/** Удаление сообщения автором или администратором. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const user = await userByToken(body.token);
    if (!user) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    const message = await db.message.findUnique({ where: { id } });
    if (!message || message.isDeleted) {
      return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
    }
    const isAuthor = message.authorId === user.id || message.authorName === user.nickname;
    if (!isAuthor && !isStaffRole(user.role)) {
      return NextResponse.json(
        { error: "Удалять может только автор сообщения или администратор" },
        { status: 403 }
      );
    }
    await db.message.update({
      where: { id },
      data: { isDeleted: true, deletedBy: isStaffRole(user.role) ? "moderator" : user.nickname },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
