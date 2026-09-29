"use client";

/**
 * 29.09.2026: единая 3-колоночная обёртка для всех страниц форума.
 *
 * Применяется на:
 *   /forum                  (каталог рубрик)
 *   /forum/category/<slug>  (список тем рубрики)
 *   /forum/topic/<id>       (конкретная тема)
 *
 * Структура (как на всех других страницах сайта — «Где купить»,
 * «ЖКХ», «Знакомства» и т.д.):
 *   — ЛЕВАЯ колонка: блок «ℹ️ О форуме» в дизайне .sakh-clock
 *   — ЦЕНТРАЛЬНАЯ колонка: основной контент (children)
 *   — ПРАВАЯ колонка: 🕒 Время + 📋 «Правила форума» в дизайне .sakh-clock
 *
 * 3-колоночный grid через .main-grid-container (300px + 1fr + 320px).
 */

import SakhDatetimeBlock from "@/components/site/sakh-datetime-block";

const FORUM_ABOUT_TEXT = (
  <>
    <p>
      <b>Форум SakhMatrix</b> — площадка для обсуждений жителей Сахалина. Темы создаются в рубриках: «Закон и право»,
      «Авто/Мото», «ЖКХ», «Цены», «Работодатели» и др.
    </p>
    <p>
      Каждая тема — отдельное обсуждение. В теме можно писать ответы, отвечать на конкретные сообщения (лесенка
      ответов), жаловаться на нарушения модерации.
    </p>
    <p>
      Многие темы создаются автоматически при нажатии кнопки «💬 Обсудить на форуме» в карточках разделов: «Где купить»,
      «Где дешевле», «ЖКХ», «О работодателях», «Рекомендую / Не рекомендую».
    </p>
  </>
);

const FORUM_RULES: { intro: string; items: string[] } = {
  intro: "Форум — место для конструктивного общения. Краткие правила:",
  items: [
    "Не оскорбляйте других участников.",
    "Не публикуйте чужие персональные данные (телефоны, адреса, ФИО).",
    "Запрещены реклама, спам, мошенничество.",
    "Жалоба — сигнал модерации, не голосование.",
    "Все сообщения проверяет ИИ-модерация; спорные случаи — человек-модератор.",
    "Автор темы может её закрыть; модератор — закрепить или перенести в архив.",
  ],
};

export default function ForumColumns({ children }: { children: React.ReactNode }) {
  return (
    <div className="main-grid-container" data-forum-layout="1">
      {/* ЛЕВАЯ КОЛОНКА — «О форуме» в дизайне .sakh-clock */}
      <aside className="left-column">
        <div className="sakh-clock forum-clock-block forum-clock-about">
          <div className="sakh-clock-head">ℹ️ О форуме</div>
          <div className="sakh-clock-body sakh-clock-body-content">
            <div className="forum-info">{FORUM_ABOUT_TEXT}</div>
          </div>
        </div>
      </aside>

      {/* ЦЕНТРАЛЬНАЯ КОЛОНКА — основной контент страницы */}
      <div className="center-column">{children}</div>

      {/* ПРАВАЯ КОЛОНКА — Время + «Правила форума» в дизайне .sakh-clock */}
      <aside className="right-column">
        <SakhDatetimeBlock />
        <div className="sakh-clock forum-clock-block forum-clock-rules">
          <div className="sakh-clock-head">📋 Правила форума</div>
          <div className="sakh-clock-body sakh-clock-body-content">
            <div className="forum-keyrule">{FORUM_RULES.intro}</div>
            <ol className="forum-ruleslist">
              {FORUM_RULES.items.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ol>
            <p className="forum-rulesnote">
              Нарушения скрываются ИИ-модерацией. Жалоба отправляется модератору — решение принимается в течение 24 часов.
              Повторные нарушения ведут к ограничениям (лимит на 1 час / 24 часа / 3 дня / бан).
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
