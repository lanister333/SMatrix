import React, { useEffect, useRef } from 'react';

export default function VolunteersCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    // Скорость: пикселей в секунду. Адаптивная:
    // - ПК (≥1024px): 60 px/сек — комфортный темп
    // - Мобайл/планшет (<1024px): 30 px/сек — медленнее, чтобы успеть прочитать
    //    на маленьком экране и не утомляло глаз.
    const PX_PER_SEC = window.innerWidth >= 1024 ? 60 : 30;
    let rafId: number | null = null;
    let lastTime = performance.now();
    let offset = 0; // текущее смещение в пикселях
    let paused = false;
    let loopWidth = 0; // ширина одного цикла = от 1-й карточки до 9-й (начала второго набора)

    // Состояние ручного свайпа
    let isDragging = false; // активно ли перетаскивание (touch или mouse)
    let dragStartX = 0; // начальная X-координата pointer
    let dragStartOffset = 0; // offset в момент начала drag
    let resumeTimer: number | null = null; // таймер возобновления автоскролла после свайпа

    // Замеряем точную ширину одного цикла: offsetLeft 9-го ребёнка (index 8).
    const measure = () => {
      const kids = track.children;
      if (kids.length >= 9) {
        loopWidth = (kids[8] as HTMLElement).offsetLeft;
      } else if (kids.length > 0) {
        loopWidth = track.scrollWidth / 2;
      }
    };
    measure();
    window.addEventListener('resize', measure);

    // Нормализация offset в диапазон [0, loopWidth) — для бесшовного цикла
    const normalizeOffset = (val: number) => {
      if (loopWidth <= 0) return val;
      // Используем модуль для отрицательных и больших значений
      let v = val % loopWidth;
      if (v < 0) v += loopWidth;
      return v;
    };

    const applyTransform = () => {
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;
    };

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      // Автоскролл работает только если НЕ перетаскиваем и НЕ на паузе
      if (!paused && !isDragging && loopWidth > 0) {
        offset += PX_PER_SEC * dt;
        if (offset >= loopWidth) {
          offset -= loopWidth;
        }
        applyTransform();
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // === Пауза при наведении мыши (только ПК) ===
    const handleMouseEnter = () => { paused = true; };
    const handleMouseLeave = () => { paused = false; lastTime = performance.now(); };
    track.addEventListener('mouseenter', handleMouseEnter);
    track.addEventListener('mouseleave', handleMouseLeave);

    // === Ручной свайп через touch (мобайл) ===
    // При горизонтальном движении пальца — пауза автоскролла + смещение трека.
    // При вертикальном движении — игнорируем (страница скроллится, touch-action: pan-y).
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      isDragging = true;
      paused = true;
      dragStartX = e.touches[0].clientX;
      dragStartOffset = offset;
      // Отменяем таймер возобновления, если был
      if (resumeTimer !== null) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - dragStartX;
      // Если движение почти вертикальное — не обрабатываем (страница скроллится)
      if (Math.abs(dx) < 5) return;
      // Смещаем трек в противоположную сторону (drag вправо → трек вправо = offset уменьшается)
      offset = normalizeOffset(dragStartOffset - dx);
      applyTransform();
    };

    const handleTouchEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      // Возобновить автоскролл через 2.5 сек после окончания свайпа
      if (resumeTimer !== null) clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        paused = false;
        lastTime = performance.now();
        resumeTimer = null;
      }, 2500);
    };

    track.addEventListener('touchstart', handleTouchStart, { passive: true });
    track.addEventListener('touchmove', handleTouchMove, { passive: true });
    track.addEventListener('touchend', handleTouchEnd, { passive: true });
    track.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    // === Ручной свайп через mouse drag (ПК — опционально, для теста) ===
    // На ПК используем колёсико мыши для горизонтальной прокрутки
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Горизонтальный скролл колёсиком/тачпадом
        paused = true;
        offset = normalizeOffset(offset + e.deltaX);
        applyTransform();
        if (resumeTimer !== null) clearTimeout(resumeTimer);
        resumeTimer = window.setTimeout(() => {
          paused = false;
          lastTime = performance.now();
          resumeTimer = null;
        }, 2500);
        e.preventDefault();
      }
    };
    track.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (resumeTimer !== null) clearTimeout(resumeTimer);
      window.removeEventListener('resize', measure);
      track.removeEventListener('mouseenter', handleMouseEnter);
      track.removeEventListener('mouseleave', handleMouseLeave);
      track.removeEventListener('touchstart', handleTouchStart);
      track.removeEventListener('touchmove', handleTouchMove);
      track.removeEventListener('touchend', handleTouchEnd);
      track.removeEventListener('touchcancel', handleTouchEnd);
      track.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const partners = [
    {
      name: "ДРУЗЬЯ ОКЕАНА",
      sub: "Помощь морским животным Сахалина",
      bg: "linear-gradient(135deg, #0A4A6E 0%, #1B7BA6 100%)",
      textColor: "#FFFFFF",
      subColor: "#AED6F1",
      url: "https://boomerangclub.ru",
      logo: "/partners/ocean-friends-logo.png",
      siteLabel: "boomerangclub.ru"
    },
    {
      name: "ПОМОЩЬ ЖИВОТНЫМ",
      sub: "Благотворительный фонд · Сахалин",
      bg: "linear-gradient(135deg, #3B2F5C 0%, #5D4A8C 100%)",
      textColor: "#FFFFFF",
      subColor: "#E5D9F2",
      url: "https://t.me/animals_sakhalin",
      logo: "/partners/animals-sakhalin-logo.png",
      siteLabel: "t.me/animals_sakhalin"
    },
    { name: "ПСО СОВА", sub: "Поисково-спасательный отряд", bg: "#1A1A1A", text: "#FFFFFF", subColor: "#FFD600", url: "https://pso-sova.ru" },
    { name: "ЛизаAlert", sub: "Поиск пропавших людей", bg: "#FF6D00", text: "#FFFFFF", subColor: "#FFFFFF", url: "https://lizaalert.org" },
    { name: "Помощь животным", sub: "Добрые сердца Сахалина", bg: "#00796B", text: "#FFFFFF", subColor: "#B2DFDB", url: "#" },
    { name: "ЭкоСахалин", sub: "Защита природы острова", bg: "#4CAF50", text: "#FFFFFF", subColor: "#E8F5E9", url: "#" },
    { name: "Я Донор Сахалин", sub: "Служба сдачи крови", bg: "#C62828", text: "#FFFFFF", subColor: "#FFCDD2", url: "#" },
    { name: "Красный Крест", sub: "Сахалинское отделение", bg: "#D32F2F", text: "#FFFFFF", subColor: "#FFFFFF", url: "#" }
  ];

  const renderCard = (p: any, idx: number) => {
    const isOcean = !!p.logo;
    const bgStyle = p.bg && p.bg.startsWith('linear-gradient')
      ? { backgroundImage: p.bg }
      : { backgroundColor: p.bg };
    return (
      <a
        key={idx}
        href={p.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          flex: '0 0 320px',
          width: '320px',
          minWidth: '320px',
          height: '180px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '14px',
          ...bgStyle,
          borderRadius: '12px',
          textDecoration: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          padding: '14px 16px',
          boxSizing: 'border-box',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {isOcean && (
          <>
            <img
              src={p.logo}
              alt=""
              style={{
                width: '78px',
                height: '78px',
                borderRadius: '50%',
                border: '3px solid #FFFFFF',
                objectFit: 'cover',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, minWidth: 0 }}>
              <span style={{ color: p.textColor, fontSize: '20px', fontWeight: 800, textTransform: 'uppercase', lineHeight: '1.1', letterSpacing: '0.5px' }}>{p.name}</span>
              <span style={{ color: p.subColor, fontSize: '12px', fontWeight: 600, marginTop: '6px', lineHeight: '1.3' }}>{p.sub}</span>
              {p.siteLabel && (
                <span style={{ color: p.textColor, fontSize: '11px', fontWeight: 500, marginTop: '10px', opacity: 0.85 }}>{p.siteLabel}</span>
              )}
            </div>
          </>
        )}
        {!isOcean && (
          <>
            <span style={{ color: p.text, fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', lineHeight: '1.15' }}>{p.name}</span>
            <span style={{ color: p.subColor, fontSize: '13px', fontWeight: 'bold', marginTop: '4px', opacity: 0.9 }}>{p.sub}</span>
          </>
        )}
      </a>
    );
  };

  // Двойной набор карточек для бесшовного цикла
  const doubled = [...partners, ...partners];

  return (
    <div className="sakh-carousel-wrap" style={{ width: '100%', marginTop: '11px', marginBottom: '11px', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div className="sakh-marquee">
        <div className="sakh-marquee-track" ref={trackRef}>
          {doubled.map((p, idx) => renderCard(p, idx))}
        </div>
      </div>
    </div>
  );
}
