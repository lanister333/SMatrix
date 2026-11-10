import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { AUTH_KEY } from "@/lib/ui";

export const runtime = "nodejs";

/** Заглавная буква для красивого вывода. */
function capitalize(s: string): string {
  if (!s) return s;
  // Разделяем по дефису и каждое слово с заглавной: «южно-сахалинск» → «Южно-Сахалинск»
  return s.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('-');
}

/**
 * GET /api/houses/[id]/topics?branchId=...
 * — Список тем в доме (или в конкретной ветке).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const branchId = req.nextUrl.searchParams.get("branchId");
    const token = req.nextUrl.searchParams.get("token");

    const house = await db.houseBlock.findUnique({
      where: { id },
      include: { branches: true, moderators: true },
    });
    if (!house) return NextResponse.json({ error: "Дом не найден" }, { status: 404 });

    const user = token ? await userByToken(token) : null;
    const isMod = user ? house.moderators.some((m) => m.userId === user.id) : false;

    const topics = await db.houseTopic.findMany({
      where: { houseId: id, ...(branchId ? { branchId } : {}) },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 50,
    });

    // Считаем сообщения для каждой темы
    const topicsWithCounts = await Promise.all(
      topics.map(async (t) => ({
        id: t.id,
        title: t.title,
        body: t.body,
        authorNick: t.authorNick,
        branchId: t.branchId,
        pinned: t.pinned === 1,
        closed: t.closed === 1,
        createdAt: t.createdAt,
        repliesCount: await db.houseMessage.count({ where: { topicId: t.id } }),
      })),
    );

    // Branch counts
    const branchCounts = await Promise.all(
      house.branches.map(async (b) => ({
        branchId: b.id,
        title: b.title,
        topicsCount: await db.houseTopic.count({ where: { houseId: id, branchId: b.id } }),
      })),
    );

    return NextResponse.json({
      house: {
        id: house.id,
        city: capitalize(house.city),
        street: capitalize(house.street),
        houseNumber: house.houseNumber,
      },
      branches: house.branches.map((b) => ({ id: b.id, title: b.title })),
      branchCounts,
      topics: topicsWithCounts,
      isModerator: isMod,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * POST /api/houses/[id]/topics
 * Body: { token, branchId, title, body }
 * — Создать новую тему в ветке (только авторизованные).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const user = await userByToken(body.token);
    if (!user) {
      return NextResponse.json({ error: "Нужно войти на форум" }, { status: 401 });
    }

    const house = await db.houseBlock.findUnique({ where: { id } });
    if (!house) return NextResponse.json({ error: "Дом не найден" }, { status: 404 });

    const title = String(body.title || "").trim().slice(0, 200);
    const text = String(body.body || "").trim().slice(0, 5000);
    const branchId = String(body.branchId || "");

    if (!title || !branchId) {
      return NextResponse.json({ error: "Укажите ветку и заголовок" }, { status: 400 });
    }

    const branch = await db.houseBranch.findFirst({ where: { id: branchId, houseId: id } });
    if (!branch) return NextResponse.json({ error: "Ветка не найдена" }, { status: 404 });

    const topic = await db.houseTopic.create({
      data: {
        houseId: id,
        branchId,
        title,
        body: text,
        authorId: user.id,
        authorNick: user.nickname,
      },
    });

    return NextResponse.json({ topic });
  } catch (e) {
    return handleApiError(e);
  }
}
