"use client";

/**
 * ТЗ 2026-09-23 «Знакомства (Love Sakh)» — самостоятельная страница /znakomstva
 * в ТРЁХ КОЛОНКАХ по образцу других разделов проекта («Рекомендую /
 * Не рекомендую», «Нужна помощь»): стандартный плотный виджет слева,
 * чистый Flat 2.0 в центре, правила справа.
 *
 * ДОСЛОВНЫЕ требования ТЗ и их реализация:
 *  ЛЕВАЯ КОЛОНКА (Навигация и фильтр):
 *   Блок 1 «Доступ» — кнопка «+ Разместить анкету» + текст снизу
 *   «Публиковать анкеты могут только зарегистрированные пользователи —
 *   войдите или зарегистрируйтесь. Гости могут читать ленту».
 *   Блок 2 «Место» — поле ввода «Южно-Сахалинск, Холмск...» + кнопка «Показать».
 *  ЦЕНТРАЛЬНАЯ КОЛОНКА (основной контент, чистый Flat 2.0):
 *   1. Заголовок «Знакомства (Love Sakh)»; 2. подзаголовок (одна строка);
 *   3. кнопка «+ Разместить анкету» (дублирует левую колонку);
 *   4. поле поиска по анкетам; 5. вкладки [ Мужчина ищет женщину ]
 *   [ Женщина ищет мужчину ] [ Дружба / Общение ] [ Ищу человека / Благодарность ];
 *   6. лента карточек: Город, Текст объявления, Контакты открыты сразу,
 *   тонкая рамка на белом фоне, БЕЗ аватаров/фото/возраста, плоский список,
 *   новые сверху; 7. пагинация под лентой, как в других разделах.
 *  ПРАВАЯ КОЛОНКА (Правила и Описание раздела):
 *   «О разделе» (3 абзаца ТЗ дословно) и «Правила раздела» (в отдельной
 *   рамке снизу: «Здесь общаются напрямую:» + 5 пунктов ТЗ дословно).
 *
 * ЛОГИКА РАБОТЫ (ТЗ):
 *  1. Гость нажимает «Разместить анкету» → форма НЕ открывается, появляется
 *     строка «Публикация анкет доступна только зарегистрированным жителям
 *     города. Пожалуйста, войдите в свой аккаунт на форуме» (дословно).
 *  2. Авторизованный → открывается чистое поле ввода: выбор одной из 4
 *     вкладок, поле «Город», ОДНО большое текстовое поле для текста и
 *     контактов, кнопка «Опубликовать»; анкета сразу падает наверх ленты.
 *  3. Переключение вкладок БЕЗ перезагрузки страницы (клиентское состояние).
 *  4. Лента плоская, новые сверху, без вложенности.
 *  5. Стиль компактный, как в других разделах SakhMatrix.
 *
 * Задокументированные решения:
 *  — часы SakhDatetimeBlock первым блоком правой колонки — сквозная
 *    директива сайта («Часы на всех страницах, как на Главной»), стоят
 *    до двух блоков ТЗ;
 *  — ТЗ 2026-09-23: кнопка-дубль в центре снята — кнопка публикации
 *    одна, в левой колонке; ЖЁСТКОЕ ПРАВИЛО ТЗ — кнопок «Обсудить на
 *    форуме» на странице НЕТ (общение напрямую по контактам), прежняя
 *    кнопка у карточек «Ищу человека / Благодарность» удалена;
 *  — неактуальные анкеты (status=stale) не удаляются: показываются ниже
 *    актуальных, серым, с серой плашкой «Неактуально» (общее правило
 *    статусов сайта); скрытые ИИ в ленту не попадают (фильтр API);
 *  — CSS: семейство .dk-* (существует с ШАГА 26, включено во все
 *    мобильные брейкпоинты каркаса) + новые .dk-card/.dk-tabbtn/
 *    .dk-placefilter/.dk-form/.dk-guesthint (globals.css);
 *  — ТЗ 2026-09-23: фильтр «Место» заменён на ВЫБОР города (select
 *    «Все города» + SAKHALIN_CITIES: Южно-Сахалинск, Корсаков, Холмск…)
 *    + кнопка «Показать».
 */

import { useCallback, useEffect, useRef, useState } from "react";
import SakhDatetimeBlock from "@/components/site/sakh-datetime-block";
import { SAKHALIN_CITIES } from "@/components/site/flat-board";
import { DATING_CATEGORIES } from "@/lib/znakomstva";
import type { ForumUser } from "@/lib/ui";
import { hasContact, CONTACT_ERROR, renderContacts } from "@/lib/contact-check";

/** Анкета в публичной выдаче API (authorId наружу не отдаётся никогда). */
interface LsItem {
  id: string;
  category: string;
  body: string;
  place: string;
  /** Ник автора без аватара; пусто → «Аноним» (ТЗ 2026-09-23). */
  nick: string;
  status: string;
  createdAt: string;
}

const PAGE_SIZE = 15;

/** Дата «23.09.2026, 05:44» — как в блоках Flat 2.0. */
function fmtDay(v: string): string {
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** ДОСЛОВНАЯ строка ТЗ 2026-09-23 (и для гостя при клике, и под кнопкой
 *  левой колонки — единый текст доступа). */
const LS_ACCESS_NOTE =
  "Публикация доступна только зарегистрированным пользователям. Гости могут только читать";

/** Правила раздела — 3 пункта ТЗ 2026-09-23 дословно. */
const LS_RULES = [
  "Раздел полностью бесплатный.",
  "Контакты открыты сразу в тексте.",
  "Любая коммерция, реклама или платные услуги запрещены — бан навсегда.",
];

export default function LoveSakhPage(props: {
  user: ForumUser | null;
  token: string | null;
  notify: (m: string) => void;
  onNeedAuth: () => void;
}) {
  const [tab, setTab] = useState(DATING_CATEGORIES[0]?.key ?? "m4w");
  const [items, setItems] = useState<LsItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  // Поиск по анкетам (центральная колонка) и фильтр «Место» (левая колонка).
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [place, setPlace] = useState("");
  const [appliedPlace, setAppliedPlace] = useState("");

  // Форма публикации: гость → строка ТЗ; авторизованный → чистая форма.
  const [formOpen, setFormOpen] = useState(false);
  const [guestHint, setGuestHint] = useState(false);
  const [formTab, setFormTab] = useState(DATING_CATEGORIES[0]?.key ?? "m4w");
  const [city, setCity] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  const listTopRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (opts: { tab?: string; page?: number; q?: string; place?: string } = {}) => {
      const t = opts.tab ?? tab;
      const p = opts.page ?? 1;
      const qq = opts.q ?? appliedQ;
      const pp = opts.place ?? appliedPlace;
      const sp = new URLSearchParams({
        category: t,
        page: String(p),
        pageSize: String(PAGE_SIZE),
      });
      if (qq) sp.set("q", qq);
      if (pp) sp.set("place", pp);
      try {
        const r = await fetch(`/api/znakomstva?${sp.toString()}`);
        const d = await r.json();
        const rows: LsItem[] = (d.posts ?? []).map((x: Record<string, unknown>) => ({
          id: String(x.id),
          category: String(x.category ?? ""),
          body: String(x.body ?? x.text ?? ""),
          place: String(x.place ?? ""),
          nick: String(x.nick ?? ""),
          status: String(x.status ?? "actual"),
          createdAt: String(x.createdAt ?? ""),
        }));
        setItems(rows);
        setTotal(Number(d.total ?? rows.length));
        setPage(Number(d.page ?? p));
        setPages(Math.max(1, Number(d.pages ?? 1)));
      } catch {
        setItems([]);
      }
    },
    [tab, appliedQ, appliedPlace]
  );

  // Переключение вкладок / применение поиска и «Места» — БЕЗ перезагрузки
  // страницы (ТЗ п.3): клиентское состояние + перезапрос ленты.
  useEffect(() => {
    setItems(null);
    load({ tab, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, appliedQ, appliedPlace]);

  const applySearch = () => {
    setAppliedQ(q.trim());
    setAppliedPlace(place.trim());
  };

  const resetSearch = () => {
    setQ("");
    setAppliedQ("");
    setPlace("");
    setAppliedPlace("");
  };

  const searching = !!(appliedQ || appliedPlace);

  /** «Разместить анкету»: гостю — ДОСЛОВНАЯ строка ТЗ (форма НЕ открывается),
   *  авторизованному — чистая форма (вкладка/город/текст/«Опубликовать»). */
  const openForm = () => {
    setNote("");
    if (!(props.user && props.token)) {
      setGuestHint(true);
      setFormOpen(false);
      return;
    }
    setGuestHint(false);
    setFormOpen(true);
    setFormTab(tab);
    setErr("");
  };

  const changeText = (v: string) => {
    setText(v);
    setErr("");
  };

  const publish = async () => {
    setErr("");
    if (!formTab) return setErr("Выберите вкладку анкеты.");
    if (city.trim().length < 2) return setErr("Укажите город.");
    if (text.trim().length < 10) return setErr("Напишите текст анкеты с контактами (от 10 символов).");
    // 2026-10-01: ТЗ — страница знакомств полностью анонимная, но КОНТАКТ
    // для связи обязателен (телефон, @telegram, https-ссылка, email).
    if (!hasContact(text)) return setErr(CONTACT_ERROR);
    setBusy(true);
    try {
      const r = await fetch("/api/znakomstva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: props.token,
          category: formTab,
          place: city.trim(),
          text: text.trim(),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось опубликовать анкету.");
      // Успех: форма закрывается, поля чистятся, анкета падает наверх ленты.
      setFormOpen(false);
      setCity("");
      setText("");
      setNote(d.note || "Анкета опубликована. Спасибо!");
      props.notify(d.note || "Анкета опубликована. Спасибо!");
      window.setTimeout(() => setNote(""), 5000);
      if (formTab !== tab) setTab(formTab);
      else await load({ tab, page: 1 });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка публикации");
    } finally {
      setBusy(false);
    }
  };

  const goToPage = async (p: number) => {
    await load({ tab, page: p });
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const list = items ?? [];

  return (
    <div className="dk-layout main-grid-container" data-ls-layout="1">
      {/* ============ ЛЕВАЯ КОЛОНКА — «О разделе» (правка 1+2+3, 28.09.2026) ============
          Прежние блоки (Доступ + Город) УБРАНЫ.
          «О разделе» перемещён сюда из правой колонки и оформлен в дизайне
          блока «Время» (.sakh-clock: тёмно-синяя шапка #1E3A5F, белое тело). */}
      <aside className="left-column">
        <div className="sakh-clock dk-clock-block dk-clock-about" data-ls-about="1">
          <div className="sakh-clock-head">ℹ️ О разделе</div>
          <div className="sakh-clock-body sakh-clock-body-content">
            <div className="dk-info" data-ls-about-text="1">
              <p>
                «Знакомства (Love Sakh)» — бесплатная народная доска для поиска людей, создания семей и дружбы на Сахалине.
                Вкладка «Благодарность» создана для поиска случайных героев на дорогах острова.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ================= ЦЕНТРАЛЬНАЯ КОЛОНКА (Flat 2.0) ================= */}
      <div className="center-column">
        <div className="dk-head" data-ls-head="1">
          {/* Пункт 1: заголовок; пункт 2: подзаголовок одной строкой. */}
          <h1 className="dk-title" data-ls-title="1">
            Знакомства (Love Sakh)
          </h1>
          {/* 2026-10-03: кнопка «Разместить анкету» ПОД заголовком страницы. */}
          <div style={{ marginBottom: 10, marginTop: 8 }}>
            <button className="sk-btn-classic" onClick={openForm} style={{ borderRadius: 0 }}>
              Разместить анкету
            </button>
          </div>
          {guestHint && (
            <div style={{ marginBottom: 10, fontSize: 13, color: "#475569" }}>
              Размещать анкеты могут только зарегистрированные пользователи. Войдите или зарегистрируйтесь.
            </div>
          )}
          {/* 2026-10-02: подзаголовок «Бесплатная народная доска знакомств
              Сахалина: текстовая анкета и открытые контакты — без фото,
              возраста и коммерции.» удалён по просьбе пользователя. */}
          {/* ТЗ 2026-09-23: кнопка-дубль в центре снята — кнопка публикации
              одна, в ЛЕВОЙ колонке (строгий Flat 2.0). */}
          {/* Поле поиска по анкетам. */}
          <div className="dk-search">
            <input
              aria-label="Поиск по анкетам"
              data-ls-search="1"
              value={q}
              maxLength={120}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
              placeholder="Поиск по анкетам…"
            />
            <button data-ls-search-apply="1" onClick={applySearch}>
              Найти
            </button>
            {searching && (
              <button className="dk-search-reset" data-ls-search-reset="1" onClick={resetSearch}>
                Сбросить
              </button>
            )}
          </div>
          {/* Логика п.1: гость кликнул «Разместить анкету» → строка ТЗ, форма НЕ открыта. */}
          {guestHint && (
            <div className="dk-guesthint" data-ls-guesthint="1" role="alert">
              {LS_ACCESS_NOTE}
            </div>
          )}
        </div>

        {/* Форма публикации (только для вошедших; Логика п.2). */}
        {formOpen && props.token && (
          <div className="dk-form" data-ls-form="1">
            {/* Выбор одной из 4 вкладок. */}
            <div className="dk-tabbar" data-ls-form-tabs="1">
              {DATING_CATEGORIES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={formTab === t.key ? "dk-tabbtn is-active" : "dk-tabbtn"}
                  data-ls-form-tab={t.key}
                  onClick={() => setFormTab(t.key)}
                >
                  {`[ ${t.label} ]`}
                </button>
              ))}
            </div>
            {/* Поле «Город»: список сахалинских городов + свободный ввод. */}
            <div style={{ marginTop: 10 }}>
              <label htmlFor="ls-city" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3f3f46" }}>
                Город
              </label>
              <input
                id="ls-city"
                data-ls-city="1"
                list="ls-cities"
                value={city}
                maxLength={80}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Южно-Сахалинск"
              />
              <datalist id="ls-cities">
                {SAKHALIN_CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            {/* ОДНО большое текстовое поле для текста и контактов. */}
            <div style={{ marginTop: 10 }}>
              <label htmlFor="ls-text" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3f3f46" }}>
                Ваше объявление и контакты <span style={{ color: "#AA3333" }}>*</span>
              </label>
              <textarea
                id="ls-text"
                data-ls-text="1"
                value={text}
                maxLength={8000}
                onChange={(e) => changeText(e.target.value)}
                placeholder="Кого и для чего ищете, город. Контакты обязательны: WhatsApp, Telegram (@ник), телефон или ссылка — без контакта анкета не публикуется"
              />
            </div>
            <div style={{ marginTop: 10 }}>
              <button className="sk-btn-classic" data-ls-publish="1" disabled={busy} onClick={publish} style={{ borderRadius: 0 }}>
                {busy ? "Публикация…" : "Опубликовать"}
              </button>
            </div>
            {err && (
              <div data-ls-err="1" role="alert" style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: "#AA3333" }}>
                {err}
              </div>
            )}
          </div>
        )}

        {/* Пункт 5: вкладки — 4 категории ТЗ дословно, переключение без перезагрузки. */}
        <div className="dk-tabbar" data-ls-tabs="1" role="tablist" style={{ marginTop: 12 }}>
          {DATING_CATEGORIES.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={tab === t.key ? "dk-tabbtn is-active" : "dk-tabbtn"}
              data-ls-tab={t.key}
              onClick={() => setTab(t.key)}
            >
              {`[ ${t.label} ]`}
            </button>
          ))}
        </div>

        <div ref={listTopRef} />

        {items === null && <div className="dk-empty">Загрузка…</div>}

        {/* Пункт 6: лента карточек — плоский список, новые сверху. */}
        {items !== null && list.length === 0 && (
          <div className="dk-empty" data-ls-empty="1">
            {searching
              ? "По запросу ничего не найдено. Попробуйте изменить слова поиска или место."
              : "Анкет пока нет — ваша может стать первой."}
          </div>
        )}

        {items !== null && list.length > 0 && (
          <div data-ls-cards="1">
            {list.map((it) => {
              const stale = it.status !== "actual" && it.status !== "active";
              return (
                <article
                  key={it.id}
                  className={stale ? "dk-card is-stale" : "dk-card"}
                  data-ls-card={it.id}
                >
                  <div className="dk-card-top">
                    <span className="dk-card-city" data-ls-card-city={it.id}>
                      {it.place}
                    </span>
                    {/* 2026-10-01: раздел «Знакомства» — полностью анонимный.
                        Ник автора не показывается нигде на странице; только
                        город и (если есть) статус «Неактуально». ТЗ: на
                        странице знакомств не должно быть ников. */}
                    {stale && (
                      <span className="dk-status dk-status-stale" data-ls-card-status={it.id}>
                        Неактуально
                      </span>
                    )}
                    <span className="dk-card-date" data-ls-card-date={it.id}>
                      {fmtDay(it.createdAt)}
                    </span>
                  </div>
                  {/* Текст объявления вместе с ПРЯМЫМИ контактами автора:
                      выводится как введён, ничего не скрывается (ТЗ).
                      2026-10-01 (правка 2): контакты внутри текста
                      (телефон, @telegram, https, email) ПОДСВЕЧЕНЫ СИНИМ
                      и КЛИКАБЕЛЬНЫ — tel: → позвонить, t.me/ → Telegram,
                      mailto: → почта, https:// → открыть в новой вкладке. */}
                  <div className="dk-card-text" data-ls-card-text={it.id}>
                    {renderContacts(it.body)}
                  </div>
                  {/* ТЗ 2026-09-23, ЖЁСТКОЕ ПРАВИЛО: кнопок «Обсудить на
                      форуме» на странице Знакомств НЕТ — общение идёт
                      напрямую по контактам из текста карточки. */}
                </article>
              );
            })}
          </div>
        )}

        {/* Пункт 7: пагинация под лентой — как в других разделах. */}
        {items !== null && pages > 1 && (
          <div className="dk-pager" data-ls-pager="1">
            <button data-ls-pager-prev="1" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
              ← Новее
            </button>
            <span data-ls-pager-info="1">
              Страница {page} из {pages} · всего {total}
            </span>
            <button data-ls-pager-next="1" disabled={page >= pages} onClick={() => goToPage(page + 1)}>
              Старее →
            </button>
          </div>
        )}
        {items !== null && pages === 1 && total > 0 && (
          <div className="dk-pager" data-ls-pager="1">
            <span data-ls-pager-info="1">Всего {total} · новые сверху</span>
          </div>
        )}

        {note && (
          <div data-ls-note="1" style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: "#2E7D32" }}>
            {note}
          </div>
        )}
      </div>

      {/* ============== ПРАВАЯ КОЛОНКА (Правила и Описание раздела) ============== */}
      {/* ==== ПРАВАЯ КОЛОНКА — Время + Правила (правки 28.09.2026) ====
          «О разделе» убран (теперь он в левой колонке).
          «Правила раздела» оформлены в дизайне блока «Время» (.sakh-clock). */}
      <aside className="right-column">
        <SakhDatetimeBlock />
        <div className="sakh-clock dk-clock-block dk-clock-rules" data-ls-rules="1">
          <div className="sakh-clock-head">⚠️ Правила раздела</div>
          <div className="sakh-clock-body sakh-clock-body-content">
            <ul className="dk-rules" data-ls-rules-list="1">
              {LS_RULES.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
