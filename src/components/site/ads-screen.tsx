"use client";

/**
 * ТЗ 2026-09-23 «Объявления» — ТРЁХКОЛОНОЧНАЯ схема (Flat 2.0):
 *  ЛЕВАЯ КОЛОНКА: кнопка «+ Разместить объявление» + мелкий текст о доступе
 *  только для зарегистрированных + фильтр городов Сахалина (select + «Показать»);
 *  ЦЕНТРАЛЬНАЯ: некоммерческая доска FlatBoard — 3 текстовые вкладки
 *  [ Отдам даром / Поделюсь ] [ Приму в дар / Нужна помощь ] [ Бюро находок
 *  (Потерял / Нашёл) ], белые карточки (город/дата/текст с ОТКРЫТЫМИ
 *  контактами), форма (вкладка + город + одно поле), СМС-верификация;
 *  ПРАВАЯ: часы (сквозная директива) → «О разделе» → «Правила раздела»
 *  (тексты ТЗ 2026-09-23 дословно).
 *
 * ЖЁСТКОЕ ПРАВИЛО ТЗ: кнопок «Обсудить на форуме» на странице НЕТ — связь
 * напрямую по контактам из объявления. Прежний AdsPage (ads-publications.tsx)
 * снят с монтирования (файл сохранён).
 *
 * Технические решения:
 *  — FlatBoard переведён в controlled-режим (controlledOpen/open/
 *    onOpenChange/hideAddButton/placeFilter): кнопка публикации — одна,
 *    в ЛЕВОЙ колонке; гость при клике получает примечание о входе
 *    (форма НЕ открывается); фильтр города уходит в GET ленты (?place=);
 *  — расследование 2026-09-23 (пред. задача): потерянные при откате
 *    воркспейса сквозные часы и правая колонка восстановлены и сохранены.
 */

import { useCallback, useEffect, useState } from "react";
import { AuthModal } from "@/components/forum/modals";
import FlatBoard, { FLAT_ADS_BOARD, SAKHALIN_CITIES } from "@/components/site/flat-board";
import SakhDatetimeBlock from "@/components/site/sakh-datetime-block";
import { DEFAULT_SETTINGS, isStaffRole, MainNav, Masthead, SiteFooter, useAuth, type SiteSettings } from "@/components/site/chrome";

/** ДОСЛОВНЫЙ мелкий текст под кнопкой левой колонки (ТЗ: «мелкий текст
 *  о доступе только для зарегистрированных» — единая строка доступа сайта). */
const ADS_ACCESS_NOTE =
  "Публикация доступна только зарегистрированным пользователям. Гости могут только читать";

/** ДОСЛОВНЫЙ текст «О разделе» (ТЗ 2026-09-23). */
const ADS_ABOUT_TEXT =
  "Объявления СахМатрицы — некоммерческий инструмент безвозмездной взаимопомощи. Здесь полностью отсутствуют разделы купли-продажи. Цель — бесплатно делиться излишками, помогать в беде и возвращать утерянные вещи.";

/** Правила раздела — пункты ТЗ 2026-09-23 дословно. */
const ADS_RULES = [
  "Доступно только зарегистрированным пользователям.",
  "Любые попытки продать товар, указать цену или дать рекламу запрещены — удаление и бан.",
];

export default function AdsScreen() {
  const { user, token, login } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [authOpen, setAuthOpen] = useState(false);
  const [toast, setToast] = useState("");
  // ТЗ 2026-09-23: controlled-режим формы FlatBoard (кнопка — в левой колонке).
  const [formOpen, setFormOpen] = useState(false);
  const [guestHint, setGuestHint] = useState(false);
  // Фильтр городов Сахалина (левая колонка) → GET ?place= ленты FlatBoard.
  const [city, setCity] = useState("");
  const [appliedCity, setAppliedCity] = useState("");

  // Общие настройки сайта для шапки и футера (те же, что на форуме)
  useEffect(() => {
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then((r) => {
        if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings });
      })
      .catch(() => {});
  }, []);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3500);
  }, []);

  /** Кнопка «+ Разместить объявление» левой колонки: авторизованному —
   *  форма в центре (controlled FlatBoard), гостю — примечание о входе
   *  (форма НЕ открывается). */
  const openFormLeft = useCallback(() => {
    if (!(user && token)) {
      setGuestHint(true);
      setFormOpen(false);
      return;
    }
    setGuestHint(false);
    setFormOpen(true);
  }, [user, token]);

  const applyCity = useCallback(() => {
    setAppliedCity(city.trim());
  }, [city]);

  // Навигация из синей полосы: «Объявления» — текущая страница,
  // остальные пункты ведут на свои страницы/форум.
  const goNav = useCallback((k: string) => {
    if (k === "ads") {
      window.scrollTo(0, 0);
      return;
    }
    if (k === "podslyshano") {
      window.location.href = "/podslyshano";
      return;
    }
    if (k === "wheretobuy") {
      window.location.href = "/gde-kupit";
      return;
    }
    if (k === "gkh") {
      window.location.href = "/gkh";
      return;
    }
    if (k === "dating") {
      window.location.href = "/znakomstva";
      return;
    }
    if (k === "recommend") {
      window.location.href = "/rekomenduyu";
      return;
    }
    if (k === "employers") {
      window.location.href = "/o-rabotodatelyah";
      return;
    }
    if (k === "gdedeshevle") {
      window.location.href = "/gde-deshevle";
      return;
    }
    if (k === "useful") {
      window.location.href = "/poleznoe";
      return;
    }
    if (k === "help") {
      window.location.href = "/help";
      return;
    }
    window.location.href = k === "home" ? "/" : `/?view=${k}`;
  }, []);

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="ads" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div className="sk-topbar">
          <span className="tb-title">Объявления</span>
        </div>
        <div className="sk-shell">
          {/* ТЗ 2026-09-23: ТРИ КОЛОНКИ. ЛЕВАЯ — кнопка «+ Разместить
              объявление» + мелкий текст доступа + фильтр городов Сахалина;
              ЦЕНТР — FlatBoard (3 вкладки, белые карточки с открытыми
              контактами, форма, СМС) в controlled-режиме; ПРАВАЯ — часы,
              «О разделе» и «Правила раздела» дословно по ТЗ. КНОПОК
              «Обсудить на форуме» НА СТРАНИЦЕ НЕТ (жёсткое правило ТЗ). */}
          <div className="main-grid-container" data-ads-layout="1">
            {/* ============ ЛЕВАЯ КОЛОНКА — «О разделе» (правки 28.09.2026) ============
                Прежние блоки (Доступ + Фильтр городов) УБРАНЫ.
                «О разделе» перемещён сюда из правой колонки и оформлен в дизайне
                блока «Время» (.sakh-clock: тёмно-синяя шапка #1E3A5F, белое тело). */}
            <aside className="left-column" data-ads-left="1">
              <div className="sakh-clock ad-clock-block ad-clock-about" data-ads-about="1">
                <div className="sakh-clock-head">ℹ️ О разделе</div>
                <div className="sakh-clock-body sakh-clock-body-content">
                  <p className="ad-about-text" data-ads-about-text="1">{ADS_ABOUT_TEXT}</p>
                </div>
              </div>
            </aside>

            {/* ============ ЦЕНТРАЛЬНАЯ КОЛОНКА (лента FlatBoard) ============ */}
            <div className="center-column" data-ads-center="1">
              <FlatBoard
                {...FLAT_ADS_BOARD}
                controlledOpen
                open={formOpen}
                onOpenChange={setFormOpen}
                hideAddButton
                placeFilter={appliedCity}
              />
            </div>

            {/* ============ ПРАВАЯ КОЛОНКА — Время + Правила (правки 28.09.2026) ============
                «О разделе» убран (теперь он в левой колонке).
                «Правила раздела» оформлены в дизайне блока «Время» (.sakh-clock). */}
            <aside className="right-column" data-ads-right="1">
              <SakhDatetimeBlock />
              <div className="sakh-clock ad-clock-block ad-clock-rules" data-ads-rules="1">
                <div className="sakh-clock-head">📋 Правила раздела</div>
                <div className="sakh-clock-body sakh-clock-body-content">
                  <ul className="ad-rules" data-ads-rules-list="1">
                    {ADS_RULES.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        </div>
        {/* Шаг «Единый футер как на Главной»: общий SiteFooter — тот же футер,
            что на Главной (строка ссылок, сведения, дисклеймер, версия),
            размер/состав 1-в-1; до этого здесь был тонкий .sk-footer */}
        <SiteFooter settings={settings} />
      </div>
      {authOpen && (
        <AuthModal
          standalone
          onClose={() => setAuthOpen(false)}
          onLogin={(t, u) => {
            login(t, u);
            notify(`Вы вошли как ${u.nickname}`);
          }}
        />
      )}
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-[90] -translate-x-1/2 border-2 border-[#1E3A5F] bg-white px-4 py-2 text-[14px] font-semibold text-[#1E3A5F] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
