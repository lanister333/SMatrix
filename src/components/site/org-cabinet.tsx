"use client";

/**
 * ТЗ 2026-09-22: «Кабинет представителя организации» (.matrix-business-cabinet)
 * — отдельная страница /kabinet. Присланная заказчиком разметка 1-в-1:
 *
 *  — шапка кабинета .cabinet-header-flat (название организации из профиля
 *    orgRep, статус «Верифицирован» = подтверждённый администратором orgRep);
 *  — .cabinet-reviews-feed: отзывы жителей о своей организации (API
 *    /api/recommend/org-feed — матч субъекта с User.orgName);
 *  — .status-pending: форма ЕДИНСТВЕННОГО официального ответа
 *    (.matrix-response-submit-form → существующий POST /api/recommend/[id]/org-response
 *    с ИИ-модерацией, Пункт 13 Манифеста);
 *  — .status-answered: опубликованный ответ + «Ответ зафиксирован»
 *    (редактирование/повтор невозможны — проверяет API, 409).
 *
 * Документированные импровизации (CSS заказчиком не прислан): см. блок
 * 2026-09-22 в globals.css. Дополнительно: пустое состояние ленты, заглушка
 * для гостей и не-orgRep, текст ошибки под формой, кнопка «Кабинет
 * представителя» в сайдбаре /rekomenduyu как точка входа.
 */

import { useCallback, useEffect, useState } from "react";
import { AuthModal } from "@/components/forum/modals";
import { DEFAULT_SETTINGS, isStaffRole, MainNav, Masthead, SiteFooter, useAuth, type SiteSettings } from "@/components/site/chrome";
import type { ForumUser } from "@/lib/ui";

interface CabinetPost {
  id: string;
  subject: string;
  stance: string; // recommend | notrecommend
  title: string;
  text: string;
  place: string;
  authorName: string;
  createdAt: string;
  orgResponseText: string | null;
  orgResponseAt: string | null;
  orgResponseByName: string | null;
}

/** Дата отзыва в кабинете (макет заказчика): «22 сентября 2026» — без времени. */
function fmtReviewDate(iso: string): string {
  const d = new Date(iso);
  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Дата публикации ответа (макет заказчика): «18.09.2026». */
function fmtDots(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

/* ------------------------------------------------------------------ */
/* Кабинет (присланная разметка)                                       */
/* ------------------------------------------------------------------ */

function OrgCabinet(props: {
  user: ForumUser | null;
  token: string | null;
  notify: (m: string) => void;
  onNeedAuth: () => void;
}) {
  const [posts, setPosts] = useState<CabinetPost[] | null>(null);
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errId, setErrId] = useState<string | null>(null);
  const [errText, setErrText] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const r = await fetch(`/api/recommend/org-feed?token=${encodeURIComponent(props.token ?? "")}`);
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось загрузить кабинет");
      setPosts(d.posts ?? []);
      setOrgName(d.orgName ?? "");
    } catch (e) {
      setPosts([]);
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    }
  }, [props.token]);

  useEffect(() => {
    if (props.user?.orgRep) load();
  }, [props.user?.orgRep, load]);

  const submit = async (postId: string) => {
    const text = (drafts[postId] ?? "").trim();
    setErrId(null);
    setErrText("");
    if (text.length < 10) {
      setErrId(postId);
      setErrText("Текст ответа: от 10 до 4000 символов");
      return;
    }
    setBusyId(postId);
    try {
      const r = await fetch(`/api/recommend/${postId}/org-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, text }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось отправить ответ");
      props.notify(d.note || "Официальный ответ опубликован. Он виден в карточке отзыва.");
      setDrafts((prev) => ({ ...prev, [postId]: "" }));
      load();
    } catch (e) {
      setErrId(postId);
      setErrText(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setBusyId(null);
    }
  };

  /* Гость / не-представитель — заглушки (импровизация, документирована) */
  if (!props.user) {
    return (
      <div className="matrix-business-cabinet">
        <header className="cabinet-header-flat">
          <div className="cabinet-brand-info">
            <h3>
              Кабинет представителя: <span className="brand-title-accent">доступ ограничен</span>
            </h3>
            <p>
              📍 Южно-Сахалинск • Статус: <span className="status-verified">🛡️ Верифицирован</span>
            </p>
          </div>
        </header>
        <div className="cabinet-reviews-feed">
          <p className="cabinet-empty">Войдите в аккаунт представителя организации, чтобы открыть кабинет.</p>
          <button className="rc-addbtn" onClick={props.onNeedAuth}>
            Войти или зарегистрироваться
          </button>
        </div>
      </div>
    );
  }
  if (!props.user.orgRep) {
    return (
      <div className="matrix-business-cabinet">
        <header className="cabinet-header-flat">
          <div className="cabinet-brand-info">
            <h3>
              Кабинет представителя: <span className="brand-title-accent">{props.user.orgName || "статус не подтверждён"}</span>
            </h3>
            <p>
              📍 Южно-Сахалинск • Статус: <span className="status-verified">🛡️ Верифицирован</span>
            </p>
          </div>
        </header>
        <div className="cabinet-reviews-feed">
          <p className="cabinet-empty">
            Кабинет доступен только подтверждённым представителям организаций. Статус представителя подтверждается
            администратором — обратитесь через форму обращения.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="matrix-business-cabinet">
      {/* Шапка кабинета — присланная разметка 1-в-1 */}
      <header className="cabinet-header-flat">
        <div className="cabinet-brand-info">
          <h3>
            Кабинет представителя: <span className="brand-title-accent">{orgName}</span>
          </h3>
          <p>
            📍 Южно-Сахалинск • Статус: <span className="status-verified">🛡️ Верифицирован</span>
          </p>
        </div>
      </header>

      {/* Список отзывов, требующих внимания */}
      <div className="cabinet-reviews-feed">
        <h5>Отзывы жителей города о вашей организации</h5>
        {error && <p className="cabinet-empty">{error}</p>}
        {posts && posts.length === 0 && !error && (
          <p className="cabinet-empty">Пока отзывов о вашей организации нет — они появятся здесь после публикаций жителей.</p>
        )}
        {(posts ?? []).map((p) => {
          const badge = p.stance === "notrecommend" ? (
            <span className="badge-no">👎 Не рекомендует</span>
          ) : (
            <span className="badge-yes">👍 Рекомендует</span>
          );
          return p.orgResponseAt ? (
            /* Отзыв, на который ответ УЖЕ ДАН (форма заблокирована) */
            <div className="cabinet-review-item status-answered" key={p.id}>
              <div className="item-user-meta">
                <strong>{p.authorName}</strong> • {badge} • <span className="date-text">{fmtReviewDate(p.createdAt)}</span>
              </div>
              <p className="item-review-text">«{p.text}»</p>
              {/* Вместо формы ввода показывается уже опубликованный ответ */}
              <div className="cabinet-already-answered-block">
                <strong>Ваш ответ (опубликован {fmtDots(p.orgResponseAt)}):</strong>
                <p>«{p.orgResponseText}»</p>
                <span className="response-locked-notice">
                  🔒 Ответ зафиксирован. Редактирование или повторный ответ невозможны согласно правилам SakhMatrix.
                </span>
              </div>
            </div>
          ) : (
            /* Отзыв без ответа (бизнес должен ответить) */
            <div className="cabinet-review-item status-pending" key={p.id}>
              <div className="item-user-meta">
                <strong>{p.authorName}</strong> • {badge} • <span className="date-text">{fmtReviewDate(p.createdAt)}</span>
              </div>
              <p className="item-review-text">«{p.text}»</p>
              {/* Интерактивная форма для ЕДИНСТВЕННОГО официального ответа (Пункт 13 Манифеста) */}
              <div className="cabinet-response-form-zone" id={`response-zone-${p.id}`}>
                <form
                  className="matrix-response-submit-form"
                  data-review-id={p.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit(p.id);
                  }}
                >
                  <label>Ваш официальный ответ (Допускается только один ответ, без дальнейших дискуссий):</label>
                  <textarea
                    className="textarea-flat response-input"
                    placeholder="Поприветствуйте клиента, разберите ситуацию без агрессии и скриптов, предложите компенсацию или решение в WhatsApp..."
                    required
                    maxLength={4000}
                    value={drafts[p.id] ?? ""}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                  <div className="response-form-actions">
                    <span className="response-hint">💡 Пишите человеческим языком, избегайте казенных формулировок.</span>
                    <button type="submit" className="btn-flat-submit-response" disabled={busyId === p.id}>
                      {busyId === p.id ? "Проверка ИИ…" : "Отправить официальный ответ"}
                    </button>
                  </div>
                  {errId === p.id && errText && <p className="response-form-err">{errText}</p>}
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Экран /kabinet — общий каркас сайта                                 */
/* ------------------------------------------------------------------ */

export default function OrgCabinetScreen() {
  const { user, token, login } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [authOpen, setAuthOpen] = useState(false);
  const [toast, setToast] = useState("");

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

  const goNav = useCallback((k: string) => {
    if (k === "recommend") {
      window.location.href = "/rekomenduyu";
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
    if (k === "employers") {
      window.location.href = "/o-rabotodatelyah";
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
      {/* Кабинет — часть раздела «Рекомендую / Не рекомендую» (current="recommend") */}
      <MainNav current="recommend" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div className="sk-topbar">
          <span className="tb-title">Кабинет представителя</span>
        </div>
        <div className="sk-shell">
          <OrgCabinet user={user} token={token} notify={notify} onNeedAuth={() => setAuthOpen(true)} />
        </div>
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
