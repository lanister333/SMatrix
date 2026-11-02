/**
 * 2026-10-01: унифицированная проверка наличия контактных данных в тексте.
 *
 * ТЗ: на страницах «Знакомства», «Объявления», «Нужна помощь» — каждое
 * объявление должно содержать контакты для прямой связи (телефон,
 * мессенджер, соцсеть, email, ссылку). Без контактов публиковать нельзя.
 *
 * Что считается контактом:
 *   • телефон: минимум 7 цифр подряд (с пробелами/дефисами/скобками)
 *   • @username — Telegram/Instagram-ник
 *   • t.me/... — прямая ссылка на Telegram-канал/чат
 *   • wa.me/... — WhatsApp-ссылка
 *   • viber://... — Viber-ссылка
 *   • https://... или http://... — любая URL
 *   • email вида xxx@xxx.xx
 *
 * Что НЕ считается контактом (намеренно):
 *   • одно слово «телефон» без цифр
 *   • город/улица без номера
 *   • отдельно стоящая @ без ника
 *
 * Использование:
 *   import { hasContact, CONTACT_ERROR } from "@/lib/contact-check";
 *   if (!hasContact(text)) return setErr(CONTACT_ERROR);
 */

const CONTACT_RE =
  /(\+?\d[\d\s\-()]{6,}\d)|(@[a-zA-Z0-9_][a-zA-Z0-9_.-]{2,})|(t\.me\/\S+)|(wa\.me\/\S+)|(viber:\/\/\S+)|(https?:\/\/\S+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;

/** true если в тексте найден хотя бы один узнаваемый контакт. */
export function hasContact(text: string): boolean {
  return CONTACT_RE.test(text || "");
}

/** Дословное сообщение об ошибке для всех 3 разделов. */
export const CONTACT_ERROR =
  "Укажите контакт для прямой связи: телефон, Telegram (@ник), WhatsApp, Viber или ссылку. Без контакта объявление опубликовать нельзя.";

/**
 * 2026-10-01 (правка 2): рендерит текст с подсвеченными КЛИКАБЕЛЬНЫМИ
 * контактами. Каждый найденный контакт (телефон, @telegram, https-ссылка,
 * email) оборачивается в <a> синего цвета с правильным href:
 *   • телефон → tel:+79241112233 (клик — позвонить)
 *   • @username → https://t.me/username (клик — открыть Telegram)
 *   • t.me/xxx → https://t.me/xxx
 *   • wa.me/xxx → https://wa.me/xxx
 *   • https://... → сама ссылка
 *   • email → mailto:email
 *
 * Возвращает массив строк и <a>-элементов, готовых к вставке в JSX.
 */
import React from "react";

export function renderContacts(text: string): React.ReactNode[] {
  if (!text) return [];
  const out: React.ReactNode[] = [];
  let lastIdx = 0;
  // global regex (свойство g), чтобы находить ВСЕ вхождения в строке
  const re = new RegExp(CONTACT_RE.source, "gi");
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    // текст перед контактом — как строка
    if (m.index > lastIdx) {
      out.push(text.substring(lastIdx, m.index));
    }
    const raw = m[0];
    const href = contactToHref(raw);
    if (href) {
      out.push(
        <a
          key={`c-${key++}`}
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          style={{
            color: "#1d4ed8",
            fontWeight: 600,
            textDecoration: "underline",
            wordBreak: "break-word",
          }}
        >
          {raw}
        </a>,
      );
    } else {
      // если по какой-то причине не смонтировали href — выводим как есть
      out.push(raw);
    }
    lastIdx = m.index + raw.length;
  }
  // остаток текста после последнего контакта
  if (lastIdx < text.length) {
    out.push(text.substring(lastIdx));
  }
  return out;
}

/** Определяет href для найденного контакта. */
function contactToHref(raw: string): string | null {
  const s = raw.trim();
  // email (содержит @ и домен с точкой)
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(s)) {
    return `mailto:${s}`;
  }
  // Telegram-ник вида @username (без t.me/)
  if (/^@[a-zA-Z0-9_][a-zA-Z0-9_.-]{2,}$/.test(s)) {
    const nick = s.substring(1);
    return `https://t.me/${nick}`;
  }
  // t.me/username (без https://)
  if (/^t\.me\/\S+$/i.test(s)) {
    return `https://${s}`;
  }
  // wa.me/...
  if (/^wa\.me\/\S+$/i.test(s)) {
    return `https://${s}`;
  }
  // viber://...
  if (/^viber:\/\/\S+$/i.test(s)) {
    return s;
  }
  // http(s):// — готовая ссылка
  if (/^https?:\/\//i.test(s)) {
    return s;
  }
  // телефон — выкидываем всё кроме цифр и +, добавляем tel:
  if (/^\+?\d[\d\s\-()]{6,}\d$/.test(s)) {
    const digits = s.replace(/[^\d+]/g, "");
    // если starts with 8 и 11 цифр (РФ) → +7
    let normalized = digits;
    if (/^8(\d{10})$/.test(digits)) {
      normalized = "+7" + digits.substring(1);
    } else if (/^(\d{10})$/.test(digits) && !digits.startsWith("+")) {
      normalized = "+7" + digits;
    }
    return `tel:${normalized}`;
  }
  return null;
}

