import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

/**
 * ШАГ 11. Апелляция на решение модерации: «Оспорить решение».
 *
 * Ключевые принципы ТЗ:
 *  — апелляцию рассматривает ЧЕЛОВЕК-модератор;
 *  — ИИ не рассматривает собственные спорные решения и к апелляциям
 *    не привлекается вовсе;
 *  — человек может отменить решение ИИ.
 *
 * Цель апелляции: скрытое сообщение (messageId) или санкция (sanctionId).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await userByToken(body.token);
    if (!user) {
      return NextResponse.json({ error: "Чтобы оспорить решение, войдите на форум" }, { status: 401 });
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

    // Ответ — сразу; ИИ к рассмотрению апелляции не привлекается.
    return NextResponse.json({
      ok: true,
      note: "Апелляция отправлена. Её рассмотрит человек-модератор. ИИ не участвует в пересмотре решения.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
