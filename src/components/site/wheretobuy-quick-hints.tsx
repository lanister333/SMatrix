"use client";

/**
 * ТЗ 2026-09-22. Панель «Быстрые подсказки «Где купить»» на ГЛАВНОЙ
 * странице SakhMatrix.ru — витрина СУХИХ географических фактов
 * (ориентиры, адреса, названия ТЦ, павильонов, официальных открытых
 * организаций) + форма быстрой подсказки.
 *
 * СКВОЗНАЯ ЛОГИКА ИИ-ФИЛЬТРА (ТЗ 2026-09-22, раунд prefilled_text —
 * действует СПЕЦИАЛЬНО для этой формы, проверка работает ДО отправки):
 *   1. При клике «Подсказать» текст проверяется на клиенте ДО запроса:
 *      телефоны («89…», «+79…» — общий движок сайта findPhoneNumbers) или
 *      плохие слова («барыги», «хамы», «мошенники», «уроды», «вор»,
 *      «обдираловка» + прежние маркеры этого ТЗ — единый движок
 *      findEmotionalLabels серверного модуля, решение одинаковое на
 *      клиенте и сервере) →
 *      отправка на главную БЛОКИРУЕТСЯ, поле ввода НЕ СТИРАЕТСЯ.
 *   2. Под полем ввода внутри карточки — аккуратная СЕРАЯ плашка с
 *      ДОСЛОВНЫМ текстом ТЗ: «Сообщение отклонено фильтром главной
 *      страницы. На главной странице запрещено публиковать личные
 *      мобильные телефоны и субъективные споры. Вы можете опубликовать
 *      этот текст на форуме.»
 *   3. Внутри плашки — кнопка «💬 Перейти в тему на форуме и опубликовать
 *      там» (надпись из прежнего ТЗ дословно). Ссылка ведёт на страницу
 *      связанной темы форума рубрики «Товары и услуги ▸ Где купить»
 *      (тема-приёмник #177, source "wtb-hints-transfer") в ДОСЛОВНОМ
 *      формате ТЗ: /forum/topic/ИД_ТОПИКА?prefilled_text=ТЕКСТ
 *      (encodeURIComponent; роут-адаптер src/app/forum/topic/[topicId]/
 *      переводит формат ТЗ в движок сайта /?topic=N, preserving параметр).
 *   4. Форма ответа форума считывает prefilled_text и подставляет текст
 *      (topic-view.tsx, эффект сквозного переноса).
 *
 * Первая линия на СЕРВЕРЕ (/api/wheretobuy-hints POST +
 * lib/moderation/wheretobuy-hint-premoderation.ts) остаётся заделом
 * прочности для прямых API-вызовов: из формы она недостижима (клиентский
 * фильтр ловит всё раньше), её строгие плашки Flat 2.0 прежнего ТЗ
 * (Кейс А/Б, URL /?topic=N&wtbhint=…) сохранены дословно.
 *
 * ТЕХНИЧЕСКИЙ UX-РЕЖИМ (дословно заказчик): «При клике на кнопку переноса,
 * текущий текст пользователя не должен стираться». Здесь:
 *  — ни клиентская серая плашка, ни серверная строгая плашка НЕ очищают
 *    поле ввода (текст остаётся на месте и после блокировки, и после клика
 *    по кнопке переноса);
 *  — кнопка — обычная ссылка <a href>: текст уходит GET-параметром
 *    prefilled_text в тему-приёмник, где форма быстрого ответа
 *    предзаполняется им;
 *  — ЧЕРНОВИК подсказки дублируется в sessionStorage (wtb-hint-draft):
 *    переход на форум и возвращение назад не теряют набранный текст
 *    (текст стирается только после УСПЕШНОЙ публикации).
 *
 * ЗАДОКУМЕНТИРОВАННЫЕ ИМПРОВИЗАЦИИ (заказчик присылал логику, а не
 * разметку): размещение панели — нижняя часть центральной колонки Главной,
 * сразу после утверждённой сетки разделов (макет Шага 27 не тронут);
 * стиль — существующие классы Главной (.mp-panel/.mp-rows/.mp-trow);
 * серая плашка — светлый фон #f4f4f5, тонкая рамка #d4d4d8, без теней
 * («аккуратная серая плашка» ТЗ; кнопка переноса — фирменный тёмно-синий
 * #1E3A5F, как в прежних плашках переноса); запасной ИД темы 177 (факт БД)
 * если GET ещё не ответил; подпись-подсказка и плейсхолдер (пример
 * заказчика) в поле ввода; для гостей — примечание о входе.
 *
 * ДОПОЛНЕНИЕ — ТЗ 2026-09-22 «6 сахалинских примеров» (раунд
 * examples-e2e): заказчик дал 6 готовых примеров для СИМУЛЯЦИИ на сайте
 * и потребовал «Ссылку на кнопке бери строго из соответствующего
 * примера». Если заблокированный текст 1-в-1 совпадает с «Вводом
 * пользователя (Ошибка)» из примера (нормализация: регистр, ё/е,
 * пробелы), кнопка получает ссылку СТРОГО из соответствующего примера —
 * слаговый ИД темы из ТЗ (примеры 1-3 этой панели: topic-grm-123 /
 * topic-shkola-789 / topic-sima-555); роут-адаптер переводит слаги в
 * тему-приёмник #177, сохраняя prefilled_text. Произвольный текст (не
 * из примеров) идёт в тему-приёмник обычным порядком (ИД из GET /
 * запасной 177) в том же дословном формате ТЗ.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/site/chrome";
import { findPhoneNumbers } from "@/lib/moderation/premoderation";
import {
  findEmotionalLabels,
  WTB_HINT_FORUM_BUTTON_LABEL,
} from "@/lib/moderation/wheretobuy-hint-premoderation";

interface HintItem {
  id: string;
  text: string;
  authorName: string;
  createdAt: string;
}

/** Ответ сервера при блокировке (Кейс А/Кейс Б, HTTP 422). */
interface HintBlocked {
  blocked: "phones" | "labels";
  message: string;
  forumButton: string;
  forumUrl: string;
}

const DRAFT_KEY = "wtb-hint-draft";

/**
 * ТЗ 2026-09-22 «сквозная логика»: серая плашка фильтра — ДОСЛОВНЫЙ текст
 * заказчика (единый для телефонов и плохих слов).
 */
const FILTER_PLAQUE_TEXT =
  "Сообщение отклонено фильтром главной страницы. На главной странице запрещено публиковать личные мобильные телефоны и субъективные споры. Вы можете опубликовать этот текст на форуме.";

/**
 * Запасной ИД темы-приёмника «Товары и услуги ▸ Где купить» (факт БД,
 * source "wtb-hints-transfer"). Используется только если GET
 * /api/wheretobuy-hints ещё не ответил; обычно приходит forumTopicId.
 */
const FALLBACK_TOPIC_ID = 177;

/**
 * ТЗ 2026-09-22 «6 сахалинских примеров» (примеры 1-3 этой панели,
 * рубрика «Товары и услуги ▸ Где купить»): ДОСЛОВНЫЕ «Ввод пользователя
 * (Ошибка)» и ИД темы из «Ссылки для переноса» заказчика. Совпадение
 * ввода с примером (нормализация ниже) → ссылка кнопки СТРОГО из
 * соответствующего примера (слаговый ИД темы ТЗ; адаптер переводит
 * слаги в тему-приёмник #177, сохраняя prefilled_text).
 */
const WTB_EXAMPLE_LINKS: { topicId: string; text: string }[] = [
  {
    // Пример 1 (ГРМ). Вопрос на главной: «Где в Южно-Сахалинске купить
    // оригинальный японский ремкомплект ГРМ на двигатель 1JZ-GE?»
    topicId: "topic-grm-123",
    text: "Есть мастер Вова на Железнодорожной, звони ему: 8-924-111-22-33",
  },
  {
    // Пример 2 (Форма). Вопрос на главной: «Где в городе прямо сейчас
    // купить качественную школьную форму на мальчика (рост 140)?»
    topicId: "topic-shkola-789",
    text: "В ТЦ Рояль на 3 этаже сидят хамы и мошенники, торгуют синтетикой!",
  },
  {
    // Пример 3 (Блесны). Вопрос на главной: «Ищу специфические японские
    // снасти и блесны на симу (розовые, 18г). Где есть?»
    topicId: "topic-sima-555",
    text: "Закажи у чувака на Авито, вот его сотовый 8-914-000-44-55",
  },
];

/** Нормализация сверки с примерами: регистр, ё/е, пробелы не важны. */
function normExample(v: string): string {
  return v.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

/** Дата «26.04.2025» — как в соседних панелях Главной. */
function fmtDay(v: string): string {
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function WhereToBuyQuickHints() {
  const { user, token } = useAuth();
  const [hints, setHints] = useState<HintItem[] | null>(null);
  // Черновик восстанавливается при возвращении с форума (текст не стирается).
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<HintBlocked | null>(null);
  // Серая плашка клиентского фильтра ТЗ «сквозная логика» (ДО запроса).
  const [filterBlocked, setFilterBlocked] = useState<"phones" | "labels" | null>(null);
  // ИД темы-приёмника для ссылки формата /forum/topic/ИД_ТОПИКА?prefilled_text=…
  const [forumTopicId, setForumTopicId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) setText(saved);
    } catch {
      /* приватный режим — просто без черновика */
    }
    let alive = false;
    fetch("/api/wheretobuy-hints")
      .then(async (r) => (r.ok ? r.json() : { hints: [] }))
      .then((d) => {
        if (alive) return;
        setHints(d.hints || []);
        // ТЗ «сквозная логика»: ИД темы-приёмника для кнопки переноса.
        if (typeof d.forumTopicId === "number") setForumTopicId(d.forumTopicId);
      })
      .catch(() => {
        if (!alive) setHints([]);
      });
    return () => {
      alive = true;
    };
  }, []);

  const changeText = useCallback((v: string) => {
    setText(v);
    // Текст изменился — прежний вердикт фильтра устарел, серая плашка гаснет.
    setFilterBlocked(null);
    try {
      sessionStorage.setItem(DRAFT_KEY, v);
    } catch {
      /* noop */
    }
  }, []);

  const submit = async () => {
    const t = text.trim();
    if (t.length < 3) return;
    setBlocked(null);
    setNote("");
    setErr("");

    // ТЗ 2026-09-22 «сквозная логика», пункт 1: проверка текста ДО отправки.
    // Телефоны («89…», «+79…») или плохие слова («барыги», «хамы»,
    // «мошенники», «уроды», «вор», «обдираловка») → отправка на главную
    // страницу БЛОКИРУЕТСЯ, поле ввода НЕ СТИРАЕТСЯ — показывается серая
    // плашка (см. JSX ниже). Тот же движок, что и на сервере — решение
    // клиентa и сервера совпадает.
    if (findPhoneNumbers(t).length > 0 || findEmotionalLabels(t).length > 0) {
      setFilterBlocked(findPhoneNumbers(t).length > 0 ? "phones" : "labels");
      return; // без fetch: ничего не отправляется и не стирается
    }
    setFilterBlocked(null);

    setBusy(true);
    try {
      const r = await fetch("/api/wheretobuy-hints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, text: t }),
      });
      const d = await r.json();
      // Кейс А/Б: плашка перенаправления. Текст в поле НЕ стирается.
      if (d.blocked) {
        setBlocked(d as HintBlocked);
        return;
      }
      if (!r.ok) throw Error(d.error || "Не удалось отправить подсказку. Попробуйте ещё раз.");
      // Успех: только теперь чистим поле и черновик.
      changeText("");
      setHints((prev) => (prev ? [d.hint as HintItem, ...prev] : prev));
      setNote(d.note || "Подсказка опубликована. Спасибо!");
      window.setTimeout(() => setNote(""), 3500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setBusy(false);
    }
  };

  // ТЗ 2026-09-22 «6 сахалинских примеров»: если заблокированный текст
  // 1-в-1 совпадает с «Вводом пользователя (Ошибка)» из примера, ссылка
  // кнопки — СТРОГО из соответствующего примера (слаговый ИД темы ТЗ);
  // остальной текст — тема-приёмник блока (forumTopicId / запасной 177).
  const exampleLink = WTB_EXAMPLE_LINKS.find(
    (e) => normExample(e.text) === normExample(text),
  );
  const forumLinkTopic = exampleLink?.topicId ?? String(forumTopicId ?? FALLBACK_TOPIC_ID);

  return (
    <section className="mp-panel" aria-label="Быстрые подсказки «Где купить»" data-wtb-hints="1">
      <div className="mp-paneltitle">
        <span className="tri">▼</span>Быстрые подсказки «Где купить»
      </div>

      {/* Витрина сухих географических фактов: последние подсказки (новые сверху). */}
      <div className="mp-rows mp-overheard" data-wtb-hints-feed="1">
        {hints === null ? (
          <div className="mp-loading">Загрузка…</div>
        ) : hints.length === 0 ? (
          <div className="mp-loading">Подсказок пока нет — ваша может стать первой.</div>
        ) : (
          hints.map((h) => (
            <div key={h.id} className="mp-trow" data-wtb-hint-id={h.id}>
              {/* Класс .mp-ttext даёт сетку «текст | ник | дата», но стилизован
                  под ссылку (синий/подчёркнутый/hover-красный) — подсказка НЕ
                  кликабельна, поэтому ссылочная косметика гасится инлайн
                  (инлайн сильнее .mp-ttext:hover). */}
              <span
                className="mp-ttext"
                title={h.text}
                style={{ color: "#1a1a1a", textDecoration: "none", cursor: "default" }}
              >
                {h.text}
              </span>
              <span className="mp-tauthor">{h.authorName}</span>
              <span className="mp-tdate">{fmtDay(h.createdAt)}</span>
            </div>
          ))
        )}
      </div>

      {/* Форма быстрой подсказки (только зарегистрированные; гости читают —
          примечание о входе, как у формы ответа на форуме). */}
      {user && token ? (
        <div className="wtb-hint-form" data-wtb-hint-form="1" style={{ padding: "8px 12px 12px" }}>
          <textarea
            data-wtb-hint-input="1"
            value={text}
            maxLength={300}
            onChange={(e) => changeText(e.target.value)}
            placeholder="Например: Видел на Железнодорожной 168, бокс 4"
            aria-label="Текст быстрой подсказки «Где купить»"
            style={{
              width: "100%",
              minHeight: 56,
              resize: "vertical",
              fontSize: 13.5,
              fontFamily: "inherit",
              padding: "7px 9px",
              border: "1px solid #c9d2dc",
              background: "#fff",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7, flexWrap: "wrap" }}>
            <button
              className="sk-btn-classic"
              data-wtb-hint-submit="1"
              disabled={busy || text.trim().length < 3}
              onClick={submit}
            >
              {busy ? "Проверка…" : "Подсказать"}
            </button>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Только сухие адреса и ориентиры: ТЦ, павильоны, официальные открытые организации.
            </span>
          </div>
          {/* ТЗ 2026-09-22 «сквозная логика», пункт 2: аккуратная СЕРАЯ
              плашка прямо внутри карточки ПОД ПОЛЕМ ВВОДА — единый
              дословный текст ТЗ для телефонов и плохих слов. Поле НЕ
              стёрто: пункт 1 ТЗ. */}
          {filterBlocked && (
            <div
              data-wtb-filter-plaque={filterBlocked}
              role="alert"
              style={{
                marginTop: 9,
                border: "1px solid #d4d4d8",
                background: "#f4f4f5",
                padding: "9px 11px",
              }}
            >
              <div
                data-wtb-filter-plaque-text={filterBlocked}
                style={{ fontSize: 13, lineHeight: 1.45, color: "#3f3f46" }}
              >
                {FILTER_PLAQUE_TEXT}
              </div>
              {/* Пункт 3 ТЗ: кнопка переноса внутри плашки. ДОСЛОВНЫЙ формат
                  ссылки: /forum/topic/ИД_ТОПИКА?prefilled_text=ТЕКСТ. ИД —
                  тема-приёмник рубрики «Товары и услуги ▸ Где купить» из
                  GET (запасной 177); текст — текущее содержимое поля, он
                  НЕ стёрт (пункт 1 ТЗ). */}
              <div style={{ marginTop: 8 }}>
                <a
                  className="wtb-hint-forum-btn"
                  data-wtb-filter-forum-btn="1"
                  href={`/forum/topic/${forumLinkTopic}?prefilled_text=${encodeURIComponent(text.trim())}`}
                  style={{
                    display: "inline-block",
                    background: "#1E3A5F",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    padding: "8px 12px",
                    textDecoration: "none",
                  }}
                >
                  {WTB_HINT_FORUM_BUTTON_LABEL}
                </a>
              </div>
            </div>
          )}
          {note && (
            <div data-wtb-hint-note="1" style={{ marginTop: 7, fontSize: 13, fontWeight: 600, color: "#2E7D32" }}>
              {note}
            </div>
          )}
          {err && (
            <div data-wtb-hint-err="1" style={{ marginTop: 7, fontSize: 13, fontWeight: 600, color: "#AA3333" }}>
              {err}
            </div>
          )}
        </div>
      ) : (
        <div data-wtb-hint-guest="1" style={{ padding: "6px 12px 12px", fontSize: 13, color: "#475569" }}>
          Подсказывать могут только зарегистрированные пользователи. Чтобы писать, войдите или
          зарегистрируйтесь — ссылка в левой колонке форума.
        </div>
      )}

      {/* Строгая плашка Flat 2.0 (Кейс А/Кейс Б): ДОСЛОВНЫЙ текст заказчика +
          кнопка переноса. Поле ввода при этом НЕ очищается: текст остаётся на
          месте и уходит GET-параметром wtbhint в тему форума. */}
      {blocked && (
        <div
          className="wtb-hint-plaque"
          data-wtb-plaque={blocked.blocked}
          role="alert"
          style={{
            margin: "0 12px 12px",
            border: "2px solid #b91c1c",
            background: "#fff",
            padding: "10px 12px",
          }}
        >
          <div
            data-wtb-plaque-text={blocked.blocked}
            style={{ fontSize: 13.5, lineHeight: 1.45, fontWeight: 600, color: "#7f1d1d" }}
          >
            {blocked.message}
          </div>
          <div style={{ marginTop: 9 }}>
            <a
              className="wtb-hint-forum-btn"
              data-wtb-forum-btn="1"
              href={blocked.forumUrl}
              style={{
                display: "inline-block",
                background: "#1E3A5F",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 12px",
                textDecoration: "none",
              }}
            >
              {blocked.forumButton}
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
