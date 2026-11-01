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
            Anton — браузер начинает качать woff2 одновременно с HTML, ещё до
            разбора globals.css; вместе с font-display:block (globals.css)
            логотип больше не рисуется фолбэк-шрифтом (Arial Narrow/Impact),
            который выглядел как «другой логотип» перед нормальным.
            crossOrigin обязателен для preload шрифтов по спецификации. */}
        <link
          rel="preload"
          href="/fonts/anton-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/anton-latin-ext.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased">
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
