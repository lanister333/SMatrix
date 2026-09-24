import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
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
    return NextResponse.json({ ok: true, note: "Обращение отправлено. Спасибо! Администратор его рассмотрит." });
  } catch (e) {
    return handleApiError(e);
  }
}
