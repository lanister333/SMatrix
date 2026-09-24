"use client";

/**
 * ТЗ 2026-09-22 — блоки «Знакомства» и «Объявления» в СТРОГОМ МИНИМАЛИЗМЕ
 * (Flat 2.0). Один общий компонент для обоих блоков (структура ТЗ
 * идентична: вкладки → лента карточек → форма добавления → СМС-верификация).
 *
 * ДОСЛОВНЫЕ требования ТЗ и их реализация:
 *  1. ВКЛАДКИ НА ГЛАВНОЙ СТРАНИЦЕ — переключение между простыми текстовыми
 *     вкладками-кнопками («Знакомства» — 4, «Объявления» — 3). Компонент
 *     смонтирован на Главной (под сеткой центральной колонки) и на
 *     самостоятельных страницах /znakomstva и /obyavleniya.
 *  2. ЛЕНТА — каждое объявление: ОТДЕЛЬНАЯ БЕЛАЯ КАРТОЧКА в ТОНКОЙ
 *     СВЕТЛО-СЕРОЙ РАМКЕ (1px #d4d4d8, фон #fff, без теней/градиентов/
 *     скруглений — строгий флэт). Внутри ТОЛЬКО город, дата и текст
 *     пользователя с его ПРЯМЫМИ контактами. Личный номер в тексте НЕ
 *     скрывается (никакой маскировки нет — текст выводится как введён).
 *  3. ФОРМА («Добавить объявление») — выбор вкладки-переключателя, поле
 *     «Город» (выпадающий список сахалинских городов + свободный ввод,
 *     datalist), ОДНО общее текстовое поле («Ваше объявление и контакты» /
 *     «Описание и ваши контакты для связи»). Поля возраста, фото-галереи и
 *     встроенные чаты ОТСУТСТВУЮТ (убраны ТЗ; чатов в разделе и не было).
 *  4. СМС-ВЕРИФИКАЦИЯ — перед финальной публикацией показывается поле с
 *     ДОСЛОВНОЙ подписью ТЗ «Введите код из СМС, отправленный на ваш номер
 *     телефона»; публикация разрешена только после успешного ввода кода.
 *     Номер запрашивается на шаге СМС («Ваш номер телефона для получения
 *     кода» — импровизация: ТЗ не указывает, откуда берётся номер).
 *
 * ТЗ 2026-09-23 «Знакомства (Love Sakh)» — для блока dating введён режим
 * publishMode="direct": авторизованный пользователь публикует НАПРЯМУЮ
 * (вкладка → город → текст → «Опубликовать» → объявление наверх ленты);
 * гостю — ДОСЛОВНАЯ строка из ТЗ. Шаг СМС у блока снят; у блока «Объявления»
 * (ads) прежний двухшаговый режим сохранён без изменений.
 *
 * ЗАДОКУМЕНТИРОВАННЫЕ ИМПРОВИЗАЦИИ:
 *  — демо-режим СМС: шлюза в сборке нет, код приходит из /api/sms (devCode)
 *    и показывается в форме с пометкой о демо-режиме;
 *  — статусные записи (Неактуально / Снято с публикации) прежних ТЗ не
 *    удаляются — показываются ниже актуальных серым (минимализм: без
 *    бейджей, просто серый текст);
 *  — «Показать ещё» — простая текстовая кнопка дозагрузки ленты;
 *  — строгий флэт: радиусы 0, никаких теней; акцент — фирменный
 *    тёмно-синий #1E3A5F, рамки #d4d4d8.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/site/chrome";

export interface FlatTab {
  key: string;
  label: string;
}

export interface FlatBoardProps {
  /** Идентификатор блока для проб: "dating" | "ads". */
  boardId: "dating" | "ads";
  heading: string;
  tabs: FlatTab[];
  /** ?category= / ?rubric= в GET ленты. */
  tabParam: "category" | "rubric";
  /** Имя поля вкладки в POST. */
  postKey: "category" | "rubric";
  apiPath: string;
  textareaLabel: string;
  textareaPlaceholder: string;
  emptyText: string;
  /** ТЗ 2026-09-23 «Знакомства»: ДОСЛОВНАЯ строка, которую видит гость
   *  при клике «Добавить объявление» (форма НЕ открывается). */
  guestHintText?: string;
  /** ТЗ 2026-09-23 «Знакомства»: "публикует напрямую" — одна кнопка
   *  «Опубликовать», без шага СМС. По умолчанию "sms" — прежний
   *  двухшаговый режим (сохранён у блока «Объявления»). */
  publishMode?: "direct" | "sms";
  /** ТЗ 2026-09-23 «Объявления»: кнопка «+ Разместить объявление» живёт
   *  в ЛЕВОЙ колонке страницы — блок управляется родителем (controlled):
   *  родитель открывает/закрывает форму через open/onOpenChange. */
  controlledOpen?: boolean;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  /** Скрыть внутреннюю кнопку добавления и внутреннюю гостевую подсказку
   *  (кнопка и примечание о доступе — в левой колонке страницы). */
  hideAddButton?: boolean;
  /** Фильтр города из левой колонки (ТЗ «Фильтр городов Сахалина»):
   *  добавляется в GET ленты (?place=). */
  placeFilter?: string;
}

/** Дата «26.04.2025» — как в соседних блоках сайта. */
/** ТЗ 2026-09-23 «Знакомства»: показывать ДАТУ/ВРЕМЯ публикации
 *  («23.09.2026, 05:44») — прежде была только дата. */
function fmtDay(v: string): string {
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** Города Сахалина для выпадающего списка «Город» (+ свободный ввод). */
export const SAKHALIN_CITIES = [
  "Южно-Сахалинск",
  "Корсаков",
  "Холмск",
  "Долинск",
  "Невельск",
  "Поронайск",
  "Южно-Курильск",
  "Углегорск",
  "Макаров",
  "Смирных",
  "Томари",
  "Тымовское",
  "Александровск-Сахалинский",
  "Оха",
  "Ноглики",
  "Анива",
  "Шахтёрск",
];

/** Стиль строгого флэта: белая карточка в тонкой рамке — окантовка КАК У
 *  БЛОКА С ЧАСАМИ #4A688C (директива 2026-09-24, распространена на
 *  «Знакомства» и «Объявления»; было #d4d4d8, ещё раньше #e4e4e7). */
const FLAT_BORDER = "1px solid #4A688C";

/** Дословная подпись поля кода (пункт 4 ТЗ). */
export const SMS_CODE_LABEL =
  "Введите код из СМС, отправленный на ваш номер телефона";

type FeedItem = {
  id: string;
  body: string;
  text?: string;
  place: string;
  /** ТЗ 2026-09-23: ник автора (без аватара); пусто → «Аноним». */
  nick?: string;
  status: string;
  createdAt: string;
};

const PAGE_SIZE = 50;

export default function FlatBoard(props: FlatBoardProps) {
  const { user, token } = useAuth();
  const [tab, setTab] = useState(props.tabs[0]?.key ?? "");
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  // Гость нажал «Добавить объявление» → показываем примечание о входе.
  const [guestHint, setGuestHint] = useState(false);
  const [formTab, setFormTab] = useState(props.tabs[0]?.key ?? "");
  const [city, setCity] = useState("");
  const [text, setText] = useState("");
  // Двухшаговая форма ТЗ: поля объявления → шаг СМС-верификации.
  const [stage, setStage] = useState<"form" | "sms">("form");
  const [phone, setPhone] = useState("");
  const [devCode, setDevCode] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(
    async (opts: { tab?: string; page?: number; append?: boolean } = {}) => {
      const t = opts.tab ?? tab;
      const p = opts.page ?? 1;
      const sp = new URLSearchParams({
        [props.tabParam]: t,
        page: String(p),
        pageSize: String(PAGE_SIZE),
      });
      // ТЗ 2026-09-23 «Объявления»: фильтр города из левой колонки страницы.
      const pf = (props.placeFilter ?? "").trim();
      if (pf) sp.set("place", pf);
      try {
        const r = await fetch(`${props.apiPath}?${sp.toString()}`);
        const d = await r.json();
        const rows: FeedItem[] = (d.posts ?? []).map((x: Record<string, unknown>) => ({
          id: String(x.id),
          body: String(x.body ?? x.text ?? ""),
          place: String(x.place ?? ""),
          /* ТЗ 2026-09-23: ник автора (без аватара) или «Аноним». */
          nick: String(x.nick ?? ""),
          status: String(x.status ?? "actual"),
          createdAt: String(x.createdAt ?? ""),
        }));
        setItems((prev) => (opts.append && prev ? [...prev, ...rows] : rows));
        setPage(p);
        setPages(Math.max(1, Number(d.pages ?? 1)));
      } catch {
        if (!opts.append) setItems([]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab, props.tabParam, props.apiPath, props.placeFilter]
  );

  useEffect(() => {
    setItems(null);
    load({ tab });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, props.placeFilter]);

  const changeText = (v: string) => {
    setText(v);
    setErr("");
  };

  const openForm = () => {
    // Гость: форму не открываем — показываем примечание о входе (как на
    // форме ответа форума).
    if (!(user && token)) {
      setGuestHint(true);
      return;
    }
    setGuestHint(false);
    setFormOpen(true);
    setStage("form");
    setFormTab(tab);
    setErr("");
    setNote("");
  };

  const toSmsStep = () => {
    setErr("");
    if (!formTab) return setErr("Выберите вкладку объявления.");
    if (city.trim().length < 2) return setErr("Укажите город.");
    if (text.trim().length < 10) return setErr("Напишите текст объявления (от 10 символов).");
    setStage("sms");
  };

  const requestCode = async () => {
    setErr("");
    setDevCode("");
    if (phone.replace(/\D/g, "").length < 10) {
      setErr("Укажите корректный номер телефона — на него придёт код подтверждения.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось отправить код. Попробуйте ещё раз.");
      setDevCode(String(d.devCode ?? ""));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка отправки кода");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setErr("");
    setNote("");
    // ТЗ 2026-09-23 «Знакомства» (прямая публикация): валидация та же,
    // что у двухшагового режима, но кнопка «Опубликовать» отправляет
    // объявление СРАЗУ — без шага СМС.
    if (props.publishMode === "direct") {
      if (!formTab) return setErr("Выберите вкладку объявления.");
      if (city.trim().length < 2) return setErr("Укажите город.");
      if (text.trim().length < 10) return setErr("Напишите текст объявления (от 10 символов).");
    }
    setBusy(true);
    try {
      const r = await fetch(props.apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          [props.postKey]: formTab,
          place: city.trim(),
          text: text.trim(),
          /* ТЗ 2026-09-23: в прямой публикации (dating) СМС-полей нет; они
             уходят только в прежнем двухшаговом режиме (блок «Объявления»,
             у которого publishMode не задан — по умолчанию СМС-режим). */
          ...(props.publishMode !== "direct" ? { smsPhone: phone, smsCode: code.trim() } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось опубликовать объявление.");
      // Успех: форма закрывается (в controlled-режиме — через родителя),
      // лента обновляется, поля чистятся.
      if (props.controlledOpen) props.onOpenChange?.(false);
      else setFormOpen(false);
      setStage("form");
      setCity("");
      setText("");
      setPhone("");
      setCode("");
      setDevCode("");
      setNote(d.note || "Объявление опубликовано. Спасибо!");
      window.setTimeout(() => setNote(""), 4000);
      await load({ tab: formTab === tab ? tab : formTab });
      if (formTab !== tab) setTab(formTab);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка публикации");
    } finally {
      setBusy(false);
    }
  };

  const tabBtn = (active: boolean): React.CSSProperties =>
    active
      ? {
          background: "#1E3A5F",
          color: "#fff",
          border: `1px solid #1E3A5F`,
          borderRadius: 0,
          padding: "7px 12px",
          fontSize: 13.5,
          cursor: "pointer",
        }
      : {
          background: "#fff",
          color: "#1a1a1a",
          border: FLAT_BORDER,
          borderRadius: 0,
          padding: "7px 12px",
          fontSize: 13.5,
          cursor: "pointer",
        };

  // Форма: в controlled-режиме (ТЗ 2026-09-23 «Объявления») состоянием
  // владеет родитель (кнопка в ЛЕВОЙ колонке страницы), иначе — внутренний
  // стейт formOpen (прежнее поведение блоков).
  const formShown = props.controlledOpen ? !!props.open : formOpen;

  return (
    <section data-flat-board={props.boardId} aria-label={props.heading} style={{ marginTop: 18 }}>
      {/* Минималистичный заголовок блока (без панельной шапки — строгий флэт). */}
      <h2
        style={{
          margin: "0 0 10px",
          fontSize: 16,
          fontWeight: 700,
          color: "#1a1a1a",
          fontFamily: "inherit",
        }}
      >
        {props.heading}
      </h2>

      {/* Пункт 1 ТЗ: простые текстовые вкладки-кнопки. */}
      <div data-flat-tabs="1" role="tablist" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {props.tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            data-flat-tab={t.key}
            style={tabBtn(tab === t.key)}
            onClick={() => setTab(t.key)}
          >
            {`[ ${t.label} ]`}
          </button>
        ))}
      </div>

      {/* Пункт 2 ТЗ: лента — белые карточки в тонкой светло-серой рамке:
          только город, дата и текст пользователя с прямыми контактами. */}
      <div data-flat-cards="1" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items === null ? (
          <div style={{ fontSize: 13.5, color: "#6b7280" }}>Загрузка…</div>
        ) : items.length === 0 ? (
          <div data-flat-empty="1" style={{ fontSize: 13.5, color: "#6b7280" }}>
            {props.emptyText}
          </div>
        ) : (
          items.map((it) => {
            const dim = it.status !== "actual" && it.status !== "active";
            return (
              <article
                key={it.id}
                data-flat-card={it.id}
                style={{
                  background: "#fff",
                  border: FLAT_BORDER,
                  borderRadius: 0,
                  padding: "10px 12px",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span
                    data-flat-card-city={it.id}
                    style={{ fontSize: 13.5, fontWeight: 700, color: "#1a1a1a" }}
                  >
                    {it.place}
                  </span>
                  {/* ТЗ 2026-09-23: ник автора БЕЗ аватара (гостям и авторам
                      без ника — «Аноним»); сортировка ленты — новые сверху. */}
                  <span
                    data-flat-card-nick={it.id}
                    style={{ fontSize: 12.5, fontWeight: 600, color: "#0a5caa" }}
                  >
                    {it.nick || "Аноним"}
                  </span>
                  <span
                    data-flat-card-date={it.id}
                    style={{ fontSize: 12.5, color: "#9ca3af", marginLeft: "auto" }}
                  >
                    {fmtDay(it.createdAt)}
                  </span>
                </div>
                <div
                  data-flat-card-text={it.id}
                  style={{
                    marginTop: 5,
                    fontSize: 14,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    color: dim ? "#9ca3af" : "#1a1a1a",
                    fontFamily: "inherit",
                  }}
                >
                  {it.body}
                </div>
              </article>
            );
          })
        )}
      </div>
      {items !== null && page < pages && (
        <button
          data-flat-more="1"
          style={{
            marginTop: 10,
            background: "#fff",
            border: FLAT_BORDER,
            borderRadius: 0,
            padding: "7px 12px",
            fontSize: 13,
            cursor: "pointer",
            color: "#1E3A5F",
          }}
          onClick={() => load({ page: page + 1, append: true })}
        >
          Показать ещё
        </button>
      )}

      {/* Пункт 3 ТЗ: кнопка «Добавить объявление» открывает простую форму.
          ТЗ 2026-09-23 «Объявления»: hideAddButton — кнопка живёт в ЛЕВОЙ
          колонке страницы, внутренняя скрыта. */}
      {!props.hideAddButton && !formOpen && (
        <div style={{ marginTop: 12 }}>
          <button
            className="sk-btn-classic"
            data-flat-add="1"
            onClick={openForm}
            style={{ borderRadius: 0 }}
          >
            Добавить объявление
          </button>
        </div>
      )}

      {!props.hideAddButton && guestHint && (
        <div data-flat-guest="1" style={{ marginTop: 12, fontSize: 13, color: "#475569" }}>
          {/* ТЗ 2026-09-23 «Знакомства»: дословная строка; блоку «Объявления»
              остаётся прежний текст (проп по умолчанию). */}
          {props.guestHintText ??
            "Добавлять объявления могут только зарегистрированные пользователи. Войдите или зарегистрируйтесь — ссылка в левой колонке форума."}
        </div>
      )}

      {formShown && (
        <div
          data-flat-form="1"
          style={{ marginTop: 12, background: "#fff", border: FLAT_BORDER, borderRadius: 0, padding: "12px" }}
        >
            {/* Выбор одной из вкладок (переключатель). */}
            <div data-flat-form-tabs="1" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {props.tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  data-flat-form-tab={t.key}
                  style={tabBtn(formTab === t.key)}
                  onClick={() => setFormTab(t.key)}
                >
                  {`[ ${t.label} ]`}
                </button>
              ))}
            </div>

            {/* Поле «Город»: выпадающий список сахалинских городов + свободный ввод. */}
            <div style={{ marginTop: 10 }}>
              <label htmlFor={`${props.boardId}-city`} style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3f3f46" }}>
                Город
              </label>
              <input
                id={`${props.boardId}-city`}
                data-flat-city="1"
                list={`${props.boardId}-cities`}
                value={city}
                maxLength={80}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Южно-Сахалинск"
                style={{
                  marginTop: 4,
                  width: "100%",
                  boxSizing: "border-box",
                  border: FLAT_BORDER,
                  borderRadius: 0,
                  background: "#fff",
                  padding: "7px 9px",
                  fontSize: 13.5,
                  fontFamily: "inherit",
                }}
              />
              <datalist id={`${props.boardId}-cities`}>
                {SAKHALIN_CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            {/* Одно общее текстовое поле ТЗ. */}
            <div style={{ marginTop: 10 }}>
              <label htmlFor={`${props.boardId}-text`} style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3f3f46" }}>
                {props.textareaLabel}
              </label>
              <textarea
                id={`${props.boardId}-text`}
                data-flat-text="1"
                value={text}
                maxLength={8000}
                onChange={(e) => changeText(e.target.value)}
                placeholder={props.textareaPlaceholder}
                style={{
                  marginTop: 4,
                  width: "100%",
                  minHeight: 90,
                  boxSizing: "border-box",
                  resize: "vertical",
                  border: FLAT_BORDER,
                  borderRadius: 0,
                  background: "#fff",
                  padding: "7px 9px",
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  fontFamily: "inherit",
                }}
              />
            </div>

            {stage === "form" ? (
              props.publishMode === "direct" ? (
                /* ТЗ 2026-09-23 «Знакомства»: публикация напрямую, без СМС. */
                <div style={{ marginTop: 10 }}>
                  <button
                    className="sk-btn-classic"
                    data-flat-publish="1"
                    disabled={busy}
                    onClick={publish}
                    style={{ borderRadius: 0 }}
                  >
                    {busy ? "Публикация…" : "Опубликовать"}
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: 10 }}>
                  <button
                    className="sk-btn-classic"
                    data-flat-next="1"
                    disabled={busy}
                    onClick={toSmsStep}
                    style={{ borderRadius: 0 }}
                  >
                    Далее: подтверждение по СМС
                  </button>
                </div>
              )
            ) : (
              /* Пункт 4 ТЗ: СМС-верификация перед финальной публикацией. */
              <div data-flat-sms="1" style={{ marginTop: 12, borderTop: FLAT_BORDER, paddingTop: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#3f3f46" }}>
                  Подтверждение по СМС
                </div>
                <div style={{ marginTop: 8 }}>
                  <label htmlFor={`${props.boardId}-phone`} style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3f3f46" }}>
                    Ваш номер телефона для получения кода
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                    <input
                      id={`${props.boardId}-phone`}
                      data-flat-sms-phone="1"
                      value={phone}
                      maxLength={20}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+7 924 123-45-67"
                      style={{
                        flex: "1 1 200px",
                        border: FLAT_BORDER,
                        borderRadius: 0,
                        background: "#fff",
                        padding: "7px 9px",
                        fontSize: 13.5,
                        fontFamily: "inherit",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      className="sk-btn-classic"
                      data-flat-sms-send="1"
                      disabled={busy}
                      onClick={requestCode}
                      style={{ borderRadius: 0 }}
                    >
                      Получить код
                    </button>
                  </div>
                </div>
                {devCode && (
                  <div
                    data-flat-sms-devcode="1"
                    style={{ marginTop: 8, fontSize: 12.5, color: "#6b7280" }}
                  >
                    {`(демо-режим сайта: SMS-шлюз не подключён — код показан здесь: ${devCode})`}
                  </div>
                )}
                <div style={{ marginTop: 10 }}>
                  {/* ДОСЛОВНАЯ подпись поля кода из ТЗ. */}
                  <label htmlFor={`${props.boardId}-code`} style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3f3f46" }}>
                    {SMS_CODE_LABEL}
                  </label>
                  <input
                    id={`${props.boardId}-code`}
                    data-flat-sms-code="1"
                    value={code}
                    maxLength={10}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="12345"
                  style={{
                    marginTop: 4,
                    width: "160px",
                    border: FLAT_BORDER,
                    borderRadius: 0,
                    background: "#fff",
                    padding: "7px 9px",
                    fontSize: 14,
                    letterSpacing: 2,
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <button
                    className="sk-btn-classic"
                    data-flat-publish="1"
                    disabled={busy}
                    onClick={publish}
                    style={{ borderRadius: 0 }}
                  >
                    {busy ? "Публикация…" : "Опубликовать объявление"}
                  </button>
                  <button
                    data-flat-back="1"
                    onClick={() => setStage("form")}
                    style={{
                      background: "#fff",
                      border: FLAT_BORDER,
                      borderRadius: 0,
                      padding: "7px 12px",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Назад к тексту
                  </button>
                </div>
              </div>
            )}
      </div>
      )}

      {note && (
        <div data-flat-note="1" style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: "#2E7D32" }}>
          {note}
        </div>
      )}
      {err && (
        <div data-flat-err="1" role="alert" style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: "#AA3333" }}>
          {err}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Конфигурации двух блоков ТЗ                                         */
/* ------------------------------------------------------------------ */

/** Блок «Знакомства» — Flat 2.0: 4 вкладки (пункт 1 ТЗ дословно). */
export const FLAT_DATING_BOARD: FlatBoardProps = {
  boardId: "dating",
  heading: "Знакомства",
  tabs: [
    { key: "m4w", label: "Мужчина ищет женщину" },
    { key: "w4m", label: "Женщина ищет мужчину" },
    { key: "friendship", label: "Дружба / Общение" },
    { key: "person", label: "Ищу человека / Благодарность" },
  ],
  tabParam: "category",
  postKey: "category",
  apiPath: "/api/znakomstva",
  textareaLabel: "Ваше объявление и контакты",
  textareaPlaceholder:
    "Кого и для чего ищете, город, любые удобные вам контакты: WhatsApp, Telegram, телефон или соцсеть",
  emptyText: "Объявлений пока нет — ваше может стать первым.",
  /* ТЗ 2026-09-23 «Знакомства (Love Sakh)»: дословное сообщение гостю
     при клике «Добавить объявление» (форма для гостя НЕ открывается). */
  guestHintText:
    "Публикация объявлений доступна только зарегистрированным жителям города. Пожалуйста, войдите в свой аккаунт на форуме",
  /* ТЗ 2026-09-23: авторизованный публикует напрямую — форма без шага СМС. */
  publishMode: "direct",
};

/** Блок «Объявления» — некоммерческая доска взаимопомощи: 3 вкладки (ТЗ дословно). */
export const FLAT_ADS_BOARD: FlatBoardProps = {
  boardId: "ads",
  heading: "Объявления — некоммерческая доска взаимопомощи",
  tabs: [
    { key: "give", label: "Отдам даром / Поделюсь" },
    { key: "need", label: "Приму в дар / Нужна помощь" },
    { key: "lostfound", label: "Бюро находок (Потерял / Нашёл)" },
  ],
  tabParam: "rubric",
  postKey: "rubric",
  apiPath: "/api/obyavleniya",
  textareaLabel: "Описание и ваши контакты для связи",
  textareaPlaceholder:
    "Что отдаёте или ищете, город, любые удобные вам контакты: WhatsApp, Telegram, телефон или соцсеть. Продажа вещей, авто и недвижимости исключена.",
  emptyText: "Объявлений пока нет — ваше может стать первым.",
};
