"use client";

/**
 * ШАГ 20. «Рекомендую / Не рекомендую» — самостоятельный раздел личного опыта
 * об организациях, компаниях, сервисах и местах. Отдельная страница: НЕ форум
 * и не рекламная площадка.
 *
 * Главное правило: одна публикация — один субъект (организация/сервис/место)
 * и одна чёткая позиция на основе ЛИЧНОГО опыта: «Рекомендую» или
 * «Не рекомендую». Критика и негативный опыт — НЕ нарушение (это суть
 * раздела); реклама, заказные рекомендации и спам скрываются ИИ-модерацией.
 *
 * ТЗ 2026-09-21: лента карточек отзывов (.matrix-review-card) — шапка с автором
 * и плашкой рекомендации, объект и личный опыт (Пункт 3), выделение конкретного
 * человека (Пункт 6), «Полезный отзыв», «⚠️ Сигнал модератору» и единственный
 * официальный ответ организации (Пункт 13).
 *
 * Критика и негативный опыт — НЕ нарушение (это суть раздела); реклама,
 * заказные рекомендации и спам скрываются ИИ-модерацией.
 *
 * Обсуждение — только через кнопку состояния форума: максимум одна тема
 * на публикацию. Жалоба — не голосование.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import SakhDatetimeBlock from "@/components/site/sakh-datetime-block";
import type { ForumUser } from "@/lib/ui";
import { discussOnForum } from "@/lib/discuss";
import { nickGenderClass } from "@/lib/nick-gender";

interface RecItem {
  id: string;
  subject: string;
  stance: string; // recommend | notrecommend
  title: string;
  text: string;
  place: string;
  authorId: string;
  authorName: string;
  /** 29.09.2026: gender автора из БД (User.gender) — для покраски ника.
   *  Если API не вернул (поля не было до 29.09.2026) — "unspecified",
   *  nickGenderClass использует эвристику по окончанию ника. */
  authorGender?: string | null;
  /** 29.09.2026: «Вопрос решён» — автор отметил проблему решённой. */
  resolved?: boolean;
  resolvedAt?: string | null;
  editedAt: string | null;
  createdAt: string;
  topicId: number | null;
  topicState?: string; // none | open | closed | archived
  isHiddenByAi?: boolean;
  hiddenReason?: string;
  needHuman?: boolean;
  /* ТЗ 2026-09-21: карточка отзыва (.matrix-review-card) */
  humanHighlight?: string; // Пункт 6 Манифеста — «Отдельно отмечу человека:»
  orgResponseText?: string | null; // Пункт 13 Манифеста — официальный ответ
  orgResponseAt?: string | null;
  orgResponseByName?: string | null;
  usefulCount?: number; // legacy «Полезный отзыв (N)» — кнопка удалена (ТЗ 2026-09-24)
  /* ТЗ 2026-09-24 (пользователь): голоса читателей для кнопок
     «Рекомендую»/«Не рекомендую» рядом с «Обсудить на форуме» */
  recommendCount?: number;
  notrecommendCount?: number;
  myVote?: string | null; // "recommend" | "notrecommend" | null — подсветка выбранного
}

interface SimilarPost {
  id: string;
  subject: string;
  title: string;
  stance: string;
  createdAt: string;
}

interface FeedResponse {
  posts: RecItem[];
  total: number;
  page: number;
  pages: number;
}

const PAGE_SIZE = 15;

/** Месяцы в родительном падеже — детерминированный формат без ICU-вариаций
 * (ru-RU toLocaleDateString добавляет « г.», а ТЗ требует «22 сентября 2026, 01:05»). */
const RU_MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/** Дата публикации в карточке отзыва (ТЗ 2026-09-21): «22 сентября 2026, 01:05». */
function fmtPubDateTime(iso: string): string {
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getDate()} ${RU_MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}, ${time}`;
}

/** Дата официального ответа (ТЗ-пример «Сегодня, 01:20»): сегодня — «Сегодня, ЧЧ:ММ»,
 * ранее — полная дата «22 сентября 2026, 01:20». */
function fmtResponseDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? `Сегодня, ${time}` : `${d.getDate()} ${RU_MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}, ${time}`;
}

/** Причины жалоб (ровно пять). */
const RC_COMPLAINT_REASONS = [
  { key: "ad", label: "Реклама" },
  { key: "spam", label: "Спам" },
  { key: "fraud", label: "Мошенничество" },
  { key: "personal_data", label: "Личные данные" },
  { key: "other", label: "Другое" },
];

/** Правила «Рекомендую / Не рекомендую» — правая колонка. */
const RC_RULES = [
  "Одна публикация — одна организация, компания, сервис или место.",
  "Пишите о своём личном опыте: положительном, отрицательном или смешанном.",
  "Чётко обозначьте позицию: «Рекомендую» или «Не рекомендую».",
  "Критика и негативный опыт разрешены — это суть раздела.",
  "Критикуйте организацию и качество работы, а не конкретных людей по именам.",
  "Оскорбления, угрозы и травля запрещены.",
  "Не публикуйте личные данные третьих лиц: ФИО, телефоны, адреса.",
  "Реклама, скрытая реклама и заказные рекомендации запрещены.",
  "Не создавайте публикации о собственном бизнесе — это реклама.",
  "Ссылки и контакты допустимы, только если они относятся к истории опыта.",
  "Спам и повторяющиеся публикации запрещены.",
  "Позицию можно изменить, если опыт изменился.",
  "Публикации не удаляются автоматически — со временем раздел становится полезной базой опыта.",
  "Нарушающие правила публикации могут быть удалены.",
];

/* Плашка позиции — .matrix-recommend-badge (ТЗ 2026-09-21): «👍 Рекомендую» /
 * «👎 Не рекомендую» — текст выводится в RecRow по stance. */

/** Состояния кнопки форума: одинаковый размер и форма для всех. */
function forumButtonLabel(state: string | undefined): string {
  switch (state) {
    case "open":
      return "Обсуждается на форуме";
    case "closed":
      return "Тема закрыта";
    case "archived":
      return "Тема в архиве";
    default:
      return "Обсудить на форуме";
  }
}

/* ------------------------------------------------------------------ */
/* ТЗ 2026-09-22: «Исправленный подвал карточки»                       */
/* (.review-card-footer-fixed) — присланный фрагмент 1-в-1             */
/* ------------------------------------------------------------------ */

/**
 * ТЗ 2026-09-22 — присланный фрагмент 1-в-1 (HTML, инлайновые стили,
 * комментарии и скрипт без изменений): исправленный подвал карточки
 * (вместо кнопок «Обсудить» и ссылок редактирования):
 *  — временная кнопка симуляции для Шефа (.sim-toggle-zone, кнопка
 *    #toggle-biz-view-btn «⚙️ Сэмулировать: Я владелец "Мебельного цеха
 *    на Ленина"»);
 *  — скрытый блок официального ответа (#biz-response-field-block /
 *    .matrix-official-response-zone, форма #fixed-biz-submit-form,
 *    textarea #fixed-biz-text-input, «Допускается только один ответ
 *    без дискуссий» — Пункт 13 Манифеста);
 *  — место фиксации ответа (#fixed-final-viewport);
 *  — присланный скрипт: toggleBizResponseForm (открытие/закрытие формы)
 *    и handleFixedBizAnswer (ИИ-фильтр агрессии «сам дурак»/«все врете»
 *    с alert «ИИ-БЛОКИРОВКА», уничтожение блоков симуляции и вывод
 *    запечатанного .official-final-rendered-answer с замком
 *    «Цепочка обсуждения закрыта по Манифесту SakhMatrix»).
 *
 * Задокументированные решения:
 *  — фрагмент смонтирован на карточке «Мебельный цех на Ленина»
 *    (существующая публикация ленты): скрипт заказчика использует
 *    статические id и document.getElementById — единственный экземпляр
 *    на странице; сценарий симуляции называет именно эту организацию.
 *    После одобрения Шефом паттерн обобщается на все карточки
 *    (id → data-атрибуты) отдельным раундом;
 *  — на этой карточке кнопка форума «Обсудить…» и авторские ссылки
 *    редактирования (Сменить позицию / Редактировать / Удалить) убраны —
 *    их заменяет фрагмент (по заголовку ТЗ); «Полезный отзыв» и
 *    «⚠️ Сигнал модератору» в ТЗ на замену не указаны — сохранены;
 *  — CSS заказчиком не прислан (все стили инлайновые в самом фрагменте) —
 *    собственных стилей не добавлено, обёртка
 *    .review-card-footer-fixed-host стилей не имеет и служит только
 *    точкой монтирования в React;
 *  — скрипт заказчика исполняется ДОСЛОВНО: тег script внутри
 *    dangerouslySetInnerHTML браузером не исполняется, поэтому в
 *    useEffect он пересоздаётся как исполняемый узел (код 1-в-1);
 *  — сабмит фрагмента локален (симуляция для проверки логики на месте,
 *    без записи в БД) — так задумано заказчиком; реальный официальный
 *    ответ организации остаётся на API Пункта 13 (.rc-orgform /
 *    /kabinet). Ре-рендер ленты запечатанное состояние не сбрасывает
 *    (innerHTML-узел React не перезаписывает), сброс — только перезагрузка
 *    страницы, что эквивалентно поведению присланного кода.
 */

/** Карточка-сценарий симуляции (субъект существующей публикации). */
const REVIEW_FOOTER_FIXED_SUBJECT = "Мебельный цех на Ленина";

/** Присланный фрагмент 1-в-1 (HTML + комментарии + скрипт заказчика). */
const REVIEW_FOOTER_FIXED_HTML = `<!-- ИСПРАВЛЕННЫЙ ПОДВАЛ КАРТОЧКИ (Вместо кнопок "Обсудить" и ссылок редактирования) -->
<div class="review-card-footer-fixed">

  <!-- Временная кнопка симуляции для Шефа, чтобы проверить логику на месте -->
  <div class="sim-toggle-zone" style="margin-bottom: 12px; background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px dashed #cbd5e1;">
    <button type="button" id="toggle-biz-view-btn" class="btn-sim-action" onclick="toggleBizResponseForm()">
      ⚙️ Сэмулировать: Я владелец «Мебельного цеха на Ленина»
    </button>
  </div>

  <!-- БЛОК ОФИЦИАЛЬНОГО ОТВЕТА (По умолчанию скрыт, открывается ТОЛЬКО по кнопке выше) -->
  <div class="matrix-official-response-zone" id="biz-response-field-block" style="display: none; background: #f1f5f9; padding: 16px; border-radius: 6px; margin-top: 12px;">
    <form id="fixed-biz-submit-form" onsubmit="handleFixedBizAnswer(event)">
      <label style="display:block; font-size:13px; font-weight:700; color:#0f766e; margin-bottom:8px;">
        Официальный ответ организации (Допускается только один ответ без дискуссий):
      </label>
      <textarea id="fixed-biz-text-input" style="width:100%; height:80px; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box; resize:none;" placeholder="Здравствуйте! Приносим извинения за задержку... Напишите нам в WhatsApp..." required></textarea>
      <button type="submit" style="background:#0f766e; color:#ffffff; border:none; padding:8px 16px; border-radius:6px; margin-top:10px; font-weight:600; cursor:pointer;">
        Опубликовать ответ компании
      </button>
    </form>
  </div>

  <script>
    // Функция открытия/закрытия формы ответа для теста
    function toggleBizResponseForm() {
      const block = document.getElementById('biz-response-field-block');
      const btn = document.getElementById('toggle-biz-view-btn');
      if (block.style.display === 'none') {
        block.style.display = 'block';
        btn.innerText = '⚙️ Режим бизнесмена: Активен (Форма ответа открыта)';
        btn.style.background = '#ccfbf1';
        btn.style.color = '#0f766e';
      } else {
        block.style.display = 'none';
        btn.innerText = '⚙️ Сэмулировать: Я владелец «Мебельного цеха на Ленина»';
        btn.style.background = '';
        btn.style.color = '';
      }
    }

    // Функция отправки ответа и жесткого закрытия цепочки
    function handleFixedBizAnswer(e) {
      e.preventDefault();
      const answerText = document.getElementById('fixed-biz-text-input').value;

      // ИИ-фильтр против агрессии
      if (answerText.toLowerCase().includes('сам дурак') || answerText.toLowerCase().includes('все врете')) {
        alert('⚠️ ИИ-БЛОКИРОВКА: Обнаружен переход на личности или агрессия. Пожалуйста, напишите ответ в конструктивном ключе по Манифесту SakhMatrix.');
        return;
      }

      // Полностью уничтожаем блок симуляции и ввода, чтобы запечатать ветку
      document.getElementById('biz-response-field-block').remove();
      document.querySelector('.sim-toggle-zone').remove();

      // Выводим финальный зафиксированный ответ
      document.getElementById('fixed-final-viewport').innerHTML = \`
        <div class="official-final-rendered-answer" style="background: #e2e8f0; border-left: 4px solid #0f766e; padding: 14px; border-radius: 4px; margin-top: 12px;">
          <strong style="font-size: 12px; color: #0f766e; text-transform: uppercase; display: block; margin-bottom: 4px;">Официальный ответ организации:</strong>
          <p style="margin: 0; font-size: 13px; color: #1e293b; line-height: 1.5;">«\${answerText}»</p>
          <span style="font-size: 11px; color: #64748b; display: block; margin-top: 6px; font-weight: 600;">🔒 Ответ зафиксирован. Цепочка обсуждения закрыта по Манифесту SakhMatrix.</span>
        </div>
      \`;
    }
  </script>

  <!-- МЕСТО ДЛЯ ФИКСАЦИИ ОТВЕТА -->
  <div id="fixed-final-viewport"></div>
</div>`;

/**
 * Монтирование присланного подвала: HTML вставляется как есть
 * (dangerouslySetInnerHTML), присланный скрипт пересоздаётся как
 * исполняемый узел — innerHTML-скрипты браузер не запускает.
 */
function RecFooterFixedDemo() {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.querySelectorAll("script").forEach((inert) => {
      const live = document.createElement("script");
      live.text = inert.textContent ?? "";
      inert.replaceWith(live);
    });
  }, []);
  return (
    <div
      ref={hostRef}
      className="review-card-footer-fixed-host"
      dangerouslySetInnerHTML={{ __html: REVIEW_FOOTER_FIXED_HTML }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* ТЗ 2026-09-22 (раунд 2): демо-записи заказчика (sakh-001…003)       */
/* ------------------------------------------------------------------ */

/**
 * ТЗ 2026-09-22, раунд 2 — заказчик прислал свой компонент
 * SakhMatrixReviewCard (sakh-matrix-review-card.tsx, сохранён 1-в-1, Tailwind):
 * официальный дизайн карточки для этих записей. Импровизация раунда 1
 * (DemoReviewCard на классах .matrix-review-card + CSS .review-category-path/
 * .review-demo-location) СНЯТА. Задокументированные решения:
 *  — записи СТАТИЧНЫЕ (в модели RecPost нет subject/title/authorId — в БД
 *    не пишем); интерактивных элементов у карточек клиента нет по дизайну;
 *  — показываются в основной ленте (вне «Мои публикации» и поиска) перед
 *    публикациями из БД, в порядке присланного массива;
 *  — статус-маркеры по присланному JSX: recommended → «👍 Рекомендую»
 *    (emerald), warning → «⚠️ Предупреждаю» (red), comment → БЕЗ маркера
 *    (в JSX клиента маркера для comment нет); в данных статусы только
 *    warning/recommended;
 *  — бизнес-ответ: null → присланная заглушка «Ожидается официальное
 *    заявление представителя бренда. Публичные дискуссии запрещены. [4]»
 *    (в текущих данных у всех трёх ответ есть — ветка не задействована);
 *  — глобальный дисклеймер [2] и формулировки — дословно из присланного
 *    компонента.
 */

/* ------------------------------------------------------------------ */
/* Публикация ленты — карточка отзыва (.matrix-review-card)            */
/* ------------------------------------------------------------------ */

/**
 * ТЗ 2026-09-21: карточка отзыва — ПРИСЛАННАЯ разметка 1-в-1
 * (.matrix-review-card.type-negative, review-card-header/-body/-footer,
 * review-user-meta/user-avatar-placeholder/user-nickname/review-pub-date,
 * matrix-recommend-badge.status-no, review-target-object,
 * review-experience-text, review-human-highlight/human-highlight-icon/
 * human-highlight-text с «Отдельно отмечу человека:», review-footer-actions,
 * btn-review-utility «Полезный отзыв (N)»/supportReview, btn-review-report
 * «⚠️ Сигнал модератору»/reportReview, review-official-response/
 * response-header/response-badge/response-date/response-content).
 *
 * Задокументированные адаптации:
 *  — в ТЗ показан чужой вид (type-negative); для положительного опыта —
 *    симметрично .type-positive и .status-yes «👍 Рекомендую»;
 *  — vote/reportReview из ТЗ = обработчики onVote/onComplain (ТЗ 2026-09-24: голосовые кнопки «Рекомендую»/«Не рекомендую» вместо supportReview);
 *  — служебные кнопки автора (Сменить позицию/Редактировать/Удалить — ШАГ 20)
 *    и кнопка состояния форума сохранены в review-footer-actions (в фрагменте
 *    показан только чужой вид); у автора utility-кнопка отключена;
 *  — «(г. Южно-Сахалинск)» в примере: место выводится как введено в поле
 *    «Место» (пользователь может сам написать «г. …»);
 *  — скрытые/на проверке ноты автора и подсветка ?post= сохранены;
 *  — заголовок публикации (title) в новой карточке не выводится (в разметке
 *    ТЗ только объект и опыт) — поле остаётся в форме/БД;
 *  — для orgRep без ответа — форма официального ответа (паттерн ЖКХ);
 *  — ТЗ 2026-09-22: на карточке «Мебельный цех на Ленина» кнопка форума
 *    «Обсудить…» и авторские ссылки редактирования заменены присланным
 *    подвалом .review-card-footer-fixed (см. RecFooterFixedDemo;
 *    «Полезный отзыв»/«Сигнал модератору» не тронуты).
 */
function RecRow(props: {
  item: RecItem;
  user: ForumUser | null;
  token: string | null;
  busy: boolean;
  highlight: boolean;
  onDiscuss: (item: RecItem) => void;
  onEdit: (item: RecItem) => void;
  onDelete: (item: RecItem) => void;
  onStance: (item: RecItem, stance: string) => void;
  onResolve: (item: RecItem, resolved: boolean) => void;
  onComplain: (item: RecItem) => void;
  onVote: (item: RecItem, kind: "recommend" | "notrecommend") => void;
  onOrgDone: (msg: string) => void;
}) {
  const { item, user } = props;
  const own = !!(user && item.authorId === user.id);
  const notrecommend = item.stance === "notrecommend";
  const hasResponse = !!item.orgResponseText && !!item.orgResponseAt;
  // ТЗ 2026-09-22: демо-карточка с присланным подвалом .review-card-footer-fixed
  const isFooterFixed = item.subject === REVIEW_FOOTER_FIXED_SUBJECT;
  // Форма официального ответа: только подтверждённый представитель организации,
  // не автор отзыва, пока ответа нет (Пункт 13 — ответ ровно один).
  const canRespond = !!(user?.orgRep && !own && !hasResponse);

  // 29.09.2026 (правка 3): «Ответ организации» — КНОПКА в actrow рядом с
  // «Обсудить на форуме». Видна только если тема НЕ закрыта. По клику
  // открывается форма RecOrgResponseForm (toggle).
  const [orgFormOpen, setOrgFormOpen] = useState(false);
  // Тема закрыта / в архиве — кнопка «Ответ организации» пропадает.
  const topicClosed = item.topicState === "closed" || item.topicState === "archived";
  const canRespondAndOpenTopic = canRespond && !topicClosed;

  return (
    <article
      className={`matrix-review-card ${notrecommend ? "type-negative" : "type-positive"}${props.highlight ? " rc-highlight" : ""}`}
      data-rc-id={item.id}
    >
      {/* ТЗ 2026-09-24 «RC → ЭТАЛОН WB»: шапка карточки — как .wb-headrow
          на «Где купить»: «📍 ник · дата · город», ник окрашен по полу
          (sm-nick-gender), аватар-заглушка 👤 убрана (Flat 2.0 — без
          аватаров). Плашка позиции (Рекомендую/Не рекомендую) — справа
          в той же строке: роль статуса сохранена. */}
      <div className="rc-headrow" data-rc-head={item.id}>
        📍 <b className={nickGenderClass(item.authorName, item.authorGender)}>{item.authorName}</b> ·{" "}
        <span className="rc-date">{fmtPubDateTime(item.createdAt)}</span>
        {item.place ? ` · ${item.place}` : ""}
        {item.editedAt && " · изменено автором"}
        {/* 29.09.2026: порядок плашек ИЗМЕНЁН — сначала «✓ Решено»
            (если есть), потом «👍 Рекомендую» / «👎 Не рекомендую».
            Обе плашки прижаты к правому краю шапки через
            .rc-headrow .matrix-recommend-badge { margin-left:auto }. */}
        <span className="rc-headrow-badges">
          {item.resolved && (
            <span className="matrix-recommend-badge status-resolved" title={item.resolvedAt ? `Решено: ${fmtResponseDate(item.resolvedAt)}` : "Отмечено как решённая"}>
              ✓ Решено
            </span>
          )}
          <span className={`matrix-recommend-badge ${notrecommend ? "status-no" : "status-yes"}`}>
            {notrecommend ? "👎 Не рекомендую" : "👍 Рекомендую"}
          </span>
        </span>
      </div>

      {/* ТЗ: поле суть — «Отзыв: [субъект]», ниже текст личного опыта
          (аналог «Вопрос:»/текста на «Где купить»; город — в шапке). */}
      <div className="review-card-body">
        <div className="rc-q">
          <span className="rc-qlabel">Отзыв:</span> <b className="rc-qsubject">{item.subject}</b>
        </div>
        <p className="rc-qtext">{item.text}</p>

        {/* Выделение конкретного человека по Пункту 6 Манифеста */}
        {!!item.humanHighlight && (
          <div className="review-human-highlight">
            <span className="human-highlight-icon">💡</span>
            <p className="human-highlight-text">
              <strong>Отдельно отмечу человека:</strong> {item.humanHighlight}
            </p>
          </div>
        )}

        {own && item.isHiddenByAi && (
          <div className="rc-hiddennote">
            Публикация скрыта ИИ-модерацией: {item.hiddenReason || "нарушение правил раздела"}. Её проверит
            человек-модератор и при ошибке вернёт в ленту.
          </div>
        )}
        {own && !item.isHiddenByAi && item.needHuman && (
          <div className="rc-humannote">Публикация отправлена на дополнительную проверку человеку-модератору.</div>
        )}
      </div>

      <div className="rc-sep" />

      {/* ТЗ 2026-09-24: официальный ответ — плоской строкой «📍 Ответ от
          [ник]: [текст]», как ответы на «Где купить»; бейдж официальности
          и дата — мелкой строкой над ответом (Пункт 13 сохранён). */}
      {hasResponse && (
        <div className="rc-answer" data-rc-answer={item.id}>
          <div className="rc-answermeta">
            <span className="rc-answerbadge">Официальный ответ организации</span>
            <span className="rc-answerdate">{fmtResponseDate(item.orgResponseAt!)}</span>
          </div>
          <div className="rc-answertext">
            📍 Ответ от{" "}
            <b className={nickGenderClass(item.orgResponseByName || "")}>
              {item.orgResponseByName || "представителя организации"}
            </b>
            : {item.orgResponseText}
          </div>
        </div>
      )}
      {/* 29.09.2026 (правка 3): форма ответа организации — открывается
          по кнопке «Ответ организации» (рядом с «Обсудить на форуме»),
          а не показывается всегда. Кнопка видна только если тема НЕ
          закрыта (topicState !== closed/archived). */}
      {canRespondAndOpenTopic && orgFormOpen && props.token && (
        <RecOrgResponseForm
          item={item}
          token={props.token}
          orgName={user?.orgName ?? ""}
          busy={props.busy}
          onDone={(msg) => {
            setOrgFormOpen(false);
            props.onOrgDone(msg);
          }}
        />
      )}

      {/* 29.09.2026: СЛУЖЕБНЫЙ РЯД АВТОРА УБРАН — все кнопки (✓ Вопрос
          решён, Редактировать, Удалить, 💬 Обсудить на форуме) теперь
          в едином ряду .rc-actrow ниже. Раньше было 2 ряда: .rc-secrow
          (автора) + .rc-actrow (общий) — разнесены. Теперь одна строка
          для всех — см. блок rc-actrow ниже. */}

      {/* ТЗ 2026-09-22: исправленный подвал карточки (симуляция официального
          ответа с «запечатыванием» ветки) — вместо кнопок «Обсудить» и
          ссылок редактирования; только на карточке-сценарии. */}
      {isFooterFixed && <RecFooterFixedDemo />}

      {/* П.5 (2026-09-24): на карточке с присланным фиксированным подвалом
          кнопка форума тоже нужна («под КАЖДОЙ публикацией») — ряд ПОД
          подвалом, бирюзовая ссылка в рубрику раздела. */}
      {isFooterFixed && (
        <div className="rc-demo-forumrow">
          {/*
            ТЗ 2026-09-24 «Обсудить — авто-создание»: button вместо <a>,
            т.к. действие создаёт тему (не навигация по статической ссылке).
            Используем тот же onDiscuss, что и основная карточка — он
            вызывает обновлённую функцию discuss() в родителе, которая
            редиректит через helper discussOnForum после ответа сервера.
          */}
          <button
            type="button"
            className="rc-btn-forum is-none"
            onClick={() => props.onDiscuss(item)}
            title="Создать тему обсуждения на форуме"
          >
            💬 Обсудить на форуме
          </button>
        </div>
      )}

      {/* 29.09.2026 (правка 4): ОДНА строка кнопок для всех.
          Раньше было 2 раздельных ряда (rc-secrow для автора + rc-actrow
          общий). Теперь всё в одном ряду .rc-actrow:

          Для ВЛАДЕЛЬЦА (own && !isFooterFixed):
            [✓ Вопрос решён / ↺ Снять отметку «решено»] [Редактировать] [Удалить] [💬 Обсудить на форуме]

          Для НЕ ВЛАДЕЛЬЦА:
            [Пожаловаться] [💬 Обсудить на форуме]

          Для ОРГ-ПРЕДСТАВИТЕЛЯ (canRespondAndOpenTopic, не автор, тема открыта):
            добавляется кнопка [🏢 Ответ организации] в конец ряда.

          Все кнопки в одной строке, flex-wrap — на узких экранах
          переносятся на следующую строку. */}
      <div className="rc-actrow rc-actrow-unified" data-rc-actrow={item.id}>
        {/* Кнопки автора — видны только владельцу публикации */}
        {own && !isFooterFixed && (
          <>
            <button
              className={`rc-act rc-resolve-btn${item.resolved ? " is-resolved" : ""}`}
              disabled={props.busy}
              onClick={() => props.onResolve(item, !item.resolved)}
              title={item.resolved ? "Снять отметку «Вопрос решён»" : "Отметить, что проблема решена — кнопка видна только вам"}
            >
              {item.resolved ? "↺ Снять отметку «решено»" : "✓ Вопрос решён"}
            </button>
            <button className="rc-act" disabled={props.busy} onClick={() => props.onEdit(item)}>
              Редактировать
            </button>
            <button className="rc-act rc-del" disabled={props.busy} onClick={() => props.onDelete(item)}>
              Удалить
            </button>
          </>
        )}

        {/* Кнопка «Пожаловаться» — только НЕ автору отзыва */}
        {!own && user && (
          <button className="rc-report" data-rc-report={item.id} onClick={() => props.onComplain(item)}>
            Пожаловаться
          </button>
        )}

        {/* Кнопка «💬 Обсудить на форуме» — видна ВСЕМ, на демо-карточке
            с фиксированным подвалом — в отдельном ряду .rc-demo-forumrow. */}
        {!isFooterFixed && (
          <button
            className={`rc-act rc-btn-forum is-${item.topicId ? item.topicState ?? "open" : "none"}`}
            disabled={props.busy}
            onClick={() => props.onDiscuss(item)}
            title="Открыть тему обсуждения на форуме"
          >
            {forumButtonLabel(item.topicId ? item.topicState : "none")}
          </button>
        )}

        {/* Кнопка «🏢 Ответ организации» — только для org rep, не автору,
            тема НЕ закрыта. По клику открывает форму ответа организации. */}
        {canRespondAndOpenTopic && (
          <button
            type="button"
            className="rc-act rc-org-resp-btn"
            disabled={props.busy}
            onClick={() => setOrgFormOpen((v) => !v)}
            title={orgFormOpen ? "Свернуть форму ответа организации" : "Официальный ответ организации — виден только представителю организации, ровно один ответ"}
          >
            {orgFormOpen ? "▲ Скрыть форму ответа" : "🏢 Ответ организации"}
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * Форма официального ответа организации (Пункт 13 Манифеста) — паттерн ЖКХ
 * (ШАГ 19): только подтверждённый представитель, ровно один ответ, текст
 * проходит ИИ-модерацию. Формулировки — как в форме ответа ЖКХ.
 */
function RecOrgResponseForm(props: {
  item: RecItem;
  token: string;
  orgName: string;
  busy: boolean;
  onDone: (msg: string) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const send = async () => {
    setErr("");
    if (text.trim().length < 10) {
      setErr("Текст ответа: от 10 до 4000 символов");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/recommend/${props.item.id}/org-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, text: text.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось опубликовать ответ");
      props.onDone(d.note || "Официальный ответ опубликован");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rc-orgform">
      <div className="rc-orgform-title">Официальный ответ организации{props.orgName ? ` — ${props.orgName}` : ""}</div>
      <p className="rc-orgform-note">
        Представитель может дать один официальный публичный ответ: позицию, пояснение обстоятельств или план решения.
        Бесконечная переписка внутри отзыва не ведётся.
      </p>
      <textarea
        value={text}
        maxLength={4000}
        onChange={(e) => setText(e.target.value)}
        style={{ minHeight: 90 }}
        placeholder="Официальный ответ организации…"
        disabled={busy || props.busy}
      />
      {err && <div className="sk-modal-err">{err}</div>}
      <div className="rc-orgform-actions">
        <button className="rc-act rc-stancebtn" disabled={busy || props.busy} onClick={send}>
          {busy ? "Проверка ИИ…" : "Опубликовать ответ"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Форма публикации / редактирования                                   */
/* ------------------------------------------------------------------ */

function RecFormModal(props: {
  token: string | null;
  editItem: RecItem | null;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const isEdit = !!props.editItem;
  const [subject, setSubject] = useState(props.editItem?.subject ?? "");
  const [stance, setStance] = useState(props.editItem?.stance ?? "recommend");
  const [title, setTitle] = useState(props.editItem?.title ?? "");
  const [text, setText] = useState(props.editItem?.text ?? "");
  const [place, setPlace] = useState(props.editItem?.place ?? "");
  // ТЗ 2026-09-21 (Пункт 6 Манифеста): необязательное выделение конкретного человека.
  const [human, setHuman] = useState(props.editItem?.humanHighlight ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [specHint, setSpecHint] = useState(""); // подсказка «укажите субъекта»
  const [similar, setSimilar] = useState<SimilarPost[] | null>(null); // предупреждение о похожих
  // ТЗ 2026-09-22 (Пункты 2 и 8 Манифеста): чекбокс подтверждения личного опыта
  // и ответственности. Сбрасывается сам — модалка размонтируется при закрытии.
  const [agree, setAgree] = useState(false);

  const clearWarnings = () => {
    setSpecHint("");
    setSimilar(null);
    setErr("");
  };

  const submit = async (confirmSimilar: boolean) => {
    clearWarnings();
    if (subject.trim().length < 2) {
      setSpecHint("Укажите, кого вы рекомендуете или не рекомендуете: конкретную организацию, компанию, сервис или место.");
      return;
    }
    if (title.trim().length < 5) {
      setErr("Заголовок слишком короткий — минимум 5 символов");
      return;
    }
    if (text.trim().length < 10) {
      setErr("Расскажите о своём опыте — минимум 10 символов");
      return;
    }
    // ТЗ 2026-09-22: нативный required не действует (кнопка вне <form>),
    // подтверждение проверяется здесь — публикация без галочки невозможна.
    if (!agree) {
      setErr("Отметьте подтверждение: отзыв основан на вашем личном опыте и не содержит чужих персональных данных.");
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = isEdit
        ? { token: props.token, action: "edit", subject: subject.trim(), title: title.trim(), text: text.trim(), place: place.trim(), humanHighlight: human.trim() }
        : { token: props.token, subject: subject.trim(), stance, title: title.trim(), text: text.trim(), place: place.trim(), humanHighlight: human.trim() };
      if (confirmSimilar) payload.confirmSimilar = true;
      const r = await fetch(isEdit ? `/api/recommend/${props.editItem!.id}` : "/api/recommend", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (d.needsSubject) {
        setSpecHint(d.hint || "Укажите, кого вы рекомендуете или не рекомендуете.");
        return;
      }
      if (d.similar && Array.isArray(d.similarPosts) && d.similarPosts.length > 0) {
        setSimilar(d.similarPosts as SimilarPost[]);
        return;
      }
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
          <span>{isEdit ? "Редактировать публикацию" : "Новая публикация в «Рекомендую / Не рекомендую»"}</span>
          <button className="sk-modal-x" onClick={props.onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="sk-modal-body">
          <div className="sk-modal-row">
            <label htmlFor="rc-f-subject">Кого — организация, компания, сервис или место</label>
            <input
              id="rc-f-subject"
              value={subject}
              maxLength={120}
              onChange={(e) => {
                setSubject(e.target.value);
                clearWarnings();
              }}
              placeholder="Например: Автомойка на Сахалинской, доставка пиццы «Два стриза»…"
            />
          </div>
          {specHint && (
            <div className="rc-spechint" role="alert">
              {specHint}
            </div>
          )}
          {!isEdit && (
            <div className="sk-modal-row">
              <label>Ваша позиция</label>
              <div className="rc-stances">
                <label className="complaint-option">
                  Рекомендую — опыт положительный
                </label>
                <label className="complaint-option">
                  Не рекомендую — опыт отрицательный
                </label>
              </div>
            </div>
          )}
          <div className="sk-modal-row">
            <label htmlFor="rc-f-title">Заголовок</label>
            <input
              id="rc-f-title"
              value={title}
              maxLength={150}
              onChange={(e) => {
                setTitle(e.target.value);
                clearWarnings();
              }}
              placeholder="Например: Сделали ремонт быстро и качественно"
            />
          </div>
          <div className="sk-modal-row">
            <label htmlFor="rc-f-text">Ваш опыт</label>
            <textarea
              id="rc-f-text"
              value={text}
              maxLength={8000}
              onChange={(e) => {
                setText(e.target.value);
                clearWarnings();
              }}
              placeholder="Расскажите, что именно происходило: когда, что делали, чем всё закончилось. Критика и негативный опыт разрешены — но без перехода на личности и личных данных."
              style={{ minHeight: 120 }}
            />
          </div>
          <div className="sk-modal-row">
            <label htmlFor="rc-f-human">Отдельно отмечу человека — необязательно</label>
            <input
              id="rc-f-human"
              value={human}
              maxLength={600}
              onChange={(e) => {
                setHuman(e.target.value);
                clearWarnings();
              }}
              placeholder="Например: мастер Алексей вежливо объяснил причину задержки и сделал скидку"
            />
          </div>
          {/* 2026-10-03: блок «Место» удалён по просьбе пользователя. */}
          {similar && similar.length > 0 && (
            <div className="rc-similarwarn" role="alert">
              <b>Похожая публикация уже есть. Возможно, о вас уже писали.</b>
              <ul>
                {similar.map((s) => (
                  <li key={s.id}>
                    <a href={`/rekomenduyu?post=${s.id}`}>«{s.title}»</a> — открыть
                  </li>
                ))}
              </ul>
              <p>Если ваша история действительно другая, опубликуйте её.</p>
            </div>
          )}
          <div className="sk-modal-demo">
            <b>Пишите о своём личном опыте: одна публикация — одна организация или один сервис.</b> Критика и негативный
            опыт разрешены. Оскорбления конкретных людей, личные данные третьих лиц, реклама и заказные рекомендации
            запрещены.
          </div>
          {/* ТЗ 2026-09-22: чекбокс подтверждения личного опыта и ответственности
              (Пункт 2 и 8 Манифеста) — присланная разметка 1-в-1.
              Показывается и при создании, и при редактировании: ответственность
              за содержание автор подтверждает при каждой публикации. */}
          <div className="form-group-flat matrix-checkbox-group">
            <label className="checkbox-container-flat">
              <input
                type="checkbox"
                id="review-manifest-agree"
                required
                checked={agree}
                onChange={(e) => {
                  setAgree(e.target.checked);
                  clearWarnings();
                }}
              />
              <span className="checkmark-flat" />
              <span className="checkbox-text-flat">
                Я подтверждаю, что этот отзыв описывает мой <strong>личный бытовой опыт</strong>. Я не публикую чужие
                персональные данные и несу полную ответственность за достоверность и содержание предоставленных мною
                сведений. Публикация не является официальной позицией SakhMatrix.
              </span>
            </label>
          </div>
          {err && <div className="sk-modal-err">{err}</div>}
          <div className="sk-modal-actions">
            <button className="sk-btn-classic" disabled={busy} onClick={() => submit(!!similar)}>
              {busy ? "Проверка ИИ…" : similar ? "Всё равно опубликовать" : isEdit ? "Сохранить" : "Опубликовать"}
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

function RecComplaintModal(props: {
  item: RecItem;
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
      const r = await fetch(`/api/recommend/${props.item.id}/complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, comment: comment.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось отправить жалобу");
      props.onDone(d.note || "Жалоба отправлена. Спасибо. Модерация рассмотрит публикацию.");
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
            Публикация: «{props.item.title}». Жалоба уходит модерации. Жалобы не являются голосованием: их количество не
            публикуется, публикацию жалоба сама по себе не удаляет.
          </div>
          <div className="sk-modal-row">
            <label>Причина</label>
            {RC_COMPLAINT_REASONS.map((r) => (
              <label key={r.key} className="complaint-option">
                <input
                  type="radio"
                  name="rc-complaint"
                  checked={category === r.key}
                  onChange={() => setCategory(r.key)}
                />
                {r.label}
              </label>
            ))}
          </div>
          <div className="sk-modal-row">
            <label htmlFor="rc-c-comment">Комментарий (необязательно)</label>
            <textarea
              id="rc-c-comment"
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

export function RecommendPage(props: {
  user: ForumUser | null;
  token: string | null;
  notify: (m: string) => void;
  onNeedAuth: () => void;
}) {
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [activeNav, setActiveNav] = useState<"home" | "latest" | "mine">("home");
  const [items, setItems] = useState<RecItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [place, setPlace] = useState("");
  const [appliedPlace, setAppliedPlace] = useState("");
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<RecItem | null>(null);
  const [complainItem, setComplainItem] = useState<RecItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const listTopRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const sp = new URLSearchParams();
      if (tab === "mine") {
        sp.set("mine", "1");
        sp.set("token", props.token ?? "");
      } else {
        sp.set("page", String(page));
        sp.set("pageSize", String(PAGE_SIZE));
        if (appliedQ) sp.set("q", appliedQ);
        if (appliedPlace) sp.set("place", appliedPlace);
        // ТЗ 2026-09-24: токен в публичной ленте — чтобы сервер вернул myVote
        // (подсветка выбранной кнопки «Рекомендую»/«Не рекомендую»). Гости
        // получают ленту без токена — myVote null.
        if (props.token) sp.set("token", props.token);
      }
      const r = await fetch(`/api/recommend?${sp.toString()}`);
      const d: FeedResponse & { error?: string; posts?: RecItem[] } = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка загрузки");
      setItems(d.posts ?? []);
      setTotal(d.total ?? d.posts?.length ?? 0);
      setPages(d.pages ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
      setItems([]);
    } finally {
      // nothing
    }
  }, [tab, page, appliedQ, appliedPlace, props.token]);

  useEffect(() => {
    load();
  }, [load]);

  // Глубокая ссылка из темы форума: /rekomenduyu?post=ID — подсветить публикацию.
  useEffect(() => {
    const postId = new URLSearchParams(window.location.search).get("post");
    if (!postId) return;
    setHighlightId(postId);
    const t = window.setInterval(() => {
      const el = document.querySelector(`[data-rc-id="${postId}"]`);
      if (el) {
        el.scrollIntoView({ block: "center" });
        window.clearInterval(t);
        window.setTimeout(() => setHighlightId(null), 4000);
      }
    }, 300);
    window.setTimeout(() => window.clearInterval(t), 12000);
    return () => window.clearInterval(t);
  }, [items]);

  const openNewForm = () => {
    if (!props.user) {
      props.onNeedAuth();
      return;
    }
    setEditItem(null);
    setFormOpen(true);
  };

  const mineTab = (t: "all" | "mine", nav: "home" | "latest" | "mine") => {
    if (t === "mine" && !props.user) {
      props.onNeedAuth();
      return;
    }
    setActiveNav(nav);
    setTab(t);
    setPage(1);
    setQ("");
    setAppliedQ("");
    setPlace("");
    setAppliedPlace("");
    window.scrollTo(0, 0);
  };

  const goToPage = (p: number) => {
    setPage(Math.min(Math.max(1, p), pages));
    listTopRef.current?.scrollIntoView({ block: "start" });
  };

  const applySearch = () => {
    setAppliedQ(q.trim());
    setAppliedPlace(place.trim());
    setPage(1);
  };

  const resetSearch = () => {
    setQ("");
    setPlace("");
    setAppliedQ("");
    setAppliedPlace("");
    setPage(1);
  };

  /**
   * Кнопка состояния форума — ТЗ 2026-09-24 «Обсудить на форуме —
   * авто-создание темы»: при клике вызываем универсальный API
   * POST /api/discuss/recommend/<postId>, который:
   *   • если у отзыва уже есть topicId — редирект в существующую тему;
   *   • если нет — создаёт тему в рубрике «Отзывы и рекомендации»
   *     от имени текущего пользователя, привязывает к отзыву, редиректит.
   * Гостю открываем AuthModal (тема создаётся от имени залогиненного).
   */
  const discuss = (item: RecItem) => {
    discussOnForum("recommend", item.id, props.token, props.onNeedAuth);
  };

  const openEdit = (item: RecItem) => {
    setEditItem(item);
    setFormOpen(true);
  };

  const deleteItem = async (item: RecItem) => {
    if (!window.confirm("Удалить публикацию? Она исчезнет из общей ленты.")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/recommend/${item.id}`, {
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

  /** Смена позиции: Рекомендую ↔ Не рекомендую. */
  const setStance = async (item: RecItem, stance: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/recommend/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, action: "stance", stance }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось изменить позицию");
      props.notify(d.note || "Позиция обновлена");
      await load();
    } catch (e) {
      props.notify(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  /** 29.09.2026: «Вопрос решён» — автор отмечает проблему решённой (или
   *  снимает отметку). Только владелец сообщения (проверяется на сервере
   *  в PATCH /api/recommend/[id] action="resolve"). */
  const resolvePost = async (item: RecItem, resolved: boolean) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/recommend/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, action: "resolve", resolved }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось обновить статус");
      props.notify(d.note || (resolved ? "Отмечено как решённая" : "Отметка «решено» снята"));
      await load();
    } catch (e) {
      props.notify(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  /** ТЗ 2026-09-24 (пользователь): кнопки «Рекомендую»/«Не рекомендую» рядом
   * с «Обсудить на форуме» (заменили «Полезный отзыв»): один голос на
   * пользователя, повторный клик снимает, соседняя кнопка переключает.
   * Гости — через onNeedAuth. */
  const vote = async (item: RecItem, kind: "recommend" | "notrecommend") => {
    if (!props.user) {
      props.onNeedAuth();
      return;
    }
    try {
      const r = await fetch(`/api/recommend/${item.id}/support`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, kind }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось учесть голос");
      setItems((prev) =>
        (prev ?? []).map((p) =>
          p.id === item.id
            ? {
                ...p,
                recommendCount: d.recommendCount ?? p.recommendCount,
                notrecommendCount: d.notrecommendCount ?? p.notrecommendCount,
                myVote: d.myVote ?? null,
              }
            : p
        )
      );
      if (d.note) props.notify(d.note);
    } catch (e) {
      props.notify(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const list = items ?? [];
  const searching = !!(appliedQ || appliedPlace);

  return (
    <>
      <div className="rc-layout main-grid-container">
        {/* Левая колонка — органайзер раздела (орг. кабинет + фильтр по месту)
            29.09.2026: навигация (Последние/Мои публикации) + кнопка
            «＋ Поделиться опытом» ПЕРЕНЕСЕНЫ в header-bar центральной колонки,
            в одну строку с H1 «Рекомендую / Не рекомендую». */}
        <aside className="rc-col-left left-column">
          {/* 29.09.2026 (правка 2): блок «О разделе» перемещён из правой
              колонки и оформлен в дизайне блока «Время» (.sakh-clock). */}
          <div className="sakh-clock rc-clock-block rc-clock-about">
            <div className="sakh-clock-head">ℹ️ О разделе</div>
            <div className="sakh-clock-body sakh-clock-body-content">
              <div className="rc-info">
                <p>
                  «Рекомендую / Не рекомендую» — самостоятельный раздел личного опыта: делитесь впечатлениями об
                  организациях, компаниях, сервисах и местах Сахалина. Это не форум и не рекламная площадка: обсуждений,
                  комментариев и реакций под публикацией нет.
                </p>
                <p>
                  Публикация содержит субъекта (кого рекомендуют), позицию («Рекомендую» или «Не рекомендую»), заголовок,
                  текст, место (если указано), ник автора, дату и время. Обсудить историю можно на форуме — под каждой
                  публикацией есть кнопка «Обсудить на форуме»; для публикации создаётся не более одной темы обсуждения.
                </p>
                <p>
                  Критика и негативный опыт — это суть раздела и НЕ нарушение. Но оскорбления конкретных людей, личные
                  данные третьих лиц, реклама и заказные рекомендации запрещены — их проверяет ИИ-модерация, а спорные
                  случаи рассматривает человек-модератор.
                </p>
              </div>
            </div>
          </div>

          {/* 29.09.2026: блок «Цвета карточек» — пояснение для посетителей
              сайта, что означают зелёная/красная рамка и голубой бейдж.
              В едином стиле с блоком «Время» (.sakh-clock), как «О разделе»
              и «Правила раздела». */}
          <div className="sakh-clock rc-clock-block rc-clock-legend">
            <div className="sakh-clock-head">🎨 Цвета карточек</div>
            <div className="sakh-clock-body sakh-clock-body-content">
              <div className="rc-legend">
                <div className="rc-legend-row">
                  <span className="rc-legend-swatch swatch-positive" />
                  <div>
                    <b>Зелёная рамка</b> — автор <b>рекомендует</b> организацию (положительный отзыв: «👍 Рекомендую»).
                  </div>
                </div>
                <div className="rc-legend-row">
                  <span className="rc-legend-swatch swatch-negative" />
                  <div>
                    <b>Красная рамка</b> — автор <b>не рекомендует</b> (отрицательный отзыв: «👎 Не рекомендую»). Критика разрешена — это суть раздела.
                  </div>
                </div>
                <div className="rc-legend-row">
                  <span className="rc-legend-swatch swatch-resolved" />
                  <div>
                    <b>Голубой бейдж «✓ Решено»</b> — автор отметил, что проблема решена. Может стоять как на зелёной, так и на красной карточке.
                  </div>
                </div>
                <p className="rc-legend-note">
                  Позиция отзыва («Рекомендую» или «Не рекомендую») выбирается автором при создании и не меняется.
                  Отметить «Вопрос решён» может только сам автор своего отзыва.
                </p>
              </div>
            </div>
          </div>

          {/* ТЗ 2026-09-22: точка входа в «Кабинет представителя организации» (/kabinet,
              разметка .matrix-business-cabinet) — только для подтверждённых orgRep.
              Точка входа — задокументированная импровизация (в макете заказчика не указана). */}
          {props.user?.orgRep && (
            <div className="rc-sideblock">
              <button className="rc-addbtn" onClick={() => { window.location.href = "/kabinet"; }}>
                🛡️ Кабинет представителя
              </button>
              <p className="rc-rulesnote">Отзывы о вашей организации и единственный официальный ответ на каждый из них.</p>
            </div>
          )}
          {/* 2026-10-03: блок «Место» (rc-sideblock с фильтром по месту)
              удалён по просьбе пользователя. */}
        </aside>

        {/* Центральная колонка — лента */}
        <div className="rc-col-main center-column">
          <div className="rc-head">
            {/* 29.09.2026: header-bar — H1 «Рекомендую / Не рекомендую» слева,
                nav + кнопка «Поделиться опытом» справа (как на /gde-deshevle,
                /gde-kupit). Активная nav-кнопка «Рекомендую / Не рекомендую»
                удалена (была чёрной #1a1a1a — дубликат названия раздела). */}
            <div className="rc-head-bar">
              <div className="rc-title">Рекомендую / Не рекомендую</div>
              <div className="rc-head-right">
                <div className="rc-nav-inline">
                  <button className={activeNav === "latest" ? "active" : ""} onClick={() => mineTab("all", "latest")}>
                    Последние публикации
                  </button>
                  <button className={activeNav === "mine" ? "active" : ""} onClick={() => mineTab("mine", "mine")}>
                    Мои публикации
                  </button>
                </div>
                <button className="rc-addbtn" onClick={openNewForm}>
                  {/* 2026-10-02: знак «＋» убран по просьбе пользователя. */}
                  Поделиться опытом
                </button>
              </div>
            </div>
            <div className="rc-desc">Личный опыт жителей Сахалина об организациях, компаниях, сервисах и местах.</div>
            {/* Простой поиск: субъект, заголовок и текст, частичное совпадение */}
            <div className="rc-search">
              <input
                aria-label="Поиск по публикациям"
                value={q}
                maxLength={120}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearch();
                }}
                placeholder="Поиск по названию организации или тексту…"
              />
              <button onClick={applySearch}>Найти</button>
              {searching && (
                <button className="rc-search-reset" onClick={resetSearch}>
                  Сбросить
                </button>
              )}
            </div>
          </div>

          <div ref={listTopRef} />

          {items === null && !error && <div className="rc-empty">Загрузка…</div>}
          {error && <div className="sk-error">{error}</div>}

          {/* 29.09.2026: 4 демо-карточки (DEMO_REVIEW_ENTRIES → SakhMatrixReviewCard)
              и симулятор примирения (SakhMatrixResolutionSimulator) УБРАНЫ со
              страницы по запросу пользователя — они не имели цветной рамки и
              путали визуал (выглядело как «неподсвеченные сообщения»).
              Теперь лента начинается сразу с реальных публикаций из БД
              (RecRow — с зелёной/красной рамкой по позиции автора). */}

          {items !== null && !error && list.length === 0 && (
            <div className="rc-empty">
              {tab === "mine"
                ? "У вас пока нет публикаций."
                : searching
                  ? `По запросу ничего не найдено. Попробуйте изменить слова поиска.`
                  : "Пока нет публикаций — поделитесь первым опытом."}
            </div>
          )}

          {/* Лента: Рекомендую → Не рекомендую, внутри группы новые сверху */}
          {items !== null &&
            !error &&
            list.map((item) => (
              <RecRow
                key={item.id}
                item={item}
                user={props.user}
                token={props.token}
                busy={busy}
                highlight={highlightId === item.id}
                onDiscuss={discuss}
                onEdit={openEdit}
                onDelete={deleteItem}
                onStance={setStance}
                onResolve={resolvePost}
                onComplain={setComplainItem}
                onVote={vote}
                onOrgDone={(msg) => {
                  props.notify(msg);
                  load();
                }}
              />
            ))}

          {/* Пагинация — не бесконечная лента */}
          {tab === "all" && pages > 1 && items !== null && !error && (
            <div className="rc-pager">
              <button disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                ← Новее
              </button>
              <span>
                Страница {page} из {pages} · всего {total}
              </span>
              <button disabled={page >= pages} onClick={() => goToPage(page + 1)}>
                Старее →
              </button>
            </div>
          )}
          {tab === "all" && pages === 1 && items !== null && !error && total > 0 && (
            <div className="rc-pager">
              <span>
                Всего {total} · новые сверху
              </span>
            </div>
          )}
        </div>

        {/* ПРАВАЯ КОЛОНКА — Время + Правила (29.09.2026):
            «О разделе» убран (теперь он в левой колонке).
            «Правила раздела» оформлены в дизайне блока «Время» (.sakh-clock). */}
        <aside className="rc-col-right right-column">
          <SakhDatetimeBlock />
          <div className="sakh-clock rc-clock-block rc-clock-rules">
            <div className="sakh-clock-head">⚠️ Правила раздела</div>
            <div className="sakh-clock-body sakh-clock-body-content">
              <div className="rc-keyrule">
                Здесь делятся личным опытом: одна публикация — одна организация или один сервис, честно и по существу.
              </div>
              <ol className="rc-ruleslist">
                {RC_RULES.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ol>
              <p className="rc-rulesnote">
                Публикации проверяет ИИ-модерация: реклама, скрытая реклама, заказные рекомендации, спам, оскорбления и
                личные данные не допускаются; критика и негативный опыт — разрешены. Кнопка «Пожаловаться» есть у каждой
                публикации; количество жалоб не публикуется и не создаёт никаких оценок.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {formOpen && props.token && (
        <RecFormModal
          token={props.token}
          editItem={editItem}
          onClose={() => setFormOpen(false)}
          onDone={(msg) => {
            setFormOpen(false);
            setEditItem(null);
            props.notify(msg);
            load();
          }}
        />
      )}
      {complainItem && (
        <RecComplaintModal
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
