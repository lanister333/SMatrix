import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isStaffRole } from "@/lib/admin";

export const runtime = "nodejs";

/**
 * ШАГ 12. Пользователи: поиск по нику и email.
 * Возвращает профильные данные: дата регистрации, темы/сообщения,
 * текущие ограничения. SQLite не чувствителен к регистру только для
 * ASCII, поэтому поиск по подстроке выполняется в коде (объём мал).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await userByToken(req.nextUrl.searchParams.get("token"));
    if (!user) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    if (!isStaffRole(user.role)) {
      return NextResponse.json({ error: "Доступно только администратору" }, { status: 403 });
    }

    const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();

    const rows = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        nickname: true,
        email: true,
        role: true,
        gender: true,
        emailVerified: true,
        restrictedUntil: true,
        createdAt: true,
        _count: { select: { topics: true, messages: true, sanctions: true } },
      },
    });

    const filtered = q
      ? rows.filter((u) => u.nickname.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      : rows;

    const now = new Date();
    const list = filtered.slice(0, 100).map((u) => ({
      id: u.id,
      nickname: u.nickname,
      email: u.email,
      role: u.role,
      gender: u.gender,
      emailVerified: u.emailVerified,
      restrictedNow: !!(u.restrictedUntil && u.restrictedUntil.getTime() > now.getTime()),
      restrictedUntil: u.restrictedUntil,
      createdAt: u.createdAt,
      topicsCount: u._count.topics,
      messagesCount: u._count.messages,
      sanctionsCount: u._count.sanctions,
    }));

    return NextResponse.json({ total: filtered.length, users: list });
  } catch (e) {
    return handleApiError(e);
  }
}
