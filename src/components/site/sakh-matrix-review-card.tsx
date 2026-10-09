import React from 'react';
import { nickGenderClass } from "@/lib/nick-gender";
import { forumCategoryHref, SECTION_FORUM } from "@/lib/forum-links";

interface ReviewProps {
  id: string;
  category: string;
  author: string;
  location: string;
  date: string;
  status: 'recommended' | 'warning' | 'comment'; // 👍, ⚠️ или 💬
  text: string;
  humanHighlight: string | null; // Разделение Человек ≠ Организация
  businessResponse: string | null; // Строго 1 ответ
}

export const SakhMatrixReviewCard: React.FC<{ review: ReviewProps }> = ({ review }) => {
  // ТЗ 2026-09-24 (пользователь): карточка — на ВСЮ ширину центральной
  // колонки, окантовка как у блока «SakhMatrix - Время» (1px solid #4A688C,
  // Flat 2.0), КОМПАКТНЫЕ вертикальные отступы (p-6→p-3, my-6→my-3 и т.д.).
  // Маркер .rc-democard — стабильный селектор приёмочных проб.
  //
  // 29.09.2026: кнопки «👍 Рекомендую» / «👎 Не рекомендую» рядом с
  // «💬 Обсудить на форуме» УБРАНЫ — голосование читателей упразднено
  // (см. коммит 6f1fbdf). Оценку (позицию) делает только владелец
  // сообщения при создании публикации. Демо-карточка теперь показывает
  // только кнопку «💬 Обсудить на форуме».
  return (
    <div className="rc-democard w-full border border-[#4A688C] bg-white p-3 my-3 font-sans text-zinc-900 tracking-tight antialiased select-none">

      {/* 1. ШАПКА КАРТОЧКИ (компакт: mb-4→mb-2) */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
        <div>
          {/* Путь хлебных крошек из утвержденного дерева рубрик */}
          <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold block">
            {review.category}
          </span>
          <h4 className="text-sm font-bold text-zinc-800 mt-1">
            <span className={nickGenderClass(review.author)}>{review.author}</span> <span className="text-zinc-400 font-normal">• {review.location} • {review.date}</span>
          </h4>
        </div>

        {/* Статус-маркеры строго по ТЗ №2 (раздел 2) */}
        <div>
          {review.status === 'recommended' && (
            <span className="inline-flex items-center text-xs px-2.5 py-1 font-medium border border-emerald-500 bg-emerald-50/40 text-emerald-700">
              👍 Рекомендую
            </span>
          )}
          {review.status === 'warning' && (
            <span className="inline-flex items-center text-xs px-2.5 py-1 font-medium border border-red-400 bg-red-50/30 text-red-700">
              ⚠️ Предупреждаю
            </span>
          )}
        </div>
      </div>

      {/* 2. ТЕКСТ ЛИЧНОГО ОПЫТА (компакт: space-y-3→1.5, leading-snug) */}
      <div className="text-sm leading-snug text-zinc-700 space-y-1.5 whitespace-pre-line">
        <p>{review.text}</p>
      </div>

      {/* 3. ФИЛОСОФСКИЙ БЛОК: ЧЕЛОВЕК ≠ ОРГАНИЗАЦИЯ (компакт: mt-4 p-3 → mt-2 p-2) */}
      {review.humanHighlight && (
        <div className="mt-2 p-2 bg-zinc-50 border-l border-zinc-300 text-xs text-zinc-600 leading-snug">
          <span className="font-bold text-zinc-700 block mb-0.5">Особое упоминание сотрудника:</span>
          {review.humanHighlight}
        </div>
      )}

      {/* 4. ГЛОБАЛЬНЫЙ СИСТЕМНЫЙ ДИСКЛЕЙМЕР (компакт: mt-5 pt-3 → mt-2 pt-1.5) */}
      <div className="mt-2 text-[11px] leading-normal text-zinc-400 border-t border-zinc-100 pt-1.5">
        <p>
          * Публикация отражает личный опыт автора <span className={nickGenderClass(review.author)}>{review.author}</span>.
          SakhMatrix не формирует официальный список «плохих» или «хороших» организаций и не является автором данного утверждения. [2]
        </p>
      </div>

      {/* 5. ИЗОЛИРОВАННЫЙ ОФИЦИАЛЬНЫЙ ОТВЕТ (компакт: mt-5 pt-4 → mt-2 pt-2) */}
      <div className="mt-2 pt-2 border-t border-zinc-100">
        <span className="text-[10px] uppercase tracking-wider text-teal-600 font-bold block mb-1">
          Официальная позиция организации
        </span>

        {review.businessResponse ? (
          <div className="bg-teal-50/20 border-l-2 border-teal-600 pl-4 py-1">
            <p className="text-sm italic leading-relaxed text-zinc-600">
              «{review.businessResponse}»
            </p>
          </div>
        ) : (
          <div className="pl-4 py-1 text-xs text-zinc-400 italic">
            Ожидается официальное заявление представителя бренда. Публичные дискуссии запрещены. [4]
          </div>
        )}
      </div>

      {/* 6. ТЗ 2026-09-24: «Обсудить на форуме» — ВНУТРИ каждого сообщения.
          29.09.2026: голосовые кнопки «Рекомендую»/«Не рекомендую» УБРАНЫ.
          Бирюзовая .rc-btn-forum ведёт в рубрику «Товары и услуги ▸
          Отзывы и рекомендации» относительным путём /forum/category/… */}
      <div className="rc-demo-forumrow rc-in">
        <a
          className="rc-btn-forum is-none"
          href={forumCategoryHref(SECTION_FORUM.recommend.rubricSlug)}
          title="Рубрика форума «Товары и услуги ▸ Отзывы и рекомендации»"
        >
          💬 Обсудить на форуме
        </a>
      </div>

    </div>
  );
};
