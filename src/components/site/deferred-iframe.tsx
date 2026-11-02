"use client";

import { useEffect, useState } from "react";

/**
 * Отложенный iframe для сторонних виджетов (meteoblue, Яндекс.Карты).
 *
 * Причина появления: сторонние виджеты могут отвечать медленно или
 * подвисать в сети пользователя. Если iframe получает src при SSR-рендере
 * (даже с loading="lazy" — виджет в видимой области стартует сразу),
 * он удерживает событие window.load страницы до собственной загрузки.
 * Встраиваемая панель предпросмотра платформы сигналит «загрузка» именно
 * до этого события — страница выглядит отрисованной, но индикатор крутится
 * вечно. Без src iframe ресурсом документа не является и событие load не
 * задерживает; src подставляется строго ПОСЛЕ того, как страница уже
 * «загружена» (или по страховочному таймауту).
 */

type DeferredIframeProps = React.IframeHTMLAttributes<HTMLIFrameElement> & {
  src: string;
};

export default function DeferredIframe({ src, ...rest }: DeferredIframeProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Страница уже полностью загружена (гидрация после load) — сразу.
    if (document.readyState === "complete") {
      setReady(true);
      return;
    }
    const onLoad = () => setReady(true);
    window.addEventListener("load", onLoad, { once: true });
    // Страховка: если load по какой-то причине задержан сторонним
    // ресурсом, виджет всё равно появится через 5 секунд.
    const fallback = window.setTimeout(() => setReady(true), 5000);
    return () => {
      window.removeEventListener("load", onLoad);
      window.clearTimeout(fallback);
    };
  }, []);

  return <iframe src={ready ? src : undefined} {...rest} />;
}
