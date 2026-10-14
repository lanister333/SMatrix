// src/app/api/theatre-bots/list/route.ts
// GET /api/theatre-bots/list?token=...
// Возвращает список всех ботов «Театра ботов» (45 шт.) с их характеристиками.
// Используется песочницей для selector'а (т.к. Z.ai работает только с песочницы).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { isStaffRole } from "@/lib/admin";

export const runtime = "nodejs";

const THEATRE_BOTS_TOKEN = process.env.THEATRE_BOTS_TOKEN || process.env.SAKHMATRIX_API_TOKEN || "sakhmatrix-theatre-2026";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const headerToken = auth.replace(/^Bearer\s+/i, "").trim();
  const qToken = req.nextUrl.searchParams.get("token");
  const token = headerToken || qToken;
  
  // 2026-10-14: принимаем 2 типа токенов — shared secret или session token staff-пользователя.
  // 1. Проверяем shared secret (для scheduler/rewriter)
  if (token === THEATRE_BOTS_TOKEN) {
    // OK — proceed to bots list
  } else {
    // 2. Проверяем session token (админ/модератор)
    const user = await userByToken(token);
    if (!user || !isStaffRole(user.role)) {
      return NextResponse.json({ error: "Неверный токен" }, { status: 401 });
    }
  }

  const users = await db.user.findMany({
    where: { email: { contains: "@theatre.local" } },
    select: { id: true, nickname: true, gender: true, bio: true },
  });

  const bots = [];
  for (const u of users) {
    if (!u.bio) continue;
    try {
      const meta = JSON.parse(u.bio);
      if (meta.role !== "theatre_bot") continue;
      bots.push({
        id: u.id,
        nickname: u.nickname,
        gender: u.gender,
        group: meta.group,
        topics: Array.isArray(meta.topics) ? meta.topics : [],
        activityWeight: typeof meta.activity_weight === "number" ? meta.activity_weight : 1,
        isLowercase: !!meta.is_lowercase,
      });
    } catch {}
  }

  return NextResponse.json({ bots, total: bots.length });
}
