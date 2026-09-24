import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAuthToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const user = await db.user
      .findUnique({ where: { email: String(email ?? "").trim().toLowerCase() } })
      .catch(() => null);
    if (!user) {
      return NextResponse.json({ error: "Пользователь с таким email не найден" }, { status: 404 });
    }
    const token = await createAuthToken(user.id, "reset");
    // Демо-режим без почтового шлюза: ссылка возвращается напрямую (кроме сотрудников).
    return NextResponse.json({
      ok: true,
      resetPath:
        user.role === "owner" || user.role === "admin" || user.role === "moderator"
          ? "ok"
          : `/?reset=${encodeURIComponent(token)}`,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
