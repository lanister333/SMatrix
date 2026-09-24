"use client";

import { useCallback, useEffect, useState } from "react";
import { Nick, fmtDate, fmtDateTime, type ForumUser } from "@/lib/ui";

/** ШАГ 27: строка результата поиска /api/search (как в topic-list). */
interface SearchRow {
  type: "message" | "topic";
  topicId: number;
  title: string;
  messageNum: number | null;
  snippet: string;
  rubricName: string;
  author: string;
  authorGender: string;
  isArchived: boolean;
  isClosed: boolean;
}

export function ProfileView(props: {
  nick: string;
  onOpenTopic: (id: number) => void;
  onOpenTopicAt: (id: number, msg: number) => void;
  onGoForumHome: () => void;
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = false;
    const load = async () => {
      setLoading(true);
      setError("");
      setData(null);
      try {
        const r = await fetch(`/api/users/${encodeURIComponent(props.nick)}`);
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Пользователь не найден");
        if (!alive) setData(d);
      } catch (e) {
        if (!alive) setError(e instanceof Error ? e.message : "Пользователь не найден");
      } finally {
        if (!alive) setLoading(false);
      }
    };
    const t = window.setTimeout(load, 0);
    return () => {
      alive = true;
      window.clearTimeout(t);
    };
  }, [props.nick]);

  if (loading) return <div className="sk-loading">Загрузка профиля…</div>;
  if (error || !data)
    return (
      <div className="sk-error">
        {error || "Пользователь не найден"} — <a onClick={props.onGoForumHome}>на главную форума</a>
      </div>
    );

  const user = data.user as { nickname: string; gender: string; createdAt: string };
  const topics = data.topics as {
    id: number;
    title: string;
    isArchived: boolean;
    isClosed: boolean;
    rubricName: string;
    createdAt: string;
    answers: number;
    views: number;
  }[];
  const messages = data.messages as { id: string; topicId: number; num: number; topicTitle: string; snippet: string; createdAt: string }[];

  return (
    <>
      <div className="sk-crumbs">
        <a onClick={props.onGoForumHome} title="На главную страницу форума">
          Форум
        </a>
        <span className="sep">→</span>
        <span className="cur">Профиль</span>
      </div>
      <div className="sk-profilebox">
        <div className="pb-head">
          <Nick name={user.nickname} gender={user.gender} className="pb-nick" />
          <span className="pb-reg">На форуме с {fmtDate(user.createdAt)}</span>
        </div>
        <div className="pb-counts">
          Тем: <b>{data.topicsCount as number}</b> · Сообщений: <b>{data.messagesCount as number}</b>
        </div>
      </div>
      <div className="sk-mainheader">Темы пользователя</div>
      {topics.length === 0 ? (
        <div className="sk-loading">Пользователь пока не создавал тем.</div>
      ) : (
        <div className="sk-profilelist">
          {topics.map((t) => (
            <div key={t.id} className="prow" onClick={() => props.onOpenTopic(t.id)}>
              <div className="prow-title">
                <a>{t.title}</a>
                {t.isArchived && <span className="sk-status-badge archived">В архиве</span>}
                {!t.isArchived && t.isClosed && <span className="sk-status-badge closed">Закрыта</span>}
              </div>
              <div className="prow-meta">
                {t.rubricName && <>{t.rubricName} · </>}создана {fmtDate(t.createdAt)} · ответов: {t.answers} · просмотров: {t.views}
              </div>
            </div>
          ))}
          {(data.topicsCount as number) > (data.topicsShown as number) && (
            <div className="prow-more">Показаны последние {data.topicsShown as number} тем из {data.topicsCount as number}.</div>
          )}
        </div>
      )}
      <div className="sk-mainheader">Сообщения пользователя</div>
      {messages.length === 0 ? (
        <div className="sk-loading">Пользователь пока не оставлял сообщений.</div>
      ) : (
        <div className="sk-profilelist">
          {messages.map((m) => (
            <div key={m.id} className="prow" onClick={() => props.onOpenTopicAt(m.topicId, m.num)}>
              <div className="prow-title">
                <a>{m.topicTitle}</a>
                <span className="sr-badge">сообщение №{m.num}</span>
              </div>
              <div className="prow-snippet">{m.snippet}</div>
              <div className="prow-meta">{fmtDateTime(m.createdAt)}</div>
            </div>
          ))}
          {(data.messagesCount as number) > (data.messagesShown as number) && (
            <div className="prow-more">
              Показаны последние {data.messagesShown as number} сообщений из {data.messagesCount as number}.
            </div>
          )}
        </div>
      )}
    </>
  );
}

/**
 * ТЗ 2026-09-21: полные правила форума по присланному макету владельца
 * (концепция «Премиальный минимализм», HTML+CSS переданы целиком —
 * стили блока живут в globals.css, классы .matrix-rules-* / .rules-*).
 * Источник контента один — этот компонент: /rules.php (RulesScreen) и
 * SPA view=rules (page.tsx). Проп onOpenTopic оставлен в сигнатуре для
 * совместимости обоих мест вызова: кнопка перехода в служебную тему
 * в новом макете не предусмотрена.
 */
export function RulesPage(props: { onOpenTopic: (id: number) => void }) {
  return (
    <div className="matrix-rules-container">
      <header className="rules-header">
        <h1>Правила Форума SakhMatrix</h1>
        <p className="rules-subtitle">Сахалинская матрица взаимопомощи. Пространство честного опыта.</p>
      </header>

      <div className="rules-disclaimer">
        <strong>Важно помнить:</strong> Публикации на форуме отражают исключительно личный опыт и сведения, предоставленные их
        авторами. Они не являются официальной позицией, оценкой, рекомендацией или мнением администрации SakhMatrix.
      </div>

      <section className="rules-section">
        <h2>1. Главный принцип: «Не обвинить — обозначить»</h2>
        <p>
          Наш форум — это не судилище, не место для травли и не площадка для вынесения приговоров. Мы собираемся здесь, чтобы
          помогать друг другу информацией. Поэтому мы ориентируемся на факты и личный опыт:
        </p>
        <ul>
          <li>
            <strong>Опыт автора:</strong> Рассказывайте о том, что вы видели, слышали непосредственно или с чем столкнулись лично.
          </li>
          <li>
            <strong>Конкретика вместо ярлыков:</strong> Пишите детали (дату, место, обстоятельства). Вместо эмоционального{" "}
            <em>«В этой компании работают хамы!»</em> напишите: <em>«5 сентября при покупке сотрудник повел себя следующим
            образом...»</em>.
          </li>
          <li>
            <strong>Негативное мнение разрешено:</strong> Если вы столкнулись с бракодельством или плохим сервисом — вы имеете полное
            право написать «не рекомендую». Сам по себе негативный опыт нарушением не является. Главное — описывать свою ситуацию, а
            не вешать общие ярлыки на всю организацию.
          </li>
          <li>
            <strong>Человек не равен организации:</strong> Плохой опыт с компанией не означает, что все её сотрудники плохие. Вы
            всегда можете отдельно отметить человека, который пытался вам помочь, даже если сама компания вам не понравилась.
          </li>
        </ul>
      </section>

      <section className="rules-section">
        <h2>2. Жесткие ограничения (Полный запрет)</h2>
        <p>
          SakhMatrix — это чистая, безопасная среда для созидания и бытовой взаимопомощи жителей острова. Пространство форума
          полностью закрыто для следующих тем:
        </p>
        <ul>
          <li>
            <strong>Политика:</strong> Любые политические дискуссии, лозунги, обсуждения государственных деятелей, партий и
            политических событий находятся под строжайшим запретом.
          </li>
          <li>
            <strong>Криминал:</strong> Запрещено обсуждение криминальных разборок, деталей уголовных дел, если это не касается прямой
            защиты жителей от мошенничества на бытовом уровне на основании личного опыта. Любые призывы к незаконным действиям
            блокируются мгновенно.
          </li>
          <li>
            <strong>Оскорбления и травля:</strong> Переход на личности, угрозы, шантаж, нецензурная брань и агрессия в отношении
            других участников форума или земляков недопустимы в любой форме.
          </li>
        </ul>
      </section>

      <section className="rules-section">
        <h2>3. Модерация и право на ответ</h2>
        <ul>
          <li>
            <strong>ИИ и человек:</strong> Первичный контент проверяется ИИ-модератором Space-Z.AI, который запрограммирован не
            трогать честную критику, но жестко пресекать спам, маты, политику и слив лишних персональных данных (личные телефоны,
            домашние адреса). Сложные случаи перепроверяются людьми.
          </li>
          <li>
            <strong>Жалоба — не приговор:</strong> Если кто-то пожаловался на ваше сообщение, это лишь сигнал для модератора. Мы не
            удаляем публикации автоматически только из-за наличия жалобы. Мы оцениваем контекст и факты.
          </li>
          <li>
            <strong>Две стороны:</strong> Мы не принимаем автоматически чью-то сторону. Форум строится по принципу конструктивного
            диалога, но не превращается в бесконечную публичную перепалку.
          </li>
        </ul>
      </section>

      <footer className="rules-footer">
        <p>
          Перед публикацией сообщения убедитесь, что ваш текст отражает ваш личный опыт и не содержит запрещенных сведений. Вы
          несете ответственность за содержание своего материала.
        </p>
      </footer>
    </div>
  );
}

export function AppealPage(props: { notify: (m: string) => void }) {
  const [text, setText] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), contact: contact.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setText("");
      setContact("");
      props.notify(d.note || "Обращение отправлено");
    } catch (e) {
      props.notify(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sm-frame-2 mx-auto max-w-[720px]">
      <div className="sm-frame-title">Обращение к администратору</div>
      <div className="space-y-2.5 p-4">
        <p className="text-[14px] text-[#56657a]">
          Обжалование решений ИИ/модерации, вопросы и предложения. Минимум 20 символов.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Опишите ситуацию…"
          className="w-full border border-[#1E3A5F] px-2.5 py-2 text-[15px] outline-none focus:bg-[#F2F6FA]"
        />
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Контакт для ответа (необязательно)"
          className="w-full border border-[#1E3A5F] px-2.5 py-2 text-[14.5px] outline-none focus:bg-[#F2F6FA]"
        />
        <button className="sm-btn sm-btn-primary px-5 py-2" disabled={busy || text.trim().length < 20} onClick={submit}>
          {busy ? "Отправка…" : "Отправить обращение"}
        </button>
      </div>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="sm-frame-2 mx-auto max-w-[800px]">
      <div className="sm-frame-title">О проекте</div>
      <div className="space-y-3 p-4 text-[15px]">
        <p>
          <b>SakhMatrix</b> — Сахалинская матрица взаимопомощи: независимый форум-портал для жителей острова.
        </p>
        <p>
          Здесь спрашивают и отвечают: рекомендации мастеров, дороги и транспорт, рыбалка, ЖКХ, цены, жизнь Сахалина. Девиз проекта —
          «Спроси у города — город ответит».
        </p>
        <p>
          На портале действует цепочка модерации: ИИ-модератор — первая инстанция, он проверяет каждое сообщение и жалобы; спорные и
          неоднозначные случаи передаются человеку-модератору. Критика и несогласное мнение нарушением не считаются.
        </p>
        <p>
          Санкции — мягкие: предупреждение → ограничение на 1 час → до 24 часов; серьёзные и постоянные санкции применяет только
          человек-модератор. Каждое решение можно оспорить — апелляцию рассматривает человек, а не ИИ.
        </p>
      </div>
    </div>
  );
}

/**
 * ШАГ 12. Публичные разделы «Объявления», «Практическая информация»,
 * «Справочник» — содержимое ведётся в админ-панели (ContentItem).
 */
const SECTION_META: Record<string, { title: string; empty: string }> = {
  ads: { title: "Объявления", empty: "Объявлений пока нет — загляните позже." },
  info: { title: "Практическая информация", empty: "Записей пока нет — раздел наполняется." },
  directory: { title: "Справочник", empty: "Справочник пока пуст — раздел наполняется." },
};

export function SectionPage(props: { section: "ads" | "info" | "directory"; onForum: () => void }) {
  const meta = SECTION_META[props.section];
  const [items, setItems] = useState<{ id: string; title: string; body: string; contact: string; updatedAt: string }[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = false;
    setItems(null);
    setError("");
    fetch(`/api/sections?section=${props.section}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Ошибка загрузки");
        return d;
      })
      .then((d) => {
        if (!alive) setItems(d.items || []);
      })
      .catch((e) => {
        if (!alive) setError(e instanceof Error ? e.message : "Ошибка загрузки");
      });
    return () => {
      alive = true;
    };
  }, [props.section]);

  return (
    <div className="sm-frame-2 mx-auto max-w-[860px]">
      <div className="sm-frame-title">{meta.title}</div>
      {error && <p className="p-4 text-[14px] text-[#B22335]">{error}</p>}
      {items === null && !error && <p className="p-4 text-[14px] text-[#56657a]">Загрузка…</p>}
      {items !== null && items.length === 0 && (
        <div className="space-y-3 p-6 text-center text-[15px]">
          <p>{meta.empty}</p>
          <button className="sm-btn sm-btn-primary px-5 py-2" onClick={props.onForum}>
            Перейти на форум
          </button>
        </div>
      )}
      {items !== null && items.length > 0 && (
        <ul className="divide-y divide-[#D8DEE7]">
          {items.map((i) => (
            <li key={i.id} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <b className="text-[15.5px]">{i.title}</b>
                {i.contact && <span className="text-[13px] text-[#0A5CAA]">{i.contact}</span>}
                <span className="ml-auto text-[12.5px] text-[#56657a]">обновлено {fmtDate(i.updatedAt)}</span>
              </div>
              {i.body && <p className="mt-1 whitespace-pre-wrap text-[14.5px] leading-relaxed">{i.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PlaceholderPage(props: { view: string; onForum: () => void }) {
  const titles: Record<string, string> = {
    ads: "Объявления",
    info: "Практическая информация",
    directory: "Справочник",
    useful: "Полезное",
  };
  return (
    <div className="sm-frame-2 mx-auto max-w-[720px]">
      <div className="sm-frame-title">{titles[props.view] || "Раздел"}</div>
      <div className="space-y-3 p-6 text-center text-[15px]">
        <p>Раздел «{titles[props.view]}» готовится к запуску в рамках поэтапной доработки портала.</p>
        <p className="text-[14px] text-[#56657a]">Сейчас работает форум — основа SakhMatrix.</p>
        <button className="sm-btn sm-btn-primary px-5 py-2" onClick={props.onForum}>
          Перейти на форум
        </button>
      </div>
    </div>
  );
}

/** ШАГ 27: страница результатов поиска из навигационной строки «Поиск по форуму...».
 *  Единственное окно поиска живёт в синей навигационной полосе (макет главной);
 *  результаты открываются здесь — список как в поиске по форуму. */
export function SearchPage(props: {
  q: string;
  onOpenTopic: (id: number) => void;
  onOpenTopicAt: (id: number, msg: number) => void;
  onOpenProfile: (nick: string) => void;
}) {
  const [res, setRes] = useState<SearchRow[] | null>(null);

  useEffect(() => {
    let alive = false;
    setRes(null);
    fetch(`/api/search?q=${encodeURIComponent(props.q)}`)
      .then(async (r) => (r.ok ? r.json() : { results: [] }))
      .then((d) => {
        if (!alive) setRes(d.results || []);
      })
      .catch(() => {
        if (!alive) setRes([]);
      });
    return () => {
      alive = true;
    };
  }, [props.q]);

  return (
    <>
      <div className="sk-mainheader">Поиск по форуму</div>
      <div className="sk-searchres">
        <div className="sk-searchres-head">
          Поиск «{props.q}» — найдено: <b>{res === null ? "…" : res.length}</b>
        </div>
        {res === null ? (
          <div className="sk-loading">Идёт поиск…</div>
        ) : res.length === 0 ? (
          <div className="sk-loading">
            Ничего не найдено. Поиск ведётся по словам в названиях тем и тексте сообщений — попробуйте часть слова, например «краб».
          </div>
        ) : (
          res.map((r, i) => (
            <div
              key={`${r.topicId}-${r.messageNum ?? "t"}-${i}`}
              className="sk-searchrow"
              onClick={() => props.onOpenTopicAt(r.topicId, r.messageNum ?? 0)}
            >
              <div className="sr-title">
                <a>{r.title}</a>
                {r.messageNum != null ? (
                  <span className="sr-badge">сообщение №{r.messageNum}</span>
                ) : (
                  <span className="sr-badge sr-badge-title">в названии темы</span>
                )}
                {r.isArchived && <span className="sr-badge sr-badge-lifecycle">В архиве</span>}
                {!r.isArchived && r.isClosed && <span className="sr-badge sr-badge-lifecycle closed">Закрыта</span>}
              </div>
              {r.type === "message" && <div className="sr-snippet">{r.snippet}</div>}
              <div className="sr-meta">
                {r.rubricName}
                {r.rubricName && " · "}
                <Nick name={r.author} gender={r.authorGender} onOpen={props.onOpenProfile} />
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
