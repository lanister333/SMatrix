import type { Metadata, Viewport } from "next";
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
        {/* Шрифт Anton самолокализован (public/fonts + @font-face в
            globals.css): внешний блокирующий запрос к fonts.googleapis.com
            убран — сторонний хост мог подвисать в сети пользователя и
            удерживать событие загрузки страницы (вечный спиннер панели
            предпросмотра платформы). */}
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
