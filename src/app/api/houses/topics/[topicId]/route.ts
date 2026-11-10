import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

/**
 * GET /api/houses/topics/[topicId]?token=...
 * — Тема + все сообщения.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ topicId: string }> },
) {
  try {
    const { topicId } = await params;
    const token = req.nextUrl.searchParams.get("token");

    const topic = await db.houseTopic.findUnique({ where: { id: topicId } });
    if (!topic) return NextResponse.json({ error: "Тема не найдена" }, { status: 404 });

    const messages = await db.houseMessage.findMany({
      where: { topicId },
      orderBy: { createdAt: "asc" },
    });

    const user = token ? await userByToken(token) : null;
    const mods = await db.houseModerator.findMany({ where: { houseId: topic.houseId } });
    const isMod = user ? mods.some((m) => m.userId === user.id) : false;

    return NextResponse.json({
      topic: {
        id: topic.id,
        title: topic.title,
        body: topic.body,
        authorNick: topic.authorNick,
        pinned: topic.pinned === 1,
        closed: topic.closed === 1,
        createdAt: topic.createdAt,
        houseId: topic.houseId,
        branchId: topic.branchId,
      },
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        authorNick: m.authorNick,
        createdAt: m.createdAt,
      })),
      isModerator: isMod,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * POST /api/houses/topics/[topicId]
 * Body: { token, body } — добавить сообщение.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ topicId: string }> },
) {
  try {
    const { topicId } = await params;
    const body = await req.json();
    const user = await userByToken(body.token);
    if (!user) return NextResponse.json({ error: "Нужно войти" }, { status: 401 });

    const topic = await db.houseTopic.findUnique({ where: { id: topicId } });
    if (!topic) return NextResponse.json({ error: "Тема не найдена" }, { status: 404 });
    if (topic.closed === 1) return NextResponse.json({ error: "Тема закрыта" }, { status: 403 });

    const text = String(body.body || "").trim().slice(0, 5000);
    if (!text) return NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });

    const msg = await db.houseMessage.create({
      data: {
        topicId,
        houseId: topic.houseId,
        authorId: user.id,
        authorNick: user.nickname,
        body: text,
      },
    });

    return NextResponse.json({ message: msg });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * PATCH /api/houses/topics/[topicId]
 * Body: { token, action: "pin" | "unpin" | "close" | "open" }
 * — Модераторские действия.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ topicId: string }> },
) {
  try {
    const { topicId } = await params;
    const body = await req.json();
    const user = await userByToken(body.token);
    if (!user) return NextResponse.json({ error: "Нужно войти" }, { status: 401 });

    const topic = await db.houseTopic.findUnique({ where: { id: topicId } });
    if (!topic) return NextResponse.json({ error: "Тема не найдена" }, { status: 404 });

    const mod = await db.houseModerator.findUnique({
      where: { userId_houseId: { userId: user.id, houseId: topic.houseId } },
    });
    if (!mod) return NextResponse.json({ error: "Нет прав модератора" }, { status: 403 });

    const action = String(body.action || "");
    const data: Record<string, number> = {};
    if (action === "pin") data.pinned = 1;
    else if (action === "unpin") data.pinned = 0;
    else if (action === "close") data.closed = 1;
    else if (action === "open") data.closed = 0;
    else return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });

    await db.houseTopic.update({ where: { id: topicId }, data });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * DELETE /api/houses/topics/[topicId]?token=...
 * — Удалить тему (модератор).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ topicId: string }> },
) {
  try {
    const { topicId } = await params;
    const token = req.nextUrl.searchParams.get("token");
    const user = token ? await userByToken(token) : null;
    if (!user) return NextResponse.json({ error: "Нужно войти" }, { status: 401 });

    const topic = await db.houseTopic.findUnique({ where: { id: topicId } });
    if (!topic) return NextResponse.json({ error: "Тема не найдена" }, { status: 404 });

    const mod = await db.houseModerator.findUnique({
      where: { userId_houseId: { userId: user.id, houseId: topic.houseId } },
    });
    if (!mod || mod.canDelete !== 1) {
      return NextResponse.json({ error: "Нет прав на удаление" }, { status: 403 });
    }

    await db.houseMessage.deleteMany({ where: { topicId } });
    await db.houseTopic.delete({ where: { id: topicId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
