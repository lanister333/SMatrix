import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

/**
 * GET /api/houses/[id]
 * — Возвращает дом с ветками и модераторами.
 * — Обновляет lastActionAt текущего модератора (если он модератор этого дома).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const token = req.nextUrl.searchParams.get("token");
    const user = token ? await userByToken(token) : null;

    const house = await db.houseBlock.findUnique({
      where: { id },
      include: {
        houseBranches: true,
        houseModerators: true,
      },
    });

    if (!house) {
      return NextResponse.json({ error: "Дом не найден" }, { status: 404 });
    }

    // Обновляем lastActionAt текущего модератора
    if (user) {
      const myMod = house.houseModerators.find((m) => m.userId === user.id);
      if (myMod) {
        await db.houseModerator.update({
          where: { userId_houseId: { userId: user.id, houseId: id } },
          data: { lastActionAt: Math.floor(Date.now() / 1000) },
        });
      }
    }

    return NextResponse.json({
      house: {
        id: house.id,
        city: house.city,
        street: house.street,
        houseNumber: house.houseNumber,
        createdAt: house.createdAt,
      },
      branches: house.houseBranches.map((b) => ({ id: b.id, title: b.title })),
      isModerator: user
        ? house.houseModerators.some((m) => m.userId === user.id)
        : false,
      isCreator: user
        ? house.houseModerators.some(
            (m) => m.userId === user.id && m.isCreator === 1,
          )
        : false,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
