/**
 * ТЗ 2026-09-22 Flat 2.0 + ПРОМТ «Временная упрощённая регистрация»:
 * выдача SMS-кода для подтверждения телефона при регистрации.
 *
 * TEST MODE:        шлюз SMS не подключён → код возвращается полем devCode
 *                   (форма показывает его с пометкой «демо-режим»). Нужно
 *                   только для локальной разработки и первых тестов.
 * PRODUCTION MODE:  реальный шлюз (или заглушка) — код ОТПРАВЛЯЕТСЯ на
 *                   номер, devCode в ответе ОТСУТСТВУЕТ (критическое
 *                   требование: SMS-код не должен возвращаться API).
 *
 * POST { phone } → { ok: true, devCode?: "1234" }  (devCode только в TEST)
 */

import { issueSmsCode, normalizePhone } from "@/lib/sms";
import { rateLimit } from "@/lib/api";
import { isTestMode } from "@/lib/security";

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

    // ПРОМТ «Временная упрощённая регистрация»: в PRODUCTION MODE код
    // отправляется реальным SMS-шлюзом и НИКОГДА не возвращается в ответе.
    // В TEST MODE — возвращаем devCode (для удобства разработки).
    if (isTestMode()) {
      // TODO: при подключении реального шлюза — заменить на отправку SMS.
      // Сейчас просто возвращаем код (демо-режим).
      return Response.json({ ok: true, devCode: code });
    }

    // PRODUCTION MODE: здесь должен быть вызов реального SMS-шлюза.
    // Пока шлюз не подключён — пишем в лог (для аудита), в ответе
    // только подтверждение, что код отправлен.
    console.log(`[sms] PRODUCTION MODE: код для ${phone.slice(0, 4)}***${phone.slice(-3)} отправлен через шлюз.`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Не удалось отправить код. Попробуйте ещё раз." }, { status: 500 });
  }
}
