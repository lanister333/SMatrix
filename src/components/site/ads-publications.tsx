"use client";

/**
 * ШАГ 22 (восстановление). «Объявления» — доска объявлений жителей Сахалина.
 * Отдельная страница: НЕ форум. Восемь рубрик: Продам, Куплю, Отдам даром,
 * Услуги, Работа, Недвижимость, Транспорт, Разное. Одно объявление — один
 * товар/услуга. Цена и контакты — необязательные поля (можно в тексте).
 *
 * Комментариев, лайков, рейтингов, форумных тем НЕТ: связь покупателя и
 * продавца — напрямую по контактам из объявления. Жалоба — не голосование.
 *
 * Компактный информационный формат: линейный список с тонкими серыми
 * разделителями — без декоративных карточек, теней, градиентов.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import SakhDatetimeBlock from "@/components/site/sakh-datetime-block";
import type { ForumUser } from "@/lib/ui";
import { hasContact, CONTACT_ERROR, renderContacts } from "@/lib/contact-check";

interface AdMediaItem {
  id?: string;
  url: string;
  mime?: string;
}

interface AdItem {
  id: string;
  rubric: string;
  rubricLabel: string;
  title: string;
  text: string;
  price: string;
  contact: string;
  place: string;
  status: string; // active | closed
  authorId: string;
  authorName: string;
  editedAt: string | null;
  createdAt: string;
  media?: AdMediaItem[];
  isHiddenByAi?: boolean;
  hiddenReason?: string;
  needHuman?: boolean;
}

interface SimilarPost {
  id: string;
  title: string;
  price: string;
  createdAt: string;
}

interface FeedResponse {
  posts: AdItem[];
  total: number;
  page: number;
  pages: number;
}

const PAGE_SIZE = 15;

const AD_RUBRICS = [
  { key: "sell", label: "Продам" },
  { key: "buy", label: "Куплю" },
  { key: "give", label: "Отдам даром" },
  { key: "services", label: "Услуги" },
  { key: "jobs", label: "Работа" },
  { key: "realty", label: "Недвижимость" },
  { key: "transport", label: "Транспорт" },
  { key: "other", label: "Разное" },
];

const STATUS_LABELS: Record<string, string> = { active: "Актуально", closed: "Снято с публикации", resolved: "✓ Решено" };

/** Дата и время публикации: «8 сентября, 14:30». */
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** Причины жалоб (ровно пять; рекламы в списке нет — объявления сами являются рекламой). */
const ADS_COMPLAINT_REASONS = [
  { key: "spam", label: "Спам" },
  { key: "fraud", label: "Мошенничество" },
  { key: "forbidden", label: "Запрещённый товар" },
  { key: "personal_data", label: "Личные данные" },
  { key: "other", label: "Другое" },
];

/** Правила «Объявлений» — правая колонка. */
const ADS_RULES = [
  "Одно объявление — один товар или одна услуга.",
  "Восемь рубрик: Продам, Куплю, Отдам даром, Услуги, Работа, Недвижимость, Транспорт, Разное. Других рубрик нет.",
  "Продавать свои вещи и предлагать свои услуги можно — это суть раздела.",
  "Указывайте цену (или «бесплатно») и способ связи — так объявление полезнее.",
  "Цена — необязательное поле. Контакт СПОСОБ СВЯЗИ — обязательный: без телефона, мессенджера или ссылки объявление не публикуется.",
  "Мошенничество запрещено: просьбы перевести предоплату вперёд — нарушение.",
  "Запрещённые к продаже товары — нарушение: наркотики, оружие, поддельные документы.",
  "Публиковать чужие персональные данные запрещено.",
  "Спам и копии одного и того же объявления запрещены.",
  "Когда товар продан или услуга больше не оказывается, снимите объявление с публикации — оно останется в истории раздела.",
  "Нарушающие правила объявления могут быть скрыты или удалены.",
  "Жалоба — сигнал для модерации, а не голосование.",
];

/** Заметка «О разделе» — оформлена в дизайне блока «Время» (.sakh-clock).
 *  28.09.2026: блок перемещён из правой колонки в левую. */
function AboutBlock() {
  return (
    <div className="sakh-clock ad-clock-block ad-clock-about ad-about">
      <div className="sakh-clock-head">ℹ️ О разделе</div>
      <div className="sakh-clock-body sakh-clock-body-content">
        <p className="ad-about-text">
          «Объявления» — доска объявлений жителей Сахалина. Здесь продают и покупают вещи, предлагают
          и ищут услуги, отдают даром, находят работу и жильё.
        </p>
        <p className="ad-about-text">
          Раздел — не форум: связи между покупателем и продавцом возникают напрямую, по контактам из
          объявления. Комментариев и лайков здесь нет.
        </p>
        <p className="ad-about-text">
          ИИ-модерация следит за мошенничеством: просьбы перевести деньги вперёд незнакомому человеку
          скрываются. Будьте внимательны и не переводите предоплату незнакомцам.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Объявление ленты                                                    */
/* ------------------------------------------------------------------ */

function AdRow(props: {
  item: AdItem;
  user: ForumUser | null;
  busy: boolean;
  highlight: boolean;
  onEdit: (item: AdItem) => void;
  onDelete: (item: AdItem) => void;
  onStatus: (item: AdItem, status: string) => void;
  onComplain: (item: AdItem) => void;
}) {
  const { item, user } = props;
  const own = !!(user && item.authorId === user.id);
  const [photoIdx, setPhotoIdx] = useState(0);
  const media = item.media ?? [];
  return (
    <article className={`ad_item${props.highlight ? " ad-highlight" : ""}${item.status === "closed" ? " is-closed" : ""}${item.status === "resolved" ? " is-resolved" : ""}`} data-ad-id={item.id}>
      <div className="ad-item-rubric">
        <span className={`ad-rubric-badge rb-${item.rubric}`}>{item.rubricLabel}</span>
        <span className={`ad-status is-${item.status}`}>{STATUS_LABELS[item.status] ?? item.status}</span>
      </div>
      <div className="ad-item-title">{item.title}</div>
      {media.length > 0 && (
        <div className="ad-photos">
          <img
            src={media[Math.min(photoIdx, media.length - 1)].url}
            alt={`Фото объявления «${item.title}»`}
            className="ad-photo"
            onClick={() => setPhotoIdx((photoIdx + 1) % media.length)}
          />
          {media.length > 1 && (
            <div className="ad-photo-count">
              {Math.min(photoIdx, media.length - 1) + 1} / {media.length}
            </div>
          )}
        </div>
      )}
      <div className="ad-item-text">{item.text}</div>
      <div className="ad-foot">
        <div className="ad-footinfo">
          <div className="ad-item-meta">
            {item.price && <span className="ad-price">{item.price}</span>}
            <b>Автор:</b> {item.authorName} · {fmtDateTime(item.createdAt)}
            {item.place && (
              <>
                {" "}
                · <b>Место:</b> {item.place}
              </>
            )}
            {item.editedAt && " · изменено автором"}
          </div>
          {/* 2026-10-01: ТЗ — контакт обязателен; показываем его отдельной
              выделенной строкой под метаинфо, чтобы покупатель сразу
              видел способ связи (был спрятан в одной строке с мета).
              Контакты — ПОДСВЕЧЕНЫ СИНИМ и КЛИКАБЕЛЬНЫ: tel: → позвонить,
              t.me/ → Telegram, mailto: → почта, https:// → новая вкладка. */}
          {item.contact && (
            <div className="ad-item-contact">
              <b>📞 Связь:</b> {renderContacts(item.contact)}
            </div>
          )}
          <div className="ad-actrow">
            {own ? (
              <>
                {/* 29.09.2026: кнопка «✅ Вопрос решён» — видна только автору.
                    После нажатия объявление уходит в архив (status=resolved).
                    Кнопка видна только когда объявление активно (status=active). */}
                {item.status === "active" && (
                  <button className="ad-act ad-resolve-btn" disabled={props.busy} onClick={() => props.onStatus(item, "resolved")}>
                    ✅ Вопрос решён
                  </button>
                )}
                {/* 29.09.2026: если resolved — показываем «↩ Вернуть в актуальные» */}
                {item.status === "resolved" && (
                  <button className="ad-act ad-statusbtn" disabled={props.busy} onClick={() => props.onStatus(item, "active")}>
                    ↩ Вернуть в актуальные
                  </button>
                )}
                {item.status === "active" ? (
                  <button className="ad-act ad-statusbtn" disabled={props.busy} onClick={() => props.onStatus(item, "closed")}>
                    Снять с публикации
                  </button>
                ) : item.status !== "resolved" ? (
                  <button className="ad-act ad-statusbtn" disabled={props.busy} onClick={() => props.onStatus(item, "active")}>
                    Вернуть в «Актуально»
                  </button>
                ) : null}
                <button className="ad-act" disabled={props.busy} onClick={() => props.onEdit(item)}>
                  Редактировать
                </button>
                <button className="ad-act ad-del" disabled={props.busy} onClick={() => props.onDelete(item)}>
                  Удалить
                </button>
              </>
            ) : (
              <button className="ad-report" onClick={() => props.onComplain(item)}>
                Пожаловаться
              </button>
            )}
          </div>
        </div>
      </div>
      {own && item.isHiddenByAi && (
        <div className="ad-hiddennote">
          Объявление скрыто ИИ-модерацией: {item.hiddenReason || "нарушение правил раздела"}. Его проверит
          человек-модератор и при ошибке вернёт в ленту.
        </div>
      )}
      {own && !item.isHiddenByAi && item.needHuman && (
        <div className="ad-humannote">Объявление отправлено на дополнительную проверку человеку-модератору.</div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Форма объявления / редактирования                                   */
/* ------------------------------------------------------------------ */

function AdFormModal(props: {
  token: string | null;
  editItem: AdItem | null;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const isEdit = !!props.editItem;
  const [rubric, setRubric] = useState(props.editItem?.rubric ?? "sell");
  const [title, setTitle] = useState(props.editItem?.title ?? "");
  const [text, setText] = useState(props.editItem?.text ?? "");
  const [price, setPrice] = useState(props.editItem?.price ?? "");
  const [contact, setContact] = useState(props.editItem?.contact ?? "");
  const [place, setPlace] = useState(props.editItem?.place ?? "");
  const [media, setMedia] = useState<AdMediaItem[]>(props.editItem?.media ?? []);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [hint, setHint] = useState(""); // подсказка: несколько товаров (заголовок)
  const [similar, setSimilar] = useState<SimilarPost[] | null>(null); // предупреждение о похожих
  const fileRef = useRef<HTMLInputElement>(null);

  const clearWarnings = () => {
    setHint("");
    setSimilar(null);
    setErr("");
  };

  const uploadMedia = useCallback(async (file: File) => {
    if (!props.token) return;
    if (media.length >= 5) {
      setErr("Максимум 5 фото на объявление");
      return;
    }
    setUploading(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("token", props.token);
      const r = await fetch("/api/obyavleniya/upload", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) {
        setErr(data.error ?? "Не удалось загрузить фото");
      } else if (data.photo) {
        setMedia((prev) => [...prev, { id: data.photo.id, url: data.photo.url }]);
      }
    } catch {
      setErr("Не удалось загрузить фото");
    } finally {
      setUploading(false);
    }
  }, [media.length, props.token]);

  const submit = async (confirmSimilar: boolean) => {
    clearWarnings();
    if (title.trim().length < 5) {
      setErr("Заголовок слишком короткий — минимум 5 символов");
      return;
    }
    if (text.trim().length < 10) {
      setErr("Напишите текст объявления — минимум 10 символов");
      return;
    }
    // 2026-10-01: ТЗ — контакт обязателен (без него объявление не публикуется).
    // Проверяем и отдельное поле contact, и сам текст (контакт мог быть в тексте).
    if (!hasContact(contact) && !hasContact(text)) {
      setErr(CONTACT_ERROR);
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = isEdit
        ? { token: props.token, action: "edit", rubric, title: title.trim(), text: text.trim(), price: price.trim(), contact: contact.trim(), place: place.trim() }
        : { token: props.token, rubric, title: title.trim(), text: text.trim(), price: price.trim(), contact: contact.trim(), place: place.trim(), photoIds: media.map((m) => m.id).filter(Boolean) };
      if (confirmSimilar) payload.confirmSimilar = true;
      const r = await fetch(isEdit ? `/api/obyavleniya/${props.editItem!.id}` : "/api/obyavleniya", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (r.ok && data.ok) {
        props.onDone(data.note ?? "Объявление опубликовано");
        return;
      }
      if (data.needsSpecific) {
        setHint(data.hint ?? "Одно объявление — один товар или одна услуга.");
        return;
      }
      if (data.similar) {
        setSimilar(data.similarPosts ?? []);
        return;
      }
      setErr(data.error ?? "Не удалось опубликовать объявление");
    } catch {
      setErr("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-modal-wrap" role="dialog" aria-modal="true" aria-label={isEdit ? "Редактирование объявления" : "Новое объявление"}>
      <div className="ad-modal">
        <div className="ad-modal-head">
          <h3>{isEdit ? "Редактирование объявления" : "Новое объявление"}</h3>
          <button className="ad-modal-x" onClick={props.onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className="ad-modal-body">
          <div className="ad-field">
            <label className="ad-label">Рубрика</label>
            <div className="ad-rubrics-grid">
              {AD_RUBRICS.map((r) => (
                <label key={r.key} className={`ad-rubric-choice${rubric === r.key ? " is-active" : ""}`}>
                  <input
                    type="radio"
                    name="ad-rubric"
                    value={r.key}
                    checked={rubric === r.key}
                    onChange={() => setRubric(r.key)}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
          <div className="ad-field">
            <label className="ad-label" htmlFor="ad-title">Заголовок</label>
            <input
              id="ad-title"
              className="ad-input"
              value={title}
              maxLength={150}
              placeholder="Например: Продаю детский велосипед"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="ad-field">
            <label className="ad-label" htmlFor="ad-text">Текст объявления</label>
            <textarea
              id="ad-text"
              className="ad-textarea"
              value={text}
              maxLength={8000}
              rows={5}
              placeholder="Опишите товар или услугу: состояние, комплектация, условия. Контакты можно указать здесь или в поле ниже."
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="ad-field-row">
            <div className="ad-field ad-field-half">
              <label className="ad-label" htmlFor="ad-price">Цена (необязательно)</label>
              <input
                id="ad-price"
                className="ad-input"
                value={price}
                maxLength={80}
                placeholder="5000 руб · бесплатно · от 1500 за час"
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="ad-field ad-field-half">
              <label className="ad-label" htmlFor="ad-place">Место (необязательно)</label>
              <input
                id="ad-place"
                className="ad-input"
                value={place}
                maxLength={80}
                placeholder="Южно-Сахалинск"
                onChange={(e) => setPlace(e.target.value)}
              />
            </div>
          </div>
          <div className="ad-field">
            <label className="ad-label" htmlFor="ad-contact">Способ связи <span style={{ color: "#AA3333" }}>*</span></label>
            <input
              id="ad-contact"
              className="ad-input"
              value={contact}
              maxLength={200}
              placeholder="Телефон, мессенджер (@telegram, wa.me/…), ссылка — без контакта объявление не публикуется"
              onChange={(e) => setContact(e.target.value)}
            />
          </div>
          {!isEdit && (
            <div className="ad-field">
              <label className="ad-label">Фото (по желанию, до 5)</label>
              {media.length > 0 && (
                <div className="ad-formphotos">
                  {media.map((m, i) => (
                    <div key={m.id ?? m.url} className="ad-formphoto">
                      <img src={m.url} alt={`Фото ${i + 1}`} />
                      <button
                        type="button"
                        className="ad-formphoto-del"
                        aria-label="Удалить фото"
                        onClick={() => setMedia((prev) => prev.filter((x) => x.url !== m.url))}
                      >
                        ✕
                      </button>
                      <span className="ad-formphoto-idx">{i + 1}</span>
                    </div>
                  ))}
                </div>
              )}
              {media.length < 5 && (
                <>
                  <button
                    type="button"
                    className="ad-upload-btn"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? "Загрузка…" : "＋ Добавить фото"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadMedia(f);
                      e.target.value = "";
                    }}
                  />
                </>
              )}
            </div>
          )}
          {hint && (
            <div className="ad-spechint">
              {hint}
              <button className="ad-warn-edit" onClick={() => { clearWarnings(); fileRef.current === null && document.getElementById("ad-title")?.focus(); }}>
                Изменить заголовок
              </button>
            </div>
          )}
          {similar && similar.length > 0 && (
            <div className="ad-similarwarn">
              <div className="ad-warn-title">Похожее объявление уже опубликовано. Возможно, то, что вы ищете, уже есть:</div>
              <ul className="ad-warn-list">
                {similar.map((s) => (
                  <li key={s.id}>
                    <a href="/obyavleniya">{s.title}</a>
                    {s.price ? ` — ${s.price}` : ""}
                  </li>
                ))}
              </ul>
              <button className="ad-act ad-warn-publish" disabled={busy} onClick={() => submit(true)}>
                Всё равно опубликовать
              </button>
            </div>
          )}
          {err && <div className="ad-formerror">{err}</div>}
          <div className="ad-modal-actions">
            <button className="ad-submit" disabled={busy || uploading} onClick={() => submit(false)}>
              {isEdit ? "Сохранить" : "Опубликовать"}
            </button>
            <button className="ad-cancel" disabled={busy} onClick={props.onClose}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Модалка жалобы (не голосование)                                     */
/* ------------------------------------------------------------------ */

function AdComplaintModal(props: {
  item: AdItem;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [category, setCategory] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!category) {
      setError("Выберите причину жалобы");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/obyavleniya/${props.item.id}/complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, comment: comment.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        props.onDone(data.note ?? "Жалоба отправлена");
        return;
      }
      setError(data.error ?? "Не удалось отправить жалобу");
    } catch {
      setError("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-modal-wrap" role="dialog" aria-modal="true" aria-label="Жалоба на объявление">
      <div className="ad-modal ad-modal-complaint">
        <div className="ad-modal-head">
          <h3>Жалоба на объявление</h3>
          <button className="ad-modal-x" onClick={props.onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className="ad-modal-body">
          <div className="ad-complaint-target">«{props.item.title}»</div>
          <div className="ad-complaint-note">
            Жалоба — сигнал для модерации, а не голосование. Количество жалоб никто не видит, само
            по себе оно объявление не удаляет: модерация проверит объявление по жалобе.
          </div>
          <div className="ad-complaint-reasons">
            {ADS_COMPLAINT_REASONS.map((r) => (
              <label key={r.key} className={`ad-complaint-reason${category === r.key ? " is-active" : ""}`}>
                <input
                  type="radio"
                  name="ad-complaint"
                  value={r.key}
                  checked={category === r.key}
                  onChange={() => setCategory(r.key)}
                />
                {r.label}
              </label>
            ))}
          </div>
          <div className="ad-field">
            <label className="ad-label" htmlFor="ad-complaint-comment">Комментарий (необязательно)</label>
            <textarea
              id="ad-complaint-comment"
              className="ad-textarea"
              rows={3}
              maxLength={1000}
              value={comment}
              placeholder="Что именно не так?"
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          {error && <div className="ad-formerror">{error}</div>}
          <div className="ad-modal-actions">
            <button className="ad-submit" disabled={busy} onClick={submit}>
              Отправить жалобу
            </button>
            <button className="ad-cancel" disabled={busy} onClick={props.onClose}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Страница раздела: рубрики | лента | правила                         */
/* ------------------------------------------------------------------ */

export function AdsPage(props: {
  user: ForumUser | null;
  token: string | null;
  notify: (msg: string) => void;
  onNeedAuth: () => void;
}) {
  const { user, token } = props;
  const [rubric, setRubric] = useState(""); // "" — все рубрики
  const [mine, setMine] = useState(false);
  const [q, setQ] = useState("");
  const [place, setPlace] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<AdItem | null>(null);
  const [complaintItem, setComplaintItem] = useState<AdItem | null>(null);
  const [highlightId, setHighlightId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (rubric) sp.set("rubric", rubric);
      if (mine) sp.set("mine", "1");
      if (token) sp.set("token", token);
      if (q.trim()) sp.set("q", q.trim());
      if (place.trim()) sp.set("place", place.trim());
      sp.set("page", String(page));
      sp.set("pageSize", String(PAGE_SIZE));
      const r = await fetch(`/api/obyavleniya?${sp.toString()}`);
      const data: FeedResponse = await r.json();
      setItems(data.posts ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch {
      props.notify("Не удалось загрузить объявления");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rubric, mine, token, q, place, page]);

  useEffect(() => {
    load();
  }, [load]);

  const afterChange = (msg: string) => {
    props.notify(msg);
    load();
  };

  const onStatus = async (item: AdItem, status: string) => {
    if (!token) {
      props.onNeedAuth();
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/obyavleniya/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "status", status }),
      });
      const data = await r.json();
      afterChange(data.note ?? (r.ok ? "Статус изменён" : (data.error ?? "Ошибка")));
    } catch {
      props.notify("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (item: AdItem) => {
    if (!token) {
      props.onNeedAuth();
      return;
    }
    if (!window.confirm("Удалить объявление? Действие необратимо.")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/obyavleniya/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "delete" }),
      });
      const data = await r.json();
      afterChange(data.note ?? (r.ok ? "Объявление удалено" : (data.error ?? "Ошибка")));
    } catch {
      props.notify("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (item: AdItem) => {
    if (!token) {
      props.onNeedAuth();
      return;
    }
    setEditItem(item);
    setFormOpen(true);
  };

  const openCreate = () => {
    if (!token) {
      props.onNeedAuth();
      return;
    }
    setEditItem(null);
    setFormOpen(true);
  };

  return (
    <div className="ad-grid main-grid-container">
      {/* ЛЕВАЯ КОЛОНКА — «О разделе» (правки 28.09.2026):
          Прежние блоки (Раздел / Рубрики / Мои публикации / Главное правило)
          УБРАНЫ. «О разделе» перемещён сюда из правой колонки и оформлен
          в дизайне блока «Время» (.sakh-clock). */}
      <aside className="ad-col ad-col-left left-column">
        <AboutBlock />
      </aside>

      {/* ЦЕНТРАЛЬНАЯ КОЛОНКА: лента объявлений */}
      <section className="ad-col ad-col-main center-column">
        <h2 className="ad-feed-title">{mine ? "Мои объявления" : rubric ? AD_RUBRICS.find((r) => r.key === rubric)?.label ?? "Объявления" : "Все объявления"}</h2>
        <p className="ad-feed-desc">
          {mine
            ? "Здесь видны все ваши объявления, включая скрытые ИИ-модерацией — с причиной скрытия."
            : "Актуальные объявления сверху, снятые с публикации — ниже серым. Выберите рубрику или воспользуйтесь поиском."}
        </p>
        <div className="ad-searchrow">
          <input
            className="ad-search"
            placeholder="Поиск по объявлениям: слово из заголовка или текста"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <input
            className="ad-search ad-search-place"
            placeholder="Место (необязательно)"
            value={place}
            onChange={(e) => {
              setPlace(e.target.value);
              setPage(1);
            }}
          />
          {(q || place) && (
            <button
              className="ad-searchreset"
              onClick={() => {
                setQ("");
                setPlace("");
                setPage(1);
              }}
            >
              Сбросить
            </button>
          )}
        </div>
        {!mine && (
          <button className="ad-create ad-create-mobile" onClick={openCreate}>
            ＋ Создать объявление
          </button>
        )}
        {loading ? (
          <div className="ad-loading">Загрузка…</div>
        ) : items.length === 0 ? (
          <div className="ad-empty">
            {mine ? "У вас пока нет объявлений. Создайте первое — это просто." : "Пока нет объявлений в этой рубрике. Ваше может быть первым."}
          </div>
        ) : (
          <div className="ad-list">
            {items.map((item) => (
              <AdRow
                key={item.id}
                item={item}
                user={user}
                busy={busy}
                highlight={item.id === highlightId}
                onEdit={openEdit}
                onDelete={onDelete}
                onStatus={onStatus}
                onComplain={(i) => setComplaintItem(i)}
              />
            ))}
          </div>
        )}
        {pages > 1 && (
          <div className="ad-pagination">
            {page > 1 && (
              <button className="ad-pagebtn" onClick={() => setPage((p) => Math.max(1, p - 1))}>
                ← Новее
              </button>
            )}
            <span className="ad-pageinfo">
              Страница {page} из {pages}
            </span>
            {page < pages && (
              <button className="ad-pagebtn" onClick={() => setPage((p) => Math.min(pages, p + 1))}>
                Старее →
              </button>
            )}
          </div>
        )}
      </section>

      {/* ПРАВАЯ КОЛОНКА — Время + Правила (правки 28.09.2026):
          AboutBlock убран (теперь он в левой колонке).
          «Правила раздела» оформлены в дизайне блока «Время» (.sakh-clock). */}
      <aside className="ad-col ad-col-right right-column">
        <SakhDatetimeBlock />
        <div className="sakh-clock ad-clock-block ad-clock-rules">
          <div className="sakh-clock-head">⚠️ Правила раздела</div>
          <div className="sakh-clock-body sakh-clock-body-content">
            <ol className="ad-rules">
              {ADS_RULES.map((rule, i) => (
                <li key={i}>{rule}</li>
              ))}
            </ol>
          </div>
        </div>
      </aside>

      {formOpen && (
        <AdFormModal
          token={token}
          editItem={editItem}
          onClose={() => {
            setFormOpen(false);
            setEditItem(null);
          }}
          onDone={(msg) => {
            setFormOpen(false);
            setEditItem(null);
            afterChange(msg);
          }}
        />
      )}
      {complaintItem && (
        <AdComplaintModal
          item={complaintItem}
          onClose={() => setComplaintItem(null)}
          onDone={(msg) => {
            setComplaintItem(null);
            props.notify(msg);
          }}
        />
      )}
    </div>
  );
}
