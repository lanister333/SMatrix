import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

/**
 * GET /api/houses/[id]/chat
 * — Прямой чат (лента сообщений ветки «Свободный чат жителей»).
 * — Использует HouseMessage с houseId + пустым topicId («»).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const token = req.nextUrl.searchParams.get("token");

    const house = await db.houseBlock.findUnique({ where: { id } });
    if (!house) return NextResponse.json({ error: "Дом не найден" }, { status: 404 });

    // Сообщения прямого чата: houseId matches, topicId = "" (нет темы)
    const messages = await db.houseMessage.findMany({
      where: { houseId: id, topicId: "" },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    const user = token ? await userByToken(token) : null;
    const mods = await db.houseModerator.findMany({ where: { houseId: id } });
    const isMod = user ? mods.some((m) => m.userId === user.id) : false;

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        authorNick: m.authorNick,
        authorId: m.authorId,
        createdAt: m.createdAt,
      })),
      isModerator: isMod,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * POST /api/houses/[id]/chat
 * Body: { token, body }
 * — Отправить сообщение в прямой чат (без темы).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const user = await userByToken(body.token);
    if (!user) return NextResponse.json({ error: "Нужно войти на форум" }, { status: 401 });

    const house = await db.houseBlock.findUnique({ where: { id } });
    if (!house) return NextResponse.json({ error: "Дом не найден" }, { status: 404 });

    const text = String(body.body || "").trim().slice(0, 5000);
    if (!text) return NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });

    const msg = await db.houseMessage.create({
      data: {
        topicId: "",  // пустой topicId = прямой чат, без темы
        houseId: id,
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
 * DELETE /api/houses/[id]/chat?msgId=...&token=...
 * — Удалить сообщение (модератор).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const msgId = req.nextUrl.searchParams.get("msgId");
    const token = req.nextUrl.searchParams.get("token");
    const user = token ? await userByToken(token) : null;
    if (!user) return NextResponse.json({ error: "Нужно войти" }, { status: 401 });

    const mod = await db.houseModerator.findUnique({
      where: { userId_houseId: { userId: user.id, houseId: id } },
    });
    if (!mod || mod.canDelete !== 1) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }

    await db.houseMessage.deleteMany({ where: { id: msgId, houseId: id, topicId: "" } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
