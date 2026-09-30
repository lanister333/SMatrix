"use client";

/**
 * ТЗ 2026-09-23 «О работодателях» — Flat 2.0 (Пункты 5/6/8/20 ТЗ №2).
 * Самостоятельная страница /o-rabotodatelyah: фиксация СУХОГО, изолированного
 * трудового опыта конкретного человека на острове. Этот раздел имеет самый
 * высокий юридический риск: мы НЕ собираем «чёрные списки» директоров и не
 * выносим публичных приговоров организациям.
 *
 * Трёхколоночная схема Flat 2.0:
 *  ◀️ ЛЕВАЯ КОЛОНКА (Доступ и Поиск компании):
 *     Блок 1 — кнопка «+ Описать трудовой опыт» + текст снизу (дословно ТЗ);
 *     Блок 2 — «Поиск по организации»: поле «Название компании или ИП» →
 *              «Найти» + фильтр по городам (Южно-Сахалинск, Холмск, Корсаков…).
 *  ⏺️ ЦЕНТРАЛЬНАЯ КОЛОНКА (Лента трудовых фактов): каждая карточка —
 *     изолированная белая карточка в тонкой светло-серой рамке:
 *     📍 Компания (Город) · 📅 Период работы · Личный опыт ·
 *     Особое упоминание человека (принцип «Человек ≠ Организация») ·
 *     дисклеймер · кнопка «💬 Обсудить на форуме» (справа).
 *     Вся живая жизнь, споры и разбор нюансов — в привязанной рубрике форума
 *     «Карьера, бизнес ▸ Работодатели»; на странице только сухой факт.
 *  ▶️ ПРАВАЯ КОЛОНКА (Описание раздела и Защита Персональных Данных):
 *     «О разделе» + «Правила публикации» в рамке (4 пункта дословно).
 *
 * Публикуют только зарегистрированные пользователи; гости только читают
 * ленту. Бездоказательные лозунги («там одни мошенники», «всегда всех
 * обманывают») отклоняются ИИ-фильтром без стирания текста формы.
 *
 * Комментариев, лайков, реакций, рейтингов, кармы, подписок, аватаров НЕТ.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import SakhDatetimeBlock from "@/components/site/sakh-datetime-block";
import type { ForumUser } from "@/lib/ui";
import { discussOnForum } from "@/lib/discuss";
import { SAKHALIN_CITIES } from "@/components/site/flat-board";

interface EmpItem {
  id: string;
  employer: string;
  city: string;
  workPeriod: string;
  experience: string;
  personMention: string;
  authorId: string;
  authorName: string;
  editedAt: string | null;
  createdAt: string;
  topicId: number | null;
  topicState?: string; // none | open | closed | archived
  isHiddenByAi?: boolean;
  hiddenReason?: string;
  needHuman?: boolean;
}

interface FeedResponse {
  posts: EmpItem[];
  total: number;
  page: number;
  pages: number;
}

const PAGE_SIZE = 15;

/** ДОСЛОВНЫЕ тексты ТЗ (левая колонка, гость, дисклеймер, правила). */
const EP_ACCESS_NOTE =
  "Оставлять отзывы о работодателях могут только зарегистрированные пользователи. Гости сайта могут только читать ленту";
const EP_GUEST_HINT =
  "Оставлять отзывы о работодателях могут только зарегистрированные пользователи. Пожалуйста, войдите в свой аккаунт";
const EP_DISCLAIMER =
  "* Публикация отражает личный опыт автора. SakhMatrix предоставляет площадку и скрывает личные контакты физлиц.";
const EP_RULES_INTRO = "Жесткие ограничения и правила:";
const EP_RULES = [
  "Пишите конкретно, с чем столкнулись лично: даты, условия работы, должностные обязанности, факты выплат или задержек. Бездоказательные лозунги («там одни мошенники», «всегда всех обманывают») отклоняются ИИ-фильтром.",
  "Запрет на личные данные физлиц: Категорически запрещено публиковать личные номера сотовых телефонов директоров, бухгалтеров или мастеров, их домашние адреса или паспортные данные. Только официальное название ООО / ИП и рабочие имена.",
  "Человек не равен организации: Помните, что плохой опыт с компанией не означает, что все её сотрудники плохие. Вы имеете право отдельно выделить и поблагодарить конкретного специалиста или руководителя за человеческое отношение.",
  "Дальнейшие обсуждения, споры и отзывы переводятся в целевую рубрику форума «Карьера, бизнес ▸ Работодатели» — переходите туда по кнопке под отзывом.",
];

/** Дата «23.09.2026» — компактная строка автора карточки. */
function fmtDay(v: string): string {
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Состояния кнопки форума: одинаковый размер и форма для всех (единая
 *  логика ТЗ 2026-09-23 «Кнопки „Обсудить на форуме"»). */
function forumButtonLabel(state: string | undefined): string {
  switch (state) {
    case "open":
      return "💬 Обсуждается на форуме";
    case "closed":
      return "💬 Тема закрыта";
    case "archived":
      return "💬 Тема в архиве";
    default:
      return "💬 Обсудить на форуме";
  }
}

export function EmployersPage(props: {
  user: ForumUser | null;
  token: string | null;
  notify: (m: string) => void;
  onNeedAuth: () => void;
}) {
  const [items, setItems] = useState<EmpItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  // Поиск по организации (левая колонка) + фильтр по городам.
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [city, setCity] = useState("");
  const [appliedCity, setAppliedCity] = useState("");

  // Форма: гость → ДОСЛОВНАЯ строка ТЗ (форма НЕ открывается);
  // авторизованный → форма карточки трудового опыта.
  const [formOpen, setFormOpen] = useState(false);
  const [guestHint, setGuestHint] = useState(false);
  const [rewrite, setRewrite] = useState(false); // ИИ-фильтр лозунгов сработал (Пункт 8 ТЗ №2)
  const [formEmployer, setFormEmployer] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formPeriod, setFormPeriod] = useState("");
  const [formExperience, setFormExperience] = useState("");
  const [formMention, setFormMention] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  const [highlightId, setHighlightId] = useState<string | null>(null);
  const listTopRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (opts: { page?: number; q?: string; city?: string } = {}) => {
      const p = opts.page ?? 1;
      const qq = opts.q ?? appliedQ;
      const cc = opts.city ?? appliedCity;
      const sp = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (qq) sp.set("q", qq);
      if (cc) sp.set("city", cc);
      try {
        const r = await fetch(`/api/employers?${sp.toString()}`);
        const d: FeedResponse = await r.json();
        setItems(d.posts ?? []);
        setTotal(Number(d.total ?? d.posts?.length ?? 0));
        setPage(Number(d.page ?? p));
        setPages(Math.max(1, Number(d.pages ?? 1)));
      } catch {
        setItems([]);
      }
    },
    [appliedQ, appliedCity]
  );

  // Применение поиска/города — без перезагрузки страницы.
  useEffect(() => {
    setItems(null);
    load({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedQ, appliedCity]);

  // Глубокая ссылка из темы форума: /o-rabotodatelyah?post=ID — подсветить карточку.
  useEffect(() => {
    const postId = new URLSearchParams(window.location.search).get("post");
    if (!postId) return;
    setHighlightId(postId);
    const t = window.setInterval(() => {
      const el = document.querySelector(`[data-ep-card="${postId}"]`);
      if (el) {
        el.scrollIntoView({ block: "center" });
        window.clearInterval(t);
        window.setTimeout(() => setHighlightId(null), 4000);
      }
    }, 300);
    window.setTimeout(() => window.clearInterval(t), 12000);
    return () => window.clearInterval(t);
  }, [items]);

  const applySearch = () => {
    setAppliedQ(q.trim());
    setAppliedCity(city.trim());
  };

  const resetSearch = () => {
    setQ("");
    setCity("");
    setAppliedQ("");
    setAppliedCity("");
  };

  const searching = !!(appliedQ || appliedCity);

  /** «+ Описать трудовой опыт»: гостю — ДОСЛОВНАЯ строка ТЗ (форма НЕ
   *  открывается), авторизованному — форма карточки опыта. */
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
    // Проверки дублируют API (одинаковые сообщения).
    if (formEmployer.trim().length < 2) {
      return setErr("Укажите официальное название компании или ИП");
    }
    if (!formCity.trim()) {
      return setErr("Выберите город, где находится организация");
    }
    if (formPeriod.trim().length < 2) {
      return setErr("Укажите период работы (например: май – август 2026 г.)");
    }
    if (formExperience.trim().length < 10) {
      return setErr("Опишите личный опыт: конкретно, с чем столкнулись лично (от 10 до 8000 символов)");
    }
    setBusy(true);
    try {
      const r = await fetch("/api/employers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: props.token,
          employer: formEmployer.trim(),
          city: formCity.trim(),
          workPeriod: formPeriod.trim(),
          experience: formExperience.trim(),
          personMention: formMention.trim(),
          confirmSimilar: true, // подсказка «похожий отзыв» не входит в ТЗ Flat 2.0
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        // ИИ-фильтр лозунгов (Пункт 8 ТЗ №2): публикация отклонена, но текст
        // НЕ стирается — форма остаётся с текстом автора, показывается
        // ДОСЛОВНОЕ сообщение с предложением переписать фактами.
        if (d.rewrite) {
          setRewrite(true);
          return;
        }
        throw Error(d.error || "Не удалось опубликовать карточку опыта.");
      }
      // Успех: форма закрывается, поля чистятся, карточка падает наверх ленты.
      setFormOpen(false);
      setFormEmployer("");
      setFormCity("");
      setFormPeriod("");
      setFormExperience("");
      setFormMention("");
      setNote(d.note || "Опыт опубликован. Спасибо!");
      props.notify(d.note || "Опыт опубликован. Спасибо!");
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
    <div className="ep-layout main-grid-container" data-ep-layout="1">
      {/* ============ ЛЕВАЯ КОЛОНКА — «О разделе» (правка 1+2+3, 28.09.2026) ============
          Прежние блоки (Доступ + Поиск по организации) УБРАНЫ.
          «О разделе» перемещён сюда из правой колонки и оформлен в дизайне
          блока «Время» (.sakh-clock: тёмно-синяя шапка #1E3A5F, белое тело). */}
      <aside className="left-column">
        <div className="sakh-clock ep-clock-block ep-clock-about" data-ep-about="1">
          <div className="sakh-clock-head">ℹ️ О разделе</div>
          <div className="sakh-clock-body sakh-clock-body-content">
            <div className="ep-info" data-ep-about-text="1">
              <p>
                «О работодателях» — это инструмент фиксации реального трудового опыта жителей Сахалина и Курил.
              </p>
              <p>
                Раздел создан не для травли или вынесения публичных приговоров организациям, а для обмена честными фактами. Мы
                не ведем «черных списков» компаний и не выносим коллективный вердикт. SakhMatrix предоставляет площадку для
                высказывания, но не является автором пользовательских утверждений.
              </p>
            </div>
          </div>
        </div>

        {/* 29.09.2026: блок «🏢 Правила ответа представителя» — пояснение
            для представителей организаций и жителей, как работает
            официальный ответ. В дизайне .sakh-clock, как все блоки. */}
        <div className="sakh-clock ep-clock-block ep-clock-orgrep">
          <div className="sakh-clock-head">🏢 Ответ представителя</div>
          <div className="sakh-clock-body sakh-clock-body-content">
            <div className="ep-info">
              <p>
                <b>Кто может ответить:</b> только подтверждённый представитель организации (статус orgRep устанавливает администратор). Обычный пользователь не может присвоить себе этот статус.
              </p>
              <p>
                <b>Сколько ответов:</b> ровно один официальный ответ на каждый отзыв. После ответа кнопка «🏢 Ответ организации» исчезает — публичная переписка не ведётся.
              </p>
              <p>
                <b>Что писать:</b> официальная позиция организации, пояснение обстоятельств, ход решения. Без эмоций и обвинений — только факты.
              </p>
              <p>
                <b>Разногласия сторон</b> не являются основанием для удаления ответа или отзыва. SakhMatrix не принимает чью-либо сторону и не ведёт «чёрных списков».
              </p>
              <p>
                <b>Человек ≠ Организация</b> — если в отзыве отмечен конкретный сотрудник, это не значит, что вся организация плохая или хорошая. Ответ представителя относится к организации, а не к личности.
              </p>
            </div>
          </div>
        </div>
      </aside>
      <div className="center-column">
        <div className="ep-head" data-ep-head="1">
          <h1 className="ep-title" data-ep-title="1">
            О работодателях
          </h1>
          <div className="ep-desc" data-ep-desc="1">
            Сухая фиксация личного трудового опыта: компания, период работы, факты — без лозунгов и «чёрных списков».
          </div>
          <button className="ep-newbtn" data-ep-add-center="1" onClick={openForm}>
            + Описать трудовой опыт
          </button>
          {/* Логика доступа: гость кликнул → ДОСЛОВНАЯ строка ТЗ, форма НЕ открыта. */}
          {guestHint && (
            <div className="ep-guesthint" data-ep-guesthint="1" role="alert">
              {EP_GUEST_HINT}
            </div>
          )}
        </div>

        {/* Форма карточки трудового опыта (только для вошедших). */}
        {formOpen && props.token && (
          <div className="ep-form" data-ep-form="1">
            <div className="ep-step" data-ep-field-employer="1">
              <label className="ep-steplabel" htmlFor="ep-f-employer">
                Компания / ИП <span className="ep-step-hint">Только официальное название организации</span>
              </label>
              <input
                id="ep-f-employer"
                data-ep-employer="1"
                value={formEmployer}
                maxLength={120}
                onChange={(e) => {
                  setFormEmployer(e.target.value);
                  setErr("");
                }}
                placeholder="Например: ООО «Сахалин-Строй-Ресурс»"
              />
            </div>
            <div className="ep-step2-grid" data-ep-field-city="1">
              <div>
                <label className="ep-steplabel" htmlFor="ep-f-city">
                  Город
                </label>
                <select
                  id="ep-f-city"
                  className="ep-cityfilter"
                  data-ep-city="1"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                >
                  <option value="">Выберите город…</option>
                  {SAKHALIN_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ep-steplabel" htmlFor="ep-f-period">
                  Период работы <span className="ep-step-hint">когда вы работали</span>
                </label>
                <input
                  id="ep-f-period"
                  data-ep-period="1"
                  value={formPeriod}
                  maxLength={120}
                  onChange={(e) => {
                    setFormPeriod(e.target.value);
                    setErr("");
                  }}
                  placeholder="Например: май – август 2026 г."
                />
              </div>
            </div>
            <div className="ep-step" data-ep-field-experience="1">
              <label className="ep-steplabel" htmlFor="ep-f-experience">
                Личный опыт <span className="ep-step-hint">конкретно: даты, условия, факты выплат или задержек — без лозунгов</span>
              </label>
              <textarea
                id="ep-f-experience"
                data-ep-experience="1"
                value={formExperience}
                maxLength={8000}
                onChange={(e) => {
                  setFormExperience(e.target.value);
                  setErr("");
                }}
                placeholder="Например: работал на строительном объекте в Дальнем. Возникла проблема с задержкой окончательного расчёта при увольнении на две недели."
              />
            </div>
            <div className="ep-step" data-ep-field-mention="1">
              <label className="ep-steplabel" htmlFor="ep-f-mention">
                Особое упоминание человека <span className="ep-step-hint">необязательно — «Человек ≠ Организация»: можно отдельно поблагодарить сотрудника (только рабочее имя, без телефонов и адресов)</span>
              </label>
              <textarea
                id="ep-f-mention"
                data-ep-mention="1"
                value={formMention}
                maxLength={2000}
                onChange={(e) => {
                  setFormMention(e.target.value);
                  setErr("");
                }}
                placeholder="Например: отдельно хочу отметить начальника участка Дмитрия Николаевича — он лично контролировал ведомости и помог мне закрыть смены. К его работе претензий нет."
                style={{ minHeight: 66 }}
              />
            </div>
            <div className="ep-formfoot">
              <button className="sk-btn-classic" data-ep-publish="1" disabled={busy} onClick={publish} style={{ borderRadius: 0 }}>
                {busy ? "Проверка ИИ…" : "Опубликовать"}
              </button>
            </div>
            {/* ИИ-фильтр лозунгов (Пункт 8 ТЗ №2): дословное сообщение,
                текст в форме СОХРАНЁН для переписывания. */}
            {rewrite && (
              <div className="ep-rewrite" data-ep-rewrite="1" role="alert">
                Публикация отклонена ИИ-фильтром. {err || "Пожалуйста, переформулируйте: укажите конкретный факт (с чем вы столкнулись лично: даты, условия работы, факты выплат или задержек). Бездоказательные лозунги («там одни мошенники», «всегда всех обманывают») отклоняются ИИ-фильтром"}
              </div>
            )}
            {err && !rewrite && (
              <div className="ep-err" data-ep-err="1" role="alert">
                {err}
              </div>
            )}
          </div>
        )}

        <div ref={listTopRef} />

        {items === null && <div className="ep-empty">Загрузка…</div>}

        {items !== null && list.length === 0 && (
          <div className="ep-empty" data-ep-empty="1">
            {searching
              ? "По запросу ничего не найдено. Попробуйте изменить название компании или город."
              : "Пока нет карточек опыта — ваша может стать первой."}
          </div>
        )}

        {/* Лента карточек: изолированные белые карточки в тонкой светло-серой
            рамке, новые сверху (ТЗ Flat 2.0). */}
        {items !== null && list.length > 0 && (
          <div data-ep-cards="1">
            {list.map((it) => {
              const state = it.topicId ? it.topicState ?? "open" : "none";
              return (
                <article key={it.id} className={`ep-card${highlightId === it.id ? " ep-highlight" : ""}`} data-ep-card={it.id}>
                  <div className="ep-card-top">
                    <span className="ep-card-place" data-ep-card-place={it.id}>
                      📍 {it.employer} ({it.city})
                    </span>
                    <span className="ep-card-meta" data-ep-card-meta={it.id}>
                      {it.authorName || "Аноним"} · {fmtDay(it.createdAt)}
                      {it.editedAt ? " · изменено автором" : ""}
                    </span>
                  </div>
                  {/* 📅 Период работы — строка ТЗ. */}
                  {it.workPeriod && (
                    <div className="ep-card-period" data-ep-card-period={it.id}>
                      📅 Период работы: {it.workPeriod}
                    </div>
                  )}
                  <div className="ep-sep" />
                  {/* Личный опыт — сухой факт без лозунгов (Пункт 8 ТЗ №2). */}
                  <div className="ep-card-row">
                    <span className="ep-rowlabel">Личный опыт:</span>
                    <div className="ep-card-text" data-ep-card-text={it.id}>
                      {it.experience}
                    </div>
                  </div>
                  {/* «Человек ≠ Организация» (Пункты 5/6 ТЗ №2): отдельно
                      выделяем хорошего сотрудника, даже если компания подвела. */}
                  {it.personMention && (
                    <div className="ep-card-row" data-ep-card-mention-row={it.id}>
                      <span className="ep-rowlabel">Особое упоминание человека:</span>
                      <div className="ep-card-text ep-card-mention" data-ep-card-mention={it.id}>
                        {it.personMention}
                      </div>
                    </div>
                  )}
                  <div className="ep-sep" />
                  {/* Дисклеймер (ТЗ, юридическая защита площадки). */}
                  <div className="ep-card-disclaimer" data-ep-card-disclaimer={it.id}>
                    {EP_DISCLAIMER}
                  </div>
                  {/*
                    ТЗ 2026-09-24 «Обсудить на форуме — авто-создание темы»:
                    button вместо <a> — действие создаёт тему, а не навигация.
                    POST /api/discuss/employers/<postId>:
                      • если есть topicId — редирект в существующую тему;
                      • если нет — создаёт тему в рубрике «Работодатели» от
                        имени текущего пользователя, привязывает к карточке,
                        редиректит в новую тему.
                    Тема формируется из employer + city + workPeriod + experience
                    + personMention (новые поля Flat 2.0, не legacy title/text).
                  */}
                  <div className="ep-card-foot">
                    {/* 29.09.2026: орг. ответ — ВО ВСЮ ШИРИНУ карточки. */}
                    {it.orgResponseText ? (
                      <div style={{ width: "100%", padding: "6px 8px", background: "#e0f2fe", border: "1px solid #0284c7", borderRadius: "2px", marginBottom: "6px", fontSize: "13px", boxSizing: "border-box" }}>
                        <b style={{ color: "#075985" }}>🏢 Официальный ответ организации</b>
                        {it.orgResponseByName ? <span style={{ color: "#56657a" }}> · {it.orgResponseByName}</span> : null}
                        <p style={{ margin: "4px 0 0", color: "#1a2433" }}>{it.orgResponseText}</p>
                      </div>
                    ) : null}
                    {/* 29.09.2026: «🏢 Ответ организации» — В ОДНОЙ строке с «💬 Обсудить на форуме» (оба справа). */}
                    {props.user?.orgRep && props.user.id !== it.authorId && !it.orgResponseText && props.token ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const text = window.prompt("Введите официальный ответ организации:");
                            if (!text || text.trim().length < 10) { props.notify("Текст ответа: от 10 символов"); return; }
                            try {
                              const r = await fetch(`/api/employers/${it.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ token: props.token, action: "orgResponse", text: text.trim() }),
                              });
                              const d = await r.json();
                              if (!r.ok) { props.notify(d.error || "Ошибка"); return; }
                              props.notify(d.note || "Ответ опубликован");
                              load();
                            } catch { props.notify("Сеть недоступна"); }
                          }}
                          title="Официальный ответ организации — виден только представителю, ровно один ответ"
                          style={{ cursor: "pointer", background: "#0a5caa", border: "1px solid #084c8b", color: "#fff", padding: "6px 14px", fontFamily: "inherit", fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap", borderRadius: "2px" }}
                        >
                          🏢 Ответ организации
                        </button>
                    ) : null}
                    {/* 29.09.2026: «💬 Обсудить на форуме» — ПОД ответом организации,
                        на отдельной строке. */}
                    <button
                      type="button"
                      className={`ep-btn-forum is-${state}`}
                      data-ep-card-forum={it.id}
                      onClick={() => discussOnForum("employers", it.id, props.token, props.onNeedAuth)}
                      title="Создать тему обсуждения в рубрике «Карьера, бизнес ▸ Работодатели»"
                    >
                      {forumButtonLabel(it.topicId ? it.topicState : "none")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Пагинация под лентой — как в других разделах. */}
        {items !== null && pages > 1 && (
          <div className="ep-pager" data-ep-pager="1">
            <button data-ep-pager-prev="1" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
              ← Новее
            </button>
            <span data-ep-pager-info="1">
              Страница {page} из {pages} · всего {total}
            </span>
            <button data-ep-pager-next="1" disabled={page >= pages} onClick={() => goToPage(page + 1)}>
              Старее →
            </button>
          </div>
        )}
        {items !== null && pages === 1 && total > 0 && (
          <div className="ep-pager" data-ep-pager="1">
            <span data-ep-pager-info="1">Всего {total} · новые сверху</span>
          </div>
        )}

        {note && (
          <div className="ep-noteok" data-ep-note="1" role="status">
            {note}
          </div>
        )}
      </div>

      {/* ==== ПРАВАЯ КОЛОНКА — Время + Правила (правки 28.09.2026) ====
          «О разделе» убран (теперь он в левой колонке).
          «Правила публикации» оформлены в дизайне блока «Время» (.sakh-clock). */}
      <aside className="right-column">
        <SakhDatetimeBlock />
        <div className="sakh-clock ep-clock-block ep-clock-rules" data-ep-rules="1">
          <div className="sakh-clock-head">⚠️ Правила публикации</div>
          <div className="sakh-clock-body sakh-clock-body-content">
            <div className="ep-rulesframe" data-ep-rules-frame="1">
              <div className="ep-keyrule">{EP_RULES_INTRO}</div>
              <ul className="ep-ruleslist" data-ep-rules-list="1">
                {EP_RULES.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
