/**
 * ТЗ 2026-09-22 Flat 2.0 (реставрация 2026-09-23): выдача СМС-кода для
 * двухшаговой формы народных досок. ДЕМО-РЕЖИМ: шлюза нет — код
 * возвращается полем devCode и показывается в форме с пометкой
 * «демо-режим» (см. src/lib/sms.ts и FlatBoard).
 *
 * POST { phone } → { ok: true, devCode: "1234" }
 */

import { issueSmsCode, normalizePhone } from "@/lib/sms";
import { rateLimit } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = normalizePhone(String(body?.phone ?? ""));
    if (phone.length !== 11 || !phone.startsWith("7")) {
      return Response.json(
        { error: "Укажите корректный номер телефона — на него придёт код подтверждения." },
        { status: 400 },
      );
    }
    // Мягкий анти-флуд запросов кода: 10 запросов в час на номер.
    if (!rateLimit(`sms-issue:${phone}`, 10, 60 * 60 * 1000)) {
      return Response.json(
        { error: "Слишком много запросов кода. Попробуйте позже." },
        { status: 429 },
      );
    }
    const { code } = issueSmsCode(phone);
    return Response.json({ ok: true, devCode: code });
  } catch {
    return Response.json({ error: "Не удалось отправить код. Попробуйте ещё раз." }, { status: 500 });
  }
}
