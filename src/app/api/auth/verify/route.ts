import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeAuthToken, createSession, toSafeUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token") ?? "";
    const payload = await consumeAuthToken(token, "verify");
    if (!payload) {
      return NextResponse.json(
        { error: "Ссылка подтверждения недействительна или устарела." },
        { status: 400 }
      );
    }
    await db.user.update({ where: { id: payload.userId }, data: { emailVerified: true } });
    const user = await db.user.findUnique({ where: { id: payload.userId } });
    const sessionToken = await createSession(payload.userId);
    return NextResponse.json({ user: { ...toSafeUser(user!), token: sessionToken } });
  } catch (e) {
    return handleApiError(e);
  }
}
