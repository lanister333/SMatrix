import crypto from "crypto";
import type { NextRequest } from "next/server";

/**
 * ПРОМТ №1 (защита платформы): извлечение IP/UA/fingerprint запроса.
 *
 * IP берётся из заголовков X-Forwarded-For / CF-Connecting-IP / X-Real-IP
 * (платформа работает за Caddy/reverse-proxy), fallback на ::1.
 *
 * Fingerprint — простой детерминированный хэш от User-Agent + Accept-Language;
 * НЕ клиентский JS fingerprint (нет трекинга в браузере) — это серверный
 * «грубый» отпечаток для базового обнаружения мульти-аккаунтинга.
 */

export function getClientIp(req: NextRequest | Request): string {
  const headers = new Headers(req.headers);
  // Caddy/CF ставит первый адрес в X-Forwarded-For.
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? "::1";
}

export function getClientAgent(req: NextRequest | Request): string {
  const headers = new Headers(req.headers);
  return (headers.get("user-agent") ?? "").slice(0, 300);
}

export function getAcceptLanguage(req: NextRequest | Request): string {
  const headers = new Headers(req.headers);
  return (headers.get("accept-language") ?? "").slice(0, 50);
}

/** Серверный fingerprint: хэш от User-Agent + Accept-Language. */
export function getDeviceFingerprint(req: NextRequest | Request): string {
  const ua = getClientAgent(req);
  const lang = getAcceptLanguage(req);
  // Если нет ни UA, ни языка — анонимный клиент (curl, бот) — отдельный bucket.
  const raw = ua ? `${ua}|${lang}` : "anonymous";
  return crypto.createHash("sha1").update(raw).digest("hex").slice(0, 24);
}

/** Краткое человекочитаемое описание устройства для админ-панели. */
export function describeDevice(ua: string): string {
  if (!ua) return "Анонимный клиент";
  if (/curl|wget|python|go-http|axios|bot|spider/i.test(ua)) {
    return "Автоматический клиент";
  }
  const isMobile = /android|iphone|mobile/i.test(ua);
  const browser = /edg/i.test(ua)
    ? "Edge"
    : /chrome/i.test(ua)
    ? "Chrome"
    : /firefox/i.test(ua)
    ? "Firefox"
    : /safari/i.test(ua)
    ? "Safari"
    : "Браузер";
  const os = /windows/i.test(ua)
    ? "Windows"
    : /mac os/i.test(ua)
    ? "macOS"
    : /android/i.test(ua)
    ? "Android"
    : /iphone|ios/i.test(ua)
    ? "iOS"
    : /linux/i.test(ua)
    ? "Linux"
    : "?";
  return `${browser} на ${os}${isMobile ? " (мобайл)" : ""}`;
}
