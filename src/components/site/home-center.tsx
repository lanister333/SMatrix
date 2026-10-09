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
  tag?: string; // rumor | observation | message
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
    // 2026-10-05: вместо списка пунктов — ротатор из 3 банеров
    // (ИЩЕШЬ МАСТЕРА? / СВОЙ ЧЕЛОВЕК / ОПЫТ + ОТЗЫВЫ),
    // меняется каждые 6 сек.
  },
  {
    title: "Нужна помощь",
    href: "/help",
    icon: HeartHandshake,
    // 2026-10-05: вместо списка пунктов — ротатор из 3 банеров
    // (ПОМОГИ ИЛИ ПОПРОСИ / ПОМОЩЬ РЯДОМ / ПОМОГАЕМ ДРУГ ДРУГУ),
    // меняется каждые 6 сек.
  },
  {
    title: "Рекомендую / Не рекомендую",
    href: "/rekomenduyu",
    icon: ThumbsUp,
    // 2026-10-05: вместо списка пунктов — ротатор из 3 банеров
    // (ПРОВЕРЕНО ЛЮДЬМИ / СТОИТ ИЛИ НЕТ? / БЫЛ — РАССКАЖИ),
    // меняется каждые 6 сек.
  },
  {
    title: "Где дешевле",
    href: "/gde-deshevle",
    icon: Tags,
    // 2026-10-05: вместо списка пунктов — ротатор из 3 банеров
    // (НЕ ПЕРЕПЛАЧИВАЙ / КУПИ ВЫГОДНЕЕ / ХОЧЕШЬ СЭКОНОМИТЬ?),
    // меняется каждые 6 сек.
  },
  {
    title: "Где купить",
    href: "/gde-kupit",
    icon: ShoppingCart,
    // 2026-10-05: вместо списка пунктов — ротатор из 3 банеров
    // (НАШЕЛ ЧТО НУЖНО? / ЗДЕСЬ ПОДСКАЖУТ / ГДЕ ВЗЯТЬ НУЖНОЕ),
    // меняется каждые 6 сек.
  },
  {
    title: "О работодателях",
    href: "/o-rabotodatelyah",
    icon: Briefcase,
    // 2026-10-05: вместо списка пунктов — ротатор из 3 банеров
    // (НЕ УСТРАИВАЙСЯ В СЛЕПУЮ / СТОИТ ЛИ ИДТИ? / РЕАЛЬНЫЙ ОПЫТ),
    // меняется каждые 6 сек.
  },
  {
    title: "ЖКХ и городские проблемы",
    href: "/gkh",
    icon: Wrench,
    // 2026-10-05: вместо списка пунктов — ротатор из 3 банеров
    // (НЕ МОЛЧИ О ПРОБЛЕМЕ / СООБЩИ ГДЕ ПЛОХО / ЖКХ БЕСИТ?),
    // меняется каждые 6 сек.
  },
  {
    title: "Объявления",
    href: "/obyavleniya",
    icon: Megaphone,
    // 2026-10-05: вместо списка пунктов — ротатор из 3 банеров
    // (ЛЮДИ ДЛЯ ЛЮДЕЙ / БЕЗ ТОРГОВЛИ / ОБМЕН), меняется каждые 6 сек.
  },
  {
    title: "Знакомства",
    href: "/znakomstva",
    icon: Heart,
    // 2026-10-05: вместо списка пунктов — ротатор из 3 банеров
    // (ЗНАКОМСТВА / ДРУЖБА / ОБЩЕНИЕ), меняется каждые 6 сек.
  },
];

const BIZ_ROT_MS = 20000;

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
  const [slide, setSlide] = useState(() => Math.floor(Math.random() * BIZ_ROT_SLIDES.length));
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pausedRef.current) setSlide((s) => { if (BIZ_ROT_SLIDES.length <= 1) return s; let next; do { next = Math.floor(Math.random() * BIZ_ROT_SLIDES.length); } while (next === s); return next; });
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

/**
 * 2026-10-05: ротатор «Знакомства» — три сменяющихся банера с надписями
 * ЗНАКОМСТВА / ДРУЖБА / ОБЩЕНИЕ. Каждый банер имеет свой цвет фона и иконку.
 * По образу BizRotator, но упрощённый: одинаковая структура слайдов,
 * меньше сложных SVG-градиентов. Клик по банеру открывает /znakomstva.
 *
 * Цвета банеров (приглушённые градиенты, не кричащие):
 *   • ЗНАКОМСТВА — малиново-розовый  #a04268 → #6e2b48
 *   • ДРУЖБА    — морско-бирюзовый   #2c7a8a → #1b525e
 *   • ОБЩЕНИЕ   — лилово-фиолетовый  #7a5d9e → #4f3a6b
 */
const DATING_ROT_MS = 20000;

const DATING_ROT_SLIDES = [
  {
    key: "dating",
    title: "ЗНАКОМСТВА",
    sub: "Найди свою половинку на Сахалине",
    bg: "linear-gradient(135deg,#ec4899 0%,#be185d 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="dt1-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="dt1-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#dt1-halo)" />
        {/* сердце с белым свечением */}
        <path
          d="M40 62C24 50 14 42 14 30c0-7 5-12 12-12 5 0 9 3 14 8 5-5 9-8 14-8 7 0 12 5 12 12 0 12-10 20-26 32Z"
          fill="#ffffff"
          opacity="0.4"
          filter="url(#dt1-glow)"
          transform="translate(0 2)"
        />
        <path
          d="M40 62C24 50 14 42 14 30c0-7 5-12 12-12 5 0 9 3 14 8 5-5 9-8 14-8 7 0 12 5 12 12 0 12-10 20-26 32Z"
          fill="#ffffff"
          stroke="#ffffff"
          strokeWidth="1.4"
        />
        {/* маленькое сердечко-блик */}
        <ellipse cx="29" cy="26" rx="5" ry="3" fill="#a04268" opacity="0.55" transform="rotate(-30 29 26)" />
      </svg>
    ),
  },
  {
    key: "friendship",
    title: "ДРУЖБА",
    sub: "Заводите друзей и единомышленников",
    bg: "linear-gradient(135deg,#06b6d4 0%,#0891b2 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="dt2-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="dt2-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#dt2-halo)" />
        {/* две руки в рукопожатии — упрощённо, в белом контуре */}
        <g
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#dt2-glow)"
          opacity="0.4"
        >
          <path d="M14 44 L26 44 L34 50 L46 50 L54 44 L66 44" />
          <path d="M26 44 L26 38" />
          <path d="M34 50 L34 56" />
          <path d="M46 50 L46 56" />
          <path d="M54 44 L54 38" />
        </g>
        <g
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 44 L26 44 L34 50 L46 50 L54 44 L66 44" />
          <path d="M26 44 L26 38" />
          <path d="M34 50 L34 56" />
          <path d="M46 50 L46 56" />
          <path d="M54 44 L54 38" />
        </g>
        {/* искра-звёздочка над рукопожатием */}
        <g fill="#ffffff">
          <circle cx="40" cy="24" r="2.5" />
          <circle cx="40" cy="24" r="4.5" opacity="0.4" />
        </g>
      </svg>
    ),
  },
  {
    key: "communication",
    title: "ОБЩЕНИЕ",
    sub: "Обсуждайте интересы и объединяйтесь",
    bg: "linear-gradient(135deg,#a855f7 0%,#7e22ce 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="dt3-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="dt3-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#dt3-halo)" />
        {/* два облачка-диалога */}
        <g filter="url(#dt3-glow)" opacity="0.4" fill="#ffffff">
          <path d="M14 22 H44 V42 H30 L22 50 V42 H14 Z" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4">
          <path d="M14 22 H44 V42 H30 L22 50 V42 H14 Z" />
        </g>
        {/* точки-буквы в первом облачке */}
        <g fill="#7a5d9e">
          <circle cx="22" cy="32" r="2" />
          <circle cx="29" cy="32" r="2" />
          <circle cx="36" cy="32" r="2" />
        </g>
        {/* второе облачко поменьше, перекрывающее */}
        <g filter="url(#dt3-glow)" opacity="0.4" fill="#ffffff">
          <path d="M38 38 H66 V56 H52 L46 62 V56 H38 Z" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4">
          <path d="M38 38 H66 V56 H52 L46 62 V56 H38 Z" />
        </g>
        <g fill="#7a5d9e">
          <circle cx="46" cy="47" r="2" />
          <circle cx="53" cy="47" r="2" />
          <circle cx="60" cy="47" r="2" />
        </g>
      </svg>
    ),
  },
];

function DatingRotator({ onOpen }: { onOpen: () => void }) {
  const [slide, setSlide] = useState(() => Math.floor(Math.random() * DATING_ROT_SLIDES.length));
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pausedRef.current) setSlide((s) => { if (DATING_ROT_SLIDES.length <= 1) return s; let next; do { next = Math.floor(Math.random() * DATING_ROT_SLIDES.length); } while (next === s); return next; });
    }, DATING_ROT_MS);
    return () => window.clearInterval(id);
  }, []);

  const s = DATING_ROT_SLIDES[slide];
  return (
    <div
      className="biz-rot"
      style={{ background: s.bg }}
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
        onClick={onOpen}
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

/**
 * 2026-10-05: ротатор «Объявления» — три сменяющихся банера с надписями
 * ЛЮДИ ДЛЯ ЛЮДЕЙ / БЕЗ ТОРГОВЛИ / ОБМЕН. Структура аналогична DatingRotator.
 * Клик по банеру открывает /obyavleniya.
 *
 * Цвета банеров (приглушённые градиенты):
 *   • ЛЮДИ ДЛЯ ЛЮДЕЙ — янтарно-медовый  #a07a3a → #6e5226
 *   • БЕЗ ТОРГОВЛИ   — хвойно-зелёный   #3d7a4a → #265030
 *   • ОБМЕН          — терракотовый     #a05a3a → #6e3a26
 */
const ADS_ROT_MS = 20000;

const ADS_ROT_SLIDES = [
  {
    key: "people",
    title: "ЛЮДИ ДЛЯ ЛЮДЕЙ",
    sub: "Помогайте друг другу без посредников",
    bg: "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="ad1-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="ad1-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#ad1-halo)" />
        {/* две фигуры людей, соединённые сердцем */}
        <g filter="url(#ad1-glow)" opacity="0.4" fill="#ffffff">
          <circle cx="22" cy="30" r="7" />
          <rect x="14" y="38" width="16" height="22" rx="3" />
          <circle cx="58" cy="30" r="7" />
          <rect x="50" y="38" width="16" height="22" rx="3" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4">
          <circle cx="22" cy="30" r="7" />
          <rect x="14" y="38" width="16" height="22" rx="3" />
          <circle cx="58" cy="30" r="7" />
          <rect x="50" y="38" width="16" height="22" rx="3" />
        </g>
        {/* сердечко-связь между ними */}
        <path
          d="M40 50c-4-3-7-5.5-7-9 0-2 1.5-3.5 3.5-3.5 1.5 0 2.5 1 3.5 2 1-1 2-2 3.5-2 2 0 3.5 1.5 3.5 3.5 0 3.5-3 6-7 9Z"
          fill="#a07a3a"
          stroke="#ffffff"
          strokeWidth="1.2"
        />
      </svg>
    ),
  },
  {
    key: "no-trade",
    title: "БЕЗ ТОРГОВЛИ",
    sub: "Даром и от души — не магазин",
    bg: "linear-gradient(135deg,#10b981 0%,#059669 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="ad2-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="ad2-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#ad2-halo)" />
        {/* подарок-коробка с лентой */}
        <g filter="url(#ad2-glow)" opacity="0.4" fill="#ffffff">
          <rect x="20" y="32" width="40" height="28" rx="2" />
          <rect x="18" y="28" width="44" height="6" rx="1" />
          <rect x="36" y="28" width="8" height="32" />
          <path d="M40 28c-4-8-14-8-14 0 4 0 8 0 14 0Z" />
          <path d="M40 28c4-8 14-8 14 0-4 0-8 0-14 0Z" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round">
          <rect x="20" y="32" width="40" height="28" rx="2" />
          <rect x="18" y="28" width="44" height="6" rx="1" />
          <rect x="36" y="28" width="8" height="32" />
          <path d="M40 28c-4-8-14-8-14 0 4 0 8 0 14 0Z" />
          <path d="M40 28c4-8 14-8 14 0-4 0-8 0-14 0Z" />
        </g>
        {/* красный禁止-кружок поверх */}
        <circle cx="58" cy="22" r="9" fill="#c44a3a" stroke="#ffffff" strokeWidth="1.8" />
        <line x1="52" y1="16" x2="64" y2="28" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "exchange",
    title: "ОБМЕН",
    sub: "Меняйтесь вещами и услугами",
    bg: "linear-gradient(135deg,#f97316 0%,#ea580c 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="ad3-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="ad3-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#ad3-halo)" />
        {/* две стрелки по кругу — символ обмена */}
        <g filter="url(#ad3-glow)" opacity="0.4" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 32 L40 22 L58 32" />
          <path d="M58 32 L52 30 M58 32 L56 38" />
          <path d="M58 48 L40 58 L22 48" />
          <path d="M22 48 L28 50 M22 48 L24 42" />
        </g>
        <g fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 32 L40 22 L58 32" />
          <path d="M58 32 L52 30 M58 32 L56 38" />
          <path d="M58 48 L40 58 L22 48" />
          <path d="M22 48 L28 50 M22 48 L24 42" />
        </g>
        {/* точка-акцент в центре */}
        <circle cx="40" cy="40" r="2.5" fill="#ffffff" />
      </svg>
    ),
  },
];

function AdsRotator({ onOpen }: { onOpen: () => void }) {
  const [slide, setSlide] = useState(() => Math.floor(Math.random() * ADS_ROT_SLIDES.length));
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pausedRef.current) setSlide((s) => { if (ADS_ROT_SLIDES.length <= 1) return s; let next; do { next = Math.floor(Math.random() * ADS_ROT_SLIDES.length); } while (next === s); return next; });
    }, ADS_ROT_MS);
    return () => window.clearInterval(id);
  }, []);

  const s = ADS_ROT_SLIDES[slide];
  return (
    <div
      className="biz-rot"
      style={{ background: s.bg }}
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
        onClick={onOpen}
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

/**
 * 2026-10-05: ротатор «ЖКХ» — три сменяющихся банера с надписями
 * НЕ МОЛЧИ О ПРОБЛЕМЕ / СООБЩИ ГДЕ ПЛОХО / ЖКХ БЕСИТ?. Структура
 * аналогична AdsRotator и DatingRotator. Клик открывает /gkh.
 *
 * Цвета банеров (приглушённые градиенты):
 *   • НЕ МОЛЧИ О ПРОБЛЕМЕ — огненно-кирпичный  #b56840 → #783a22
 *   • СООБЩИ ГДЕ ПЛОХО      — индиго-стальной   #2d4a78 → #16284a
 *   • ЖКХ БЕСИТ?            — умбра-сепия       #925028 → #5e3216
 */
const GKH_ROT_MS = 20000;

const GKH_ROT_SLIDES = [
  {
    key: "speak-up",
    title: "НЕ МОЛЧИ О ПРОБЛЕМЕ",
    sub: "Расскажи — другие должны знать",
    bg: "linear-gradient(135deg,#ef4444 0%,#dc2626 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="gkh1-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="gkh1-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#gkh1-halo)" />
        {/* мегафон-рупор с волнами звука */}
        <g filter="url(#gkh1-glow)" opacity="0.4" fill="#ffffff">
          <path d="M16 36 L34 36 L54 22 L54 58 L34 44 L16 44 Z" />
          <rect x="14" y="36" width="4" height="8" rx="1" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M16 36 L34 36 L54 22 L54 58 L34 44 L16 44 Z" />
          <rect x="14" y="36" width="4" height="8" rx="1" />
        </g>
        {/* звуковые волны */}
        <g fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round">
          <path d="M60 30 Q66 40 60 50" opacity="0.85" />
          <path d="M66 26 Q74 40 66 54" opacity="0.6" />
        </g>
      </svg>
    ),
  },
  {
    key: "report-bad",
    title: "СООБЩИ ГДЕ ПЛОХО",
    sub: "Сломано, не работает, игнорируют — пиши",
    bg: "linear-gradient(135deg,#3b82f6 0%,#2563eb 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="gkh2-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="gkh2-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#gkh2-halo)" />
        {/* предупреждающий знак-треугольник с восклицательным знаком */}
        <g filter="url(#gkh2-glow)" opacity="0.4" fill="#ffffff">
          <path d="M40 14 L66 60 L14 60 Z" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M40 14 L66 60 L14 60 Z" />
        </g>
        {/* восклицательный знак — вырез в треугольнике */}
        <rect x="38" y="28" width="4" height="18" rx="1" fill="#2d4a78" />
        <circle cx="40" cy="52" r="2.4" fill="#2d4a78" />
      </svg>
    ),
  },
  {
    key: "annoyed",
    title: "ЖКХ БЕСИТ?",
    sub: "Поделись — вместе найдём решение",
    bg: "linear-gradient(135deg,#d97706 0%,#b45309 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="gkh3-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="gkh3-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#gkh3-halo)" />
        {/* недовольный смайл */}
        <g filter="url(#gkh3-glow)" opacity="0.4" fill="#ffffff">
          <circle cx="40" cy="40" r="26" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4">
          <circle cx="40" cy="40" r="26" />
        </g>
        {/* хмурые брови */}
        <g fill="none" stroke="#925028" strokeWidth="3" strokeLinecap="round">
          <path d="M28 32 L36 36" />
          <path d="M52 32 L44 36" />
        </g>
        {/* прищуренные глаза */}
        <g fill="#925028">
          <circle cx="30" cy="40" r="2" />
          <circle cx="50" cy="40" r="2" />
        </g>
        {/* опущенные уголки губ */}
        <path
          d="M30 54 Q40 48 50 54"
          fill="none"
          stroke="#925028"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

function GkhRotator({ onOpen }: { onOpen: () => void }) {
  const [slide, setSlide] = useState(() => Math.floor(Math.random() * GKH_ROT_SLIDES.length));
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pausedRef.current) setSlide((s) => { if (GKH_ROT_SLIDES.length <= 1) return s; let next; do { next = Math.floor(Math.random() * GKH_ROT_SLIDES.length); } while (next === s); return next; });
    }, GKH_ROT_MS);
    return () => window.clearInterval(id);
  }, []);

  const s = GKH_ROT_SLIDES[slide];
  return (
    <div
      className="biz-rot"
      style={{ background: s.bg }}
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
        onClick={onOpen}
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

/**
 * 2026-10-05: ротатор «О работодателях» — три сменяющихся банера с надписями
 * НЕ УСТРАИВАЙСЯ В СЛЕПУЮ / СТОИТ ЛИ ИДТИ? / РЕАЛЬНЫЙ ОПЫТ. Клик открывает
 * /o-rabotodatelyah.
 *
 * Цвета банеров (приглушённые градиенты):
 *   • НЕ УСТРАИВАЙСЯ В СЛЕПУЮ — тёмно-синий деловой  #2d4a78 → #16284a
 *   • СТОИТ ЛИ ИДТИ?           — графитово-стальной  #4a5568 → #2a3140
 *   • РЕАЛЬНЫЙ ОПЫТ            — медно-золотой       #8a5e3a → #5a3a22
 */
const EMP_ROT_MS = 20000;

const EMP_ROT_SLIDES = [
  {
    key: "blind-hire",
    title: "НЕ УСТРАИВАЙСЯ В СЛЕПУЮ",
    sub: "Узнай заранее, что за работодатель",
    bg: "linear-gradient(135deg,#3b82f6 0%,#2563eb 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="em1-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="em1-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#em1-halo)" />
        {/* портфель-кейс с вопросительным знаком поверх */}
        <g filter="url(#em1-glow)" opacity="0.4" fill="#ffffff">
          <rect x="20" y="30" width="40" height="28" rx="3" />
          <rect x="34" y="24" width="12" height="8" rx="2" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round">
          <rect x="20" y="30" width="40" height="28" rx="3" />
          <rect x="34" y="24" width="12" height="8" rx="2" />
        </g>
        {/* знак вопроса */}
        <text
          x="40"
          y="50"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="20"
          fontWeight="700"
          fill="#2d4a78"
        >
          ?
        </text>
      </svg>
    ),
  },
  {
    key: "worth-it",
    title: "СТОИТ ЛИ ИДТИ?",
    sub: "Почитай отзывы бывших сотрудников",
    bg: "linear-gradient(135deg,#64748b 0%,#475569 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="em2-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="em2-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#em2-halo)" />
        {/* развесистые весы — взвешивание решения */}
        <g filter="url(#em2-glow)" opacity="0.4" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="40" y1="18" x2="40" y2="56" />
          <line x1="22" y1="30" x2="58" y2="30" />
          <path d="M22 30 L16 44 L28 44 Z" fill="#ffffff" />
          <path d="M58 30 L52 44 L64 44 Z" fill="#ffffff" />
        </g>
        <g fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="40" y1="18" x2="40" y2="56" />
          <line x1="22" y1="30" x2="58" y2="30" />
          <path d="M22 30 L16 44 L28 44 Z" fill="#ffffff" />
          <path d="M58 30 L52 44 L64 44 Z" fill="#ffffff" />
        </g>
        {/* основание весов */}
        <rect x="32" y="56" width="16" height="4" rx="1" fill="#ffffff" />
      </svg>
    ),
  },
  {
    key: "real-experience",
    title: "РЕАЛЬНЫЙ ОПЫТ",
    sub: "Делись своей историей — помоги другим",
    bg: "linear-gradient(135deg,#84cc16 0%,#65a30d 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="em3-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="em3-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#em3-halo)" />
        {/* рука с большим пальцем вверх */}
        <g filter="url(#em3-glow)" opacity="0.4" fill="#ffffff">
          <path d="M28 38 L28 60 L34 60 L34 38 Z" />
          <path d="M34 38 L34 60 L46 60 Q52 60 52 54 L52 44 Q52 38 46 38 L34 38 Z" />
          <path d="M28 38 Q24 36 24 32 Q24 28 28 28 L28 38 Z" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M28 38 L28 60 L34 60 L34 38 Z" />
          <path d="M34 38 L34 60 L46 60 Q52 60 52 54 L52 44 Q52 38 46 38 L34 38 Z" />
          <path d="M28 38 Q24 36 24 32 Q24 28 28 28 L28 38 Z" />
        </g>
        {/* звёздочки-оценка */}
        <g fill="#8a5e3a">
          <path d="M40 16 L41.5 21 L46.5 21 L42.5 24 L44 29 L40 26 L36 29 L37.5 24 L33.5 21 L38.5 21 Z" />
        </g>
      </svg>
    ),
  },
];

function EmployersRotator({ onOpen }: { onOpen: () => void }) {
  const [slide, setSlide] = useState(() => Math.floor(Math.random() * EMP_ROT_SLIDES.length));
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pausedRef.current) setSlide((s) => { if (EMP_ROT_SLIDES.length <= 1) return s; let next; do { next = Math.floor(Math.random() * EMP_ROT_SLIDES.length); } while (next === s); return next; });
    }, EMP_ROT_MS);
    return () => window.clearInterval(id);
  }, []);

  const s = EMP_ROT_SLIDES[slide];
  return (
    <div
      className="biz-rot"
      style={{ background: s.bg }}
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
        onClick={onOpen}
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

/**
 * 2026-10-05: ротатор «Где купить» — три сменяющихся банера с надписями
 * НАШЕЛ ЧТО НУЖНО? / ЗДЕСЬ ПОДСКАЖУТ / ГДЕ ВЗЯТЬ НУЖНОЕ. Клик открывает
 * /gde-kupit.
 *
 * Цвета банеров (приглушённые градиенты):
 *   • НАШЕЛ ЧТО НУЖНО?  — оливково-хаки      #6e7a3a → #424a22
 *   • ЗДЕСЬ ПОДСКАЖУТ   — морской волны      #2c6a7a → #1a4050
 *   • ГДЕ ВЗЯТЬ НУЖНОЕ  — тёплый терракот     #a05840 → #6a3220
 */
const WTB_ROT_MS = 20000;

const WTB_ROT_SLIDES = [
  {
    key: "found-it",
    title: "НАШЕЛ ЧТО НУЖНО?",
    sub: "Поделись находкой с другими",
    bg: "linear-gradient(135deg,#84cc16 0%,#65a30d 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="wtb1-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="wtb1-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#wtb1-halo)" />
        {/* лупа поверх пакета-сумки */}
        <g filter="url(#wtb1-glow)" opacity="0.4" fill="#ffffff">
          <path d="M22 32 L50 32 L52 56 L20 56 Z" />
          <path d="M30 32 Q30 22 40 22 Q50 22 50 32" fill="none" stroke="#ffffff" strokeWidth="3.5" />
        </g>
        <g fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 32 L50 32 L52 56 L20 56 Z" fill="#ffffff" />
          <path d="M30 32 Q30 22 40 22 Q50 22 50 32" />
        </g>
        {/* лупа */}
        <circle cx="42" cy="42" r="9" fill="none" stroke="#6e7a3a" strokeWidth="3" />
        <line x1="49" y1="49" x2="56" y2="56" stroke="#6e7a3a" strokeWidth="3.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "ask-here",
    title: "ЗДЕСЬ ПОДСКАЖУТ",
    sub: "Спроси — жители острова знают",
    bg: "linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="wtb2-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="wtb2-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#wtb2-halo)" />
        {/* облачко с вопросительным знаком */}
        <g filter="url(#wtb2-glow)" opacity="0.4" fill="#ffffff">
          <path d="M16 28 Q16 18 26 18 L54 18 Q64 18 64 28 L64 42 Q64 52 54 52 L34 52 L24 60 L26 52 Q16 52 16 42 Z" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M16 28 Q16 18 26 18 L54 18 Q64 18 64 28 L64 42 Q64 52 54 52 L34 52 L24 60 L26 52 Q16 52 16 42 Z" />
        </g>
        {/* знак вопроса */}
        <text
          x="40"
          y="42"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="22"
          fontWeight="700"
          fill="#2c6a7a"
        >
          ?
        </text>
      </svg>
    ),
  },
  {
    key: "where-to-get",
    title: "ГДЕ ВЗЯТЬ НУЖНОЕ",
    sub: "Подсказки от тех, кто уже нашёл",
    bg: "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="wtb3-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="wtb3-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#wtb3-halo)" />
        {/* указатель-стрелка к локации */}
        <g filter="url(#wtb3-glow)" opacity="0.4" fill="#ffffff">
          <path d="M40 14 Q26 14 26 28 Q26 38 40 56 Q54 38 54 28 Q54 14 40 14 Z" />
          <circle cx="40" cy="28" r="6" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M40 14 Q26 14 26 28 Q26 38 40 56 Q54 38 54 28 Q54 14 40 14 Z" />
        </g>
        {/* внутренний круг — пин локации */}
        <circle cx="40" cy="28" r="6" fill="#a05840" />
        {/* стрелка-указатель */}
        <g fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 64 L26 64 L30 60" />
          <path d="M26 64 L22 60 M26 64 L22 68" />
        </g>
      </svg>
    ),
  },
];

function WhereToBuyRotator({ onOpen }: { onOpen: () => void }) {
  const [slide, setSlide] = useState(() => Math.floor(Math.random() * WTB_ROT_SLIDES.length));
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pausedRef.current) setSlide((s) => { if (WTB_ROT_SLIDES.length <= 1) return s; let next; do { next = Math.floor(Math.random() * WTB_ROT_SLIDES.length); } while (next === s); return next; });
    }, WTB_ROT_MS);
    return () => window.clearInterval(id);
  }, []);

  const s = WTB_ROT_SLIDES[slide];
  return (
    <div
      className="biz-rot"
      style={{ background: s.bg }}
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
        onClick={onOpen}
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

/**
 * 2026-10-05: ротатор «Где дешевле» — три сменяющихся банера с надписями
 * НЕ ПЕРЕПЛАЧИВАЙ / КУПИ ВЫГОДНЕЕ / ХОЧЕШЬ СЭКОНОМИТЬ?. Клик открывает
 * /gde-deshevle.
 *
 * Цвета банеров (приглушённые градиенты):
 *   • НЕ ПЕРЕПЛАЧИВАЙ     — лаймово-зелёный   #6a7a3a → #3a4222
 *   • КУПИ ВЫГОДНЕЕ        — изумрудно-хвойный #2a6a4a → #143a2a
 *   • ХОЧЕШЬ СЭКОНОМИТЬ?   — медно-янтарный    #8a5e3a → #5a3a22
 */
const WC_ROT_MS = 20000;

const WC_ROT_SLIDES = [
  {
    key: "no-overpay",
    title: "НЕ ПЕРЕПЛАЧИВАЙ",
    sub: "Узнай, где цена ниже",
    bg: "linear-gradient(135deg,#84cc16 0%,#65a30d 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="wc1-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="wc1-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#wc1-halo)" />
        {/* ценник с перечёркнутой высокой ценой */}
        <g filter="url(#wc1-glow)" opacity="0.4" fill="#ffffff">
          <path d="M22 18 L58 18 L58 62 L22 62 Z" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M22 18 L58 18 L58 62 L22 62 Z" />
        </g>
        {/* верёвочка ценника */}
        <line x1="30" y1="12" x2="30" y2="20" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
        <line x1="50" y1="12" x2="50" y2="20" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
        {/* старая цена — перечёркнутая */}
        <text
          x="40"
          y="38"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="14"
          fontWeight="700"
          fill="#6a7a3a"
          textDecoration="line-through"
        >
          999
        </text>
        {/* новая низкая цена */}
        <text
          x="40"
          y="56"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="18"
          fontWeight="700"
          fill="#6a7a3a"
        >
          199
        </text>
      </svg>
    ),
  },
  {
    key: "buy-better",
    title: "КУПИ ВЫГОДНЕЕ",
    sub: "Сравни цены в магазинах острова",
    bg: "linear-gradient(135deg,#22c55e 0%,#16a34a 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="wc2-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="wc2-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#wc2-halo)" />
        {/* две стрелки — сравнение (вверх-вниз) */}
        <g filter="url(#wc2-glow)" opacity="0.4" fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M28 56 L28 24 L20 32" />
          <path d="M52 24 L52 56 L60 48" />
        </g>
        <g fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M28 56 L28 24 L20 32" />
          <path d="M52 24 L52 56 L60 48" />
        </g>
        {/* монетка-рубль между стрелками */}
        <circle cx="40" cy="40" r="9" fill="#ffffff" stroke="#ffffff" strokeWidth="1.2" />
        <text
          x="40"
          y="46"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="14"
          fontWeight="700"
          fill="#2a6a4a"
        >
          ₽
        </text>
      </svg>
    ),
  },
  {
    key: "want-save",
    title: "ХОЧЕШЬ СЭКОНОМИТЬ?",
    sub: "Подскажем, где дешевле",
    bg: "linear-gradient(135deg,#84cc16 0%,#65a30d 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="wc3-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="wc3-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#wc3-halo)" />
        {/* кошелёк-портмоне с монеткой */}
        <g filter="url(#wc3-glow)" opacity="0.4" fill="#ffffff">
          <path d="M16 32 Q16 26 22 26 L58 26 Q64 26 64 32 L64 50 Q64 56 58 56 L22 56 Q16 56 16 50 Z" />
          <path d="M16 36 L64 36" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M16 32 Q16 26 22 26 L58 26 Q64 26 64 32 L64 50 Q64 56 58 56 L22 56 Q16 56 16 50 Z" />
        </g>
        {/* прорезь кошелька */}
        <rect x="46" y="32" width="14" height="3" rx="1" fill="#8a5e3a" />
        {/* монетка-рубль вылезает */}
        <circle cx="53" cy="46" r="6" fill="#8a5e3a" stroke="#ffffff" strokeWidth="1.2" />
        <text
          x="53"
          y="50"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="10"
          fontWeight="700"
          fill="#ffffff"
        >
          ₽
        </text>
        {/* искорки-звёздочки — символ выгоды */}
        <g fill="#ffffff">
          <path d="M22 22 L23 25 L26 25 L23.5 27 L24.5 30 L22 28 L19.5 30 L20.5 27 L18 25 L21 25 Z" opacity="0.9" />
          <path d="M62 60 L62.5 62 L64 62 L63 63 L63.5 64.5 L62 64 L60.5 64.5 L61 63 L60 62 L61.5 62 Z" opacity="0.7" />
        </g>
      </svg>
    ),
  },
];

function WhereCheaperRotator({ onOpen }: { onOpen: () => void }) {
  const [slide, setSlide] = useState(() => Math.floor(Math.random() * WC_ROT_SLIDES.length));
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pausedRef.current) setSlide((s) => { if (WC_ROT_SLIDES.length <= 1) return s; let next; do { next = Math.floor(Math.random() * WC_ROT_SLIDES.length); } while (next === s); return next; });
    }, WC_ROT_MS);
    return () => window.clearInterval(id);
  }, []);

  const s = WC_ROT_SLIDES[slide];
  return (
    <div
      className="biz-rot"
      style={{ background: s.bg }}
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
        onClick={onOpen}
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

/**
 * 2026-10-05: ротатор «Рекомендую / Не рекомендую» — три банера с надписями
 * ПРОВЕРЕНО ЛЮДЬМИ / СТОИТ ИЛИ НЕТ? / БЫЛ — РАССКАЖИ. Клик открывает /rekomenduyu.
 *
 * Цвета банеров (приглушённые градиенты):
 *   • ПРОВЕРЕНО ЛЮДЬМИ  — небесно-васильковый  #3a6a9e → #1f3a5f
 *   • СТОИТ ИЛИ НЕТ?     — сливово-винный       #6e3a5a → #42223a
 *   • БЫЛ — РАССКАЖИ     — охра-табачный          #8a5e3a → #5a3a22
 */
const REC_ROT_MS = 20000;

const REC_ROT_SLIDES = [
  {
    key: "verified",
    title: "ПРОВЕРЕНО ЛЮДЬМИ",
    sub: "Реальные отзывы сахалинцев",
    bg: "linear-gradient(135deg,#f97316 0%,#ea580c 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="rec1-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="rec1-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#rec1-halo)" />
        {/* щит-печать с галочкой */}
        <g filter="url(#rec1-glow)" opacity="0.4" fill="#ffffff">
          <path d="M40 14 L60 22 L60 40 Q60 56 40 64 Q20 56 20 40 L20 22 Z" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M40 14 L60 22 L60 40 Q60 56 40 64 Q20 56 20 40 L20 22 Z" />
        </g>
        {/* галочка-проверка */}
        <path
          d="M30 38 L37 45 L52 30"
          fill="none"
          stroke="#3a6a9e"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: "worth-or-not",
    title: "СТОИТ ИЛИ НЕТ?",
    sub: "Узнай мнение других перед выбором",
    bg: "linear-gradient(135deg,#ec4899 0%,#be185d 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="rec2-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="rec2-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#rec2-halo)" />
        {/* знак вопроса в круге */}
        <g filter="url(#rec2-glow)" opacity="0.4" fill="#ffffff">
          <circle cx="40" cy="40" r="26" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4">
          <circle cx="40" cy="40" r="26" />
        </g>
        {/* знак вопроса */}
        <text
          x="40"
          y="52"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="34"
          fontWeight="700"
          fill="#6e3a5a"
        >
          ?
        </text>
      </svg>
    ),
  },
  {
    key: "share-experience",
    title: "БЫЛ — РАССКАЖИ",
    sub: "Поделись своим опытом",
    bg: "linear-gradient(135deg,#84cc16 0%,#65a30d 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="rec3-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="rec3-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#rec3-halo)" />
        {/* облачко-чат с тремя точками */}
        <g filter="url(#rec3-glow)" opacity="0.4" fill="#ffffff">
          <path d="M14 24 Q14 16 22 16 L58 16 Q66 16 66 24 L66 42 Q66 50 58 50 L40 50 L30 60 L32 50 Q14 50 14 42 Z" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M14 24 Q14 16 22 16 L58 16 Q66 16 66 24 L66 42 Q66 50 58 50 L40 50 L30 60 L32 50 Q14 50 14 42 Z" />
        </g>
        {/* три точки — символ сообщения */}
        <g fill="#8a5e3a">
          <circle cx="28" cy="33" r="2.6" />
          <circle cx="40" cy="33" r="2.6" />
          <circle cx="52" cy="33" r="2.6" />
        </g>
      </svg>
    ),
  },
];

function RecommendRotator({ onOpen }: { onOpen: () => void }) {
  const [slide, setSlide] = useState(() => Math.floor(Math.random() * REC_ROT_SLIDES.length));
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pausedRef.current) setSlide((s) => { if (REC_ROT_SLIDES.length <= 1) return s; let next; do { next = Math.floor(Math.random() * REC_ROT_SLIDES.length); } while (next === s); return next; });
    }, REC_ROT_MS);
    return () => window.clearInterval(id);
  }, []);

  const s = REC_ROT_SLIDES[slide];
  return (
    <div
      className="biz-rot"
      style={{ background: s.bg }}
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
        onClick={onOpen}
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

/**
 * 2026-10-05: ротатор «Нужна помощь» — три банера с надписями
 * ПОМОГИ ИЛИ ПОПРОСИ / ПОМОЩЬ РЯДОМ / ПОМОГАЕМ ДРУГ ДРУГУ. Клик открывает /help.
 *
 * Цвета банеров (приглушённые градиенты):
 *   • ПОМОГИ ИЛИ ПОПРОСИ  — кораллово-розовый  #b85a4a → #6e2a22
 *   • ПОМОЩЬ РЯДОМ         — тёплый оливковый   #6a7a3a → #3a4222
 *   • ПОМОГАЕМ ДРУГ ДРУГУ  — глубокий синий     #2d4a78 → #16284a
 */
const HELP_ROT_MS = 20000;

const HELP_ROT_SLIDES = [
  {
    key: "give-or-ask",
    title: "ПОМОГИ ИЛИ ПОПРОСИ",
    sub: "Тебе помогут — или помоги ты",
    bg: "linear-gradient(135deg,#eab308 0%,#a16207 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="hlp1-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="hlp1-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#hlp1-halo)" />
        {/* рука с ладонью вверх (дающая) */}
        <g filter="url(#hlp1-glow)" opacity="0.4" fill="#ffffff">
          <path d="M20 38 Q20 32 26 32 L38 32 L38 56 L26 56 Q20 56 20 50 Z" />
          <path d="M38 32 L50 32 Q56 32 56 38 L56 50 Q56 56 50 56 L38 56 Z" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M20 38 Q20 32 26 32 L38 32 L38 56 L26 56 Q20 56 20 50 Z" />
          <path d="M38 32 L50 32 Q56 32 56 38 L56 50 Q56 56 50 56 L38 56 Z" />
        </g>
        {/* сердце на ладони */}
        <path
          d="M40 28 Q38 24 34 24 Q30 24 30 28 Q30 32 40 38 Q50 32 50 28 Q50 24 46 24 Q42 24 40 28 Z"
          fill="#b85a4a"
          stroke="#ffffff"
          strokeWidth="0.8"
        />
      </svg>
    ),
  },
  {
    key: "nearby",
    title: "ПОМОЩЬ РЯДОМ",
    sub: "Соседи готовы откликнуться",
    bg: "linear-gradient(135deg,#84cc16 0%,#65a30d 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="hlp2-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="hlp2-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#hlp2-halo)" />
        {/* пин-локатор с сердцем внутри */}
        <g filter="url(#hlp2-glow)" opacity="0.4" fill="#ffffff">
          <path d="M40 14 Q26 14 26 28 Q26 38 40 56 Q54 38 54 28 Q54 14 40 14 Z" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M40 14 Q26 14 26 28 Q26 38 40 56 Q54 38 54 28 Q54 14 40 14 Z" />
        </g>
        {/* сердце внутри пина */}
        <path
          d="M40 22 Q37 18 33 18 Q29 18 29 23 Q29 28 40 36 Q51 28 51 23 Q51 18 47 18 Q43 18 40 22 Z"
          fill="#6a7a3a"
        />
      </svg>
    ),
  },
  {
    key: "together",
    title: "ПОМОГАЕМ ДРУГ ДРУГУ",
    sub: "Вместе справимся со всем",
    bg: "linear-gradient(135deg,#3b82f6 0%,#2563eb 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="hlp3-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="hlp3-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#hlp3-halo)" />
        {/* две руки в круге-союзе */}
        <g filter="url(#hlp3-glow)" opacity="0.4" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="40" cy="40" r="22" />
          <path d="M28 44 L34 44" />
          <path d="M46 44 L52 44" />
        </g>
        <g fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="40" cy="40" r="22" />
        </g>
        {/* две фигуры людей */}
        <g fill="#ffffff">
          <circle cx="32" cy="38" r="4.5" />
          <rect x="28" y="42" width="8" height="11" rx="2" />
          <circle cx="48" cy="38" r="4.5" />
          <rect x="44" y="42" width="8" height="11" rx="2" />
        </g>
        {/* соединяющее сердце в центре */}
        <path
          d="M40 34 Q37.5 30 34 30 Q31 30 31 34 Q31 38 40 44 Q49 38 49 34 Q49 30 46 30 Q42.5 30 40 34 Z"
          fill="#2d4a78"
        />
      </svg>
    ),
  },
];

function HelpRotator({ onOpen }: { onOpen: () => void }) {
  const [slide, setSlide] = useState(() => Math.floor(Math.random() * HELP_ROT_SLIDES.length));
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pausedRef.current) setSlide((s) => { if (HELP_ROT_SLIDES.length <= 1) return s; let next; do { next = Math.floor(Math.random() * HELP_ROT_SLIDES.length); } while (next === s); return next; });
    }, HELP_ROT_MS);
    return () => window.clearInterval(id);
  }, []);

  const s = HELP_ROT_SLIDES[slide];
  return (
    <div
      className="biz-rot"
      style={{ background: s.bg }}
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
        onClick={onOpen}
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

/**
 * 2026-10-05: ротатор «Исполнители» — три банера с надписями
 * ИЩЕШЬ МАСТЕРА? / СВОЙ ЧЕЛОВЕК / ОПЫТ + ОТЗЫВЫ. Клик открывает /obyavleniya.
 *
 * Цвета банеров (приглушённые градиенты):
 *   • ИЩЕШЬ МАСТЕРА?  — стальной индиго    #3a4a6e → #1f2a44
 *   • СВОЙ ЧЕЛОВЕК     — болотно-хвойный   #4a6e3a → #2a4222
 *   • ОПЫТ + ОТЗЫВЫ    — медно-коричневый  #8a5e3a → #5a3a22
 */
const CONTR_ROT_MS = 20000;

const CONTR_ROT_SLIDES = [
  {
    key: "find-master",
    title: "ИЩЕШЬ МАСТЕРА?",
    sub: "Сантехник, электрик, мастер на час",
    bg: "linear-gradient(135deg,#6366f1 0%,#4f46e5 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="ctr1-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="ctr1-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#ctr1-halo)" />
        {/* ключ-гаечный */}
        <g filter="url(#ctr1-glow)" opacity="0.4" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 58 L42 38" />
        </g>
        <g fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 58 L42 38" />
        </g>
        {/* головка ключа — кольцо с шестигранным гнездом */}
        <circle cx="50" cy="30" r="14" fill="#ffffff" stroke="#ffffff" strokeWidth="2" />
        <path
          d="M50 22 L57 26 L57 34 L50 38 L43 34 L43 26 Z"
          fill="#3a4a6e"
        />
        {/* искры-искры от работы */}
        <g fill="#ffffff">
          <circle cx="32" cy="48" r="1.4" />
          <circle cx="28" cy="52" r="1" opacity="0.7" />
          <circle cx="36" cy="44" r="1" opacity="0.7" />
        </g>
      </svg>
    ),
  },
  {
    key: "your-man",
    title: "СВОЙ ЧЕЛОВЕК",
    sub: "Знакомые мастера по рекомендации",
    bg: "linear-gradient(135deg,#22c55e 0%,#16a34a 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="ctr2-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="ctr2-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#ctr2-halo)" />
        {/* рука с большим пальцем вверх + галочка-«свой» */}
        <g filter="url(#ctr2-glow)" opacity="0.4" fill="#ffffff">
          <path d="M28 38 L28 60 L34 60 L34 38 Z" />
          <path d="M34 38 L34 60 L46 60 Q52 60 52 54 L52 44 Q52 38 46 38 L34 38 Z" />
          <path d="M28 38 Q24 36 24 32 Q24 28 28 28 L28 38 Z" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M28 38 L28 60 L34 60 L34 38 Z" />
          <path d="M34 38 L34 60 L46 60 Q52 60 52 54 L52 44 Q52 38 46 38 L34 38 Z" />
          <path d="M28 38 Q24 36 24 32 Q24 28 28 28 L28 38 Z" />
        </g>
        {/* галочка в кружке — символ проверки */}
        <circle cx="58" cy="22" r="9" fill="#4a6e3a" stroke="#ffffff" strokeWidth="1.8" />
        <path
          d="M53 22 L57 26 L63 18"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: "experience-reviews",
    title: "ОПЫТ + ОТЗЫВЫ",
    sub: "Реальные оценки от заказчиков",
    bg: "linear-gradient(135deg,#84cc16 0%,#65a30d 100%)",
    icon: (
      <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">
        <defs>
          <radialGradient id="ctr3-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="ctr3-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <circle cx="40" cy="40" r="34" fill="url(#ctr3-halo)" />
        {/* пять звёзд — рейтинг */}
        <g filter="url(#ctr3-glow)" opacity="0.4" fill="#ffffff">
          <path d="M40 16 L44 26 L54 27 L46 34 L49 44 L40 38 L31 44 L34 34 L26 27 L36 26 Z" />
        </g>
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.2" strokeLinejoin="round">
          <path d="M40 16 L44 26 L54 27 L46 34 L49 44 L40 38 L31 44 L34 34 L26 27 L36 26 Z" />
        </g>
        {/* полоса-прогресс оценки под звёздами */}
        <rect x="20" y="50" width="40" height="6" rx="1" fill="#ffffff" opacity="0.4" />
        <rect x="20" y="50" width="36" height="6" rx="1" fill="#ffffff" />
        {/* лента «проверено» под рейтингом */}
        <g fill="#ffffff">
          <path d="M20 60 L60 60 L60 68 L40 64 L20 68 Z" />
        </g>
        <text
          x="40"
          y="67"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="6.5"
          fontWeight="700"
          fill="#8a5e3a"
        >
          ✓ ОПЫТ
        </text>
      </svg>
    ),
  },
];

function ContractorsRotator({ onOpen }: { onOpen: () => void }) {
  const [slide, setSlide] = useState(() => Math.floor(Math.random() * CONTR_ROT_SLIDES.length));
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pausedRef.current) setSlide((s) => { if (CONTR_ROT_SLIDES.length <= 1) return s; let next; do { next = Math.floor(Math.random() * CONTR_ROT_SLIDES.length); } while (next === s); return next; });
    }, CONTR_ROT_MS);
    return () => window.clearInterval(id);
  }, []);

  const s = CONTR_ROT_SLIDES[slide];
  return (
    <div
      className="biz-rot"
      style={{ background: s.bg }}
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
        onClick={onOpen}
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
   * Алгоритм: каждый кадр requestAnimationFrame сдвигаем scrollTop на 0.1px
   * (~6px/сек при 60fps — плавно и без рывков; история:
   *   - 0.4px/кадр — изначальная версия
   *   - 0.2px/кадр — ТЗ 2026-09-25 «в 2 раза медленнее»
   *   - 0.1px/кадр — ТЗ 2026-09-27 «ещё в 2 раза медленнее»),
   * при достижении конца плавно возвращаемся в начало. Пауза по hover.
   */
  useEffect(() => {
    const el = overheardRef.current;
    if (!el) return;
    // Не запускаем, если публикаций нет — крутить нечего.
    if (!posts || posts.length === 0) return;

    let rafId = 0;
    // Накопитель дробных пикселей: 0.1px/кадр браузер округлит до 0,
    // поэтому копим доли пикселя в переменной и применяем целую часть.
    let fractionalPx = 0;
    const SCROLL_PER_FRAME = 0.1; // 0.1px/кадр → ~6px/сек при 60fps
    const onEnter = () => { overheardPausedRef.current = true; };
    const onLeave = () => { overheardPausedRef.current = false; };
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);

    const step = () => {
      if (!overheardPausedRef.current) {
        // Крутим только если контент реально длиннее контейнера.
        if (el.scrollHeight > el.clientHeight + 1) {
          // 0.1px/кадр (~6px/сек при 60fps — в 2 раза медленнее прежних 0.2px/кадр).
          // Накапливаем дробную часть: browsers округляют scrollTop до int,
          // поэтому 0.1 + 0.1 + 0.1 + ... + 0.1 (10 раз) = 1px — применяем раз в 10 кадров.
          fractionalPx += SCROLL_PER_FRAME;
          if (fractionalPx >= 1) {
            const toAdd = Math.floor(fractionalPx);
            el.scrollTop += toAdd;
            fractionalPx -= toAdd;
          }
          // Достигли низа (с допуском в 1px) — мягко возвращаемся в начало.
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
            el.scrollTop = 0;
            fractionalPx = 0;
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

    /** Видимое число строк в окне блока.
     *  ТЗ 2026-09-27: было 5 → 3 → теперь 2 (заказчик попросил ещё
     *  вдвое меньше). Минимум для читаемости — 2 публикации одновременно. */
    const VISIBLE_ROWS = 2;

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
        2026-10-02 (мобайл): отступ от голубой шапки (sk-topbar) делается
        глобально через globals.css: .sk-topbar + * — действует на всех
        страницах сайта, не только на главной.
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
              // ТЗ 2026-10-04: клик по публикации ведёт на отдельную
              // страницу /podslyshano — полную ленту всех сообщений.
              const href = "/podslyshano";
              // ТЗ 2026-10-04: метки публикаций.
              const tagIcon =
                p.tag === "rumor" ? "⚠" :
                p.tag === "observation" ? "👁" : "ℹ";
              const tagLabel =
                p.tag === "rumor" ? "СЛУХИ И МОЛВА" :
                p.tag === "observation" ? "НАБЛЮДЕНИЕ ЖИТЕЛЯ" :
                "СООБЩЕНИЕ ЖИТЕЛЯ";
              return (
                <div key={p.id} className="mp-trow mp-oh-row">
                  <span className="mp-oh-meta">
                    <span className="mp-oh-date">{fmtDayTime(p.createdAt)}</span>
                    <span className={`mp-oh-tag mp-oh-tag-${p.tag || "message"}`}>
                      {tagIcon} {tagLabel}
                    </span>
                  </span>
                  <a className="mp-ttext mp-oh-text" href={href} title={p.title}>
                    {p.title}
                  </a>
                  {p.tag === "rumor" && (
                    <span className="mp-oh-warn">Информация не является официально подтверждённой и может содержать неточности.</span>
                  )}
                </div>
              );
            })
          )}
        </div>
        <a className="mp-oh-alllink" href="/podslyshano">Все сообщения →</a>
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
              <c.icon size={14} strokeWidth={2.4} aria-hidden="true" />
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
            ) : c.title === BIZ_CELL_TITLE ? (
              <BizRotator onOpenStartup={openStartup} onOpenRegister={props.onOpenRegister} />
            ) : c.title === "Знакомства" ? (
              <DatingRotator onOpen={() => { window.location.href = c.href; }} />
            ) : c.title === "Объявления" ? (
              <AdsRotator onOpen={() => { window.location.href = c.href; }} />
            ) : c.title === "ЖКХ и городские проблемы" ? (
              <GkhRotator onOpen={() => { window.location.href = c.href; }} />
            ) : c.title === "О работодателях" ? (
              <EmployersRotator onOpen={() => { window.location.href = c.href; }} />
            ) : c.title === "Где купить" ? (
              <WhereToBuyRotator onOpen={() => { window.location.href = c.href; }} />
            ) : c.title === "Где дешевле" ? (
              <WhereCheaperRotator onOpen={() => { window.location.href = c.href; }} />
            ) : c.title === "Рекомендую / Не рекомендую" ? (
              <RecommendRotator onOpen={() => { window.location.href = c.href; }} />
            ) : c.title === "Нужна помощь" ? (
              <HelpRotator onOpen={() => { window.location.href = c.href; }} />
            ) : c.title === "Исполнители" ? (
              <ContractorsRotator onOpen={() => { window.location.href = c.href; }} />
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
