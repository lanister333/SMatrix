"use client";

/**
 * ШАГ 16 (ТЗ). «Нужна помощь» — самостоятельная доска бесплатной взаимопомощи
 * жителей Сахалина. Отдельная техническая сущность HelpPublication — НЕ форумная
 * тема и не соцсеть: без обсуждений, комментариев, ответов, лайков, рейтингов,
 * подписок, уведомлений и аватаров. Автор публикует просьбу и контакт (по
 * желанию); желающий помочь связывается напрямую по указанному контакту.
 * Только безвозмездная помощь. Статусы — только два: «Вопрос решён» и
 * «Неактуально»; активные публикации идут выше без статусного маркера.
 */

import { useCallback, useEffect, useState } from "react";
import SakhDatetimeBlock from "@/components/site/sakh-datetime-block";
import type { ForumUser } from "@/lib/ui";

interface HelpItem {
  id: string;
  title: string;
  text: string;
  contactData: string;
  status: string; // active | resolved | irrelevant
  authorId: string;
  authorName: string;
  editedAt: string | null;
  createdAt: string;
  isHiddenByAi?: boolean;
  hiddenReason?: string;
  needHuman?: boolean;
}

/** ТЗ: используется только два статуса — активные публикации идут без маркера. */
const STATUS_LABELS: Record<string, string> = {
  resolved: "Вопрос решён",
  irrelevant: "Неактуально",
};

/** ТЗ 2026-09-23 «Кнопки „Обсудить на форуме“» (п.1/3/6): блок «Нужна помощь»
 *  входил в перечень кнопок, но самой кнопки у карточек не было. Добавлена
 *  статическая относительная ссылка в соответствующую рубрику форума
 *  «Товары и услуги ▸ Услуги и специалисты» (rubric 119) — единая карта
 *  src/lib/forum-links.ts; работает и у гостя (список тем рубрики, п.5). */
const HELP_FORUM_URL = "/forum/category/tovary-i-uslugi--uslugi-i-specialisty";

/** Месяцы в родительном падеже — детерминированный формат без ICU-вариаций
 * (ru-RU toLocaleDateString добавляет « г.», а ТЗ требует «21 сентября 2026»). */
const RU_MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/** Дата публикации: «8 сентября 2026». */
function fmtLongDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${RU_MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
}

/** Дата активной публикации по ТЗ: «21 сентября 2026, 23:45». */
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${fmtLongDate(iso)}, ${hh}:${mm}`;
}

const HELP_COMPLAINT_REASONS = [
  { key: "fraud", label: "Мошенничество" },
  { key: "paid", label: "Платная услуга" },
  { key: "ad", label: "Реклама" },
  { key: "spam", label: "Спам" },
  { key: "personal_data", label: "Персональные данные" },
  { key: "forbidden", label: "Запрещённое содержание" },
  { key: "other", label: "Другое" },
];

/** Краткие правила — левая колонка (по ТЗ: «навигация и правила»). */
const SHORT_RULES = [
  "Только безвозмездная помощь — бесплатно.",
  "Платные услуги и просьбы перевести деньги запрещены.",
  "Реклама, вакансии, продажа товаров — запрещены.",
  "Чужие персональные данные не публикуем.",
  "Если помощь предполагает расходы — укажите это прямо в тексте.",
];

/* ------------------------------------------------------------------ */
/* Объявление                                                          */
/* ------------------------------------------------------------------ */

/**
 * ТЗ 2026-09-21: карточка публикации — ПРИСЛАННАЯ разметка (.help-item-card
 * status-active/status-resolved): шапка = бейдж статуса («Актуально» у активных,
 * серый «Вопрос решён»/«Неактуально» у закрытых — пример ТЗ «решенной/неактуальной
 * карточки» один: класс status-resolved для обеих) + «👤 Ник: …» + дата (у активных
 * с временем «, ЧЧ:ММ»); тело h4+p; футер: «Связь напрямую:» + WA-ссылка,
 * служебные кнопки, «✓ Взаимопомощь оказана» у решённых.
 * В фрагменте показан только чужой активный вид — служебные кнопки автора
 * (Вопрос решён/Неактуально/Снова актуально/Редактировать/Удалить — функциональность
 * ШАГ 16) сохранены в .help-sys-actions; «⚠️ Пожаловаться» (onclick
 * reportPublication(id) из ТЗ → открытие существующей модалки жалобы).
 * Строка «Контакт: …» и маркер «изменено автором» в новой разметке ТЗ
 * отсутствуют — не выводятся (данные contactData хранятся в БД/API).
 */
function HelpCard(props: {
  item: HelpItem;
  user: ForumUser | null;
  busy: boolean;
  onStatus: (item: HelpItem, action: "resolve" | "irrelevant" | "reopen") => void;
  onEdit: (item: HelpItem) => void;
  onDelete: (item: HelpItem) => void;
  onComplain: (item: HelpItem) => void;
}) {
  const { item, user } = props;
  const own = !!(user && item.authorId === user.id);
  const closed = item.status !== "active";

  return (
    <article className={`help-item-card ${closed ? "status-resolved" : "status-active"}`}>
      <div className="help-item-header">
        <span className={`help-status-badge${closed ? " gray" : ""}`}>
          {closed ? (STATUS_LABELS[item.status] ?? item.status) : "Актуально"}
        </span>
        <span className="help-item-author">👤 Ник: {item.authorName}</span>
        <span className="help-item-date">
          {closed ? fmtLongDate(item.createdAt) : fmtDateTime(item.createdAt)}
        </span>
      </div>

      <div className="help-item-body">
        <h4>{item.title}</h4>
        <p>{item.text}</p>
      </div>

      {own && item.isHiddenByAi && (
        <div className="hp-hiddennote">
          Публикация скрыта ИИ-модерацией: {item.hiddenReason || "нарушение правил раздела"}. Её проверит
          человек-модератор и при ошибке вернёт в ленту.
        </div>
      )}
      {own && !item.isHiddenByAi && item.needHuman && (
        <div className="hp-humannote">Публикация отправлена на дополнительную проверку человеку-модератору.</div>
      )}

      {/* ТЗ 2026-09-23 «Кнопки „Обсудить на форуме“» (п.3/6): переход в
          рубрику «Товары и услуги ▸ Услуги и специалисты». Статическая
          ссылка справа, бирюзовая — как у «ЖКХ» и «Знакомств». */}
      <div className="help-card-foot" data-hp-card-forumrow={item.id}>
        <a
          className="hp-btn-forum"
          data-hp-card-forum={item.id}
          href={HELP_FORUM_URL}
          title="Обсудить в рубрике «Товары и услуги ▸ Услуги и специалисты»"
        >
          💬 Обсудить на форуме
        </a>
      </div>

      {(!closed || item.status === "resolved" || own) && (
        <div className="help-item-footer">
          {item.status === "resolved" && (
            <span className="resolved-text">✓ Взаимопомощь оказана</span>
          )}
          {!closed && (
            <div className="help-direct-contact">
              <strong>Связь напрямую:</strong>{" "}
              <a href="https://wa.me" target="_blank" rel="noreferrer" className="wa-action-link">
                Написать в WhatsApp
              </a>
            </div>
          )}
          <div className="help-sys-actions">
            {own ? (
              closed ? (
                <>
                  <button className="hp-act" disabled={props.busy} onClick={() => props.onStatus(item, "reopen")}>
                    Снова актуально
                  </button>
                  <button className="hp-act" disabled={props.busy} onClick={() => props.onEdit(item)}>
                    Редактировать
                  </button>
                  <button className="hp-act hp-del" disabled={props.busy} onClick={() => props.onDelete(item)}>
                    Удалить
                  </button>
                </>
              ) : (
                <>
                  <button className="hp-act" disabled={props.busy} onClick={() => props.onStatus(item, "resolve")}>
                    Вопрос решён
                  </button>
                  <button className="hp-act" disabled={props.busy} onClick={() => props.onStatus(item, "irrelevant")}>
                    Неактуально
                  </button>
                  <button className="hp-act" disabled={props.busy} onClick={() => props.onEdit(item)}>
                    Редактировать
                  </button>
                  <button className="hp-act hp-del" disabled={props.busy} onClick={() => props.onDelete(item)}>
                    Удалить
                  </button>
                </>
              )
            ) : (
              !closed && (
                <button className="btn-report" disabled={props.busy} onClick={() => props.onComplain(item)}>
                  ⚠️ Пожаловаться
                </button>
              )
            )}
          </div>
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Форма публикации / редактирования                                   */
/* ------------------------------------------------------------------ */

/**
 * ТЗ 2026-09-21: модалка создания публикации — ПРИСЛАННАЯ разметка
 * (.matrix-modal-form id="help-form-modal", form id="matrix-help-submit-form",
 * классы form-flat-group / input-flat / textarea-flat / modal-form-actions /
 * btn-flat-cancel / btn-flat-submit — все 1-в-1; тексты заголовка, предупреждения,
 * меток и плейсхолдеров — СТРОГО из ТЗ). Открывается уже существующими кнопками
 * «＋ Создать публикацию» (closeHelpModal = обработчик закрытия из ТЗ).
 * Серверные ошибки — в sk-modal-err (динамический элемент, в статичной
 * разметке ТЗ отсутствует); во время ИИ-проверки кнопка занята (busy).
 */

/* ТЗ 2026-09-21: клиентский фильтр банковских карт на форме публикации
 * (присланный сниппет заказчика, слушатель submit формы
 * #matrix-help-submit-form). Паттерн и текст alert — из сниппета 1-в-1. */
/** Регулярка из ТЗ: 16 цифр подряд либо разделённых пробелами/дефисами. */
const HELP_CARD_PATTERN = /\b(?:\d[ -]*?){16}\b/;
/** Системное предупреждение по Манифесту (текст из ТЗ 1-в-1). */
const HELP_CARD_ALERT =
  "Внимание: Публикация номеров банковских карт в разделе взаимопомощи запрещена правилами SakhMatrix. Пожалуйста, удалите платежные реквизиты. Помощь должна быть безвозмездной.";

function HelpCreateModal(props: {
  token: string | null;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const closeHelpModal = props.onClose;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // ТЗ 2026-09-21: клиентский фильтр банковских карт (сниппет заказчика 1-в-1):
    // собирается весь текст формы (help-title + help-desc + help-contact) и
    // проверяется 16-значным паттерном; при совпадении — отправка жёстко
    // блокируется и показывается предупреждение по Манифесту.
    // Адаптация к React: значения полей берутся из контролируемого state
    // (эквивалент document.getElementById('…').value); preventDefault уже
    // выполнен в шапке обработчика, return false сниппета = ранний return,
    // форма остаётся открытой с введённым текстом (busy не включается).
    const fullText = `${title} ${text} ${contact}`;
    if (HELP_CARD_PATTERN.test(fullText)) {
      window.alert(HELP_CARD_ALERT);
      return;
    }

    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, title: title.trim(), text: text.trim(), contactData: contact.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось опубликовать. Попробуйте ещё раз.");
      props.onDone(d.note || "Публикация опубликована");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="matrix-modal-form" id="help-form-modal" onClick={closeHelpModal}>
      <div className="modal-form-content" onClick={(e) => e.stopPropagation()}>
        <h5>Новая публикация в ленту взаимопомощи</h5>

        {/* Компактное предупреждение по Манифесту — текст 1-в-1 из ТЗ */}
        <div className="modal-rules-notice">
          Помощь только БЕСПЛАТНАЯ. Сборы денег, переводы, реклама и вакансии запрещены. Вы несете
          ответственность за достоверность данных.
        </div>

        <form id="matrix-help-submit-form" onSubmit={submit}>
          <div className="form-flat-group">
            <label htmlFor="help-title">Тема (Коротко: что случилось?)</label>
            <input
              type="text"
              id="help-title"
              className="input-flat"
              placeholder="Например: Помочь довезти продукты пожилому человеку"
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="form-flat-group">
            <label htmlFor="help-desc">Описание ситуации и суть содействия</label>
            <textarea
              id="help-desc"
              className="textarea-flat"
              placeholder="Опишите детали, место, время. Если помощь предполагает сопутствующие расходы — укажите их прямо здесь."
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="form-flat-group">
            <label htmlFor="help-contact">Ваши контактные данные для прямой связи</label>
            <input
              type="text"
              id="help-contact"
              className="input-flat"
              placeholder="Например: WhatsApp +7 (9XX) XXX-XX-XX, Иван"
              required
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              disabled={busy}
            />
          </div>

          {err && <div className="sk-modal-err">{err}</div>}

          <div className="modal-form-actions">
            <button type="button" className="btn-flat-cancel" onClick={closeHelpModal} disabled={busy}>
              Отмена
            </button>
            <button type="submit" className="btn-flat-submit" disabled={busy}>
              {busy ? "Проверка ИИ…" : "Опубликовать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HelpFormModal(props: {
  token: string | null;
  editItem: HelpItem | null;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const isEdit = !!props.editItem;
  const [title, setTitle] = useState(props.editItem?.title ?? "");
  const [text, setText] = useState(props.editItem?.text ?? "");
  const [contactData, setContactData] = useState(props.editItem?.contactData ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (title.trim().length < 5) {
      setErr("Заголовок слишком короткий — минимум 5 символов");
      return;
    }
    if (text.trim().length < 10) {
      setErr("Опишите ситуацию подробнее — минимум 10 символов");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(isEdit ? `/api/help/${props.editItem!.id}` : "/api/help", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? { token: props.token, action: "edit", title: title.trim(), text: text.trim(), contactData: contactData.trim() }
            : { token: props.token, title: title.trim(), text: text.trim(), contactData: contactData.trim() }
        ),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось опубликовать. Попробуйте ещё раз.");
      props.onDone(d.note || (isEdit ? "Публикация обновлена" : "Публикация опубликована"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sk-modal-overlay" onClick={props.onClose}>
      <div className="sk-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="sk-modal-title">
          <span>{isEdit ? "Редактировать публикацию" : "Новая публикация"}</span>
          <button className="sk-modal-x" onClick={props.onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="sk-modal-body">
          <div className="sk-modal-row">
            <label htmlFor="hp-f-title">Заголовок — кратко, какая помощь нужна</label>
            <input
              id="hp-f-title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Нужна помощь перевезти вещи"
            />
          </div>
          <div className="sk-modal-row">
            <label htmlFor="hp-f-text">Описание ситуации или просьбы</label>
            <textarea
              id="hp-f-text"
              value={text}
              maxLength={4000}
              onChange={(e) => setText(e.target.value)}
              placeholder="Что нужно сделать, где и когда. Если помощь предполагает расходы (бензин, материалы) — ясно объясните их назначение прямо в тексте."
              style={{ minHeight: 120 }}
            />
          </div>
          <div className="sk-modal-row">
            <label htmlFor="hp-f-contact">Контактные данные — необязательно (можно указать их в тексте)</label>
            <input
              id="hp-f-contact"
              value={contactData}
              maxLength={200}
              onChange={(e) => setContactData(e.target.value)}
              placeholder="Телефон, Telegram или другой контакт"
            />
          </div>
          <div className="sk-modal-demo">
            <b>Не публикуйте чужие персональные данные без их согласия.</b> Не указывайте лишнюю личную информацию,
            которая не нужна для связи. Платные услуги, просьбы перевести деньги, реклама и продажа товаров в разделе
            запрещены.
          </div>
          {err && <div className="sk-modal-err">{err}</div>}
          <div className="sk-modal-actions">
            <button className="sk-btn-classic" disabled={busy} onClick={submit}>
              {busy ? "Проверка ИИ…" : isEdit ? "Сохранить" : "Публикация"}
            </button>
            <button className="right" onClick={props.onClose}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Жалоба                                                              */
/* ------------------------------------------------------------------ */

function HelpComplaintModal(props: {
  item: HelpItem;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [category, setCategory] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!category) {
      setErr("Выберите причину жалобы");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/help/${props.item.id}/complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, comment: comment.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось отправить жалобу");
      props.onDone(d.note || "Жалоба отправлена. Спасибо. Модерация рассмотрит объявление.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sk-modal-overlay" onClick={props.onClose}>
      <div className="sk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sk-modal-title">
          <span>Жалоба на публикацию</span>
          <button className="sk-modal-x" onClick={props.onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="sk-modal-body">
          <div className="sk-modal-demo">
            Публикация: «{props.item.title}». Жалоба уходит модерации. Количество жалоб не публикуется и не создаёт
            никаких оценок.
          </div>
          <div className="sk-modal-row">
            <label>Причина</label>
            {HELP_COMPLAINT_REASONS.map((r) => (
              <label key={r.key} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontWeight: 400, fontSize: 13.5 }}>
                <input
                  type="radio"
                  name="hp-complaint"
                  checked={category === r.key}
                  onChange={() => setCategory(r.key)}
                  style={{ marginTop: 2 }}
                />
                {r.label}
              </label>
            ))}
          </div>
          <div className="sk-modal-row">
            <label htmlFor="hp-c-comment">Комментарий (необязательно)</label>
            <textarea
              id="hp-c-comment"
              value={comment}
              maxLength={1000}
              onChange={(e) => setComment(e.target.value)}
              style={{ minHeight: 70 }}
              placeholder="Что именно нарушено…"
            />
          </div>
          {err && <div className="sk-modal-err">{err}</div>}
          <div className="sk-modal-actions">
            <button className="sk-btn-classic" disabled={busy || !category} onClick={submit}>
              {busy ? "Отправка…" : "Отправить жалобу"}
            </button>
            <button className="right" onClick={props.onClose}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Страница раздела                                                    */
/* ------------------------------------------------------------------ */

export function HelpPage(props: {
  user: ForumUser | null;
  token: string | null;
  notify: (m: string) => void;
  onNeedAuth: () => void;
}) {
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [items, setItems] = useState<HelpItem[] | null>(null);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<HelpItem | null>(null);
  const [complainItem, setComplainItem] = useState<HelpItem | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const url =
        tab === "mine" ? `/api/help?mine=1&token=${encodeURIComponent(props.token ?? "")}` : "/api/help";
      const r = await fetch(url);
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка загрузки");
      setItems(d.requests ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
      setItems([]);
    }
  }, [tab, props.token]);

  useEffect(() => {
    let alive = false;
    setItems(null);
    const t = window.setTimeout(() => {
      if (!alive) load();
    }, 0);
    return () => {
      alive = true;
      window.clearTimeout(t);
    };
  }, [load]);

  const openNewForm = () => {
    if (!props.user) {
      props.onNeedAuth();
      return;
    }
    setEditItem(null);
    setFormOpen(true);
  };

  const changeStatus = async (item: HelpItem, action: "resolve" | "irrelevant" | "reopen") => {
    setBusy(true);
    try {
      const r = await fetch(`/api/help/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, action }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось изменить статус");
      props.notify(d.note || "Статус обновлён");
      await load();
    } catch (e) {
      props.notify(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (item: HelpItem) => {
    if (!window.confirm("Удалить публикацию? Она исчезнет из общей ленты.")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/help/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, action: "delete" }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось удалить");
      props.notify(d.note || "Публикация удалена");
      await load();
    } catch (e) {
      props.notify(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (item: HelpItem) => {
    setEditItem(item);
    setFormOpen(true);
  };

  const mineTab = (t: "all" | "mine") => {
    if (t === "mine" && !props.user) {
      props.onNeedAuth();
      return;
    }
    setTab(t);
  };

  const list = items ?? [];
  const openCount = list.filter((i) => i.status === "active").length;

  /** ТЗ 2026-09-21: создание — присланная flat-модалка (HelpCreateModal),
      редактирование — прежняя модалка (в ТЗ не входила). */
  const done = (msg: string) => {
    setFormOpen(false);
    setEditItem(null);
    props.notify(msg);
    load();
  };

  return (
    <>
      <div className="hp-layout main-grid-container">
        {/* 29.09.2026: ЛЕВАЯ КОЛОНКА — «О разделе» (в дизайне .sakh-clock).
            Прежние блоки (Раздел nav, ＋ Создать публикацию, Краткие правила)
            убраны — навигация и кнопка перенесены в header-bar центральной
            колонки (как на /gde-deshevle, /gde-kupit, /rekomenduyu). */}
        <aside className="hp-col-left left-column">
          <div className="sakh-clock hp-clock-block hp-clock-about">
            <div className="sakh-clock-head">ℹ️ О разделе</div>
            <div className="sakh-clock-body sakh-clock-body-content">
              <div className="hp-freenote">
                Помощь в разделе — только БЕСПЛАТНАЯ. Платные услуги, переводы денег и сборы средств запрещены.
              </div>
              <div className="hp-info">
                <p>
                  «Нужна помощь» — самостоятельная доска бесплатной взаимопомощи жителей Сахалина. Публикации не становятся
                  темами для обсуждения: комментарии и ответы здесь не предусмотрены, связь — напрямую по контакту
                  из публикации.
                </p>
                <p>
                  Публикация содержит заголовок, описание ситуации, контактные данные (если автор их указал), ник автора,
                  дату публикации и статус. Связь с автором — напрямую по указанному контакту.
                </p>
                <p>
                  Автор может изменить статус, снова сделать публикацию актуальной, отредактировать или удалить
                  свою публикацию. Завершённые и неактуальные публикации не удаляются автоматически — они остаются
                  в списке, но размещаются ниже активных и обозначаются серым статусом.
                </p>
              </div>
            </div>
          </div>

          {/* 29.09.2026: блок «🎨 Цвета карточек» — пояснение для посетителей
              сайта, что означают цвета рамок карточек в ленте. В едином стиле
              с блоком «Время» (.sakh-clock), как «О разделе» и «Правила
              публикации». Аналог блока на /rekomenduyu. */}
          <div className="sakh-clock hp-clock-block hp-clock-legend">
            <div className="sakh-clock-head">🎨 Цвета карточек</div>
            <div className="sakh-clock-body sakh-clock-body-content">
              <div className="hp-legend">
                <div className="hp-legend-row">
                  <span className="hp-legend-swatch swatch-active" />
                  <div>
                    <b>Бирюзовая рамка</b> — публикация <b>активна</b> (статус «Актуально»). Автор ждёт помощи.
                  </div>
                </div>
                <div className="hp-legend-row">
                  <span className="hp-legend-swatch swatch-resolved" />
                  <div>
                    <b>Серая рамка + полупрозрачность</b> — публикация завершена (статус «Решено») или потеряла
                    актуальность («Неактуально»). Размещается ниже активных в ленте.
                  </div>
                </div>
                <p className="hp-legend-note">
                  Статус публикации меняет её автор: отметил помощь полученной → «Решено», или потеряло актуальность →
                  «Неактуально». Завершённые/неактуальные не удаляются — остаются в ленте серыми для истории.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Центральная колонка — объявления + header bar */}
        <div className="hp-col-main center-column">
          <div className="hp-head">
            {/* 29.09.2026: header bar — H1 слева + nav + кнопка справа,
                как на /gde-deshevle, /gde-kupit, /rekomenduyu. */}
            <div className="hp-head-bar">
              <div className="hp-title">{tab === "mine" ? "Мои публикации" : "Нужна помощь"}</div>
              <div className="hp-head-right">
                <div className="hp-nav-inline">
                  <button className={tab === "all" ? "active" : ""} onClick={() => mineTab("all")}>
                    Нужна помощь
                  </button>
                  <button className={tab === "mine" ? "active" : ""} onClick={() => mineTab("mine")}>
                    Мои публикации
                  </button>
                </div>
                <button className="hp-addbtn" onClick={openNewForm}>
                  ＋ Создать публикацию
                </button>
              </div>
            </div>
            {!props.user && (
              <p className="hp-rulesnote">Публиковать могут зарегистрированные пользователи — войдите или зарегистрируйтесь.</p>
            )}
            <p className="hp-desc">
              Простая доска объявлений о бесплатной взаимопомощи жителей Сахалина: помочь пожилому человеку, с бытовой
              ситуацией, найти потерянную вещь, разобраться в вопросе, помочь физически или информационно, попросить
              совета или содействия. Обсуждений здесь нет: желающие помочь связываются с автором напрямую
              по контакту из публикации.
            </p>
          </div>

          {error && <div className="sk-error">{error}</div>}
          {items !== null && !error && list.length === 0 && (
            <div className="hp-empty">
              {tab === "mine" ? "У вас пока нет публикаций." : "Пока нет публикаций — создайте первую, кому-то нужна ваша помощь."}
            </div>
          )}
          {tab === "all" && openCount > 0 && items !== null && (
            <div className="hp-empty" style={{ padding: "0 2px 6px" }}>
              Активных публикаций: {openCount}. Завершённые и неактуальные — ниже, в конце списка.
            </div>
          )}
          {/* ТЗ 2026-09-21: контейнер .help-publications-list — ВМЕСТО текста «Загрузка…» */}
          <div className="help-publications-list">
            {items !== null &&
              !error &&
              list.map((item) => (
                <HelpCard
                  key={item.id}
                  item={item}
                  user={props.user}
                  busy={busy}
                  onStatus={changeStatus}
                  onEdit={openEdit}
                  onDelete={deleteItem}
                  onComplain={setComplainItem}
                />
              ))}
          </div>
        </div>

        {/* ПРАВАЯ КОЛОНКА — Время + Правила (29.09.2026):
            «О разделе» убран (теперь он в левой колонке).
            «Правила публикации» оформлены в дизайне блока «Время» (.sakh-clock). */}
        <aside className="hp-col-right right-column">
          <SakhDatetimeBlock />
          <div className="sakh-clock hp-clock-block hp-clock-rules">
            <div className="sakh-clock-head">📋 Правила публикации</div>
            <div className="sakh-clock-body sakh-clock-body-content">
              <ol className="hp-ruleslist">
                <li>Раздел предназначен только для бесплатной взаимопомощи.</li>
                <li>Платные услуги и платное посредничество запрещены.</li>
                <li>Просьбы перевести деньги и сборы средств запрещены.</li>
                <li>Коммерческие предложения и реклама бизнеса запрещены.</li>
                <li>Вакансии и поиск работников запрещены.</li>
                <li>Продажа и покупка товаров запрещены.</li>
                <li>Предложения заработка и скрытая реклама запрещены.</li>
                <li>Мошеннические публикации запрещены.</li>
                <li>Объявления, не связанные с бесплатной помощью, запрещены.</li>
                <li>Не публикуйте чужие персональные данные без их согласия.</li>
                <li>Если помощь предполагает расходы — ясно объясните их назначение в тексте.</li>
                <li>Контактные данные автор указывает по желанию — можно в тексте публикации.</li>
                <li>Решённый вопрос отмечайте «Вопрос решён»; потерявшую актуальность публикацию — «Неактуально».</li>
                <li>Публикуют только зарегистрированные пользователи; анонимные публикации запрещены.</li>
                <li>Нарушающие правила публикации удаляет модерация.</li>
                <li>Массовые жалобы — только сигнал для модерации, а не автоматическое доказательство нарушения.</li>
              </ol>
              <p className="hp-rulesnote">
                Публикации проверяет ИИ-модерация, спорные случаи рассматривает человек-модератор. Кнопка «Пожаловаться»
                есть у каждой публикации; количество жалоб не публикуется и не создаёт никаких оценок.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {formOpen && props.token &&
        (editItem ? (
          <HelpFormModal
            token={props.token}
            editItem={editItem}
            onClose={() => setFormOpen(false)}
            onDone={done}
          />
        ) : (
          <HelpCreateModal token={props.token} onClose={() => setFormOpen(false)} onDone={done} />
        ))}
      {complainItem && (
        <HelpComplaintModal
          item={complainItem}
          onClose={() => setComplainItem(null)}
          onDone={(msg) => {
            setComplainItem(null);
            props.notify(msg);
          }}
        />
      )}
    </>
  );
}
