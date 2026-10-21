import React, { useEffect, useRef, useState } from 'react';

export default function VolunteersCarousel() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const container = carouselRef.current;
    if (!container) return;

    const originalChildren = Array.from(container.children);
    originalChildren.forEach((child) => {
      const clone = child.cloneNode(true);
      container.appendChild(clone);
    });

    const step = 244;
    const scrollInterval = setInterval(() => {
      if (isPaused) return;
      if (container.scrollLeft >= container.scrollWidth / 2) {
        container.scrollLeft = 0;
      }
      container.scrollBy({ left: step, behavior: 'smooth' });
    }, 2500);

    return () => clearInterval(scrollInterval);
  }, [isPaused]);

  const partners = [
    { name: "ПСО СОВА", sub: "Поисково-спасательный отряд", bg: "#1A1A1A", text: "#FFFFFF", subColor: "#FFD600", url: "https://pso-sova.ru" },
    { name: "ЛизаAlert", sub: "Поиск пропавших людей", bg: "#FF6D00", text: "#FFFFFF", subColor: "#FFFFFF", url: "https://lizaalert.org" },
    { name: "Помощь животным", sub: "Добрые сердца Сахалина", bg: "#00796B", text: "#FFFFFF", subColor: "#B2DFDB", url: "#" },
    { name: "ЭкоСахалин", sub: "Защита природы острова", bg: "#4CAF50", text: "#FFFFFF", subColor: "#E8F5E9", url: "#" },
    { name: "Я Донор Сахалин", sub: "Служба сдачи крови", bg: "#C62828", text: "#FFFFFF", subColor: "#FFCDD2", url: "#" },
    { name: "Красный Крест", sub: "Сахалинское отделение", bg: "#D32F2F", text: "#FFFFFF", subColor: "#FFFFFF", url: "#" }
  ];

  return (
    /* 2026-10-20 v5: фиксированные отступы 12px/11px (как на /obyavleniya).
       Никакой JS-компенсации — простая и надёжная симметрия на всех страницах. */
    <div style={{ width: '100%', marginTop: '12px', marginBottom: '11px', boxSizing: 'border-box', overflow: 'hidden' }}>
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
              boxShadow: '0 0 4px rgba(0,0,0,0.05)',
              padding: '12px 14px',
              boxSizing: 'border-box',
              flexShrink: 0
            }}
          >
            <span style={{ color: p.text, fontSize: '16px', fontWeight: 800, textTransform: 'uppercase', lineHeight: '1.15' }}>{p.name}</span>
            <span style={{ color: p.subColor, fontSize: '11px', fontWeight: 'bold', marginTop: '0px', opacity: 0.9 }}>{p.sub}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
