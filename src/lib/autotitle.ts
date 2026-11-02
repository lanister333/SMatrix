/**
 * ТЗ 2026-09-22 «Знакомства / Объявления Flat 2.0» — автозаголовок.
 *
 * Новые формы блоков НЕ имеют поля заголовка (одно общее текстовое поле:
 * «Ваше объявление и контакты» / «Описание и ваши контакты для связи»).
 * Существующие модели БД (DatingPost/AdListing) хранят title как
 * обязательное поле прежних ТЗ (поиск, защита от дублей), поэтому заголовок
 * выводится автоматически из первой строки текста объявления.
 * Задокументированная импровизация: до 100 символов, одна строка,
 * при обрезке — многоточие.
 */

const AUTO_TITLE_MAX = 100;

export function titleFromBody(text: string): string {
  const firstLine = String(text ?? "")
    .split("\n")
    .map((s) => s.trim())
    .find((s) => s.length > 0) ?? "";
  const collapsed = firstLine.replace(/\s+/g, " ");
  if (collapsed.length <= AUTO_TITLE_MAX) return collapsed;
  return collapsed.slice(0, AUTO_TITLE_MAX - 1).trimEnd() + "…";
}
