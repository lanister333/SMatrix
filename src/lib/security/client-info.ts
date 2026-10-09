import crypto from "crypto";
import type { NextRequest } from "next/server";

/**
 * ПРОМТ №1 (защита платформы): извлечение IP/UA/fingerprint запроса.
 *
 * S-4 (аудит безопасности 2026-10-04): X-Forwarded-For и др. proxy-
 * заголовки ДОВЕРЯТСЯ только если env TRUST_PROXY=1 (по умолчанию — НЕ
 * доверять, для dev). В проде за Caddy/Cloudflare — установить
 * TRUST_PROXY=1, чтобы получать реальный клиентский IP из заголовков
 * (Caddy ставит X-Forwarded-For правильным образом).
 *
 * Если TRUST_PROXY не задан — IP берётся напрямую из сокета через
 * req.ip (Next.js / Node.js), без доверия клиентским заголовкам. Это
 * защищает от spoofing-атак: без доверия proxy заголовок X-Forwarded-For,
 * присланный клиентом, игнорируется.
 *
 * Fingerprint — простой детерминированный хэш от User-Agent + Accept-Language;
 * НЕ клиентский JS fingerprint (нет трекинга в браузере) — это серверный
 * «грубый» отпечаток для базового обнаружения мульти-аккаунтинга.
 */

/** S-4: доверяем ли proxy-заголовкам? */
function trustProxy(): boolean {
  // Кэшируем в globalThis, чтобы не читать env на каждый запрос.
  const g = globalThis as unknown as { __trustProxy?: boolean };
  if (g.__trustProxy === undefined) {
    g.__trustProxy = (process.env.TRUST_PROXY ?? "0").trim() === "1";
  }
  return g.__trustProxy;
}

export function getClientIp(req: NextRequest | Request): string {
  // S-4: если TRUST_PROXY=1 — доверяем X-Forwarded-For от прокси.
  // Иначе — берём IP из сокета (req.ip для NextRequest, fallback на ::1).
  if (trustProxy()) {
    const headers = new Headers(req.headers);
    // Caddy/CF ставит первый адрес в X-Forwarded-For.
    const xff = headers.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
    return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? "::1";
  }
  // S-4: без доверия proxy — пробуем взять IP из сокета.
  // NextRequest.ip есть в Node.js runtime; в edge runtime может быть undefined.
  const nr = req as NextRequest & { ip?: string };
  return nr.ip ?? "::1";
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

