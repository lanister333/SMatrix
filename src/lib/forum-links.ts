/**
 * ТЗ 2026-09-23 «Кнопки „Обсудить на форуме“ — единая логика».
 *
 * ЕДИНАЯ КАРТА НАЗНАЧЕНИЙ (п.3 ТЗ): каждая кнопка «Обсудить на форуме»
 * ведёт на страницу форума в соответствующую рубрику — относительным
 * путём /forum/category/<slug> (список тем рубрики) либо /forum/topic/<id>
 * (конкретная тема, когда она уже связана с публикацией — п.4 ТЗ).
 * Никаких localhost, никаких /?rubric=…-зависимостей для кнопок.
 *
 * Форматы ссылок (п.4 ТЗ):
 *   /forum/category/<slug>            — ведём в рубрику;
 *   /forum/topic/<id>?prefilled_text= — ведём в конкретную тему
 *                                       (текст подставится в поле ответа —
 *                                       поддержка в topic-view.tsx).
 *
 * Соответствие рубрикам БД (проверено 2026-09-23, все существуют):
 *   Где купить          → «Товары и услуги ▸ Где купить»             (rubric 118)
 *   Где дешевле         → «Товары и услуги ▸ Цены»                   (rubric 120)
 *   Рекомендую/Не рек.  → «Товары и услуги ▸ Отзывы и рекомендации»  (rubric 121)
 *   Нужна помощь        → «Товары и услуги ▸ Услуги и специалисты»   (rubric 119)
 *   ЖКХ и гор. проблемы → «Недвижимость ▸ ЖКХ и управляющие компании»(rubric 104)
 *   О работодателях     → «Карьера, бизнес ▸ Работодатели»           (rubric 78,
 *                          «или соответствующая» — родная контентная рубрика)
 *   Подслушано Сахалин  → «Обсуждение сообщений из "Подслушано"»     (rubric 130,
 *                          соответствующая служебная ветка обсуждений)
 *   Знакомства (Love Sakh) → спец-ветка /forum/topic/179 (указ заказчика
 *                          2026-09-23, рубрика «Знакомства (Love Sakh)»)
 */

/** Относительная ссылка на список тем рубрики (п.4 ТЗ). */
export function forumCategoryHref(slug: string): string {
  return `/forum/category/${encodeURIComponent(slug)}`;
}

/** Относительная ссылка на конкретную тему форума (п.4 ТЗ). */
export function forumTopicHref(topicId: number | string): string {
  return `/forum/topic/${topicId}`;
}

/** Ссылка на тему с переносом текста в поле ответа (prefilled_text). */
export function forumTopicPrefilledHref(topicId: number | string, text: string): string {
  return `/forum/topic/${topicId}?prefilled_text=${encodeURIComponent(text)}`;
}

export interface SectionForumTarget {
  /** Человекочитаемая рубрика: «Товары и услуги ▸ Где купить». */
  label: string;
  /** Слаг рубрики-назначения в БД. */
  rubricSlug: string;
  /** Название рубрики (для хлебных крошек и подписей). */
  rubricName: string;
  /** Название родительской рубрики (для хлебных крошек). */
  parentName: string;
}

/** Единая карта «блок → рубрика форума» (п.3 ТЗ, дословно). */
export const SECTION_FORUM: Record<string, SectionForumTarget> = {
  wheretobuy: {
    label: "Товары и услуги ▸ Где купить",
    rubricSlug: "tovary-i-uslugi--gde-kupit",
    rubricName: "Где купить",
    parentName: "Товары и услуги",
  },
  gdedeshevle: {
    label: "Товары и услуги ▸ Цены",
    rubricSlug: "tovary-i-uslugi--ceny",
    rubricName: "Цены",
    parentName: "Товары и услуги",
  },
  recommend: {
    label: "Товары и услуги ▸ Отзывы и рекомендации",
    rubricSlug: "tovary-i-uslugi--otzyvy-i-rekomendacii",
    rubricName: "Отзывы и рекомендации",
    parentName: "Товары и услуги",
  },
  help: {
    label: "Товары и услуги ▸ Услуги и специалисты",
    rubricSlug: "tovary-i-uslugi--uslugi-i-specialisty",
    rubricName: "Услуги и специалисты",
    parentName: "Товары и услуги",
  },
  gkh: {
    label: "Недвижимость ▸ ЖКХ и управляющие компании",
    rubricSlug: "nedvizhimost--zhkh-i-upravlyayuschie-kompanii",
    rubricName: "ЖКХ и управляющие компании",
    parentName: "Недвижимость",
  },
  employers: {
    label: "Карьера, бизнес ▸ Работодатели",
    rubricSlug: "karera-biznes--rabotodateli",
    rubricName: "Работодатели",
    parentName: "Карьера, бизнес",
  },
  overheard: {
    label: "Обсуждение сообщений из «Подслушано»",
    rubricSlug: "podslyshano-discuss",
    rubricName: "Обсуждение сообщений из «Подслушано»",
    parentName: "Обсуждения из блоков",
  },
};

/** Ссылка-назначение для карточки блока: связанная тема или рубрика блока. */
export function sectionDiscussHref(section: string, topicId: number | null | undefined): string {
  if (topicId) return forumTopicHref(topicId);
  const t = SECTION_FORUM[section];
  return t ? forumCategoryHref(t.rubricSlug) : "/forum";
}
