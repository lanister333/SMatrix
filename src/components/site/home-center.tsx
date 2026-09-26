"use client";

/**
 * ШАГ 27 (макет главной): центральный столбец главной страницы.
 * 1) «Подслушано Сахалин» — 4 свежие публикации (текст | ник | дата);
 * 2) «Последние темы форума» — 8 свежих тем (тема | автор | дата/время);
 * 3) нижняя сетка разделов попарно в две колонки (ровно как на макете):
 *    Поддержка молодого бизнеса / Исполнители / Нужна помощь /
 *    Рекомендую–Не рекомендую / Где дешевле / Где купить /
 *    О работодателях / ЖКХ и городские проблемы / Объявления / Знакомства.
 * Поиск внутри блоков запрещён макетом (единственный поиск — в навигации).
 * ТЗ 2026-09-21: ячейка «Поддержка молодого бизнеса» (шапка и слайды 1/3
 * ротатора) ведёт на самостоятельную страницу «Новый бизнес Сахалина»
 * (/startup.php) — прежняя инлайн-лента biz-ajax убрана.
 */

import { useEffect, useRef, useState } from "react";
import {
  Briefcase,
  Cloud,
  CloudRain,
  CloudSnow,
  Hammer,
  Heart,
  HeartHandshake,
  Megaphone,
  ShoppingCart,
  Store,
  Sun,
  Tags,
  ThumbsUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Nick, type TopicRow } from "@/lib/ui";
import { forumCategoryHref, forumTopicHref } from "@/lib/forum-links";
import TransportScheduleBlock from "@/components/site/transport-schedule-block";
// Указ заказчика 2026-09-23 (скриншот «это удали», ТРЕТЬЕ снятие): панели
// «Быстрые подсказки «Где купить»/«Где дешевле»» снова сняты с Главной —
// импорты и монтирование удалены (низ центральной колонки). Подсистема
// СОХРАНЕНА и не рендерится (политика прежних снятий 2026-09-22):
//   • компоненты  src/components/site/wheretobuy-quick-hints.tsx /
//     gdedeshevle-quick-hints.tsx (клиентский фильтр + серая плашка);
//   • API /api/wheretobuy-hints + /api/gdedeshevle-hints (пре-модерация);
//   • модели БД WheretobuyHint/CheapHint, темы-приёмники #177/#178;
//   • роут-адаптер /forum/topic/[topicId] (слаги примеров → темы).
// История снятий/возвратов (раунды prefilled_text и «6 сахалинских
// примеров», examples-e2e) — в worklog; возврат = вернуть эти два
// импорта и монтирование в конец центральной колонки.

/** Дата «26.04.2025» (год полностью — как на согласованном макете). */
function fmtDay(v: string | Date): string {
  const d = typeof v === "string" ? new Date(v) : v;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Дата/время «26.04.2025 10:24» — как на согласованном макете. */
function fmtDayTime(v: string | Date): string {
  const d = typeof v === "string" ? new Date(v) : v;
  return (
    d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  );
}

interface OverheardLite {
  id: string;
  title: string;
  authorName: string;
  createdAt: string;
  /**
   * ID связанной темы форума, если публикация уже привязана к теме
   * в рубрике «Обсуждение сообщений из «Подслушано»» (podslyshano-discuss).
   * Если есть — клик ведёт прямо в тему (/forum/topic/<id>);
   * если нет — в список тем рубрики (/forum/category/podslyshano-discuss),
   * где пользователь может сам создать тему обсуждения.
   */
  topicId?: number | null;
}

/** Пункт нижней сетки: заголовок-ссылка и короткий список пунктов. */
interface GridCell {
  title: string;
  href: string;
  icon: LucideIcon;
  /** У ячейки бизнеса пунктов нет — в белом поле ротатор баннеров
   *  (оба ведут на /startup.php — страница «Новый бизнес Сахалина»). */
  items?: string[];
}

const BIZ_CELL_TITLE = "Поддержка молодого бизнеса";

const GRID_CELLS: GridCell[] = [
  {
    title: BIZ_CELL_TITLE,
    // ТЗ 2026-09-21: баннер «Поддержка молодого бизнеса» открывает
    // страницу «Новый бизнес Сахалина» (/startup.php)
    href: "/startup.php",
    icon: Store,
  },
  {
    title: "Исполнители",
    href: "/obyavleniya",
    icon: Hammer,
    items: ["Сантехник — Южно-Сахалинск", "Электрик — Анива", "Мастер на час — Корсаков"],
  },
  {
    title: "Нужна помощь",
    href: "/help",
    icon: HeartHandshake,
    items: ["Сбор гуманитарной помощи", "Поиск пропавших людей", "Волонтеры"],
  },
  {
    title: "Рекомендую / Не рекомендую",
    href: "/rekomenduyu",
    icon: ThumbsUp,
    items: ["Магазины и сервисы", "Кафе и рестораны", "Мастера и специалисты"],
  },
  {
    title: "Где дешевле",
    href: "/gde-deshevle",
    icon: Tags,
    items: ["Продукты питания", "Бытовая техника", "Стройматериалы"],
  },
  {
    title: "Где купить",
    href: "/gde-kupit",
    icon: ShoppingCart,
    items: ["Автозапчасти", "Электроника", "Детские товары"],
  },
  {
    title: "О работодателях",
    href: "/o-rabotodatelyah",
    icon: Briefcase,
    items: ["Вакансии", "Резюме", "Отзывы о работодателях"],
  },
  {
    title: "ЖКХ и городские проблемы",
    href: "/gkh",
    icon: Wrench,
    items: ["Коммунальные услуги", "Дороги и транспорт", "Благоустройство"],
  },
  {
    title: "Объявления",
    href: "/obyavleniya",
    icon: Megaphone,
    items: ["Продам / Куплю", "Услуги", "Разное"],
  },
  {
    title: "Знакомства",
    href: "/znakomstva",
    icon: Heart,
    items: ["Ищу девушку / парня", "Дружба", "Общение"],
  },
];

const BIZ_ROT_MS = 6000;

const BIZ_ROT_SLIDES = [
  {
    key: "sprout",
    title: "Давайте поможем нашим землякам!",
    sub: "Здесь зарождается новый бизнес Сахалина. Заходи, читай блоги, поддержи своих!",
    action: "startup" as const,
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <linearGradient id="bz1-leafL" x1="20" y1="19" x2="39" y2="39" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#eafcb0" />
            <stop offset="0.4" stopColor="#a3e635" />
            <stop offset="0.78" stopColor="#84cc16" />
            <stop offset="1" stopColor="#eab308" />
          </linearGradient>
          <linearGradient id="bz1-leafR" x1="60" y1="19" x2="41" y2="39" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#e2fba4" />
            <stop offset="0.4" stopColor="#97dc2c" />
            <stop offset="0.78" stopColor="#74b812" />
            <stop offset="1" stopColor="#d99e0b" />
          </linearGradient>
          <linearGradient id="bz1-stem" x1="40" y1="72" x2="40" y2="39" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#d9a50e" />
            <stop offset="1" stopColor="#a3e635" />
          </linearGradient>
          <radialGradient id="bz1-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#d4f75e" stopOpacity="0.4" />
            <stop offset="1" stopColor="#d4f75e" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bz1-gloss" x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <filter id="bz1-soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.4" /></filter>
          <filter id="bz1-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.8" /></filter>
        </defs>
        {/* светящееся лимонно-золотое поле за ростком и у земли — вместо тёмных теней */}
        <circle cx="40" cy="37.5" r="34" fill="url(#bz1-halo)" />
        <ellipse cx="40" cy="72" rx="13" ry="2.6" fill="#ffd45e" opacity="0.4" filter="url(#bz1-glow)" />
        {/* стебель: золотисто-салатовый градиент + светлый боковой блик */}
        <path d="M40 72c.5-11.5.5-22 0-32.9" stroke="url(#bz1-stem)" strokeWidth={4.4} strokeLinecap="round" fill="none" />
        <path d="M38.5 71.6c.4-11 .4-21 0-31.7" stroke="#eafcb0" strokeWidth={1.3} strokeLinecap="round" fill="none" opacity="0.8" />
        {/* левый лист: объёмная подложка → лимонное тело → прожилка → белый глянец */}
        <path d="M40 39C40 26.6 30.9 18.5 18.5 18.5c.6 12.4 9.7 20.5 21.5 20.5Z" fill="#4d7c0f" opacity="0.55" filter="url(#bz1-soft)" transform="translate(1.6 2.2)" />
        <path d="M40 39C40 26.6 30.9 18.5 18.5 18.5c.6 12.4 9.7 20.5 21.5 20.5Z" fill="url(#bz1-leafL)" />
        <path d="M38.6 37.9C32 34.9 25.9 29.2 21.6 21.9" stroke="#578303" strokeWidth={1.4} strokeLinecap="round" fill="none" opacity="0.6" />
        <ellipse cx="29.5" cy="26.7" rx="9.5" ry="3.6" fill="url(#bz1-gloss)" opacity="0.9" transform="rotate(-38 29.5 26.7)" filter="url(#bz1-soft)" />
        {/* правый лист: та же схема с золотым переливом у основания */}
        <path d="M40 39c0-12.4 9.1-20.5 21.5-20.5-.6 12.4-9.7 20.5-21.5 20.5Z" fill="#4d7c0f" opacity="0.55" filter="url(#bz1-soft)" transform="translate(1.6 2.2)" />
        <path d="M40 39c0-12.4 9.1-20.5 21.5-20.5-.6 12.4-9.7 20.5-21.5 20.5Z" fill="url(#bz1-leafR)" />
        <path d="M41.4 37.9c6.6-3 12.7-8.6 17-15.9" stroke="#578303" strokeWidth={1.4} strokeLinecap="round" fill="none" opacity="0.6" />
        <ellipse cx="50.5" cy="26.7" rx="9.5" ry="3.6" fill="url(#bz1-gloss)" opacity="0.85" transform="rotate(38 50.5 26.7)" filter="url(#bz1-soft)" />
      </svg>
    ),
  },
  {
    key: "house",
    title: "Открыли новый бизнес на острове?",
    sub: "Расскажи о своем деле",
    action: "register" as const,
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <linearGradient id="bz2-roof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffb347" />
            <stop offset="1" stopColor="#ff5a1f" />
          </linearGradient>
          <linearGradient id="bz2-sign" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff8a00" />
            <stop offset="1" stopColor="#ff2d00" />
          </linearGradient>
          <linearGradient id="bz2-win" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd166" />
            <stop offset="1" stopColor="#ff7b2e" />
          </linearGradient>
          <radialGradient id="bz2-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ff7b2e" stopOpacity="0.4" />
            <stop offset="1" stopColor="#ff7b2e" stopOpacity="0" />
          </radialGradient>
          <filter id="bz2-soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.4" /></filter>
          <filter id="bz2-glow" x="-90%" y="-90%" width="280%" height="280%"><feGaussianBlur stdDeviation="3" /></filter>
        </defs>
        {/* оранжевое свечение-маяк позади здания и у земли — тёмных заливок больше нет */}
        <circle cx="40" cy="45" r="34" fill="url(#bz2-halo)" />
        <ellipse cx="40.6" cy="69.8" rx="25" ry="3" fill="#ff7b2e" opacity="0.4" filter="url(#bz2-glow)" />
        {/* корпус: контуры чистым белым, стенки — лёгкая белая стекло-заливка */}
        <path d="M47.5 38.1 63.1 30.5V59L47.5 66.8Z" fill="rgba(255,255,255,0.04)" stroke="#ffffff" strokeWidth={1.7} strokeLinejoin="round" />
        <rect x="16.3" y="38.1" width="31.2" height="28.7" fill="rgba(255,255,255,0.09)" stroke="#ffffff" strokeWidth={1.7} />
        {/* объёмная неоново-оранжевая крыша: свечение-дубль, затем чёткая плашка */}
        <rect x="14.5" y="33.6" width="34.9" height="4.5" fill="url(#bz2-roof)" opacity="0.75" filter="url(#bz2-glow)" />
        <rect x="14.5" y="33.6" width="34.9" height="4.5" fill="url(#bz2-roof)" stroke="#ffffff" strokeWidth={0.9} />
        <path d="M49.4 33.6 64.9 25.9v4.5L49.4 38.1Z" fill="#e8491d" stroke="#ffffff" strokeWidth={0.9} strokeLinejoin="round" />
        {/* ярко горящая вывеска (неон оранжево-красный) с белой чашкой */}
        <rect x="21.3" y="40.8" width="21.7" height="12.5" fill="url(#bz2-sign)" opacity="0.8" filter="url(#bz2-glow)" />
        <rect x="21.3" y="40.8" width="21.7" height="12.5" fill="url(#bz2-sign)" stroke="#ffffff" strokeWidth={1.1} />
        <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round">
          <path d="M26.5 44h9.2v5.5a3.1 3.1 0 0 1-3.1 3.1h-3a3.1 3.1 0 0 1-3.1-3.1Z" strokeWidth={1.5} />
          <path d="M35.7 44.9c2.4 0 2.4 3.6 0 3.6" strokeWidth={1.3} />
          <path d="M29 42.6c.6-.9-.6-1.5 0-2.4M33.2 42.6c.6-.9-.6-1.5 0-2.4" strokeWidth={1.2} />
        </g>
        {/* тёплое неоновое окно со свечением + дверь в белом контуре */}
        <rect x="20.5" y="57" width="8" height="7" fill="url(#bz2-win)" opacity="0.75" filter="url(#bz2-glow)" />
        <rect x="20.5" y="57" width="8" height="7" fill="url(#bz2-win)" stroke="#ffffff" strokeWidth={1} />
        <rect x="34.5" y="55" width="9.5" height="11.8" fill="rgba(255,255,255,0.06)" stroke="#ffffff" strokeWidth={1.4} />
        <circle cx="42.1" cy="61.3" r="0.8" fill="#ffffff" />
      </svg>
    ),
  },
  {
    key: "box",
    title: "ИЩЕШЬ НОВОЕ?",
    sub: "Загляни в блоги к новичкам — они готовы делом доказать качество",
    action: "startup" as const,
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <linearGradient id="bz3-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffedc2" />
            <stop offset="1" stopColor="#f3c96b" />
          </linearGradient>
          <linearGradient id="bz3-side" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#eec672" />
            <stop offset="1" stopColor="#d9a53f" />
          </linearGradient>
          <linearGradient id="bz3-flapF" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f8dc9a" />
            <stop offset="1" stopColor="#e7bb5c" />
          </linearGradient>
          <linearGradient id="bz3-ray" x1="40" y1="39" x2="40" y2="9.4" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffd60a" stopOpacity="0.95" />
            <stop offset="0.55" stopColor="#ffc300" stopOpacity="0.6" />
            <stop offset="1" stopColor="#ffd60a" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="bz3-mouth" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff6cf" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ffd60a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bz3-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffd60a" stopOpacity="0.3" />
            <stop offset="1" stopColor="#ffd60a" stopOpacity="0" />
          </radialGradient>
          <filter id="bz3-soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.4" /></filter>
          <filter id="bz3-glow" x="-90%" y="-90%" width="280%" height="280%"><feGaussianBlur stdDeviation="3" /></filter>
        </defs>
        <circle cx="40" cy="38" r="34" fill="url(#bz3-halo)" />
        <ellipse cx="39.4" cy="68.5" rx="22" ry="3" fill="#ffd60a" opacity="0.4" filter="url(#bz3-glow)" />
        {/* зев коробки: светящееся золотое нутро — внутреннее свечение вместо тёмного проёма */}
        <path d="M16.25 43.75 26.25 36.25h35l-10 7.5Z" fill="#f7c948" />
        <path d="M26.25 36.25h35v3.75h-35Z" fill="#ffe08a" />
        <ellipse cx="38.75" cy="40.75" rx="16.9" ry="5.7" fill="url(#bz3-mouth)" />
        {/* солнечные лучи: мягкое свечение + чёткие золотые столбы + искры */}
        <g filter="url(#bz3-glow)" opacity="0.8">
          <path d="M39.9 38.1V9.4" stroke="#ffd60a" strokeWidth={8.75} strokeLinecap="round" fill="none" />
          <path d="M34 38.5 22 14.25" stroke="#ffc300" strokeWidth={6.75} strokeLinecap="round" fill="none" />
          <path d="M45.75 38.5 57.75 14.25" stroke="#ffc300" strokeWidth={6.75} strokeLinecap="round" fill="none" />
        </g>
        <path d="M39.9 38.1V9.4" stroke="url(#bz3-ray)" strokeWidth={5.25} strokeLinecap="round" fill="none" />
        <path d="M34 38.5 22 14.25" stroke="url(#bz3-ray)" strokeWidth={4} strokeLinecap="round" fill="none" />
        <path d="M45.75 38.5 57.75 14.25" stroke="url(#bz3-ray)" strokeWidth={4} strokeLinecap="round" fill="none" />
        <circle cx="39.9" cy="6.75" r="1.5" fill="#ffd60a" />
        <circle cx="19.5" cy="11.5" r="1.2" fill="#ffd60a" opacity="0.9" />
        <circle cx="60.5" cy="11.5" r="1.2" fill="#ffd60a" opacity="0.9" />
        {/* светлый бежево-золотой корпус с 3D-перспективой и белыми кромками */}
        <path d="M51.25 43.75 61.25 36.25V60l-10 7.5Z" fill="url(#bz3-side)" stroke="#ffffff" strokeWidth={0.9} strokeLinejoin="round" />
        <rect x="16.25" y="43.75" width="35" height="23.75" fill="url(#bz3-front)" stroke="#ffffff" strokeWidth={0.9} />
        <rect x="16.25" y="43.75" width="35" height="5.75" fill="url(#bz3-flapF)" />
        <path d="M51.25 43.75 61.25 36.25v5.5l-10 7.5Z" fill="#d9a53f" stroke="#ffffff" strokeWidth={0.8} strokeLinejoin="round" />
        <path d="M16.25 43.75h35" stroke="#ffffff" strokeWidth={1.2} opacity="0.9" />
        <path d="M16.25 43.75 26.25 36.25" stroke="#ffffff" strokeWidth={1} opacity="0.8" />
        <path d="M61.25 36.25h-35" stroke="#ffffff" strokeWidth={1} opacity="0.7" />
      </svg>
    ),
  },
];

/**
 * biz-rotator-2026-09-20: автосмена трёх баннеров по кругу каждые 6 с.
 * Пауза — по образцу карусели волонтёров, но на СТАБИЛЬНОЙ оболочке .biz-rot
 * (сменяется только внутренний слайд — hover не сбрасывается). Слайд 2
 * («Открыли новый бизнес на острове?») открывает окно регистрации сайта
 * (AuthModal, вкладка «Регистрация»); слайды 1 и 3 ведут на страницу
 * «Новый бизнес Сахалина» (/startup.php) — ТЗ 2026-09-21.
 */
function BizRotator({ onOpenStartup, onOpenRegister }: { onOpenStartup: () => void; onOpenRegister: () => void }) {
  const [slide, setSlide] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pausedRef.current) setSlide((s) => (s + 1) % BIZ_ROT_SLIDES.length);
    }, BIZ_ROT_MS);
    return () => window.clearInterval(id);
  }, []);

  const s = BIZ_ROT_SLIDES[slide];
  return (
    <div
      className="biz-rot"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
      onTouchStart={() => {
        pausedRef.current = true;
      }}
      onTouchEnd={() => {
        window.setTimeout(() => {
          pausedRef.current = false;
        }, 4000);
      }}
    >
      <button
        key={s.key}
        type="button"
        className="biz-rot-slide biz-rot-fade"
        onClick={() => (s.action === "register" ? onOpenRegister() : onOpenStartup())}
      >
        <span className="biz-rot-ico">{s.icon}</span>
        <span className="biz-rot-txt">
          <span className="biz-rot-h">{s.title}</span>
          <span className="biz-rot-sub">{s.sub}</span>
        </span>
      </button>
    </div>
  );
}

/** Иконка погодного состояния (метеокод open-meteo). */
export function WeatherIcon({ code, size = 20, className }: { code: number; size?: number; className?: string }) {
  let Ico: LucideIcon = Cloud;
  if (code === 0) Ico = Sun;
  else if (code <= 2) Ico = Sun; // переменная облачность — солнце с облачком упрощаем до солнца
  else if (code === 3 || code === 45 || code === 48) Ico = Cloud;
  else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) Ico = CloudRain;
  else Ico = CloudSnow;
  return <Ico size={size} className={className} aria-hidden="true" />;
}

export default function HomeCenter(props: {
  onOpenTopic: (id: number) => void;
  onOpenProfile: (nick: string) => void;
  onOpenRegister: () => void;
}) {
  const [posts, setPosts] = useState<OverheardLite[] | null>(null);
  const [topics, setTopics] = useState<TopicRow[] | null>(null);

  /**
   * ТЗ 2026-09-24 «Подслушано Сахалин» — автопрокрутка ленты на главной.
   * Контейнер с фиксированной высотой (CSS-класс .mp-overheard-scroll),
   * внутри которого публикации прокручиваются вертикально и плавно через
   * requestAnimationFrame. При наведении мыши прокрутка приостанавливается,
   * чтобы пользователь мог спокойно прочитать заголовок и кликнуть.
   *
   * Запускается только когда есть что крутить (posts.length > 0 и контент
   * длиннее высоты контейнера). Если публикаций нет — рендерится статичное
   * сообщение «Пока нет публикаций — ваша может стать первой…».
   */
  const overheardRef = useRef<HTMLDivElement>(null);
  const overheardPausedRef = useRef(false);

  // ТЗ 2026-09-21: баннер «Поддержка молодого бизнеса» (слайды 1 и 3
  // ротатора) открывает страницу «Новый бизнес Сахалина» (/startup.php).
  const openStartup = () => {
    window.location.href = "/startup.php";
  };

  useEffect(() => {
    let alive = false;
    // Берём 12 свежих публикаций (с запасом — для заметной автопрокрутки;
    // 4 было слишком мало для полноценной ленты новостей).
    fetch("/api/overheard?page=1&pageSize=12")
      .then(async (r) => (r.ok ? r.json() : { posts: [] }))
      .then((d) => {
        if (!alive) setPosts((d.posts || []).slice(0, 12));
      })
      .catch(() => {
        if (!alive) setPosts([]);
      });
    fetch("/api/topics?page=1&perPage=8")
      .then(async (r) => (r.ok ? r.json() : { topics: [] }))
      .then((d) => {
        if (!alive) setTopics((d.topics || []).slice(0, 8));
      })
      .catch(() => {
        if (!alive) setTopics([]);
      });
    return () => {
      alive = true;
    };
  }, []);

  /**
   * ТЗ 2026-09-24: автопрокрутка ленты «Подслушано Сахалин».
   * Алгоритм: каждый кадр requestAnimationFrame сдвигаем scrollTop на 0.2px
   * (~12px/сек при 60fps — плавно и без рывков; в 2 раза медленнее, чем
   * прошлая версия 0.4px/кадр — ТЗ 2026-09-25 «Замедлить ровно в 2 раза»),
   * при достижении конца плавно возвращаемся в начало. Пауза по hover.
   */
  useEffect(() => {
    const el = overheardRef.current;
    if (!el) return;
    // Не запускаем, если публикаций нет — крутить нечего.
    if (!posts || posts.length === 0) return;

    let rafId = 0;
    const onEnter = () => { overheardPausedRef.current = true; };
    const onLeave = () => { overheardPausedRef.current = false; };
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);

    const step = () => {
      if (!overheardPausedRef.current) {
        // Крутим только если контент реально длиннее контейнера.
        if (el.scrollHeight > el.clientHeight + 1) {
          // 0.2px/кадр (ровно в 2 раза медленнее прежних 0.4px/кадр).
          el.scrollTop += 0.2;
          // Достигли низа (с допуском в 1px) — мягко возвращаемся в начало.
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
            el.scrollTop = 0;
          }
        }
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [posts]);

  /**
   * ТЗ 2026-09-25 «Высота блока ровно под 5 сообщений»: после рендера
   * публикаций измеряем высоту первой строки .mp-trow (через offsetHeight,
   * включая padding и border) и устанавливаем высоту контейнера = 5 × rowH.
   * Динамический расчёт надёжнее статичного CSS, т.к. высота строк может
   * отличаться (длинный ник, длина даты, варианты шрифтов на разных ОС).
   *
   * Если публикаций меньше 5 — оставляем CSS-дефолт (380px) или сжимаем
   * под фактическое число строк (минимум не нужен — flexbox сам справится).
   *
   * Срабатывает на каждый рендер posts (появились новые публикации —
   * высота контейнера пересчитывается). Также подписываемся на resize
   * окна (через ResizeObserver) — на случай, когда пользователь меняет
   * масштаб браузера или поворачивает телефон.
   */
  useEffect(() => {
    const el = overheardRef.current;
    if (!el) return;
    if (!posts || posts.length === 0) return;

    /** Видимое число строк в окне блока. */
    const VISIBLE_ROWS = 5;

    /** Пересчёт высоты контейнера по факту высоты первой строки. */
    const adjustHeight = () => {
      const firstRow = el.querySelector<HTMLElement>(".mp-trow");
      if (!firstRow) return;
      const rowH = firstRow.offsetHeight;
      if (rowH <= 0) return;
      // Устанавливаем ровно под VISIBLE_ROWS строк. Если публикаций меньше
      // — всё равно фиксируем высоту под 5 (т.к. пользователь видит «окно»
      // стабильного размера; пустое место остаётся снизу — это нормально
      // и не ломает автопрокрутку, потому что scrollHeight <= clientHeight
      // и rAF-цикл просто не запускается).
      el.style.height = `${rowH * VISIBLE_ROWS}px`;
    };

    // Первый пересчёт — после монтирования (DOM уже есть, но layout ещё
    // мог не зафиксироваться; вызываем через requestAnimationFrame, чтобы
    // браузер успел отрисовать .mp-trow и offsetHeight был корректным).
    const raf = requestAnimationFrame(adjustHeight);

    // Подписка на изменения размера (масштаб браузера, поворот телефона,
    // изменение шрифта системы) — пересчёт высоты.
    const ro = new ResizeObserver(() => adjustHeight());
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      // Сбрасываем инлайн-стиль, чтобы CSS-класс снова взял верх при
      // следующем рендере (например, когда posts стал пустым).
      el.style.height = "";
    };
  }, [posts]);

  return (
    <div className="mp-center">
      {/*
        7.1 «Подслушано Сахалин» — лента с автопрокруткой.
        ТЗ 2026-09-24: блок имеет фиксированную высоту (380px, CSS-класс
        .mp-overheard-scroll) и плавно прокручивается по вертикали через
        requestAnimationFrame (см. useEffect выше). При наведении мыши —
        пауза. Клик по публикации ведёт в связанную тему форума, если у
        публикации есть topicId, иначе — в рубрику «Обсуждение сообщений
        из «Подслушано»» (/forum/category/podslyshano-discuss). Если
        публикаций нет — статичное сообщение «Пока нет публикаций…».
      */}
      <section className="mp-panel" aria-label="Подслушано Сахалин">
        <div className="mp-paneltitle">
          <span className="tri">▼</span>Подслушано Сахалин
        </div>
        <div
          className="mp-rows mp-overheard mp-overheard-scroll"
          ref={overheardRef}
        >
          {posts === null ? (
            <div className="mp-loading">Загрузка…</div>
          ) : posts.length === 0 ? (
            <div className="mp-loading">Пока нет публикаций — ваша может стать первой на странице «Подслушано Сахалин».</div>
          ) : (
            posts.map((p) => {
              // Если у публикации есть связанная тема форума — ведём в неё;
              // иначе — в рубрику «Обсуждение сообщений из «Подслушано»»,
              // где пользователь может сам создать тему обсуждения.
              const href = p.topicId
                ? forumTopicHref(p.topicId)
                : forumCategoryHref("podslyshano-discuss");
              return (
                <div key={p.id} className="mp-trow">
                  <a className="mp-ttext" href={href} title={p.title}>
                    {p.title}
                  </a>
                  <span className="mp-tauthor">
                    <Nick name={p.authorName} />
                  </span>
                  <span className="mp-tdate">{fmtDay(p.createdAt)}</span>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 7.2 «Последние темы форума» — заголовок ровно как в макете */}
      <section className="mp-panel" aria-label="Последние темы форума">
        <div className="mp-paneltitle">
          <span className="tri">▼</span>Последние темы форума
        </div>
        <div className="mp-rows">
          {topics === null ? (
            <div className="mp-loading">Загрузка тем…</div>
          ) : topics.length === 0 ? (
            <div className="mp-loading">Тем пока нет.</div>
          ) : (
            topics.map((t) => (
              <div key={t.id} className="mp-trow">
                <a
                  className="mp-ttext"
                  onClick={(e) => {
                    e.preventDefault();
                    props.onOpenTopic(t.id);
                  }}
                  title={t.title}
                >
                  {t.title}
                </a>
                <span className="mp-tauthor">
                  <Nick name={t.author} gender={t.authorGender} onOpen={props.onOpenProfile} />
                </span>
                <span className="mp-tdate">{fmtDayTime(t.lastActivityAt)}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 7.3/7.4 Нижняя сетка: попарно две колонки, порядок и названия ровно по макету.
          ТЗ 2026-09-21: шапка ячейки бизнеса и слайды 1/3 баннера ведут
          на страницу «Новый бизнес Сахалина» (/startup.php). */}
      <div className="mp-grid">
        {GRID_CELLS.map((c) => (
          <section key={c.title} className="mp-panel mp-cell" aria-label={c.title}>
            <a className="mp-paneltitle mp-celltitle" href={c.href}>
              <c.icon size={13} strokeWidth={2.4} aria-hidden="true" />
              <span>{c.title}</span>
            </a>
            {c.items ? (
              <ul className="mp-list">
                {c.items.map((it) => (
                  <li key={it}>
                    <a href={c.href}>{it}</a>
                  </li>
                ))}
              </ul>
            ) : (
              <BizRotator onOpenStartup={openStartup} onOpenRegister={props.onOpenRegister} />
            )}
          </section>
        ))}
      </div>

      {/* Указ заказчика 2026-09-23 (скриншот «это удали»): место прежнего
          монтирования панелей «Быстрые подсказки «Где купить»/«Где
          дешевле»» (низ центральной колонки, после сетки) — ПУСТО.
          Компоненты и вся сквозная подсистема (клиентский фильтр, серая
          плашка, API, темы-приёмники #177/#178, роут-адаптер слагов
          примеров) сохранены на диске и просто не рендерятся — см.
          комментарий в шапке файла. Возврат: два импорта в шапке +
          <WhereToBuyQuickHints /> и <GdedeshevleQuickHints /> здесь. */}

      {/* ТЗ 2026-09-26: блок «Расписание транспорта» — в самом низу
          центральной колонки Главной, на всю ширину. Дизайн повторяет
          блок «Время» (.sakh-clock): синяя шапка #1E3A5F, белое тело.
          Компактный, с вкладками (✈️ Авиа / 🚢 Вода / 🚂 ЖД).
          Источник: env YANDEX_RASP_KEY → реальные данные Яндекс.Расписаний;
          иначе — демонстрационная заглушка с пометкой. */}
      <TransportScheduleBlock />
    </div>
  );
}
