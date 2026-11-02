"use client";

/**
 * ТЗ 2026-09-21: самостоятельная страница «Новый бизнес Сахалина»
 * (роут /startup.php) — карточки островных стартапов по ПРИСЛАННОЙ
 * разметке (классы sakh-matrix-startup-* сохранены 1-в-1):
 *   - .startup-header-panel — кнопка «⬅️ Назад на Главную» + заголовок;
 *   - .startup-stream — лента .startup-card (data-company-id):
 *     бейдж категории, название, описание, ответственный
 *     (.startup-human-factor), кнопки «Читать блог новичка» и WhatsApp.
 * ТЗ 2026-09-21 (доработка): кнопка «Читать блог новичка» на карточке
 * «Анива Тимбер» открывает её Бизнес-страницу — новая концепция ВМЕСТО
 * текстовой ленты (hero-баннер, сетка ключевых фактов, «Дневник
 * основателя», блок действия; классы matrix-business-page / biz-*
 * сохранены 1-в-1; список при этом скрывается display:none) с возвратом
 * «⬅️ К списку стартапов». У остальных компаний страниц пока нет —
 * тост-заглушка (тексты НЕ выдумываются).
 * Каркас общий с остальными разделами: Masthead + MainNav + SiteFooter,
 * та же авторизация (useAuth/AuthModal). WhatsApp — ссылка из ТЗ.
 */

import { useCallback, useEffect, useState } from "react";
import { AuthModal } from "@/components/forum/modals";
import { DEFAULT_SETTINGS, isStaffRole, MainNav, Masthead, SiteFooter, useAuth, type SiteSettings } from "@/components/site/chrome";

/** Три компании ТЗ — тексты 1:1 (id, категории, описания, люди). */
const STARTUPS: {
  id: string;
  badge: string;
  name: string;
  description: string;
  humanLabel: string;
  humanName: string;
}[] = [
  {
    id: "aniva-timber",
    badge: "Мастерская",
    name: "Анива Тимбер (Крафт из плавника)",
    description:
      "Собираем штормовую древесину (плавник) на побережье Анивского залива, сушим по технологии и создаем уникальные часы, зеркала и журнальные столы залитые эпоксидной смолой. Каждое изделие хранит дух Охотского моря!",
    humanLabel: "Мастер:",
    humanName: "Игорь Радченко (г. Анива)",
  },
  {
    id: "клоп-и-ко",
    badge: "Гастрономия",
    name: "Клоп и Ко (Островные дикоросы)",
    description:
      "Мы открыли цех полезных перекусов. Делаем натуральный мармелад, соусы и сиропы из сахалинской клоповки, брусники и лимонника. Без химии. Докажем делом, что островные ягоды — это лучший локальный продукт!",
    humanLabel: "Шеф-технолог:",
    humanName: "Елена Воронова (г. Южно-Сахалинск)",
  },
  {
    id: "sakh-climat",
    badge: "Сервис",
    name: "СахКлимат (Честный монтаж)",
    description:
      "Два профессиональных инженера ушли из крупной компании и открыли свое дело по установке и обслуживанию кондиционеров и тепловых насосов. Работаем строго по договору. Несем личную ответственность за каждый стык.",
    humanLabel: "Бригадир:",
    humanName: "Артем и Виталий (г. Корсаков)",
  },
];

/**
 * ТЗ 2026-09-21 (новая концепция): Бизнес-страница компании — ВМЕСТО
 * текстовой ленты блога. Пока только «Анива Тимбер» (id = data-company-id
 * карточки). Все тексты, эмодзи и ссылки — СТРОГО из ТЗ заказчика, не
 * выдумываются; записи дневника идут от свежих к старым (порядок ТЗ).
 * Ключ = id компании: когда заказчик пришлёт страницы
 * «Клоп и Ко»/«СахКлимат», добавятся новые записи.
 */
const BIZ_PAGES: Record<
  string,
  {
    category: string;
    title: string;
    tagline: string;
    badge: string;
    features: { icon: string; label: string; text: string }[];
    diaryTitle: string;
    timeline: { date: string; title: string; text: string }[];
    owner: { avatar: string; name: string; role: string };
    waLabel: string;
    waHref: string;
  }
> = {
  "aniva-timber": {
    category: "Крафтовая мастерская",
    title: "Анива Тимбер",
    tagline: "🔥 Создаем мебель и декор из штормового дерева Анивского залива",
    badge: "Стартап на SakhMatrix",
    features: [
      {
        icon: "📍",
        label: "Локация",
        text: "Производство в г. Анива. Доставка по всему Сахалину.",
      },
      {
        icon: "🌲",
        label: "Материал",
        text: "Настоящий сахалинский плавник, мореная древесина, эпоксидная смола.",
      },
      {
        icon: "🛡️",
        label: "Честный подход",
        text: "Личная ответственность мастеров. Договор. Без скрытых наценок.",
      },
    ],
    diaryTitle: "Дневник основателя",
    timeline: [
      {
        date: "21 сентября 2026",
        title: "Борьба с влажностью и смолой",
        text: "Из-за высокой островной влажности первый слой заливки пошел пузырями. Полностью сошлифовали материал, потеряли 5000₽, но клиенту отдадим идеальный стол. Качество важнее денег.",
      },
      {
        date: "10 сентября 2026",
        title: "Первый шаг на SakhMatrix",
        text: "Ушли с наемной стройки, открыли свой цех в гараже. Готовы делом доказать качество каждому земляку!",
      },
    ],
    owner: { avatar: "👨‍💻", name: "Игорь Радченко", role: "Основатель мастерской" },
    waLabel: "💬 Написать мастеру в WhatsApp",
    waHref: "https://wa.me",
  },
};

export default function StartupScreen() {
  const { user, token, login } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [authOpen, setAuthOpen] = useState(false);
  const [toast, setToast] = useState("");
  // ТЗ 2026-09-21 (доработка): открытая бизнес-страница компании
  // (id из BIZ_PAGES) или null — показан список стартапов.
  const [openBlogId, setOpenBlogId] = useState<string | null>(null);

  // Общие настройки сайта для шапки и футера (те же, что на форуме)
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

  // ТЗ 2026-09-21 (доработка): «Читать блог новичка» — у «Анивы Тимбер»
  // открывает её бизнес-страницу (список скрывается display:none — как
  // в ТЗ), у остальных компаний страницы пока нет — тост-заглушка.
  const openBlog = useCallback((id: string) => {
    if (!BIZ_PAGES[id]) {
      notify("Блог компании скоро откроется");
      return;
    }
    setOpenBlogId(id);
    window.scrollTo(0, 0);
  }, [notify]);

  const backToList = useCallback(() => {
    setOpenBlogId(null);
    window.scrollTo(0, 0);
  }, []);

  // Навигация из синей полосы: пункты-разделы ведут на свои страницы,
  // «Главная» — на /, остальные виды — SPA-параметром главной.
  const goNav = useCallback((k: string) => {
    window.location.href = k === "home" ? "/" : `/?view=${k}`;
  }, []);

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="useful" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div className="sk-shell">
          {/* Разметка ТЗ — классы сохранены 1-в-1. При открытом блоге
              список скрывается display:none — как в присланном ТЗ */}
          <div
            className="sakh-matrix-startup-container"
            style={openBlogId ? { display: "none" } : undefined}
          >
            <div className="startup-header-panel">
              <button className="btn-back-to-main" id="ajax-back-btn" onClick={() => { window.location.href = "/"; }}>
                ⬅️ Назад на Главную
              </button>
              <span className="startup-panel-title">Новый бизнес Сахалина</span>
            </div>

            <div className="startup-stream">
              {STARTUPS.map((s) => (
                <article className="startup-card" data-company-id={s.id} key={s.id}>
                  <div className="startup-card-main">
                    <div className="startup-info">
                      <span className="startup-badge">{s.badge}</span>
                      <h4 className="startup-name">{s.name}</h4>
                      <p className="startup-description">{s.description}</p>
                      <div className="startup-human-factor">
                        <span className="human-label">{s.humanLabel}</span>
                        <span className="human-name">{s.humanName}</span>
                      </div>
                    </div>
                    <div className="startup-actions">
                      <button
                        className="btn-open-blog"
                        onClick={() => openBlog(s.id)}
                      >
                        Читать блог новичка
                      </button>
                      <a href="https://wa.me" className="btn-startup-whatsapp" target="_blank" rel="noreferrer">
                        WhatsApp
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* ТЗ 2026-09-21 (новая концепция): Бизнес-страница компании —
              классы matrix-business-page / biz-* сохранены 1-в-1 из ТЗ;
              открывается кнопкой «Читать блог новичка» (пока только
              «Анива Тимбер»). Возврат «⬅️ К списку стартапов» — из
              предыдущего ТЗ. */}
          {openBlogId && BIZ_PAGES[openBlogId] && (
            <>
              <div className="biz-backrow">
                <button className="btn-back-to-list" onClick={backToList}>
                  ⬅️ К списку стартапов
                </button>
              </div>
              <div className="matrix-business-page" id={`bizpage-${openBlogId}`}>
                {/* 1. Главный баннер-презентация дела */}
                <div className="biz-hero-section">
                  <div className="biz-main-info">
                    <span className="biz-category-tag">{BIZ_PAGES[openBlogId].category}</span>
                    <h2 className="biz-title">{BIZ_PAGES[openBlogId].title}</h2>
                    <p className="biz-tagline">{BIZ_PAGES[openBlogId].tagline}</p>
                  </div>
                  <div className="biz-status-badge">{BIZ_PAGES[openBlogId].badge}</div>
                </div>

                {/* 2. Сетка ключевых фактов о бизнесе */}
                <div className="biz-features-grid">
                  {BIZ_PAGES[openBlogId].features.map((f) => (
                    <div className="feature-card" key={f.label}>
                      <span className="feature-icon">{f.icon}</span>
                      <div className="feature-text">
                        <h6>{f.label}</h6>
                        <p>{f.text}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 3. Живой Дневник дела (от свежих к старым) */}
                <div className="biz-content-section">
                  <h4>{BIZ_PAGES[openBlogId].diaryTitle}</h4>
                  <div className="biz-timeline">
                    {BIZ_PAGES[openBlogId].timeline.map((t) => (
                      <div className="timeline-item" key={t.date}>
                        <div className="item-meta">{t.date}</div>
                        <h5>{t.title}</h5>
                        <p>{t.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Фиксированный блок действия (прямая связь) */}
                <div className="biz-action-bar">
                  <div className="action-owner-info">
                    <span className="owner-avatar">{BIZ_PAGES[openBlogId].owner.avatar}</span>
                    <div>
                      <h6>{BIZ_PAGES[openBlogId].owner.name}</h6>
                      <p>{BIZ_PAGES[openBlogId].owner.role}</p>
                    </div>
                  </div>
                  <div className="action-buttons">
                    <a href={BIZ_PAGES[openBlogId].waHref} className="btn-action-wa" target="_blank" rel="noreferrer">
                      {BIZ_PAGES[openBlogId].waLabel}
                    </a>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        {/* Единый футер как на Главной/«Полезном» */}
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
