import React, { useState } from 'react';

/**
 * ТЗ 2026-09-23 «Кнопки „Обсудить на форуме“» (п.1/2/3): кнопка
 * «Обсудить проблему на форуме» в симуляторе была МЁРТВОЙ — прежний
 * обработчик только переключал локальное состояние (setForumLinked(true),
 * «в реальном движке здесь будет редирект» — комментарий заказчика),
 * без какого-либо перехода: пользователь нажимал и ничего не происходило.
 *
 * Исправлено: кнопка ведёт на страницу форума в соответствующую рубрику
 * блока «Рекомендую / Не рекомендую» — «Товары и услуги ▸ Отзывы и
 * рекомендации» (rubric 121), относительный путь /forum/category/<slug>
 * (единая карта src/lib/forum-links.ts). Локальное состояние больше
 * не единственный эффект —
 * переход уводит со страницы; локальная реакция «Ссылка на форум создана»
 * сохранена как мгновенный отклик ДО перехода (на случай задержки сети).
 */
import { forumCategoryHref, SECTION_FORUM } from '@/lib/forum-links';

interface SimulatedReview {
  id: string;
  category: string;
  author: string;
  location: string;
  date: string;
  status: 'recommended' | 'warning' | 'resolved'; // Добавили статус 'resolved'
  text: string;
  businessResponse: string | null;
}

export const SakhMatrixResolutionSimulator = () => {
  // Имитируем состояние одного из наших сценариев (например, Пян-се на Пуркаева)
  const [review, setReview] = useState<SimulatedReview>({
    id: 'sakh-001',
    category: 'Кулинарная книга ▸ Сахалинская кухня ▸ Где поесть',
    author: 'IslandVibe_65',
    location: 'Южно-Сахалинск, ул. Пуркаева',
    date: '21.09.2026',
    status: 'warning', // Исходный статус — Предупреждаю
    text: 'Взяли пян-се на вынос в точке на Пуркаева. Тесто влажное, начинки наполовину меньше обычного. Всегда покупали здесь, но в этот раз качество подвело.',
    businessResponse: null // Бизнес пока не верифицирован / молчит
  });

  const [forumLinked, setForumLinked] = useState(false);

  // Рубрика блока «Рекомендую / Не рекомендую» (единая карта ТЗ 2026-09-23).
  const FORUM_CATEGORY_URL = forumCategoryHref(SECTION_FORUM.recommend.rubricSlug);

  // Функция примирения — перевод в «Вопрос закрыт» (ТЗ №2, Пункт 4)
  const handleResolve = () => {
    setReview(prev => ({
      ...prev,
      status: 'resolved'
    }));
  };

  // Кнопка «Обсудить проблему на форуме»: реальный переход в рубрику
  // «Товары и услуги ▸ Отзывы и рекомендации» (ТЗ 2026-09-23, п.2/3).
  const handleLinkToForum = () => {
    setForumLinked(true);
    window.location.href = FORUM_CATEGORY_URL;
  };

  // ТЗ 2026-09-24 (пользователь): симулятор — на ВСЮ ширину центральной
  // колонки (max-w-2xl убран), окантовка как у блока «SakhMatrix - Время»
  // (1px solid #4A688C), тень убрана (Flat 2.0). Маркер .rc-simcard —
  // стабильный селектор проб. Логика и содержимое — присланный код 1-в-1.
  return (
    <div className="rc-simcard w-full border border-[#4A688C] bg-white p-3 my-3 font-sans text-zinc-900 tracking-tight antialiased">
      
      {/* КАРТОЧКА ОТЗЫВА */}
      <div className={`transition-all duration-300 ${review.status === 'resolved' ? 'opacity-75' : ''}`}>
        
        {/* Шапка */}
        <div className="flex justify-between items-baseline mb-2">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold block">
              {review.category}
            </span>
            <h4 className="text-sm font-bold text-zinc-800 mt-1">
              {review.author} <span className="text-zinc-400 font-normal">• {review.location} • {review.date}</span>
            </h4>
          </div>

          {/* Динамический маркер статуса строго по ТЗ */}
          <div>
            {review.status === 'warning' && (
              <span className="text-xs px-2.5 py-1 font-medium border border-red-400 bg-red-50/30 text-red-700">
                ⚠️ Предупреждаю
              </span>
            )}
            {review.status === 'resolved' && (
              <span className="text-xs px-2.5 py-1 font-medium border border-teal-600 bg-teal-50/50 text-teal-700">
                ✓ Вопрос закрыт / Претензий нет
              </span>
            )}
          </div>
        </div>

        {/* Текст отзыва */}
        <p className="text-sm leading-relaxed text-zinc-700 whitespace-pre-line mb-3">
          {review.text}
        </p>

        {/* Системный дисклеймер (ТЗ №2, Пункт 7) */}
        <div className="text-[11px] text-zinc-400 border-t border-zinc-100 pt-2 mb-2">
          * Публикация отражает личный опыт автора. SakhMatrix не формирует официальных списков.
        </div>

        {/* Блок официального ответа / статуса присутствия бизнеса */}
        <div className="p-4 bg-zinc-50 border border-zinc-100 mb-3">
          <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block mb-1">
            Официальный статус организации
          </span>
          <p className="text-xs text-zinc-500 italic">
            Организация еще не заявила права на профиль. Публичные споры в карточке запрещены.
          </p>
        </div>

        {/* ИНТЕРФЕЙС УПРАВЛЕНИЯ ДЛЯ АВТОРА (Виден только создателю отзыва) */}
        <div className="border-t border-dashed border-zinc-200 pt-2 mt-2 bg-zinc-50/50 p-4">
          <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold block mb-3">
            Панель автора (Симулятор логики)
          </span>
          
          {review.status === 'warning' ? (
            <div className="flex flex-wrap gap-3">
              {/* Если бизнес молчит — разрешаем уйти в форум */}
              {!forumLinked ? (
                <button 
                  onClick={handleLinkToForum}
                  className="text-xs uppercase tracking-wider border border-zinc-300 bg-white px-3 py-2 text-zinc-700 hover:border-zinc-900 transition-colors font-medium"
                >
                  💬 Обсудить проблему на форуме
                </button>
              ) : (
                <span className="text-xs text-teal-600 font-medium self-center bg-teal-50 px-2.5 py-1.5 border border-teal-200">
                  ✓ Ссылка на форум создана. Обсуждение перенесено в ветку.
                </span>
              )}

              {/* Кнопка ручного примирения */}
              <button 
                onClick={handleResolve}
                className="text-xs uppercase tracking-wider bg-zinc-900 text-white px-3 py-2 hover:bg-teal-600 transition-colors font-medium"
              >
                🤝 Ошибка исправлена / Претензий нет
              </button>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 italic">
              Конфликт успешно исчерпан. История взаимоотношений сохранена в экосистеме.
            </p>
          )}
        </div>

      </div>
    </div>
  );
};
