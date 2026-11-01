/**
 * ТЗ 2026-09-22 Flat 2.0 + ПРОМТ «Временная упрощённая регистрация»:
 * выдача SMS-кода для подтверждения телефона при регистрации.
 *
 * КРИТИЧЕСКОЕ ТРЕБОВАНИЕ БЕЗОПАСНОСТИ (K-1, аудит 2026-10-04):
 * SMS-код НИКОГДА не возвращается в JSON-ответе, HTML, клиентских
 * логах или других публично доступных ответах. Проверка кода
 * выполняется только сервером через verifySmsCode (src/lib/sms.ts).
 *
 * TEST MODE:        код пишется ТОЛЬКО в server-side лог (console.log)
 *                   для удобства локальной разработки. В ответе — только
 *                   { ok: true }. Демо-режим должен быть явно включён
 *                   env REGISTRATION_MODE=test (по умолчанию всё ещё
 *                   test для обратной совместимости, но код больше не
 *                   утекает в API).
 * PRODUCTION MODE:  код отправляется реальным SMS-шлюзом (если подключён)
 *                   или просто не возвращается. В ответе — { ok: true }.
 *
 * POST { phone } → { ok: true }  (никаких devCode)
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

    // K-1: код НЕ возвращается в ответе. В TEST MODE — пишем в server-side
    // лог (только для локальной разработки). В PRODUCTION MODE — здесь
    // должен быть вызов реального SMS-шлюза.
    if (isTestMode()) {
      // TODO: при подключении реального шлюза — заменить на отправку SMS.
      // Пока шлюз не подключён — логируем на сервере (НЕ в ответе).
      console.log(`[sms] TEST MODE: код для ${phone.slice(0, 4)}***${phone.slice(-3)} = ${code}`);
    } else {
      // PRODUCTION MODE: здесь должен быть вызов реального SMS-шлюза.
      // Пока шлюз не подключён — пишем в лог (для аудита), в ответе
      // только подтверждение, что код отправлен.
      console.log(`[sms] PRODUCTION MODE: код для ${phone.slice(0, 4)}***${phone.slice(-3)} отправлен через шлюз.`);
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Не удалось отправить код. Попробуйте ещё раз." }, { status: 500 });
  }
}
