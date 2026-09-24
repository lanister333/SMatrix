import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { revokeSanction } from "@/lib/moderation/sanctions";
import { isStaffRole, logAdminAction } from "@/lib/admin";

export const runtime = "nodejs";

/** Решение модератора по сообщению: publish | hide | delete. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await userByToken(body.token);
    if (!user) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    if (!isStaffRole(user.role)) {
      return NextResponse.json({ error: "Доступно только администратору" }, { status: 403 });
    }
    const id = String(body.id ?? "");
    const decision = String(body.decision ?? "");
    const message = await db.message.findUnique({ where: { id } });
    if (!message) {
      return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
    }

    if (decision === "publish") {
      await db.message.update({
        where: { id },
        data: {
          isHiddenByAi: false,
          hiddenReason: "",
          needHuman: false,
          isDeleted: false,
          aiStatus: "ok",
          aiNote: (message.aiNote ? `${message.aiNote} · ` : "") + "решение администратора: опубликовано",
        },
      });
      // ШАГ 11: человек отменяет решение ИИ — связанные с этим сообщением
      // автоматические санкции ИИ отменяются, ограничение снимается.
      const aiSanctions = await db.sanction.findMany({
        where: { messageId: id, source: "ai", revoked: false },
      });
      for (const s of aiSanctions) {
        await revokeSanction(s.id, user.nickname, "решение ИИ отменено человеком-модератором");
      }
      // Открытые апелляции по этому сообщению удовлетворены решением человека.
      await db.decisionAppeal.updateMany({
        where: { messageId: id, status: "open" },
        data: {
          status: "accepted",
          resolvedBy: user.nickname,
          note: "Сообщение опубликовано человеком-модератором",
          resolvedAt: new Date(),
        },
      });
    } else if (decision === "hide") {
      await db.message.update({
        where: { id },
        data: {
          isHiddenByAi: true,
          hiddenReason: "решение администратора",
          needHuman: false,
          aiStatus: "hidden",
        },
      });
    } else if (decision === "delete") {
      await db.message.update({
        where: { id },
        data: { isDeleted: true, deletedBy: "moderator", needHuman: false },
      });
    } else {
      return NextResponse.json({ error: "Неизвестное решение" }, { status: 400 });
    }

    // Все жалобы на это сообщение считаются рассмотренными.
    await db.complaint.updateMany({ where: { messageId: id, resolved: false }, data: { resolved: true } });

    // ШАГ 12: запись во внутренний журнал действий.
    await logAdminAction({
      actor: user.nickname,
      actorRole: user.role,
      action: `message.${decision}`,
      targetType: "message",
      targetLabel: `сообщение №${message.num} автора «${message.authorName}»`,
      details: `тема: «${(await db.topic.findUnique({ where: { id: message.topicId }, select: { title: true } }))?.title ?? message.topicId}»`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
