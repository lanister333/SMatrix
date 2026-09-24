/**
 * ТЗ 2026-09-22 (реставрация 2026-09-23): ПЕРВАЯ ЛИНИЯ автоматической
 * пре-модерации отзывов «Рекомендую / Не рекомендую» — детерминированные
 * проверки ДО ИИ-модерации. Три пункта ТЗ:
 *
 *   п.1 ЯРЛЫКИ на людей/организации («мошенник», «кидала», «обманщики»,
 *       «разводилово»…) → ВЕРНУТЬ автору с точной подсказкой заказчика
 *       (verdict "return"): факты вместо ярлыков;
 *   п.2 ЛИЧНЫЕ ДАННЫЕ физлиц (телефоны, адреса, паспорта, ФИО+номера
 *       документов) → ВЕРНУТЬ с требованием удалить (verdict "return");
 *   п.3 КАПСЛОК / МАТ / УГРОЗЫ → БЛОК (verdict "block").
 *
 * Фактурный негатив («вернули без чека, испортили заказ») — пропускается
 * дальше (verdict "ok"): это содержательный отзыв, а не ярлык.
 */

import { checkProfanity } from "./profanity";

export interface PremoderationInput {
  subject: string;
  title: string;
  text: string;
  place: string;
  humanHighlight: string;
}

export interface PremoderationOutcome {
  verdict: "ok" | "return" | "block";
  /** Машиночитаемое имя правила (для админ-лога/ответа API). */
  rule: string;
  /** Человекочитаемая подсказка автору (дословные формулировки ТЗ). */
  message: string;
}

/** Ярлыки (п.1): клише-обвинения без фактуры — вернуть автору. */
const LABEL_RE =
  /мошенник\w*|мошенич\w*|кидал\w*|кинул\w*|разводил\w*|развод\w*|обманщик\w*|обманыва\w*|жулик\w*|аферист\w*|скамер\w*|вор\w*|топис\w*|халявщик\w*|барыга\w*/i;

/** Персональные данные (п.2): телефоны, карты, паспорта, адреса «д. N». */
const PERSONAL_DATA_RE =
  /(?:\+?\s*7|8)[\s(-]?\d{3}[\s)-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b|\b\d{2}\s?\d{2}\s?\d{6}\b|\bсерия\s+и\s+номер\b/i;

/** Угрозы (п.3): прямые угрозы жизни/здоровью/имуществу. */
const THREAT_RE =
  /убью\b|замочу\b|закопаю\b|сожгу\b|изувечу\b|порешу\b|найду и накажу\b|судимость получишь\b|сломаю (?:тебе )?(?:руки|ноги)\b/i;

/** Доля ЗАГЛАВНЫХ букв в буквенном тексте для п.3 «капслок». */
function capsRatio(s: string): number {
  const letters = s.replace(/[^A-Za-zА-Яа-яЁё]/g, "");
  if (letters.length < 30) return 0; // короткие выкрики не считаем
  const upper = letters.replace(/[^А-ЯЁA-Z]/g, "").length;
  return upper / letters.length;
}

/**
 * ОБЩИЙ ДВИЖОК САЙТА (используется и подсказками «Где дешевле» /
 * «Где купить»): находит телефоны в тексте — +7/8 + 10 цифр,
 * с разделителями и без. Возвращает массив найденных фрагментов.
 */
export function findPhoneNumbers(s: string): string[] {
  const out: string[] = [];
  const re = /(?:\+?\s*7|8)[\s(-]?\d{3}[\s)-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(s ?? ""))) !== null) out.push(m[0].trim());
  return out;
}

export function premoderateReviewText(input: PremoderationInput): PremoderationOutcome {
  const full = [input.title, input.text, input.place, input.humanHighlight]
    .filter(Boolean)
    .join("\n");

  // п.3а МАТ — детерминированный детектор сайта (лексикон с обходами).
  const prof = checkProfanity(full);
  if (prof.blocked) {
    return {
      verdict: "block",
      rule: "profanity",
      message:
        "Текст содержит нецензурную лексику. Уберите мат и опишите ситуацию нормальными словами.",
    };
  }

  // п.3б УГРОЗЫ — блок немедленно.
  if (THREAT_RE.test(full)) {
    return {
      verdict: "block",
      rule: "threat",
      message: "В тексте есть угрозы. Угрозы запрещены правилами — уберите их и опишите факты.",
    };
  }

  // п.3в КАПСЛОК — больше половины букв заглавными.
  if (capsRatio(full) > 0.5) {
    return {
      verdict: "block",
      rule: "capslock",
      message:
        "Текст набран ЗАГЛАВНЫМИ буквами. Отключите Caps Lock и напишите отзыв обычным регистром.",
    };
  }

  // п.1 ЯРЛЫКИ — вернуть автору: факты вместо ярлыков.
  if (LABEL_RE.test(full)) {
    return {
      verdict: "return",
      rule: "label",
      message:
        "В отзыве есть ярлык в адрес человека или организации («мошенник», «кидала» и т.п.). Замените ярлык на факты: что именно произошло, когда и при каких обстоятельствах.",
    };
  }

  // п.2 ЛИЧНЫЕ ДАННЫЕ физлиц — вернуть с требованием удалить.
  if (PERSONAL_DATA_RE.test(full)) {
    return {
      verdict: "return",
      rule: "personal_data",
      message:
        "В отзыве есть личные данные (телефон, карта, паспорт и т.п.). Удалите их — публиковать персональные данные третьих лиц запрещено.",
    };
  }

  // Фактурный негатив и нормальные отзывы — дальше (ИИ-модерация).
  return { verdict: "ok", rule: "", message: "" };
}
