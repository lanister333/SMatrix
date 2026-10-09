import React, { useEffect, useRef, useState } from 'react';

export default function VolunteersCarousel() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const container = carouselRef.current;
    if (!container) return;

    // Дублируем элементы в DOM для бесшовного бесконечного круга
    const originalChildren = Array.from(container.children);
    originalChildren.forEach((child) => {
      const clone = child.cloneNode(true);
      container.appendChild(clone);
    });

    const step = 244; // 240px ширина + 4px зазор

    const scrollInterval = setInterval(() => {
      if (isPaused) return;

      // Если доехали до середины (конца оригинальных элементов) — незаметно прыгаем в начало
      if (container.scrollLeft >= container.scrollWidth / 2) {
        container.scrollLeft = 0;
      }

      container.scrollBy({ left: step, behavior: 'smooth' });
    }, 2500);

    return () => clearInterval(scrollInterval);
  }, [isPaused]);

  // Данные наших сочных сахалинских карточек
  const partners = [
    { name: "ПСО СОВА", sub: "Поисково-спасательный отряд", bg: "#1A1A1A", text: "#FFFFFF", subColor: "#FFD600", url: "https://pso-sova.ru" },
    { name: "ЛизаAlert", sub: "Поиск пропавших людей", bg: "#FF6D00", text: "#FFFFFF", subColor: "#FFFFFF", url: "https://lizaalert.org" },
    { name: "Помощь животным", sub: "Добрые сердца Сахалина", bg: "#00796B", text: "#FFFFFF", subColor: "#B2DFDB", url: "#" },
    { name: "ЭкоСахалин", sub: "Защита природы острова", bg: "#4CAF50", text: "#FFFFFF", subColor: "#E8F5E9", url: "#" },
    { name: "Я Донор Сахалин", sub: "Служба сдачи крови", bg: "#C62828", text: "#FFFFFF", subColor: "#FFCDD2", url: "#" },
    { name: "Красный Крест", sub: "Сахалинское отделение", bg: "#D32F2F", text: "#FFFFFF", subColor: "#FFFFFF", url: "#" }
  ];

  return (
    /* Указ 2026-09-23 «карусель висит в воздухе»: вертикальные отступы карусель↔футер.
       БЫЛО: marginBottom 25px (+ margin-top:12px у .mp-footer в globals.css = 37px зазор,
       на мобиле 31px). СТАЛО: marginBottom 10px + margin-top:0 у футера = компактный зазор
       10px — бордер футера служит визуальной границей, карусель не «висит».
       marginTop:20px сверху сохранён (отделение от контента над каруселью). */
    <div style={{ width: '100%', marginTop: '20px', marginBottom: '10px', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div
        ref={carouselRef}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setTimeout(() => setIsPaused(false), 4000)}
        style={{
          display: 'flex',
          gap: '4px',
          overflowX: 'auto',
          scrollBehavior: 'smooth',
          width: '100%',
          boxSizing: 'border-box',
          /* БЫЛО: '2px 0' — тени карточек подрезались. СТАЛО: 4px — воздух для теней
             выросших по высоте карточек (150px). */
          padding: '4px 0',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {partners.map((p, idx) => (
          <a
            key={idx}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            /* Указ 2026-09-23 «карусель стала выше»: БЫЛО height 120px, padding '2px 5px'
               (текст прилипал к краям), шрифт 15px/10px. СТАЛО: height 150px (+30px, +25% —
               карусель заметно выше, пропорции карточки сохранены), padding '12px 14px'
               (сверху/снизу по 12px — текст не прилипает), шрифт 16px/11px (лёгкий рост
               вместе с высотой — читаемость та же, пропорция текст/плашка не поломана).
               Ширина 240px НЕ тронута — горизонтальный шаг прокрутки (step=244) в эффекте
               выше остаётся верным, логика бесконечного цикла не ломается. */
            style={{
              flex: '0 0 240px',
              width: '240px',
              minWidth: '240px',
              height: '150px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: p.bg,
              borderRadius: '4px',
              textDecoration: 'none',
              boxShadow: '0 2px 5px rgba(0,0,0,0.08)',
              padding: '12px 14px',
              boxSizing: 'border-box',
              flexShrink: 0
            }}
          >
            <span style={{ color: p.text, fontSize: '16px', fontWeight: 800, textTransform: 'uppercase', lineHeight: '1.15' }}>{p.name}</span>
            <span style={{ color: p.subColor, fontSize: '11px', fontWeight: 'bold', marginTop: '4px', opacity: 0.9 }}>{p.sub}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
