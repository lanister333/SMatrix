/**
 * ПРОМТ «Временная упрощённая регистрация»: переключатель TEST/PRODUCTION mode.
 *
 *   TEST MODE       — CAPTCHA → email → подтверждение email → аккаунт.
 *                     SMS-механика отключена (но сохранена в коде).
 *   PRODUCTION MODE — CAPTCHA → SMS → email → аккаунт.
 *                     Обязательно: phone + smsCode + email + email-подтверждение.
 *
 *   Переключатель — серверная env REGISTRATION_MODE = "test" (по умолчанию)
 *   или "production". НЕ переключается пользователем через интерфейс.
 *
 *   SMS-механика (src/lib/sms.ts: issueSmsCode/verifySmsCode) сохраняется
 *   и в TEST, и в PRODUCTION — в TEST просто не вызывается при регистрации,
 *   в PRODUCTION вызывается обязательно. /api/sms в PROD не возвращает
 *   devCode (защита: SMS-код не должен возвращаться API).
 */

export type RegistrationMode = "test" | "production";

let _cached: RegistrationMode | null = null;

export function getRegistrationMode(): RegistrationMode {
  if (_cached !== null) return _cached;
  const raw = (process.env.REGISTRATION_MODE ?? "test").toLowerCase().trim();
  _cached = raw === "production" || raw === "prod" ? "production" : "test";
  return _cached;
}

export function isProductionMode(): boolean {
  return getRegistrationMode() === "production";
}

export function isTestMode(): boolean {
  return getRegistrationMode() === "test";
}

/** Сброс кэша (для тестов). */
export function _resetRegistrationModeCache(): void {
  _cached = null;
}
