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
    if (user.emailVerified) {
      return NextResponse.json({ error: "Email уже подтверждён — можно входить" }, { status: 400 });
    }
    const token = await createAuthToken(user.id, "verify");
    return NextResponse.json({
      ok: true,
      verifyPath: `/api/auth/verify?token=${encodeURIComponent(token)}`,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
