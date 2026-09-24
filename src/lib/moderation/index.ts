/**
 * ШАГ 10. Конвейер модерации: детерминированный фильтр лексики →
 * ИИ-модератор (первая инстанция) → при спорном случае человек-модератор.
 */

import { checkProfanity } from "./profanity";
import { aiModerate, type AiModerationVerdict } from "./ai";

export { aiModerate };
export type { AiModerationVerdict };

/** Точное сообщение о блокировке (по ТЗ). */
export const PROFANITY_BLOCK_MESSAGE =
  "Сообщение содержит нецензурную или оскорбительную лексику. Пожалуйста, отредактируйте текст и попробуйте снова.";

/** Точное подтверждение отправки жалобы (по ТЗ). */
export const COMPLAINT_CONFIRM_MESSAGE =
  "Жалоба отправлена. Спасибо. Модерация рассмотрит сообщение.";

export type ModerationAction = "allow" | "block" | "hide" | "human";

export interface ModerationOutcome {
  action: ModerationAction;
  /** Сообщение пользователю при блокировке отправки (только для action="block"). */
  blockMessage?: string;
  /** Причина скрытия (action="hide") — попадает в hiddenReason. */
  hiddenReason?: string;
  /** Заметка ИИ — попадает в aiNote. */
  aiNote?: string;
  /** Требуется решение человека-модератора. */
  needHuman: boolean;
  /** Источник вердикта. «slogan» — ИИ-фильтр лозунгов ЖКХ (ТЗ №2 от 2026-09-23, п.17). */
  source: "profanity" | "card-filter" | "slogan" | "ai" | "fallback";
  /** Категория нарушения (ШАГ 11 — для лестницы санкций). */
  category?: string;
  hits?: { word: string; stem: string; mode: string }[];
}

/**
 * Проверка НОВОГО текста перед публикацией (сообщение, тема, правка).
 * Текст проверяется целиком, включая цитируемые фрагменты.
 */
export async function moderateNewText(text: string): Promise<ModerationOutcome> {
  // Шаг 1. Детерминированный фильтр нецензурной/оскорбительной лексики.
  const prof = checkProfanity(text);
  if (prof.blocked) {
    return {
      action: "block",
      blockMessage: PROFANITY_BLOCK_MESSAGE,
      aiNote: "нецензурная лексика (автофильтр)",
      needHuman: false,
      source: "profanity",
      hits: prof.hits,
    };
  }

  // Шаг 2. ИИ-модератор: контекст, скрытые нарушения, защита мнений.
  try {
    const ai = await aiModerate(text);
    if (ai.verdict === "violation") {
      return {
        action: "hide",
        hiddenReason: ai.reason,
        aiNote: ai.note,
        needHuman: false,
        source: "ai",
        category: ai.category,
      };
    }
    if (ai.verdict === "ambiguous") {
      return {
        action: "human",
        aiNote: ai.note,
        needHuman: true,
        source: "ai",
        category: ai.category,
      };
    }
    return { action: "allow", aiNote: ai.note, needHuman: false, source: "ai", category: ai.category };
  } catch {
    // ИИ недоступен: текст лексический фильтр прошёл — публикуем,
    // но обязательно ставим в очередь человеку-модератору.
    return {
      action: "human",
      aiNote: "ИИ-модератор недоступен — требуется проверка человеком",
      needHuman: true,
      source: "fallback",
    };
  }
}

/**
 * Повторная проверка УЖЕ опубликованного сообщения (по жалобе или в очереди).
 * Блокировка отправки здесь неприменима: очевидное нарушение → скрыть.
 */
export async function moderatePublishedText(text: string): Promise<ModerationOutcome> {
  const outcome = await moderateNewText(text);
  if (outcome.action === "block") {
    return {
      ...outcome,
      action: "hide",
      hiddenReason: "нецензурная или оскорбительная лексика",
      needHuman: false,
    };
  }
  return outcome;
}

/**
 * ШАГ 11. Текст об активном ограничении для пользователя.
 */
export function restrictionBlockMessage(info: {
  kindLabel: string;
  reason: string;
  expiresAt: string | null;
  permanent: boolean;
}): string {
  if (info.permanent) {
    return `Аккаунт заблокирован постоянно. Причина: ${info.reason}. Вы можете оспорить решение — «Оспорить решение».`;
  }
  const until = info.expiresAt
    ? ` Ограничение действует до ${new Date(info.expiresAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.`
    : "";
  return `Действует ограничение: ${info.kindLabel}. Причина: ${info.reason}.${until} Вы можете оспорить решение — «Оспорить решение».`;
}
