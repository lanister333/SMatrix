"use client";

/**
 * ШАГ 16 (исправление): общий «каркас» проекта SakhMatrix.
 * Шапка (Masthead), главная синяя навигация (MainNav) и авторизация (useAuth)
 * — общие для форума (/) и самостоятельной страницы «Нужна помощь» (/help).
 * Раньше эти компоненты жили в src/app/page.tsx; вынесены, чтобы /help
 * был действительно отдельной страницей в том же стиле, а не вкладкой форума.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { AUTH_KEY, type ForumUser } from "@/lib/ui";
import { AuthModal } from "@/components/forum/modals";
import VolunteersCarousel from "@/components/site/volunteers-carousel";

/** ШАГ 12: настройки сайта из /api/bootstrap (шапка и подвал). */
export interface SiteSettings {
  siteSlogan: string;
  siteSubtitle: string;
  siteDescription: string;
  footerNote: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  siteSlogan: "Спроси у города — город ответит.",
  siteSubtitle: "Сахалинская матрица взаимопомощи",
  siteDescription:
    "Независимый форум-портал для жителей острова: советы, рекомендации мастеров, дороги, рыбалка и жизнь Сахалина. Спроси — и город ответит.",
  footerNote: "Спроси у города — город ответит.",
};

/** ШАГ 12: сотрудник проекта (владелец или модератор). */
export function isStaffRole(role?: string): boolean {
  return role === "owner" || role === "admin" || role === "moderator";
}

/** ШАГ 27: размеры иконки поиска в навигации. */
const NAV_SEARCH_ICON = 14;

export function Masthead(props: { settings: SiteSettings }) {
  // ТЗ 2026-09-21: borderBottom 2px убран из inline — на десктопе он был
  // невидим (navy на navy-полосе .sm-mainnav) и ломал равенство полосок
  // активной кнопки; для мобайла (≤480px, полоса скрыта) полоска вернута
  // правилом .sm-masthead в существующем @media-блоке globals.css
  return (
    <header
      className="w-full sm-masthead"
      /* ТЗ 2026-09-21 «шапку сайта окрась в цвет как у блока поддержка
         молодого бизнеса» + «шапку сделай светлее»: та же бирюзово-
         изумрудная гамма, что у плашки ротатора .biz-rot главной
         (radial-блик 16% 0% + linear 150deg), но все три стопа подняты
         по светлоте ~на 8-9 пунктов: #14b09d (L38%) → #0d8476 (L28%)
         → #085951 (L19%) против блочных #0c9484 → #075e55 → #033a34
         (L31/20/12%) — шапка читается заметно светлее, белый текст и
         логотип сохраняют контраст. Прежняя var(--sm-turquoise-vivid)
         #00b3a4 из ТЗ «шапку бирюзовую сделай темнее» заменена; сама
         переменная остаётся для мелких акцентов (активная кнопка и пр.).
         Указ 2026-09-22 «шапку бирюзового цвета сделай немного светлее»:
         ещё +4.6-4.9 пункта светлоты по всем трём стопам (вдвое меньше
         прошлого шага — «немного»), тон и насыщенность сохранены
         (scripts/header-color-shift.mjs): #14b09d (L38%) → #16c5b0 (L43%),
         #0d8476 (L28%) → #0f9989 (L33%), #085951 (L19%) → #0a7066 (L24%). */
      style={{
        background:
          "radial-gradient(130% 150% at 16% 0%,rgba(255,255,255,0.16) 0%,rgba(255,255,255,0) 44%),linear-gradient(150deg,#16c5b0 0%,#0f9989 46%,#0a7066 100%)",
      }}
    >
      {/* ЗАДАЧА 14 (рестайл ПК), Шаг 1.2: слоган (.header-slogan) и правый
          блок призыва (.header-appeal: подзаголовок + описание) перекрашены
          из тёмно-синего в чистый белый (Tailwind-класс white) для контраста
          на бирюзовом фоне.
          ШАГ 13: логотип SakhMatrix крупнее и с большим наклоном (см. .sm-masthead-title в globals.css).
          ШАГ 15: шапка компактнее — меньше вертикальных отступов и межстрочных расстояний, логотип сильнее вытянут.
          ЗАДАЧА 2 (эстетика): асимметричный маржин-топ md:mt-6px убран; логотип несёт
          класс .header-logo с симметричными вертикальными отступами
          padding-top/padding-bottom 6px/6px (globals.css, медиа ≥768px),
          чтобы встать по центру бирюзовой плашки; вертикальные отступы
          плашки (md:py-3 = 12px/12px) остаются строго симметричными.
          Мобайл (≤767px) не затронут.
          ЗАДАЧА 2 (эстетика): правый блок лозунга (.sm-mh-side: подзаголовок
          «Сахалинская матрица взаимопомощи» + описание) принудительно белый —
          color:#FFFFFF !important (globals.css).
          Шаг 1 (рестайл ПК-версии): логотип (.header-logo) приспущен на 2px
          ниже, ближе к лозунгу — .header-logo{position:relative;top:2px}
          (globals.css, медиа ≥768px); симметричные паддинги 6px/6px и
          отступы плашки md:py-3 = 12px/12px сохранены без изменений.
          Шаг 1.2 (рестайл ПК-версии): слоган несёт ТЗ-селектор .header-slogan,
          правый блок — .header-appeal; оба — чистый белый #FFFFFF
          (globals.css).
          СТАДИЯ 1/Шаг 3 (мобайл ≤480px): классы sm-mh-wrap/sm-mh-main/sm-mh-side — крючки для
          однокомпонентной шапки ≤60px; кнопка ☰ Меню открывает шторку через событие
          sm-toggle-mobile-menu (слушает MainNav). На десктопе кнопка скрыта media-запросом (min-width:481px) —
          ПК-версию правки не затрагивают. */}
      <div className="sm-mh-wrap mx-auto flex max-w-[1280px] flex-col gap-0 px-3 py-2 md:flex-row md:items-center md:justify-between md:gap-6 md:px-4 md:py-3">
        <div className="sm-mh-main min-w-0">
          {/* Десктоп: кнопка ☰ внутри бирюзовой шапки (как было). Мобайл:
              дублирующая кнопка в .sm-mh-mobile-bar ниже — здесь скрываем. */}
          <button
            type="button"
            className="sm-mh-burger sm-mh-burger-in-header"
            aria-label="Открыть меню разделов"
            onClick={() => window.dispatchEvent(new CustomEvent("sm-toggle-mobile-menu"))}
          >
            ☰ Разделы портала
          </button>
          {/* Логотип — ссылка на главную (href="/") по ТЗ страниц-заглушек:
              стандартная шапка с логотипом, ведущим на главную. Обёртка без
              собственных стилей (preflight: color/text-decoration наследуются,
              display:block повторяет прежний блочный бокс h1) — вид шапки
              на ПК пиксельно не меняется. */}
          {/* ЗАДАЧА 2 (эстетика): асимметричный маржин-топ заменён на класс .header-logo —
              симметричные вертикальные паддинги 6px/6px (медиа ≥768px,
              мобайл не тронут). */}
          <a href="/" className="header-logo block" aria-label="SakhMatrix — на главную">
            <h1 className="sm-masthead-title text-[42px] min-[420px]:text-[50px] min-[560px]:text-[56px] md:text-[64px] xl:text-[86px]" itemProp="name">
              <span className="sm-masthead-sakh">
                S<span className="sm-masthead-low">akh</span>
              </span>
              <span className="sm-masthead-matrix">
                M<span className="sm-masthead-low">atrix</span>
              </span>
            </h1>
          </a>
          {/* ШАГ 12: слоган в общем шрифте сайта (Arial/Helvetica), без курсива; цвет затемнён.
              ШАГ 15: компактнее — меньше отступ сверху и размер.
              Шаг 1.2 (рестайл ПК): ТЗ-селектор .header-slogan — цвет строго
              чистый белый (#FFFFFF, globals.css) на бирюзовом фоне.
              Директива «Центрирование лозунга»: убраны Tailwind-классы
              mt-0.5 / md:mt-1 — они давали визуальный отступ сверху и смещали
              текст вниз; центрирование теперь через CSS .header-slogan
              (margin:0;padding:0; line-height:50px) в globals.css — текст
              стоит идеально по центру бирюзовой плашки. */}
          <p className="header-slogan text-[13px] font-semibold leading-tight tracking-wide text-white md:text-[15px] xl:text-[16px]">
            {props.settings?.siteSlogan ?? DEFAULT_SETTINGS.siteSlogan}
          </p>
        </div>
        <div className="sm-mh-side header-appeal shrink-0 text-left md:max-w-[380px] md:text-right">
          <div className="text-[12px] font-bold uppercase leading-tight tracking-wide text-white md:text-[13.5px] xl:text-[15px]">
            {props.settings?.siteSubtitle ?? DEFAULT_SETTINGS.siteSubtitle}
          </div>
          <p className="mt-0.5 text-[11.5px] font-medium leading-snug text-white md:mt-0.5 md:text-[12.5px] max-[640px]:hidden">
            {props.settings?.siteDescription ?? DEFAULT_SETTINGS.siteDescription}
          </p>
        </div>
      </div>
    </header>
  );
}

/** СТАДИЯ 2 (директива «Очистка навигации»): из левой части синей
 *  панели УДАЛЕНЫ 3 пункта, которые перегружали экран и дублировали
 *  логику меню «Ещё» — «Практическая информация», «Справочник»,
 *  «Полезное». В левой части осталось строго 4 пункта: Главная,
 *  Форум, Объявления, Ещё ▾ (с выпадающим списком NAV_MORE).
 *  ТЗ 2026-09-21: «Полезное» ВЕРНУТО отдельной кнопкой с выпадающим
 *  меню сервисных страниц (NAV_USEFUL: погода / курс валют /
 *  отключения / пробки) — см. ниже. */
const NAV_MAIN = [
  { key: "home", label: "Главная" },
  { key: "forum", label: "Форум" },
  { key: "ads", label: "Объявления" },
];

/** Директива «Чистка навигации» (задача nav-cleanup-2026-09-18):
 *  меню «Ещё» (ПК-дропдаун И мобильная шторка-аккордеон) — СТРОГО 3 пункта,
 *  обычные ссылки на самостоятельные страницы (роуты rules.php /
 *  feedback.php / about.php). Все сторонние рубрики («Подслушано Сахалин»,
 *  «Где купить», «Где дешевле», «Рекомендую / Не рекомендую»,
 *  «О работодателях», «ЖКХ и городские проблемы», «Нужна помощь»,
 *  «Знакомства», «Админ-раздел») из меню УДАЛЕНЫ без остатка;
 *  рубрики (кроме «Знакомств») перенесены в левую колонку — карточка
 *  «Обсудить на форуме» (DISCUSS_RUBRICS в src/components/site/left-nav.tsx).
 *  Один источник NAV_MORE для ПК и мобилки — интерфейс монолитен,
 *  дублирование списков исключено. */
const NAV_MORE = [
  { label: "Правила форума", href: "/rules.php" },
  { label: "Обращение к администратору", href: "/feedback.php" },
  { label: "О проекте", href: "/about.php" },
];

/** ТЗ 2026-09-21: кнопка «Полезное» в синей полосе — выпадающее меню
 *  сервисных страниц (погода / курс валют / отключения / пробки).
 *  Один источник для ПК-дропдауна и мобильной шторки — как у NAV_MORE;
 *  подсветка активной кнопки — по реальному адресу (роуты *.php).
 *  ТЗ 2026-09-21 (доработка): раздел «Новый бизнес Сахалина»
 *  (/startup.php) в меню «Полезное» НЕ входит — он открывается кликом
 *  по баннеру «Поддержка молодого бизнеса» в нижней сетке Главной
 *  (см. home-center.tsx). */
const NAV_USEFUL = [
  { label: "Погода", href: "/weather.php" },
  { label: "Курс валют", href: "/currency.php" },
  { label: "Отключения", href: "/disconnections.php" },
  { label: "Пробки", href: "/traffic.php" },
  // 2026-10-01: добавлен раздел «Транспорт» — расписание авиа/вода/ЖД.
  { label: "Транспорт", href: "/transport.php" },
];

/**
 * ШАГ 27 (макет главной): единая тёмно-синяя навигационная полоса —
 * пункты, ЕДИНСТВЕННОЕ окно поиска «Поиск по форуму...» и справа
 * «Войти» / «Зарегистрироваться» (гостю) или ник + «выйти».
 * Навигация самодостаточна по авторизации (свой useAuth + AuthModal):
 * на самостоятельных страницах (/help, /podslyshano, …) вход из навигации
 * работает без правок этих экранов — после входа/выхода делается перезагрузка,
 * если экран не передал свои обработчики onLogin/onLogout.
 */
export function MainNav(props: {
  current: string;
  isAdmin: boolean;
  onNavigate: (k: string) => void;
  /** ШАГ 27: SPA-переход к результатам поиска (по умолчанию — переход на /?view=search&q=…). */
  onSearch?: (q: string) => void;
  /** ШАГ 27: открыть профиль (по умолчанию — переход на /?user=Ник). */
  onOpenProfile?: (nick: string) => void;
  /** ШАГ 27: синхронизация состояния входа экрана после входа в навигации. */
  onLogin?: (token: string, user: ForumUser) => void;
  /** ШАГ 27: синхронизация состояния выхода экрана после выхода в навигации. */
  onLogout?: () => void;
}) {
  const { current, isAdmin, onNavigate } = props;
  // Директива «Чистка навигации»: подсветка активного пункта «Ещё» — по
  // реальному адресу страницы (роуты *.php), а не по SPA-ключу вида.
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // ТЗ 2026-09-21: дропдаун кнопки «Полезное» (ПК) + аккордеон в шторке (мобайл)
  const [usefulOpen, setUsefulOpen] = useState(false);
  const [mUseful, setMUseful] = useState(false);
  const usefulRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  // СТАДИЯ 1/Шаги 3-4 (мобайл ≤480px): левая выдвижная шторка-гамбургер.
  // Кнопка ☰ Меню живёт в Masthead и сообщает о тапе событием sm-toggle-mobile-menu;
  // mMore — аккордеон «Ещё» внутри шторки (вместо десктопного absolute-списка).
  const [mOpen, setMOpen] = useState(false);
  const [mMore, setMMore] = useState(false);
  const auth = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t)) setOpen(false);
      // ТЗ 2026-09-21: клик вне «Полезного» закрывает его дропдаун
      if (usefulRef.current && !usefulRef.current.contains(t)) setUsefulOpen(false);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);
  useEffect(() => {
    const toggle = () => setMOpen((v) => !v);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMOpen(false);
    };
    window.addEventListener("sm-toggle-mobile-menu", toggle);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("sm-toggle-mobile-menu", toggle);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  const moreActive = NAV_MORE.some((m) => m.href === pathname);
  // ТЗ 2026-09-21: «Полезное» подсвечивается на сервисных страницах —
  // тот же механизм, что у «Ещё» (по реальному адресу, не по SPA-ключу)
  const usefulActive = NAV_USEFUL.some((m) => m.href === pathname);

  const submitSearch = () => {
    const query = q.trim();
    if (query.length < 2) return;
    if (props.onSearch) props.onSearch(query);
    else window.location.href = `/?view=search&q=${encodeURIComponent(query)}`;
  };
  const openAuth = (tab: "login" | "register") => {
    setAuthTab(tab);
    setAuthOpen(true);
  };
  const handleLogin = (t: string, u: ForumUser) => {
    auth.login(t, u);
    if (props.onLogin) props.onLogin(t, u);
    else window.setTimeout(() => window.location.reload(), 50);
  };
  const handleLogout = () => {
    auth.logout();
    if (props.onLogout) props.onLogout();
    else window.setTimeout(() => window.location.reload(), 50);
  };
  const openProfile = (nick: string) => {
    if (props.onOpenProfile) props.onOpenProfile(nick);
    // 2026-10-01: отдельная страница профиля /user/[nick] (прежде SPA-вид ?user=).
    else window.location.href = `/user/${encodeURIComponent(nick)}`;
  };

  return (
    <>
      {/* 2026-10-01 (только мобайл ≤480px): синяя полоса ПОД бирюзовой шапкой
          с кнопкой ☰ Разделы портала (слева) и кнопками «Войти» /
          «Зарегистрироваться» (справа, для гостя), либо «никнейм — профиль» +
          «выйти» (для залогиненного). На десктопе блок скрыт через
          @media (min-width:481px){.sm-mh-mobile-bar{display:none !important}}.
          Логика авторизации (useAuth, openAuth, handleLogin, handleLogout)
          общая с десктопной навигацией ниже — единственный источник правды. */}
      <div className="sm-mh-mobile-bar">
        <button
          type="button"
          className="sm-mh-burger sm-mh-burger-in-bar"
          aria-label="Открыть меню разделов"
          onClick={() => window.dispatchEvent(new CustomEvent("sm-toggle-mobile-menu"))}
        >
          ☰ Разделы портала
        </button>
        <div className="sm-mh-mobile-auth">
          {auth.user ? (
            <>
              <button
                type="button"
                className="sm-mh-mobile-authbtn sm-mh-mobile-nick"
                title="Ваш профиль"
                onClick={() => openProfile(auth.user!.nickname)}
              >
                <span style={{ color: "#f59e0b" }}>👤</span> {auth.user.nickname}
              </button>
              <button
                type="button"
                className="sm-mh-mobile-authbtn sm-mh-mobile-out"
                onClick={handleLogout}
              >
                выйти
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="sm-mh-mobile-authbtn sm-mh-mobile-login"
                onClick={() => openAuth("login")}
              >
                Войти
              </button>
              <button
                type="button"
                className="sm-mh-mobile-authbtn sm-mh-mobile-register"
                onClick={() => openAuth("register")}
              >
                Регистрация
              </button>
            </>
          )}
        </div>
      </div>

      <nav className="sm-mainnav w-full" aria-label="Главная навигация портала">
      {/* ШАГ 13: навигация переносами — никаких горизонтальных прокруток;
          ШАГ 27: справа — поиск (единственный на странице) и вход/регистрация */}
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-stretch px-0">
        {NAV_MAIN.map((m) => (
          <button key={m.key} className={`sm-mainnav-link ${current === m.key ? "active" : ""}`} onClick={() => onNavigate(m.key)}>
            {m.label}
          </button>
        ))}
        {/* ТЗ 2026-09-21: кнопка «Полезное» с выпадающим меню сервисных
            страниц (погода / курс валют / отключения / пробки); открытие
            закрывает соседний дропдаун «Ещё» — открытым остаётся один */}
        <div className="relative" ref={usefulRef}>
          <button
            className={`sm-mainnav-link ${usefulActive ? "active" : ""}`}
            onClick={() => {
              setUsefulOpen((v) => !v);
              setOpen(false);
            }}
            aria-expanded={usefulOpen}
            aria-haspopup="menu"
          >
            Полезное <span aria-hidden="true">▾</span>
          </button>
          {usefulOpen && (
            <div role="menu" className="absolute left-0 z-50 min-w-[240px] border-2 border-[#1E3A5F] bg-white shadow-lg">
              {NAV_USEFUL.map((m) => (
                <a
                  key={m.href}
                  role="menuitem"
                  href={m.href}
                  className="block w-full px-4 py-2.5 text-left text-[15px] font-semibold text-[#1E3A5F] hover:bg-[#EEF3F8]"
                >
                  {m.label}
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="relative" ref={ref}>
          <button
            className={`sm-mainnav-link ${moreActive ? "active" : ""} border-r-0`}
            onClick={() => {
              setOpen((v) => !v);
              setUsefulOpen(false);
            }}
            aria-expanded={open}
            aria-haspopup="menu"
          >
            Ещё <span aria-hidden="true">▾</span>
          </button>
          {open && (
            <div role="menu" className="absolute right-0 z-50 min-w-[280px] border-2 border-[#1E3A5F] bg-white shadow-lg">
              {NAV_MORE.map((m) => (
                <a
                  key={m.href}
                  role="menuitem"
                  href={m.href}
                  className="block w-full px-4 py-2.5 text-left text-[15px] font-semibold text-[#1E3A5F] hover:bg-[#EEF3F8]"
                >
                  {m.label}
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="sm-nav-right">
          <form
            className="sm-nav-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
          >
            <input
              id="sm-nav-search"
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по форуму..."
              aria-label="Поиск по форуму"
            />
            <button type="submit" aria-label="Найти">
              <Search size={NAV_SEARCH_ICON} strokeWidth={2.5} />
            </button>
          </form>
          {auth.user ? (
            <>
              <button className="sm-mainnav-link sm-nav-nick" title="Ваш профиль" onClick={() => openProfile(auth.user!.nickname)}>
                <span style={{ color: "#f59e0b" }}>👤</span> {auth.user.nickname}
              </button>
              <button className="sm-mainnav-link sm-nav-out border-r-0" onClick={handleLogout}>
                выйти
              </button>
            </>
          ) : (
            <>
              <button className="sm-mainnav-link" onClick={() => openAuth("login")}>
                Войти
              </button>
              <button className="sm-mainnav-link border-r-0" onClick={() => openAuth("register")}>
                Зарегистрироваться
              </button>
            </>
          )}
        </div>
      </div>
      </nav>
      {/* СТАДИЯ 1/Шаги 3-4 (только ≤480px, см. CSS): левая шторка — все навигационные
          ссылки и кнопки «Войти»/«Зарегистрироваться»; подпункты «Ещё» — аккордеоном,
          без десктопного position:absolute. Монтируется только в открытом состоянии.
          ВАЖНО: шторка и AuthModal — СОСЕДИ <nav> вне его (на мобиле nav скрыт
          display:none, а вложенные в него элементы не отображаются). */}
      {authOpen && <AuthModal initialTab={authTab} onClose={() => setAuthOpen(false)} onLogin={handleLogin} />}
      {mOpen && (
        <>
          <div className="sm-mdrawer-backdrop" onClick={() => setMOpen(false)} />
          <aside id="sm-mdrawer" className="sm-mdrawer" aria-label="Меню разделов">
            <div className="sm-mdrawer-head">
              <span className="sm-mdrawer-title">Меню</span>
              <button type="button" className="sm-mdrawer-close" aria-label="Закрыть меню" onClick={() => setMOpen(false)}>
                ✕
              </button>
            </div>
            <div className="sm-mdrawer-nav">
              {NAV_MAIN.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={`sm-mdrawer-link ${current === m.key ? "active" : ""}`}
                  onClick={() => {
                    setMOpen(false);
                    onNavigate(m.key);
                  }}
                >
                  {m.label}
                </button>
              ))}
              <button
                type="button"
                className={`sm-mdrawer-link sm-mdrawer-more ${usefulActive ? "active" : ""}`}
                aria-expanded={mUseful}
                onClick={() => setMUseful((v) => !v)}
              >
                Полезное <span aria-hidden="true">{mUseful ? "▴" : "▾"}</span>
              </button>
              {mUseful &&
                NAV_USEFUL.map((m) => (
                  <a
                    key={m.href}
                    href={m.href}
                    className={`sm-mdrawer-link sm-mdrawer-sub ${pathname === m.href ? "active" : ""}`}
                  >
                    {m.label}
                  </a>
                ))}
              <button
                type="button"
                className={`sm-mdrawer-link sm-mdrawer-more ${moreActive ? "active" : ""}`}
                aria-expanded={mMore}
                onClick={() => setMMore((v) => !v)}
              >
                Ещё <span aria-hidden="true">{mMore ? "▴" : "▾"}</span>
              </button>
              {mMore &&
                NAV_MORE.map((m) => (
                  <a
                    key={m.href}
                    href={m.href}
                    className={`sm-mdrawer-link sm-mdrawer-sub ${pathname === m.href ? "active" : ""}`}
                  >
                    {m.label}
                  </a>
                ))}
            </div>
            <div className="sm-mdrawer-auth">
              {auth.user ? (
                <>
                  <button
                    type="button"
                    className="sm-mdrawer-authbtn"
                    title="Ваш профиль"
                    onClick={() => {
                      setMOpen(false);
                      openProfile(auth.user!.nickname);
                    }}
                  >
                    <span style={{ color: "#f59e0b" }}>👤</span> Мой профиль ({auth.user.nickname})
                  </button>
                  <button
                    type="button"
                    className="sm-mdrawer-authbtn"
                    onClick={() => {
                      setMOpen(false);
                      handleLogout();
                    }}
                  >
                    выйти
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="sm-mdrawer-authbtn"
                    onClick={() => {
                      setMOpen(false);
                      openAuth("login");
                    }}
                  >
                    Войти
                  </button>
                  <button
                    type="button"
                    className="sm-mdrawer-authbtn"
                    onClick={() => {
                      setMOpen(false);
                      openAuth("register");
                    }}
                  >
                    Зарегистрироваться
                  </button>
                </>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}

/**
 * Шаг «Единый футер как на Главной» (указ заказчика): футер — один и тот же
 * на ВСЕХ страницах проекта, того же размера и состава, что на Главной:
 * строка ссылок (.mp-footer-links), сведения о проекте + дисклеймер
 * (.mp-footer-info), версия. На Главной (/) ссылки работают через
 * SPA-навигацию (onNavigate), на самостоятельных страницах — обычные href.
 * «Поиск» фокусирует строку поиска в синей навигации (#sm-nav-search —
 * есть на всех страницах, MainNav общий). Разметка и классы — строго
 * футера Главной (.mp-footer), поэтому высота/размер совпадают 1-в-1.
 */
export function SiteFooter(props: { settings?: SiteSettings | null; onNavigate?: (view: string) => void }) {
  const { settings, onNavigate } = props;
  const linkProps = (view: string, href: string): { onClick?: () => void; href?: string } =>
    onNavigate ? { onClick: () => onNavigate(view) } : { href };
  const goSearch = () => {
    const el = document.getElementById("sm-nav-search");
    if (el) {
      el.focus();
      window.scrollTo(0, 0);
    }
  };
  return (
    <>
      {/* Директива «Сквозной блок волонтёров»: вставлен в SiteFooter,
          который подключается на ВСЕХ страницах без исключения.
          Стоит строго НАД синей плашкой футера. */}
      <VolunteersCarousel />
      <footer className="mp-footer">
      <nav className="mp-footer-links" aria-label="Футер сайта">
        <a {...linkProps("home", "/")}>Главная</a>
        <a {...linkProps("forum", "/?view=forum")}>Форум</a>
        <a href="/obyavleniya">Объявления</a>
        <a onClick={goSearch}>Поиск</a>
        <a {...linkProps("about", "/?view=about")}>О проекте</a>
        <a {...linkProps("rules", "/?view=rules")}>Правила SakhMatrix</a>
        <a {...linkProps("rules", "/?view=rules")}>Правила публикаций</a>
        <a {...linkProps("appeal", "/?view=appeal")}>Контакты проекта</a>
      </nav>
      <div className="mp-footer-info">
        <div className="mp-footer-left">
          <div>
            <b>SakhMatrix</b> — {settings?.siteSubtitle || DEFAULT_SETTINGS.siteSubtitle}.
          </div>
          <div className="mp-footer-disc">Публикации пользователей отражают их личный опыт и не являются официальной позицией SakhMatrix.</div>
        </div>
        <div className="mp-footer-right">
          <div>© 2025 SakhMatrix. Все права защищены.</div>
          <div>
            Версия 1.0 | <a {...linkProps("about", "/?view=about")}>Техническая информация</a>
          </div>
        </div>
      </div>
      </footer>
    </>
  );
}

export function useAuth() {
  const [user, setUser] = useState<ForumUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = false;
    Promise.resolve().then(() => {
      if (alive) return;
      try {
        const raw = localStorage.getItem(AUTH_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.token && saved.user) {
            setToken(saved.token);
            setUser(saved.user);
            fetch(`/api/auth/me?token=${encodeURIComponent(saved.token)}`)
              .then((r) => (r.ok ? r.json() : Promise.reject()))
              .then((r) => setUser(r.user))
              .catch(() => {
                localStorage.removeItem(AUTH_KEY);
                setToken(null);
                setUser(null);
              });
          }
        }
      } catch {}
      setReady(true);
    });
    return () => {
      alive = true;
    };
  }, []);
  const login = useCallback((t: string, u: ForumUser) => {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ token: t, user: u }));
    setToken(t);
    setUser(u);
  }, []);
  const logout = useCallback(() => {
    if (token) {
      fetch(`/api/auth/me?token=${encodeURIComponent(token)}`, { method: "DELETE" }).catch(() => {});
    }
    localStorage.removeItem(AUTH_KEY);
    setToken(null);
    setUser(null);
  }, [token]);
  return { user, token, ready, login, logout };
}
