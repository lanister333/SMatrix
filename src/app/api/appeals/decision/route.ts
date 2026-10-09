import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import { getClientIp } from "@/lib/security";
import { notifyAdmin } from "@/lib/notifications";

export const runtime = "nodejs";

/**
 * ШАГ 11. Апелляция на решение модерации: «Оспорить решение».
 *
 * Ключевые принципы ТЗ:
 *  — апелляцию рассматривает ЧЕЛОВЕК-модератор;
 *  — автоматические решения пересматривает человек;
 *  — человек может отменить автоматическое решение.
 *
 * Цель апелляции: скрытое сообщение (messageId) или санкция (sanctionId).
 *
 * S-3 (аудит 2026-10-04): rate-limit на апелляции — 5/час на пользователя
 * + 10/час на IP (для не-авторизованных), препятствует спаму.
 */
export async function POST(req: NextRequest) {
  try {
    // S-3: rate-limit до auth — чтобы не тратить DB-запросы на спам.
    const ip = getClientIp(req);
    if (!rateLimit(`appeals-decision-ip:${ip}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Слишком много апелляций с вашего адреса. Попробуйте позже." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const user = await userByToken(body.token);
    if (!user) {
      return NextResponse.json({ error: "Чтобы оспорить решение, войдите на форум" }, { status: 401 });
    }
    // S-3: лимит на пользователя — 5/час (3 — для fresh-аккаунтов).
    if (!rateLimit(`appeals-decision-user:${user.id}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Слишком много апелляций за час. Попробуйте позже." },
        { status: 429 }
      );
    }

    const text = String(body.text ?? "").trim();
    if (text.length < 10) {
      return NextResponse.json(
        { error: "Опишите, почему вы считаете решение ошибочным — минимум 10 символов" },
        { status: 400 }
      );
    }

    const messageId = body.messageId ? String(body.messageId) : null;
    const sanctionId = body.sanctionId ? String(body.sanctionId) : null;
    if (!messageId && !sanctionId) {
      return NextResponse.json({ error: "Не указано решение для оспаривания" }, { status: 400 });
    }

    // Право на апелляцию — только у автора решения.
    if (messageId) {
      const message = await db.message.findUnique({ where: { id: messageId } });
      if (!message) {
        return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
      }
      const isAuthor = message.authorId === user.id || message.authorName === user.nickname;
      if (!isAuthor) {
        return NextResponse.json({ error: "Оспорить можно только своё сообщение" }, { status: 403 });
      }
      const existing = await db.decisionAppeal.findFirst({
        where: { messageId, status: "open" },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Апелляция по этому решению уже отправлена и ждёт рассмотрения человеком-модератором" },
          { status: 409 }
        );
      }
    }

    if (sanctionId) {
      const sanction = await db.sanction.findUnique({ where: { id: sanctionId } });
      if (!sanction) {
        return NextResponse.json({ error: "Санкция не найдена" }, { status: 404 });
      }
      if (sanction.userId !== user.id) {
        return NextResponse.json({ error: "Оспорить можно только своё ограничение" }, { status: 403 });
      }
      const existing = await db.decisionAppeal.findFirst({
        where: { sanctionId, status: "open" },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Апелляция по этому решению уже отправлена и ждёт рассмотрения человеком-модератором" },
          { status: 409 }
        );
      }
    }

    await db.decisionAppeal.create({
      data: {
        userId: user.id,
        userNick: user.nickname,
        messageId,
        sanctionId,
        text: text.slice(0, 5000),
      },
    });

    // Уведомление администратора о новой апелляции.
    notifyAdmin({
      type: "appeal",
      section: "forum",
      title: `Апелляция от пользователя «${user.nickname}»`,
      details: `Текст: ${text.slice(0, 150)}${text.length > 150 ? "…" : ""}. Цель: ${messageId ? `сообщение ${messageId}` : `санкция ${sanctionId}`}.`,
      adminUrl: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/kabinet?section=ai`,
    }).catch(() => {});

    // Ответ — сразу; автоматические решения пересматривает человек-модератор.
    return NextResponse.json({
      ok: true,
      note: "Апелляция отправлена. Её рассмотрит человек-модератор. ИИ не участвует в пересмотре решения.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
