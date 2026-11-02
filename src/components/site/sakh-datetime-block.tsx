"use client";

/**
 * Сахалинские часы реального времени (ИДЕНТИЧНО на ВСЕХ страницах).
 *
 * ФИКС 2026-09-19 «часы выглядят одинаково на всех страницах»:
 * прежние inline-стили с суффиксом "!important" ОТБРАСЫВАЛИСЬ клиентским
 * react-dom при клиентской перерисовке (SPA-виды форума /?view=forum,
 * /?topic=1) — блок оставался без рамки, фона, шапки и шрифтов.
 * Все стили перенесены в CSS-классы .sakh-clock* (globals.css, блок
 * «Часы и дата выглядят одинаково на всех страницах») — значения
 * ДОСЛОВНО из прежних inline-стилей: рамка 1px #4A688C (тёмно-синяя,
 * как у Погоды), радиус 0, композитная тень, шапка #1E3A5F
 * (var(--sm-navy) — ЦВЕТ ПОГОДЫ), белый текст, padding 5px 9px,
 * font 13px/700, border-bottom 1px #16293F (var(--sm-navy-deep)).
 *
 * В теле Flexbox-центровщик (display:flex; flex-direction:column;
 * justify-content:center; align-items:center; height:50px) — дата и
 * время строго по центру. Время тикает каждую секунду, часовой пояс
 * Asia/Magadan (GMT+11) принудительно.
 */

import { useEffect, useRef } from "react";

function updateSakhTime(dateEl: HTMLElement | null, timeEl: HTMLElement | null) {
  if (!dateEl || !timeEl) return;
  const now = new Date();

  // Принудительно переводим время в Сахалинский часовой пояс (GMT+11)
  const optionsDate: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Magadan",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  const optionsTime: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Magadan",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };

  let dateStr = now.toLocaleDateString("ru-RU", optionsDate);
  const timeStr = now.toLocaleTimeString("ru-RU", optionsTime);

  // Делаем первую букву дня недели заглавной
  dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  // JS только вставляет текст, без скрытых стилей/тегов
  dateEl.textContent = dateStr;
  timeEl.textContent = timeStr;
}

export default function SakhDatetimeBlock() {
  const dateRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Запускаем тиканье каждую секунду и сразу при загрузке
    updateSakhTime(dateRef.current, timeRef.current);
    const timer = setInterval(() => {
      updateSakhTime(dateRef.current, timeRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    /* КОНТЕЙНЕР — класс .sakh-clock (globals.css): белая панель с рамкой
       1px #4A688C, тенью и радиусом 0 — дословно прежние inline-стили */
    <div className="sakh-clock" aria-label="Сахалинское время">
      {/* ШАПКА — класс .sakh-clock-head: фон #1E3A5F (ЦВЕТ ПОГОДЫ),
          белый текст, 13px/700, border-bottom 1px #16293F */}
      <div className="sakh-clock-head">🕒 SakhMatrix • Время</div>

      {/* ТЕЛО: класс .sakh-clock-body — Flexbox-центровщик 50px,
          дата и время строго по центру */}
      <div className="sakh-clock-body">
        {/* ДАТА */}
        <div id="sakh-date" ref={dateRef} className="sakh-clock-date" />
        {/* ЦИФРЫ ВРЕМЕНИ */}
        <div id="sakh-time" ref={timeRef} className="sakh-clock-time">
          00:00:00
        </div>
      </div>
    </div>
  );
}
