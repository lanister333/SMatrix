"use client";

/**
 * ШАГ 24 (восстановление). «Полезное» — справочный раздел из пяти сервисов.
 * Содержимое загружается с /api/poleznoe; выбор сервиса — из левой колонки.
 * Три колонки: список сервисов | содержание выбранного сервиса | о разделе.
 * Публикаций, жалоб, лайков и авторизации в разделе нет — это справка.
 */

import { useCallback, useEffect, useState } from "react";
import SakhDatetimeBlock from "@/components/site/sakh-datetime-block";

interface PoleznoeEntry {
  title: string;
  note: string;
  detail?: string;
}

interface PoleznoeServiceFull {
  key: string;
  title: string;
  description: string;
  entries: PoleznoeEntry[];
  footnote: string;
}

interface PoleznoeServiceShort {
  key: string;
  title: string;
  description: string;
  entryCount: number;
}

/** Деталь пункта: номер телефона кликается, ссылка открывается в новой вкладке. */
function EntryDetail({ detail }: { detail: string }) {
  if (/^[\d\s()+-]{3,}$/.test(detail)) {
    return (
      <a className="pl-entry-detail" href={`tel:${detail.replace(/[^\d+]/g, "")}`}>
        {detail}
      </a>
    );
  }
  if (/^[\w.-]+\.[a-z]{2,}/i.test(detail)) {
    return (
      <a className="pl-entry-detail" href={`https://${detail}`} target="_blank" rel="noreferrer noopener">
        {detail}
      </a>
    );
  }
  return <span className="pl-entry-detail">{detail}</span>;
}

export function PoleznoePage(props: { notify: (msg: string) => void }) {
  const [services, setServices] = useState<PoleznoeServiceShort[]>([]);
  const [current, setCurrent] = useState<PoleznoeServiceFull | null>(null);
  const [loading, setLoading] = useState(true);

  const loadService = useCallback(async (key: string) => {
    try {
      const r = await fetch(`/api/poleznoe?service=${encodeURIComponent(key)}`);
      const data = await r.json();
      if (data.service) setCurrent(data.service);
      else props.notify("Сервис не найден");
    } catch {
      props.notify("Не удалось загрузить содержание сервиса");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/poleznoe");
        const data = await r.json();
        setServices(data.services ?? []);
        // По умолчанию открываем первый сервис («Важные телефоны»).
        if (data.services?.length) await loadService(data.services[0].key);
      } catch {
        props.notify("Не удалось загрузить раздел");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pl-grid main-grid-container">
      {/* ЛЕВАЯ КОЛОНКА: список сервисов */}
      <aside className="pl-col pl-col-left left-column">
        <div className="pl-sidebox">
          <h3 className="pl-side-title">Раздел: Полезное</h3>
          <p className="pl-side-note">Справка для жителей Сахалина: телефоны, транспорт и инструкции в одном месте.</p>
        </div>
        <div className="pl-sidebox">
          <h3 className="pl-side-title">Сервисы</h3>
          <div className="pl-service-list">
            {services.map((s) => (
              <button
                key={s.key}
                className={`pl-service-link${current?.key === s.key ? " is-active" : ""}`}
                onClick={() => loadService(s.key)}
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ЦЕНТРАЛЬНАЯ КОЛОНКА: содержание выбранного сервиса */}
      <section className="pl-col pl-col-main center-column">
        {loading ? (
          <div className="pl-loading">Загрузка…</div>
        ) : !current ? (
          <div className="pl-loading">Содержимое недоступно. Попробуйте обновить страницу.</div>
        ) : (
          <article className="pl-service" data-pl-service={current.key}>
            <h2 className="pl-service-title">{current.title}</h2>
            <p className="pl-service-desc">{current.description}</p>
            <div className="pl-entry-list">
              {current.entries.map((e, i) => (
                <div key={i} className="pl-entry">
                  <div className="pl-entry-title">
                    {e.title}
                    {e.detail && (
                      <>
                        {" · "}
                        <EntryDetail detail={e.detail} />
                      </>
                    )}
                  </div>
                  <div className="pl-entry-note">{e.note}</div>
                </div>
              ))}
            </div>
            <div className="pl-footnote">{current.footnote}</div>
          </article>
        )}
      </section>

      {/* ПРАВАЯ КОЛОНКА: о разделе */}
      <aside className="pl-col pl-col-right right-column">
        {/* Часы на всех страницах: первым блоком правой колонки, как на Главной */}
        <SakhDatetimeBlock />
        <div className="pl-sidebox">
          <h3 className="pl-side-title">О разделе</h3>
          <p className="pl-about-text">
            «Полезное» — справочный раздел SakhMatrix. Здесь собраны важные телефоны, транспортные
            справки и инструкции, которые чаще всего нужны жителям острова.
          </p>
          <p className="pl-about-text">
            Раздел не содержит пользовательских публикаций: содержание редактируется вместе с сайтом.
            Если у вас есть предложение, что добавить, — напишите в обращение к администратору.
          </p>
          <a className="pl-about-link" href="/?view=appeal">
            Написать обращение »
          </a>
        </div>
        <div className="pl-sidebox">
          <h3 className="pl-side-title">Важно</h3>
          <p className="pl-about-text pl-about-warn">
            Номера телефонов и справочные данные приведены для удобства. Актуальность всегда
            проверяйте на официальных сайтах служб: расписания и тарифы меняются.
          </p>
        </div>
      </aside>
    </div>
  );
}
