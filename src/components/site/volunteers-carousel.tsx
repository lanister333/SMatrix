import React, { useEffect, useRef } from 'react';

export default function VolunteersCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    // Скорость: пикселей в секунду. Адаптивная:
    // - ПК (≥1024px): 15 px/сек — очень медленно
    // - Мобайл/планшет (<1024px): 10 px/сек — еле заметно
    const PX_PER_SEC = window.innerWidth >= 1024 ? 15 : 10;
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
      // Берём горизонтальную дельту если есть, иначе вертикальную (обычное колесо мыши).
      // Это позволяет скроллить карусель как обычным колесом, так и тачпадом по горизонтали.
      const delta = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta !== 0) {
        paused = true;
        offset = normalizeOffset(offset + delta);
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
      logo: "/partners/ocean-friends-logo.png?v=1",
      siteLabel: "boomerangclub.ru"
    },
    {
      name: "ПОМОЩЬ ЖИВОТНЫМ",
      sub: "Благотворительный фонд · Сахалин",
      bg: "linear-gradient(135deg, #3B2F5C 0%, #5D4A8C 100%)",
      textColor: "#FFFFFF",
      subColor: "#E5D9F2",
      url: "https://t.me/animals_sakhalin",
      logo: "/partners/animals-sakhalin-logo-nobg.png?v=7",
      siteLabel: "t.me/animals_sakhalin",
      logoSize: 140,
      logoBorder: "#000000"
    },
    {
      name: "ПЁС И КОТ",
      sub: "Частный приют · Южно-Сахалинск",
      bg: "linear-gradient(135deg, #2E5C9A 0%, #3B6FB0 100%)",
      textColor: "#FFFFFF",
      subColor: "#D6E4F5",
      url: "https://t.me/pesikotsakh",
      logo: "/partners/pesikot-logo-centered.png?v=9",
      siteLabel: "t.me/pesikotsakh"
    },
    {
      name: "РОДНИК",
      sub: "Экоцентр · Защита природы Сахалина",
      bg: "linear-gradient(135deg, #4A7C2E 0%, #76C043 100%)",
      textColor: "#FFFFFF",
      subColor: "#E8F5E9",
      url: "https://sakhrodnik.ru",
      logo: "/partners/rodnik-logo.png?v=4",
      siteLabel: "sakhrodnik.ru",
      logoShiftUp: 8,
      logoShiftLeft: 2
    },
    {
      name: "РАДОСТЬ ЖИЗНИ",
      sub: "Благотворительный фонд · Сахалин",
      bg: "linear-gradient(135deg, #1E3A5F 0%, #2E5A8C 100%)",
      textColor: "#FFFFFF",
      subColor: "#AED6F1",
      url: "https://radostzhizni.ru",
      logo: "/partners/radost-logo-white.png?v=5",
      siteLabel: "radostzhizni.ru",
      logoHorizontal: true
    },
    {
      name: "УЛЫБКА РЕБЁНКА",
      sub: "Благотворительный фонд · Сахалин",
      bg: "linear-gradient(135deg, #2E7D4F 0%, #3A8B5E 100%)",
      textColor: "#FFFFFF",
      subColor: "#E3F27A",
      url: "https://ulybka-rebenka.ru",
      logo: "/partners/ulybka-logo.png?v=2",
      siteLabel: "ulybka-rebenka.ru"
    },
    {
      name: "ПСО СОВА",
      sub: "Поисково-спасательный отряд · Сахалин",
      bg: "linear-gradient(135deg, #0D1B2A 0%, #1A3A6E 100%)",
      textColor: "#FFFFFF",
      subColor: "#FFD700",
      url: "https://t.me/sakhpsosova",
      logo: "/partners/sova-logo-centered.png?v=6",
      siteLabel: "t.me/sakhpsosova"
    },
    {
      name: "ЖИВОТНЫЕ ТЕРРИТОРИЯ СПАСЕНИЯ",
      sub: "СРОО · Сахалин",
      bg: "linear-gradient(135deg, #1565C0 0%, #1E88E5 100%)",
      textColor: "#FFFFFF",
      subColor: "#FFE0B2",
      url: "https://zts-sakh.ru",
      logo: "/partners/zts-logo-centered.png?v=3",
      siteLabel: "zts-sakh.ru"
    },
    {
      name: "СТОП СПИД",
      sub: "Школа волонтёров · Сахалинский центр СПИД",
      bg: "linear-gradient(135deg, #C62828 0%, #E31E24 100%)",
      textColor: "#FFFFFF",
      subColor: "#FFCDD2",
      url: "http://hiv65.ru",
      logo: "/partners/hiv-logo-shrunk.png?v=7",
      siteLabel: "hiv65.ru"
    }
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
            {p.logoShiftUp ? (
              // 2026-10-29: для логотипов со сдвигом вверх (Родник —
              // приподнять, чтобы нижний край не касался круга).
              // <img> не может иметь overflow:hidden внутри себя, поэтому
              // оборачиваем в wrapper div с border-radius:50% + overflow:hidden,
              // а <img> внутри сдвигаем вверх через position:absolute + top:-Npx.
              // Результат: круг остаётся на месте, логотип сдвинут вверх,
              // верхняя часть логотипа обрезана, нижняя часть круга — белая
              // подложка (через backgroundColor:white на wrapper).
              <div style={{
                width: `${p.logoSize || 110}px`,
                height: `${p.logoSize || 110}px`,
                borderRadius: '50%',
                overflow: 'hidden',
                backgroundColor: '#ffffff',
                position: 'relative',
                flexShrink: 0
              }}>
                <img
                  src={p.logo}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    top: `-${p.logoShiftUp}px`,
                    left: p.logoShiftLeft ? `-${p.logoShiftLeft}px` : '0',
                    objectFit: 'cover',
                    flexShrink: 0
                  }}
                />
              </div>
            ) : (
              <img
                src={p.logo}
                alt=""
                style={p.logoHorizontal ? {
                  // 2026-10-29: для горизонтальных логотипов (Радость жизни,
                  // 2022x567 PNG с прозрачным фоном) НЕ применяем border-radius:50%
                  // и object-fit:cover — они обрезают логотип в круг 110x110 и
                  // искажают. Вместо этого — естественная форма PNG (height:auto)
                  // с object-fit:contain, чтобы логотип был виден полностью.
                  // Размер: 96x170 (компромисс — крупнее оригинала 78x130,
                  // но помещается в карточку 320x180).
                  height: '96px',
                  width: 'auto',
                  maxWidth: '170px',
                  objectFit: 'contain',
                  flexShrink: 0
                } : {
                  // Квадратные логотипы — круглый border-radius:50% (форма
                  // логотипа), object-fit:cover. Размер 110x110 (или
                  // индивидуальный через p.logoSize).
                  width: `${p.logoSize || 110}px`,
                  height: `${p.logoSize || 110}px`,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                  ...(p.logoBorder ? { border: `1px solid ${p.logoBorder}` } : {})
                }}
              />
            )}
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
