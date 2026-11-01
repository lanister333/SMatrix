import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError, rateLimit } from "@/lib/api";
import { getClientIp } from "@/lib/security";
import { notifyAdmin } from "@/lib/notifications";
import { userByToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // S-3 (аудит 2026-10-04): rate-limit на feedback-форму.
    // 2026-11-01: добавлена проверка token (необязательная — гости могут,
    // но если token есть — лимит по user.id, а не IP).
    const body = await req.json();
    const token = String(body.token ?? "");
    const user = token ? await userByToken(token) : null;
    const ip = getClientIp(req);
    const limitKey = user ? `appeals:${user.id}` : `appeals:${ip}`;
    if (!rateLimit(limitKey, 5, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Слишком много обращений. Попробуйте позже." },
        { status: 429 }
      );
    }
    const body = await req.json();
    const text = String(body.text ?? "").trim();
    const contact = String(body.contact ?? "").trim().slice(0, 200);
    if (text.length < 20) {
      return NextResponse.json(
        { error: "Опишите ситуацию подробнее — минимум 20 символов" },
        { status: 400 }
      );
    }
    await db.appeal.create({ data: { text: text.slice(0, 5000), contact } });
    // Уведомление администратора о новом обращении.
    notifyAdmin({
      type: "feedback",
      title: "Новое обращение через форму обратной связи",
      details: `Текст: ${text.slice(0, 100)}${text.length > 100 ? "…" : ""}. Контакт: ${contact || "не указан"}.`,
    }).catch(() => {});
    return NextResponse.json({ ok: true, note: "Обращение отправлено. Спасибо! Администратор его рассмотрит." });
  } catch (e) {
    return handleApiError(e);
  }
}
