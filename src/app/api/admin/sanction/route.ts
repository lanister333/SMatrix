import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { applySanction, revokeSanction, SANCTION_KINDS, SANCTION_LABELS, type SanctionKind } from "@/lib/moderation/sanctions";
import { isOwnerRole, isStaffRole, logAdminAction, ROLE_LABELS } from "@/lib/admin";

export const runtime = "nodejs";

/**
 * ШАГ 11/12. Действия человека-модератора с санкциями и апелляциями.
 * Модератор и владелец могут: apply / revoke / resolveAppeal / unblock.
 * Каждое действие записывается во внутренний журнал (ШАГ 12).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const admin = await userByToken(body.token);
    if (!admin) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    if (!isStaffRole(admin.role)) {
      return NextResponse.json({ error: "Доступно только администратору" }, { status: 403 });
    }

    const action = String(body.action ?? "");

    // ШАГ 12: права ограничены. Санкции (apply/unblock/revoke) — только
    // Главный администратор / Владелец. Апелляции рассматривает любой
    // человек-модератор (moderator) — ИИ не пересматривает решения.
    if (action === "apply" || action === "unblock" || action === "revoke") {
      if (!isOwnerRole(admin.role)) {
        return NextResponse.json(
          { error: "Санкции применяет и отменяет только Главный администратор (Владелец)" },
          { status: 403 }
        );
      }
    }

    if (action === "apply") {
      const kind = String(body.kind ?? "") as SanctionKind;
      if (!SANCTION_KINDS.includes(kind)) {
        return NextResponse.json({ error: "Неизвестный вид санкции" }, { status: 400 });
      }
      const reason = String(body.reason ?? "").trim();
      if (reason.length < 5) {
        return NextResponse.json({ error: "Укажите причину санкции (минимум 5 символов)" }, { status: 400 });
      }
      const targetNick = String(body.nick ?? "").trim();
      const target = targetNick
        ? await db.user.findUnique({ where: { nickname: targetNick } })
        : await db.user.findUnique({ where: { id: String(body.userId ?? "") } });
      if (!target) {
        return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
      }
      if (target.role === "owner" || target.role === "admin") {
        return NextResponse.json({ error: "Нельзя применять санкции к администратору" }, { status: 400 });
      }
      const sanction = await applySanction({
        userId: target.id,
        kind,
        reason,
        source: "human",
        createdBy: admin.nickname,
      });
      await logAdminAction({
        actor: admin.nickname,
        actorRole: admin.role,
        action: "sanction.apply",
        targetType: "user",
        targetLabel: `${target.nickname} (${ROLE_LABELS[target.role] ?? target.role})`,
        details: `${SANCTION_LABELS[kind]}: ${reason}`,
      });
      return NextResponse.json({
        ok: true,
        note: `Санкция применена: ${SANCTION_LABELS[kind]} для ${target.nickname}`,
        sanction,
      });
    }

    if (action === "unblock") {
      // ШАГ 12: снять ограничение/блокировку аккаунта (человек отменяет все активные санкции).
      const targetNick = String(body.nick ?? "").trim();
      const target = targetNick
        ? await db.user.findUnique({ where: { nickname: targetNick } })
        : await db.user.findUnique({ where: { id: String(body.userId ?? "") } });
      if (!target) {
        return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
      }
      const active = await db.sanction.findMany({
        where: { userId: target.id, revoked: false, kind: { not: "warning" } },
      });
      for (const s of active) {
        await revokeSanction(s.id, admin.nickname, String(body.reason ?? "").trim() || "снято человеком-модератором (разблокировка)");
      }
      await db.user.update({
        where: { id: target.id },
        data: { restrictedUntil: null },
      }).catch(() => {});
      await logAdminAction({
        actor: admin.nickname,
        actorRole: admin.role,
        action: "sanction.unblock",
        targetType: "user",
        targetLabel: target.nickname,
        details: `снято санкций: ${active.length}`,
      });
      return NextResponse.json({
        ok: true,
        note: `Ограничения с ${target.nickname} сняты человеком-модератором`,
        revoked: active.length,
      });
    }

    if (action === "revoke") {
      const sanctionId = String(body.sanctionId ?? "");
      const sanction = await db.sanction.findUnique({ where: { id: sanctionId } });
      if (!sanction) {
        return NextResponse.json({ error: "Санкция не найдена" }, { status: 404 });
      }
      const reason = String(body.reason ?? "").trim() || "отменено человеком-модератором";
      await revokeSanction(sanctionId, admin.nickname, reason);
      const sUser = await db.user.findUnique({ where: { id: sanction.userId }, select: { nickname: true } });
      await logAdminAction({
        actor: admin.nickname,
        actorRole: admin.role,
        action: "sanction.revoke",
        targetType: "sanction",
        targetLabel: `${SANCTION_LABELS[sanction.kind as SanctionKind] ?? sanction.kind} → ${sUser?.nickname ?? sanction.userId}`,
        details: reason,
      });
      return NextResponse.json({ ok: true, note: "Санкция отменена человеком-модератором" });
    }

    if (action === "resolveAppeal") {
      const appealId = String(body.appealId ?? "");
      const decision = String(body.decision ?? "");
      if (!["accepted", "rejected"].includes(decision)) {
        return NextResponse.json({ error: "Неизвестное решение по апелляции" }, { status: 400 });
      }
      const appeal = await db.decisionAppeal.findUnique({ where: { id: appealId } });
      if (!appeal) {
        return NextResponse.json({ error: "Апелляция не найдена" }, { status: 404 });
      }
      if (appeal.status !== "open") {
        return NextResponse.json({ error: "Апелляция уже рассмотрена" }, { status: 409 });
      }
      const note = String(body.note ?? "").trim().slice(0, 500);

      if (decision === "accepted") {
        // Человек отменяет решение: снимаем санкцию и/или публикуем сообщение.
        if (appeal.sanctionId) {
          await revokeSanction(appeal.sanctionId, admin.nickname, "апелляция удовлетворена человеком-модератором");
        }
        if (appeal.messageId) {
          await db.message.update({
            where: { id: appeal.messageId },
            data: {
              isHiddenByAi: false,
              hiddenReason: "",
              needHuman: false,
              isDeleted: false,
              aiStatus: "ok",
              aiNote: "решение ИИ отменено человеком по апелляции",
            },
          }).catch(() => {});
          const linkedSanctions = await db.sanction.findMany({
            where: { messageId: appeal.messageId, source: "ai", revoked: false },
          });
          for (const s of linkedSanctions) {
            await revokeSanction(s.id, admin.nickname, "решение ИИ отменено человеком по апелляции");
          }
        }
      }

      await db.decisionAppeal.update({
        where: { id: appealId },
        data: {
          status: decision,
          resolvedBy: admin.nickname,
          note:
            note ||
            (decision === "accepted"
              ? "Решение отменено человеком-модератором"
              : "Человек-модератор подтвердил правильность решения"),
          resolvedAt: new Date(),
        },
      });

      await logAdminAction({
        actor: admin.nickname,
        actorRole: admin.role,
        action: decision === "accepted" ? "appeal.accept" : "appeal.reject",
        targetType: "appeal",
        targetLabel: `апелляция ${appeal.userNick || appeal.userId || ""}`.trim(),
        details: note || (decision === "accepted" ? "решение отменено" : "решение подтверждено"),
      });

      return NextResponse.json({
        ok: true,
        note: decision === "accepted" ? "Апелляция удовлетворена — решение отменено" : "Апелляция отклонена",
      });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (e) {
    return handleApiError(e);
  }
}
