"use client";

/**
 * ЗАДАЧА 14 (рестайл ПК-версии), Шаг №4: левая колонка внутренних
 * страниц сервисов (/weather.php, /currency.php, /disconnections.php,
 * /traffic.php). ТЗ: «Каждая внутренняя страница обязана строго
 * дублировать трехколоночную архитектуру Главной страницы. Левая
 * колонка: Полноценный развернутый блок меню навигации и категорий
 * форума (как на Главной)».
 *
 * Разметка и классы — те же, что у левой колонки Главной (Sidebar
 * в homeMode: .sk-col-left > .sk-sideblock > .sk-blocktitle + .sk-navlist,
 * иконки lucide 13px, рубрики с ▶-раскрытием .sk-sublist). Отличие
 * только в поведении ссылок: внутренние страницы не управляют видом
 * форума, поэтому каждый пункт — обычная ссылка на Главную с
 * URL-параметром, который Главная уже понимает:
 *   — «/?scope=<key>»  — срезы Навигации (page.tsx syncFromUrl: scope);
 *   — «/?rubric=<slug>» — категория/подкатегория форума (syncFromUrl: rubric).
 * Иконки скоупов и рубрик (SCOPE_ICONS/rubricIcon) перенесены сюда из
 * page.tsx как единый источник — Главная импортирует их отсюда, вид
 * колонок не расходится.
 */

import { useEffect, useState } from "react";
import {
  Activity,
  Archive,
  Briefcase,
  Building2,
  Car,
  ClipboardList,
  Compass,
  FileText,
  Fish,
  Flame,
  FolderOpen,
  HeartPulse,
  Mail,
  MessageSquare,
  Mountain,
  PawPrint,
  Scale,
  ShoppingBag,
  Sparkles,
  Star,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Rubric } from "@/lib/ui";

/** Иконка пункта левой колонки «Навигация» (как на Главной). */
export const SCOPE_ICONS: Record<string, LucideIcon> = {
  new: ClipboardList,
  popular: Flame,
  active: Activity,
  mine: FileText,
  participated: Mail,
  favorites: Star,
  archive: Archive,
};

/** Иконка рубрики форума по названию (как на Главной; фолбэк — «сообщение»). */
export function rubricIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes("авто")) return Car;
  if (n.includes("лыжи") || n.includes("сноуборд")) return Mountain;
  if (n.includes("живот")) return PawPrint;
  if (n.includes("закон") || n.includes("право")) return Scale;
  if (n.includes("здоров") || n.includes("медиц")) return HeartPulse;
  if (n.includes("карьер") || n.includes("бизнес") || n.includes("работ")) return Briefcase;
  if (n.includes("красот")) return Sparkles;
  if (n.includes("кулинар") || n.includes("ед") || n.includes("рецепт")) return UtensilsCrossed;
  if (n.includes("недвиж") || n.includes("жиль")) return Building2;
  if (n.includes("отношен") || n.includes("знаком")) return Users;
  if (n.includes("рыбалк") || n.includes("охот")) return Fish;
  if (n.includes("товар") || n.includes("услуг")) return ShoppingBag;
  if (n.includes("туризм") || n.includes("отдых") || n.includes("путешеств")) return Compass;
  return MessageSquare;
}

const SCOPE_LINKS = [
  { key: "new", label: "Новые сообщения" },
  { key: "popular", label: "Популярные темы" },
  { key: "active", label: "Активные темы" },
  { key: "mine", label: "Мои темы" },
  { key: "participated", label: "Мои сообщения" },
  { key: "favorites", label: "Избранное" },
  { key: "archive", label: "Архив тем" },
];

/**
 * Директива «Блок „Обсудить на форуме“ в стиле левого меню»
 * (правка nav-discuss-restyle-2026-09-18 к задаче nav-cleanup-2026-09-18):
 * рубрики, убранные из меню «Ещё» (chrome.tsx), живут в левой колонке —
 * в карточке «Обсудить на форуме» ПОД основным вертикальным меню.
 * Список задан директивой дословно (5 пунктов); «Знакомства» в блок
 * НЕ входит — независимый трафик-магнит по ТЗ.
 *
 * Каждая строка — ОДНА кликабельная ссылка в ветку обсуждений этой
 * рубрики на форуме (сервисные рубрики *-discuss из БД — туда же пишут
 * темы кнопки «Обсудить на форуме» под публикациями).
 * ТЗ 2026-09-23 «Кнопки „Обсудить на форуме“» (п.4): формат ссылок
 * переведён с /?rubric=<slug> на /forum/category/<slug> — реальные
 * страницы списка тем рубрики (маршруты /forum/*, см. src/app/forum).
 */
export const DISCUSS_RUBRICS: {
  name: string;
  href: string;
  title: string;
  /** Stage 2 (директива): принудительный перенос имени на 2 строки
   *  (для «Рекомендую / Не рекомендую»). */
  break?: boolean;
}[] = [
  {
    name: "Подслушано Сахалин",
    href: "/forum/category/podslyshano-discuss",
    title: "Ветка форума: обсуждение сообщений из «Подслушано»",
  },
  {
    name: "Где купить",
    href: "/forum/category/wheretobuy-discuss",
    title: "Ветка форума: обсуждения раздела «Где купить»",
  },
  {
    name: "Где дешевле",
    href: "/forum/category/gdedeshevle-discuss",
    title: "Ветка форума: обсуждения раздела «Где дешевле»",
  },
  {
    name: "Рекомендую / Не рекомендую",
    href: "/forum/category/recommend-discuss",
    title: "Ветка форума: обсуждения раздела «Рекомендую / Не рекомендую»",
    /** Stage 2 (директива заказчика): принудительный перенос имени
     *  на 2 строки — «Рекомендую /» на одной строке, «Не рекомендую»
     *  на следующей. Без этого флага на широких экранах строка
     *  оставалась одной линией и визуально «не дышала». */
    break: true,
  },
  {
    name: "О работодателях",
    href: "/forum/category/employers-discuss",
    title: "Ветка форума: обсуждения раздела «О работодателях»",
  },
];

/**
 * Карточка «Обсудить на форуме» — приведена к ЕДИНОМУ стилю всех блоков
 * левой колонки (директива «добавить окантовку как у всех блоков»):
 * использует стандартные CSS-классы .sk-sideblock (окантовка 1px solid
 * var(--sm-navy)=#1E3A5F + тень 0 1px 3px, фон #fff, padding 9px 10px,
 * margin-bottom 10px) и .sk-blocktitle (синяя шапка #1E3A5F, белый
 * текст 13px/700, padding 5px 9px, border-bottom 1px solid #16293F).
 * Шапка растягивается на всю ширину блока через отрицательные margin
 * -9px -10px 7px (правило .sk-sideblock > .sk-blocktitle в globals.css).
 *
 * Внутри — 5 ссылок-рубрик с inline-стилями (flex align-items:flex-start,
 * эмодзи 💬 для всех, стрелка ▶ align-self:center). Для «Рекомендую /
 * Не рекомендую» — принудительный перенос на 2 строки через <br/>.
 *
 * ПОЗИЦИЯ: блок стоит ВЫШЕ «Служебный раздел» (Служебный раздел — в самом
 * низу левой колонки).
 */
export function ForumDiscussCard() {
  return (
    <div className="sk-sideblock">
      <div className="sk-blocktitle">
        <span className="tri">▼</span>Обсудить на форуме
      </div>

      {/* ТЕЛО БЛОКА СО СПИСКОМ РУБРИК — inline-стили строк сохранены
          (flex с эмодзи 💬 и стрелкой ▶); обёртка тела без собственных
          стилей (базовый padding 9px 10px даёт .sk-sideblock). */}
      <div>
        {DISCUSS_RUBRICS.map((d) => {
          // Stage 2: единая иконка 💬 для всех рубрик блока.
          const emoji = "💬";
          // Stage 2: для рубрики «Рекомендую / Не рекомендую» —
          // принудительный перенос имени на 2 строки (break: true).
          const nameParts = d.break ? d.name.split(" / ") : null;
          return (
            <a
              key={d.href}
              href={d.href}
              title={d.title}
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                padding: "8px 12px",
                textDecoration: "none",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  fontSize: "14px",
                  color: "#004A8F",
                }}
              >
                <span style={{ fontSize: "16px", lineHeight: "1" }}>{emoji}</span>
                <span style={{ lineHeight: "1.3" }}>
                  {nameParts ? (
                    <>
                      {nameParts[0]} /<br />
                      {nameParts[1]}
                    </>
                  ) : (
                    d.name
                  )}
                </span>
              </div>
              <span style={{ color: "#CED4DA", fontSize: "12px", alignSelf: "center" }}>▶</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export default function ForumSideNav() {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then((r) => setRubrics(r.rubrics || []))
      .catch(() => {});
  }, []);

  const service = rubrics.find((r) => r.isService);
  const modAsk = service?.children?.find((c) => c.name.toLowerCase().includes("модератору"));

  return (
    <aside className="sk-col-left sk-col-left-inner left-column" aria-label="Навигация и категории форума">
      <div className="sk-sideblock">
        <div className="sk-blocktitle">
          <span className="tri">▼</span>Навигация
        </div>
        <ul className="sk-navlist">
          {SCOPE_LINKS.map((s) => {
            const Ico = SCOPE_ICONS[s.key] ?? MessageSquare;
            return (
              <li key={s.key} className="sk-navico-row">
                <Ico size={13} strokeWidth={2.1} className="sk-navico" aria-hidden="true" />
                <a href={`/?scope=${s.key}`}>{s.label}</a>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="sk-sideblock">
        <div className="sk-blocktitle">
          <span className="tri">▼</span>Рубрики форума
        </div>
        <ul className="sk-navlist">
          {rubrics
            .filter((r) => !r.isService)
            .map((r) => {
              const RIco = rubricIcon(r.name);
              return (
                /* ФИКС вертикальной раскладки рубрик: li — обычный блок;
                   flex-строка только .sk-rubric-header (иконка + название +
                   стрелка), ul.sk-sublist — брат заголовка (опускается ВНИЗ). */
                <li key={r.id} className="sk-rubric-row">
                  <div className="sk-rubric-header">
                    <RIco size={13} strokeWidth={2.1} className="sk-navico" aria-hidden="true" />
                    <a className="sk-rubric-name" href={`/?rubric=${encodeURIComponent(r.slug)}`}>
                      {r.name}
                    </a>
                    {r.children.length > 0 && (
                      <button
                        type="button"
                        className="sk-rubric-arr"
                        aria-label={`Подрубрики: ${r.name}`}
                        aria-expanded={expanded === r.slug}
                        onClick={() => setExpanded(expanded === r.slug ? null : r.slug)}
                      >
                        <span className={`arr ${expanded === r.slug ? "open" : ""}`}>▶</span>
                      </button>
                    )}
                  </div>
                  {expanded === r.slug && r.children.length > 0 && (
                    <ul className="sk-sublist">
                      {r.children.map((c) => (
                        <li key={c.id}>
                          <a href={`/?rubric=${encodeURIComponent(c.slug)}`}>{c.name}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
        </ul>
      </div>
      {/* Директива «Чистка навигации» + Stage 2 (поднятие блока): карточка
          «Обсудить на форуме» теперь ВЫШЕ «Служебный раздел» (раньше была
          ниже) — по прямому указанию заказчика. Тот же блок стоит и в левой
          колонке Главной/форума (page.tsx). */}
      <ForumDiscussCard />
      {modAsk && (
        <div className="sk-sideblock">
          <div className="sk-blocktitle">
            <span className="tri">▼</span>Служебный раздел
          </div>
          <ul className="sk-navlist">
            <li className="sk-navico-row">
              <FolderOpen size={13} strokeWidth={2.1} className="sk-navico" aria-hidden="true" />
              <a href={`/?rubric=${encodeURIComponent(modAsk.slug)}`}>Предложения и вопросы модератору</a>
            </li>
          </ul>
        </div>
      )}
    </aside>
  );
}
