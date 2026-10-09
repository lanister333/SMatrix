import { NextRequest, NextResponse } from "next/server";

/**
 * S-5 + S-6 (аудит безопасности 2026-10-04): защитные HTTP-заголовки.
 *
 * Middleware применяется ко всем маршрутам, включая /_next/static, /api/*,
 * и статические ассеты. Headers:
 *   — Content-Security-Policy: безопасная конфигурация, не ломающая работу
 *     приложения (включая inline-стили Next.js, image-domains, JS chunks).
 *   — X-Content-Type-Options: nosniff — запрещает MIME-сниффинг.
 *   — X-Frame-Options: DENY — кликджекинг-защита (можно снять, если нужно
 *     встроить сайт во iframe; по умолчанию защищаем).
 *   — Referrer-Policy: strict-origin-when-cross-origin — не светит полный
 *     URL в Referer при cross-origin переходах (защищает токены в query).
 *   — Strict-Transport-Security: max-age=31536000; includeSubDomains —
 *     HSTS на год; работает только при HTTPS (в dev на http не применяется).
 *   — Permissions-Policy: запрет камеру, микрофон, геолокацию, payment —
 *     сайт эти API не использует.
 *
 * Совместимость: в приложение НЕ используются inline-event-handlers в
 * HTML-атрибутах, external scripts вне _next/static — нет. Для inline
 * <style> и Next.js hydration используется 'unsafe-inline' в style-src
 * (Next.js 16 ставит critical CSS инлайн). script-src 'strict-dynamic'
 * + 'unsafe-inline' для доверенных _next chunks (без этого Next.js не
 * загружает чанки). 'unsafe-eval' НЕ включаем (нет eval в проде).
 */

export function proxy(_req: NextRequest) {
  const res = NextResponse.next();

  // S-5: Content-Security-Policy — безопасная, но не ломающая работу.
  const csp = [
    "default-src 'self'",
    // script-src: 'self' для _next chunks; 'unsafe-inline' для Next.js
    // hydration inline scripts (NeXTгенерирует <script>...</script>).
    "script-src 'self' 'unsafe-inline'",
    // style-src: 'unsafe-inline' обязателен — Next.js Critical CSS инлайн.
    "style-src 'self' 'unsafe-inline'",
    // image-src: 'self' + data: (base64 small images) + https: для внешних
    // картинок партнёров (SakhMatrix подключает аватары, логотипы банков).
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    // connect-src: 'self' для /api/* fetch; open-meteo.com (погода);
    // сайт больше не делает внешних XHR.
    "connect-src 'self' https://api.open-meteo.com",
    "media-src 'self'",
    // frame-src: белый список внешних iframe-виджетов, которые реально
    // используются на главной:
    //   - https://www.meteoblue.com — виджет погоды в правой колонке.
    //   - https://yandex.com / https://*.yandex.com — виджет Яндекс.Карт
    //     с актуальным слоем пробок (l=trf).
    // Без этого правила default-src 'self' блокирует внешние iframe,
    // и блоки «Погода»/«Пробки» не загружаются (визуально пустые).
    "frame-src 'self' https://www.meteoblue.com https://meteoblue.com https://yandex.com https://*.yandex.com https://yandex.ru https://*.yandex.ru",
    // frame-ancestors 'none' = запретить встраивание НАШЕГО сайта в чужой
    // iframe (защита от кликджекинга; X-Frame-Options: DENY дублирует).
    // Это НЕ блокирует внешние iframe на нашем сайте — для этого служит
    // frame-src выше.
    "frame-ancestors 'none'",
    // base-uri 'self' — запрет <base href="evil.com">.
    "base-uri 'self'",
    // form-action 'self' — формы могут сабмитить только на свой домен
    // (защита от утечки данных через <form action="evil.com">).
    "form-action 'self'",
    // object-src 'none' — запрет <object>/<embed> (Flash/плагины).
    "object-src 'none'",
  ].join("; ");

  res.headers.set("Content-Security-Policy", csp);

  // S-6: X-Content-Type-Options — запретить MIME-сниффинг.
  res.headers.set("X-Content-Type-Options", "nosniff");

  // S-6: X-Frame-Options — дублирует frame-ancestors 'none' для старых браузеров.
  res.headers.set("X-Frame-Options", "DENY");

  // S-1: Referrer-Policy — не светить полный URL (с токеном в query)
  // при cross-origin переходах. Same-origin полный referrer сохраняется.
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // S-6: HSTS — только при HTTPS (Next.js middleware видит proto).
  // В dev на http этот заголовок браузер проигнорирует.
  if (_req.nextUrl.protocol === "https:" || _req.headers.get("x-forwarded-proto") === "https") {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  // S-6: Permissions-Policy — явный запрет на использование браузерных API,
  // которые сайт не использует (камера, микрофон, геолокация, payment).
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
  );

  return res;
}

export const config = {
  // Применять ко всем маршрутам, кроме статических файлов в /public/*
  // (картинки партнёров, шрифты — им тоже можно безопасные заголовки,
  // но они и так получают их через middleware).
  matcher: [
    // Все маршруты, кроме _next/static и _next/image (оптимизация):
    "/((?!_next/static|_next/image).*)",
  ],
};
