import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "SakhMatrix — Сахалинская матрица взаимопомощи",
  description:
    "SakhMatrix — форум-портал для жителей Сахалина: советы, рекомендации мастеров, дороги, рыбалка и жизнь острова. Спроси у города — город ответит.",
  keywords: ["Сахалин", "форум", "Южно-Сахалинск", "SakhMatrix", "сообщество", "взаимопомощь"],
  openGraph: {
    title: "SakhMatrix — Сахалинская матрица взаимопомощи",
    description: "Спроси у города — город ответит.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "SakhMatrix — Сахалинская матрица взаимопомощи",
    description: "Спроси у города — город ответит.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Исправление «мигания логотипа»: preload самозагруженного шрифта
            Anton Latin — браузер начинает качать woff2 одновременно с HTML,
            ещё до разбора globals.css; вместе с font-display:block (globals.css)
            логотип больше не рисуется фолбэк-шрифтом (Arial Narrow/Impact),
            который выглядел как «другой логотип» перед нормальным.
            crossOrigin обязателен для preload шрифтов по спецификации.
            2026-11-11: preload только latin (основной) — latin-ext не нужен,
            на сайте нет расширенной латиницы (ā, ē и т.п.); сам файл
            остаётся доступным, просто не preload-ится, экономит приоритет
            критичных ресурсов. */}
        <link
          rel="preload"
          href="/fonts/anton-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {/* Yandex Webmaster verification */}
        <meta name="yandex-verification" content="f6d6f62dab337dcc" />
        {/* Google Search Console verification */}
        <meta name="google-site-verification" content="1JnkctkTBjfpNV2BEuKETwfvLFfXJ5nvP4dSDliouvY" />
        {/* 2026-11-08: favicon — избавляет от 404 на /favicon.ico в логах.
            Логотип SakhMatrix (Z-символ на тёмно-графитовом фоне).
            2026-11-11: favicon.ico собран напрямую из logo.svg (16/32/64),
            добавлены apple-touch-icon (180×180) и PNG 32/256 для разных
            платформ — везде теперь наш логотип. */}
        <link rel="icon" href="/favicon.ico?v=20261111e" sizes="any" />
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
        <link rel="icon" href="/icon-32.png?v=20261111e" type="image/png" sizes="32x32" />
        <link rel="icon" href="/icon-256.png?v=20261111e" type="image/png" sizes="256x256" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=20261111e" />
        <link rel="mask-icon" href="/logo.svg" color="#0a7d75" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {/* Яндекс.Метрика — счётчик 113691446.
            Установлен 2026-10-20. Включён вебвизор, клики по ссылкам,
            точный показатель отказов, карта кликов.
            Стратегия afterInteractive — скрипт грузится сразу после
            интерактивности, не блокируя рендер. */}
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");ym(113691446, "init", {clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});`}
        </Script>
        <noscript>
          <div>
            <img
              src="https://mc.yandex.ru/watch/113691446"
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>
        {children}
      </body>
    </html>
  );
}
