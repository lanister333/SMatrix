import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken, toSafeUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const user = await userByToken(req.nextUrl.searchParams.get("token"));
    if (!user) return NextResponse.json({ error: "Сессия не найдена" }, { status: 401 });
    return NextResponse.json({ user });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (token) {
      await db.session.deleteMany({ where: { token } });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
