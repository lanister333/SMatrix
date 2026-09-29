"use client";

/**
 * ТЗ №2 от 2026-09-23 «ЖКХ и городские проблемы» — трёхколоночная страница
 * /gkh по схеме Flat 2.0 (перестройка раздела ШАГ 19; прежний вид —
 * история проблемы, обновления, ответ организации, «Мои публикации»,
 * объединение дубликатов — остаётся в git-истории, API целы).
 *
 * КРИТИЧЕСКИ ВАЖНО (Пункт 17 ТЗ №2): «Проблема не должна превращаться
 * в обвинение». Раздел — не для слива нецензурных эмоций и не для лозунгов.
 * Это инструмент сухой фиксации коммунальных, дорожных и инфраструктурных
 * проблем: формулировки фактурные — что, где, когда, какие действия
 * предприняты.
 *
 * ДОСЛОВНЫЕ требования ТЗ №2 и их реализация:
 *  ЛЕВАЯ КОЛОНКА (Фильтр и Управление):
 *   Блок 1 (Кнопка действия) — «+ Зафиксировать проблему» + текст снизу
 *   «Оставлять сигналы о городских и коммунальных проблемах могут только
 *   зарегистрированные жители. Город видит каждый адрес».
 *   Блок 2 (Локация) — поле ввода «Район / Улица / Дом» (список городов:
 *   Южно-Сахалинск с планировочными районами, Корсаков, Долинск…) +
 *   кнопка «Показать» (API ?place=).
 *  ЦЕНТРАЛЬНАЯ КОЛОНКА (Лента городских фактов):
 *   1. Заголовок «ЖКХ и городские проблемы»; 2. подзаголовок (одна строка);
 *   3. кнопка «+ Зафиксировать проблему» (дублирует левую колонку);
 *   4. поле поиска по проблемам; 5. лента карточек — плоский список,
 *   новые сверху.
 *  СТРУКТУРА КАРТОЧКИ (Flat 2.0): 📍 адрес (район, улица, дом) · ник автора
 *  (или «Аноним») · 📅 дата; строка «⚠️ Текущий статус: …» (В поиске решения /
 *  Передано в УК / Решено / Отклонено); «Проблема: …» (суть без лозунгов);
 *  «Действия: …» (куда звонили/писали, номер заявки, статус); кнопка
 *  «💬 Обсудить на форуме ЖКХ» → рубрика «Недвижимость ▸ ЖКХ и управляющие
 *  компании» (/?rubric=…, относительный путь, никаких localhost).
 *  Без аватаров.
 *  ФОРМА ДОБАВЛЕНИЯ — 3 ОБЯЗАТЕЛЬНЫХ ШАГА (вместо одного поля «Напишите,
 *  что случилось»): 1) «Что произошло?» — суть проблемы без лозунгов;
 *  2) «Точный адрес и время» — где и с какого числа наблюдается проблема;
 *  3) «Предпринятые действия» — куда уже звонили/писали и какой статус.
 *  Поле «Предпринятые действия» ОБЯЗАТЕЛЬНОЕ — без него публикация
 *  не проходит.
 *  ИИ-ФИЛЬТР (Пункт 17): лозунги и обобщения («все воруют», «УК ничего
 *  не делает годами», «никому ничего не нужно») отклоняются автоматически;
 *  текст при этом НЕ стирается — показывается ДОСЛОВНОЕ сообщение ТЗ
 *  с предложением переписать текст фактами.
 *  ЛОГИКА ДОСТУПА: гость нажимает «Зафиксировать проблему» → форма НЕ
 *  открывается, появляется ДОСЛОВНАЯ строка ТЗ; авторизованный → форма
 *  из 3 шагов, после публикации карточка сразу падает наверх ленты.
 *  ПРАВАЯ КОЛОНКА: «О разделе» (2 абзаца дословно) + «Правила публикации»
 *  в рамке (вводка «Формулируйте факты, а не эмоции:» + 4 пункта дословно).
 *
 * Задокументированные решения:
 *  — часы SakhDatetimeBlock первым блоком правой колонки — сквозная
 *    директива сайта («Часы на всех страницах, как на Главной»);
 *  — статусы: значения БД ШАГ 19 (active/in_progress/solved) сохранены,
 *    метки обновлены по ТЗ №2, добавлен rejected «Отклонено» (lib/gkh.ts);
 *    в ленте активные выше, решённые/отклонённые ниже, внутри групп
 *    новые сверху (как неактуальные у «Знакомств»);
 *  — кнопка «Обсудить на форуме ЖКХ» — по ТЗ №2 ведёт В РУБРИКУ форума
 *    «Недвижимость ▸ ЖКХ и управляющие компании» (rubric 104, slug
 *    nedvizhimost--zhkh-i-upravlyayuschie-kompanii), поэтому она
 *    СТАТИЧЕСКАЯ (одна на все карточки), не создаёт тему на каждую
 *    проблему; вид — по указу заказчика 2026-09-23: СПРАВА и БИРЮЗОВЫЙ
 *    (.gkf-btn-forum = правила .dk-btn-forum); prefilled_text не
 *    используется;
 *  — заголовок публикации строится API автоматически из первого
 *    предложения текста (в карточке Flat 2.0 отдельного заголовка нет);
 *  — форма отправляет confirmSimilar: true: подсказка «похожая проблема»
 *    не входит в ТЗ №2 (форма строго из 3 шагов); защита API остаётся;
 *  — на ≤480px центральная кнопка скрыта (сквозная директива зад. 39 —
 *    .gkf-newbtn добавлена в общий список скрытых);
 *  — CSS: каркас .gkh-layout/.gkh-sideblock/.gkh-blocktitle (ШАГ 19)
 *    + новое семейство .gkf-* (globals.css).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import SakhDatetimeBlock from "@/components/site/sakh-datetime-block";
import { SAKHALIN_CITIES } from "@/components/site/flat-board";
import { GKH_STATUS_LABELS } from "@/lib/gkh";
import type { ForumUser } from "@/lib/ui";

/** Сигнал в публичной выдаче API (authorId наружу не отдаётся). */
interface GkfItem {
  id: string;
  place: string;
  problemDate: string;
  status: string;
  text: string;
  actions: string;
  authorName: string;
  createdAt: string;
}

const PAGE_SIZE = 15;

/** Дата «23.09.2026» — как в карточке ТЗ. */
function fmtDay(v: string): string {
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** ДОСЛОВНЫЕ тексты ТЗ №2 (левая колонка, гость, ИИ-фильтр). */
const GKF_ACCESS_NOTE =
  "Оставлять сигналы о городских и коммунальных проблемах могут только зарегистрированные жители. Город видит каждый адрес";
const GKF_GUEST_HINT =
  "Оставлять сигналы о городских и коммунальных проблемах могут только зарегистрированные жители. Пожалуйста, войдите в свой аккаунт";
const GKF_REWRITE_MESSAGE =
  "Пожалуйста, переформулируйте: укажите конкретный факт (что именно не работает), точный адрес и дату начала проблемы. Бездоказательные обобщения отклоняются";

/** ТЗ 2026-09-23 «Кнопки „Обсудить на форуме“» (п.3/4): рубрика блока
 *  «Недвижимость ▸ ЖКХ и управляющие компании» (rubric 104) — относительный
 *  путь /forum/category/<slug> на РЕАЛЬНУЮ страницу списка тем рубрики
 *  (прежде — /?rubric=… внутрь корневого SPA). Единая карта —
 *  src/lib/forum-links.ts (SECTION_FORUM.gkh). */
const GKF_FORUM_URL = "/forum/category/nedvizhimost--zhkh-i-upravlyayuschie-kompanii";

// ТЗ 2026-09-24 «Обсудить на форуме — авто-создание темы»: клиентский
// helper для всех 5 разделов (recommend / wheretobuy / gdedeshevle /
// employers / gkh). Создаёт тему через POST /api/discuss/<kind>/<id> и
// редиректит пользователя на готовую тему.
import { discussOnForum } from "@/lib/discuss";

/** Класс чипа статуса карточки (плоские заливки, ТЗ №2). */
const GKF_STATUS_CLASS: Record<string, string> = {
  active: "gkf-status is-search",
  in_progress: "gkf-status is-uk",
  solved: "gkf-status is-solved",
  rejected: "gkf-status is-rejected",
};

/** Локация: города острова + планировочные районы Южно-Сахалинска. */
const GKF_LOCATIONS = [
  ...SAKHALIN_CITIES,
  "Южно-Сахалинск, планировочный район Луговое",
  "Южно-Сахалинск, планировочный район Новоалександровск",
  "Южно-Сахалинск, планировочный район Санаторы",
  "Южно-Сахалинск, планировочный район Взморье",
  "Южно-Сахалинск, планировочный район Дальнее",
  "Южно-Сахалинск, планировочный район Ключи",
  "Южно-Сахалинск, планировочный район Хомутово",
];

/** «Правила публикации» — вводка + 4 пункта ТЗ №2 дословно (в рамке). */
const GKF_RULES_INTRO = "Формулируйте факты, а не эмоции:";
const GKF_RULES = [
  "Пишите конкретно, что именно не работает (например: «Нет освещения во дворе с 5 сентября» вместо «Никому ничего не нужно, все бездействуют»). Первое — помогает решить проблему. Второе — раздувает конфликт.",
  "Указывайте точный адрес, дату начала проблемы и номер поданной заявки в ЕДДС или УК, если она есть.",
  "Бездоказательные обобщения («все воруют», «УК ничего не делает годами») автоматически отклоняются ИИ-фильтром. Текст при этом не стирается, а система предложит вам переписать его, убрав лозунги.",
  "Обсуждение работы управляющих компаний и коммунальных служб ведётся в специальной рубрике форума «Недвижимость ▸ ЖКХ и управляющие компании» — переходите туда по кнопке под карточкой.",
];

export function GkhPage(props: {
  user: ForumUser | null;
  token: string | null;
  notify: (m: string) => void;
  onNeedAuth: () => void;
}) {
  const [items, setItems] = useState<GkfItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  // Поиск по проблемам (центр) и фильтр «Локация» (левая колонка).
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [place, setPlace] = useState("");
  const [appliedPlace, setAppliedPlace] = useState("");

  // Форма 3 шагов: гость → ДОСЛОВНАЯ строка ТЗ; авторизованный → форма.
  const [formOpen, setFormOpen] = useState(false);
  const [guestHint, setGuestHint] = useState(false);
  const [rewrite, setRewrite] = useState(false); // ИИ-фильтр лозунгов сработал
  const [formText, setFormText] = useState("");
  const [formPlace, setFormPlace] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formActions, setFormActions] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  const listTopRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (opts: { page?: number; q?: string; place?: string } = {}) => {
      const p = opts.page ?? 1;
      const qq = opts.q ?? appliedQ;
      const pp = opts.place ?? appliedPlace;
      const sp = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (qq) sp.set("q", qq);
      if (pp) sp.set("place", pp);
      try {
        const r = await fetch(`/api/gkh?${sp.toString()}`);
        const d = await r.json();
        const rows: GkfItem[] = (d.problems ?? []).map((x: Record<string, unknown>) => ({
          id: String(x.id),
          place: String(x.place ?? ""),
          problemDate: String(x.problemDate ?? ""),
          status: String(x.status ?? "active"),
          text: String(x.text ?? ""),
          actions: String(x.actions ?? ""),
          authorName: String(x.authorName ?? ""),
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
    [appliedQ, appliedPlace]
  );

  // Применение поиска/локации — без перезагрузки страницы.
  useEffect(() => {
    setItems(null);
    load({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedQ, appliedPlace]);

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

  /** «Зафиксировать проблему»: гостю — ДОСЛОВНАЯ строка ТЗ (форма НЕ
   *  открывается), авторизованному — чистая форма из 3 шагов. */
  const openForm = () => {
    setNote("");
    if (!(props.user && props.token)) {
      setGuestHint(true);
      setFormOpen(false);
      return;
    }
    setGuestHint(false);
    setRewrite(false);
    setErr("");
    setFormOpen(true);
  };

  const publish = async () => {
    setErr("");
    setRewrite(false);
    // 3 обязательных шага — проверки дублируют API (одинаковые сообщения).
    if (formText.trim().length < 10) {
      return setErr("Опишите суть проблемы: что именно не работает (от 10 до 8000 символов)");
    }
    if (formPlace.trim().length < 5) {
      return setErr("Укажите точный адрес проблемы: район, улица, дом");
    }
    if (!formDate) {
      return setErr("Укажите дату начала проблемы (с какого числа наблюдается)");
    }
    if (formActions.trim().length < 10) {
      return setErr("Опишите предпринятые действия: куда звонили или писали и какой статус. Поле обязательное — без него публикация не проходит");
    }
    setBusy(true);
    try {
      const r = await fetch("/api/gkh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: props.token,
          text: formText.trim(),
          place: formPlace.trim(),
          problemDate: formDate,
          actions: formActions.trim(),
          confirmSimilar: true, // подсказка «похожая проблема» не входит в ТЗ №2
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        // ИИ-фильтр лозунгов (ТЗ №2 п.17): публикация отклонена, но текст
        // НЕ стирается — форма остаётся с текстом автора, показывается
        // ДОСЛОВНОЕ сообщение ТЗ с предложением переписать фактами.
        if (d.rewrite) {
          setRewrite(true);
          return;
        }
        throw Error(d.error || "Не удалось опубликовать сигнал.");
      }
      // Успех: форма закрывается, поля чистятся, карточка падает наверх ленты.
      setFormOpen(false);
      setFormText("");
      setFormPlace("");
      setFormDate("");
      setFormActions("");
      setNote(d.note || "Сигнал опубликован. Спасибо!");
      props.notify(d.note || "Сигнал опубликован. Спасибо!");
      window.setTimeout(() => setNote(""), 5000);
      await load({ page: 1 });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка публикации");
    } finally {
      setBusy(false);
    }
  };

  const goToPage = async (p: number) => {
    await load({ page: p });
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const list = items ?? [];

  return (
    <div className="gkh-layout main-grid-container" data-gkf-layout="1">
      {/* ============ ЛЕВАЯ КОЛОНКА — «О разделе» (правка 1+2+3, 28.09.2026) ============
          Прежние блоки (Доступ + Локация) УБРАНЫ.
          «О разделе» перемещён сюда из правой колонки и оформлен в дизайне
          блока «Время» (.sakh-clock: тёмно-синяя шапка #1E3A5F, белое тело). */}
      <aside className="left-column">
        <div className="sakh-clock gkh-clock-block gkh-clock-about" data-gkf-about="1">
          <div className="sakh-clock-head">ℹ️ О разделе</div>
          <div className="sakh-clock-body sakh-clock-body-content">
            <div className="gkf-info" data-gkf-about-text="1">
              <p>
                «ЖКХ и городские проблемы» — это инструмент прямой фиксации коммунальных, дорожных и инфраструктурных проблем на
                Сахалине и Курилах.
              </p>
              <p>
                Раздел создан не для пустых споров, а для решения конкретных задач. Каждая карточка — это сухой сигнал для города,
                управляющих компаний и других жителей, позволяющий видеть реальную картину состояния ЖКХ в вашем районе в режиме
                реального времени.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ================= ЦЕНТРАЛЬНАЯ КОЛОНКА (Лента городских фактов) ================= */}
      <div className="center-column">
        <div className="gkf-head" data-gkf-head="1">
          {/* Пункт 1: заголовок; пункт 2: подзаголовок одной строкой. */}
          <h1 className="gkf-title" data-gkf-title="1">
            ЖКХ и городские проблемы
          </h1>
          <div className="gkf-desc" data-gkf-desc="1">
            Сухая фиксация коммунальных, дорожных и инфраструктурных проблем: факты, адреса, статусы — без лозунгов и обвинений.
          </div>
          {/* Пункт 3: кнопка дублирует левую колонку. */}
          <button className="gkf-newbtn" data-gkf-add-center="1" onClick={openForm}>
            + Зафиксировать проблему
          </button>
          {/* Пункт 4: поле поиска по проблемам. */}
          <div className="gkf-search">
            <input
              aria-label="Поиск по проблемам"
              data-gkf-search="1"
              value={q}
              maxLength={120}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
              placeholder="Поиск по проблемам…"
            />
            <button data-gkf-search-apply="1" onClick={applySearch}>
              Найти
            </button>
            {searching && (
              <button className="gkf-search-reset" data-gkf-search-reset="1" onClick={resetSearch}>
                Сбросить
              </button>
            )}
          </div>
          {/* Логика доступа п.1: гость кликнул «Зафиксировать проблему» →
              ДОСЛОВНАЯ строка ТЗ, форма НЕ открыта. */}
          {guestHint && (
            <div className="gkf-guesthint" data-gkf-guesthint="1" role="alert">
              {GKF_GUEST_HINT}
            </div>
          )}
        </div>

        {/* Форма из 3 ОБЯЗАТЕЛЬНЫХ шагов (только для вошедших). */}
        {formOpen && props.token && (
          <div className="gkf-form" data-gkf-form="1">
            {/* Шаг 1: суть проблемы без лозунгов. */}
            <div className="gkf-step" data-gkf-step1="1">
              <label className="gkf-steplabel" htmlFor="gkf-text">
                1. Что произошло? <span className="gkf-step-hint">Суть проблемы без лозунгов</span>
              </label>
              <textarea
                id="gkf-text"
                data-gkf-text="1"
                value={formText}
                maxLength={8000}
                onChange={(e) => {
                  setFormText(e.target.value);
                  setErr("");
                }}
                placeholder="Например: с 15 сентября нет горячего водоснабжения в третьем подъезде"
              />
            </div>
            {/* Шаг 2: точный адрес и время. */}
            <div className="gkf-step" data-gkf-step2="1">
              <label className="gkf-steplabel" htmlFor="gkf-place">
                2. Точный адрес и время <span className="gkf-step-hint">Где и с какого числа наблюдается проблема</span>
              </label>
              <div className="gkf-step2-grid">
                <input
                  id="gkf-place"
                  data-gkf-place="1"
                  list="gkf-form-locations"
                  value={formPlace}
                  maxLength={120}
                  onChange={(e) => setFormPlace(e.target.value)}
                  placeholder="Южно-Сахалинск, ул. Емельянова, д. 21"
                />
                <input
                  type="date"
                  aria-label="Дата начала проблемы"
                  data-gkf-date="1"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
              <datalist id="gkf-form-locations">
                {GKF_LOCATIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            {/* Шаг 3: предпринятые действия — ОБЯЗАТЕЛЬНОЕ поле. */}
            <div className="gkf-step" data-gkf-step3="1">
              <label className="gkf-steplabel" htmlFor="gkf-actions">
                3. Предпринятые действия <span className="gkf-step-hint">Куда уже звонили / писали и какой статус — обязательное поле</span>
              </label>
              <textarea
                id="gkf-actions"
                data-gkf-actions="1"
                value={formActions}
                maxLength={2000}
                onChange={(e) => {
                  setFormActions(e.target.value);
                  setErr("");
                }}
                placeholder="Например: коллективная заявка в УК №10 от 16.09, номер 4512-Ж; звонок в ЕДДС 115 — ответ пока не дан"
              />
            </div>
            <div className="gkf-formfoot">
              <button className="sk-btn-classic" data-gkf-publish="1" disabled={busy} onClick={publish} style={{ borderRadius: 0 }}>
                {busy ? "Публикация…" : "Опубликовать"}
              </button>
            </div>
            {/* ИИ-фильтр лозунгов (ТЗ №2 п.17): дословное сообщение,
                текст в форме СОХРАНЁН для переписывания. */}
            {rewrite && (
              <div className="gkf-rewrite" data-gkf-rewrite="1" role="alert">
                {GKF_REWRITE_MESSAGE}
              </div>
            )}
            {err && (
              <div className="gkf-err" data-gkf-err="1" role="alert">
                {err}
              </div>
            )}
          </div>
        )}

        <div ref={listTopRef} />

        {items === null && <div className="gkf-empty">Загрузка…</div>}

        {/* Пункт 5: лента карточек — плоский список, новые сверху. */}
        {items !== null && list.length === 0 && (
          <div className="gkf-empty" data-gkf-empty="1">
            {searching
              ? "По запросу ничего не найдено. Попробуйте изменить слова поиска или локацию."
              : "Сигналов пока нет — ваша может стать первой."}
          </div>
        )}

        {items !== null && list.length > 0 && (
          <div data-gkf-cards="1">
            {list.map((it) => {
              const stLabel = GKH_STATUS_LABELS[it.status] ?? it.status;
              const stCls = GKF_STATUS_CLASS[it.status] ?? "gkf-status is-search";
              return (
                <article key={it.id} className="gkf-card" data-gkf-card={it.id}>
                  <div className="gkf-card-top">
                    <span className="gkf-card-place" data-gkf-card-place={it.id}>
                      📍 {it.place}
                    </span>
                    <span className="gkf-card-nick" data-gkf-card-nick={it.id}>
                      {it.authorName || "Аноним"}
                    </span>
                    <span className="gkf-card-date" data-gkf-card-date={it.id}>
                      📅 {fmtDay(it.createdAt)}
                    </span>
                  </div>
                  {/* Текущий статус карточки (ТЗ №2): В поиске решения /
                      Передано в УК / Решено / Отклонено. */}
                  <div className="gkf-statusrow">
                    <span className={stCls} data-gkf-card-status={it.id}>
                      ⚠️ Текущий статус: {stLabel}
                    </span>
                  </div>
                  <div className="gkf-sep" />
                  {/* Суть проблемы — без лозунгов (Пункт 17 ТЗ №2). */}
                  <div className="gkf-card-row">
                    <span className="gkf-rowlabel">Проблема:</span>
                    <div className="gkf-card-text" data-gkf-card-text={it.id}>
                      {it.text}
                    </div>
                  </div>
                  {/* Предпринятые действия: куда звонили/писали, номер заявки. */}
                  <div className="gkf-card-row">
                    <span className="gkf-rowlabel">Действия:</span>
                    <div className="gkf-card-actions" data-gkf-card-actions={it.id}>
                      {it.actions || "—"}
                    </div>
                  </div>
                  <div className="gkf-sep" />
                  {/* Кнопка ТЗ №2: рубрика «Недвижимость ▸ ЖКХ и управляющие
                      компании» (статическая ссылка, относительный путь).
                      Справа, бирюзовая — указ заказчика 2026-09-23. */}
                  {/*
                    ТЗ 2026-09-24 «Обсудить на форуме — авто-создание темы»:
                    button вместо <a> — действие создаёт тему, а не навигация.
                    POST /api/discuss/gkh/<postId>:
                      • если есть topicId — редирект в существующую тему;
                      • если нет — создаёт тему в рубрике «ЖКХ и управляющие
                        компании» от имени текущего пользователя, привязывает
                        к проблеме, редиректит в новую тему.
                    Заголовок и текст темы берутся из полей title и text
                    модели GkhProblem (дополнительно — действия/статус через
                    отдельный JS-логику не формируем, оставляем как в публикации).
                  */}
                  <div className="gkf-card-foot">
                    <button
                      type="button"
                      className="gkf-btn-forum"
                      data-gkf-card-forum={it.id}
                      onClick={() => discussOnForum("gkh", it.id, props.token, props.onNeedAuth)}
                      title="Создать тему обсуждения в рубрике «ЖКХ и управляющие компании»"
                    >
                      💬 Обсудить на форуме ЖКХ
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Пагинация под лентой — как в других разделах. */}
        {items !== null && pages > 1 && (
          <div className="gkf-pager" data-gkf-pager="1">
            <button data-gkf-pager-prev="1" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
              ← Новее
            </button>
            <span data-gkf-pager-info="1">
              Страница {page} из {pages} · всего {total}
            </span>
            <button data-gkf-pager-next="1" disabled={page >= pages} onClick={() => goToPage(page + 1)}>
              Старее →
            </button>
          </div>
        )}
        {items !== null && pages === 1 && total > 0 && (
          <div className="gkf-pager" data-gkf-pager="1">
            <span data-gkf-pager-info="1">Всего {total} · новые сверху</span>
          </div>
        )}

        {note && (
          <div className="gkf-noteok" data-gkf-note="1" role="status">
            {note}
          </div>
        )}
      </div>

      {/* ============== ПРАВАЯ КОЛОНКА (Правила и философия) ============== */}
      {/* ==== ПРАВАЯ КОЛОНКА — Время + Правила (правки 28.09.2026) ====
          «О разделе» убран (теперь он в левой колонке).
          «Правила публикации» оформлены в дизайне блока «Время» (.sakh-clock). */}
      <aside className="right-column">
        <SakhDatetimeBlock />
        <div className="sakh-clock gkh-clock-block gkh-clock-rules" data-gkf-rules="1">
          <div className="sakh-clock-head">⚠️ Правила публикации</div>
          <div className="sakh-clock-body sakh-clock-body-content">
            <div className="gkf-keyrule">{GKF_RULES_INTRO}</div>
            <ul className="gkf-rules" data-gkf-rules-list="1">
              {GKF_RULES.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
