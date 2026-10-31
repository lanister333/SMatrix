import { NextResponse } from "next/server";
import { getRegistrationMode } from "@/lib/security";

/**
 * ПРОМТ «Временная упрощённая регистрация»: GET /api/auth/mode —
 * возвращает текущий режим регистрации, чтобы клиент (AuthModal) знал,
 * какие поля показывать (phone+smsCode в PRODUCTION, без них в TEST).
 *
 * Это НЕ переключатель — режим задан серверной env REGISTRATION_MODE
 * (test по умолчанию, production для боевого режима). Клиент только
 * читает текущее значение, не может изменить.
 */
export async function GET() {
  return NextResponse.json({ mode: getRegistrationMode() });
}
