import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

/** PATCH /api/users/[nick]/update — редактирование профиля.
 *  Требует токен. Только владелец может редактировать свой профиль.
 *  Поля: city, phone, bio, gender, newsletterSubscribed, notificationsSubscribed.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ nick: string }> }) {
  try {
    const { nick } = await ctx.params;
    const nickname = decodeURIComponent(nick);
    const body = await req.json();
    const token = String(body.token ?? "");
    const user = token ? await userByToken(token) : null;
    if (!user || user.nickname !== nickname) {
      return NextResponse.json({ error: "Можно редактировать только свой профиль", needAuth: true }, { status: 401 });
    }

    const city = String(body.city ?? "").trim().slice(0, 100);
    const phone = String(body.phone ?? "").trim().slice(0, 30);
    const bio = String(body.bio ?? "").trim().slice(0, 500);
    const gender = ["male", "female", "unspecified"].includes(body.gender) ? body.gender : "unspecified";
    const newsletterSubscribed = !!body.newsletterSubscribed;
    const notificationsSubscribed = !!body.notificationsSubscribed;

    await db.user.update({
      where: { id: user.id },
      data: { city, phone, bio, gender, newsletterSubscribed, notificationsSubscribed },
    });

    return NextResponse.json({ ok: true, note: "Профиль обновлён" });
  } catch (e) {
    return handleApiError(e);
  }
}
