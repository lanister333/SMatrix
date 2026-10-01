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
  blockMessage?: string;
  hiddenReason?: string;
  aiNote?: string;
  needHuman: boolean;
  source: "profanity" | "card-filter" | "slogan" | "ai" | "fallback";
  category?: string;
  hits?: { word: string; stem: string; mode: string }[];
  /** 2026-10-01: уровень нарушения (1-4). */
  modLevel?: number;
  /** 2026-10-01: технический статус AI: WATCH | LIMIT | STOP | ALERT. */
  aiAction?: string;
  /** 2026-10-01: уверенность AI: low | medium | high. */
  aiConfidence?: string;
  /** 2026-10-01: сработавший сигнал. */
  aiSignal?: string;
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
    // 2026-10-01: маппинг нового формата (level 1-4, action) → ModerationOutcome
    if (ai.action === "ALERT" || (ai.level <= 1)) {
      // Критическая опасность — скрыть и уведомить администратора
      return {
        action: "hide",
        hiddenReason: ai.reason || "критическая опасность — скрыто ИИ",
        aiNote: ai.note,
        needHuman: true,
        source: "ai",
        category: ai.category,
        modLevel: ai.level,
        aiAction: ai.action,
        aiConfidence: ai.confidence,
        aiSignal: ai.signal,
      };
    }
    if (ai.action === "STOP" || ai.verdict === "violation") {
      // Серьёзное нарушение — скрыть
      return {
        action: "hide",
        hiddenReason: ai.reason || "нарушение правил — скрыто ИИ",
        aiNote: ai.note,
        needHuman: false,
        source: "ai",
        category: ai.category,
        modLevel: ai.level,
        aiAction: ai.action,
        aiConfidence: ai.confidence,
        aiSignal: ai.signal,
      };
    }
    if (ai.needsHuman || ai.action === "LIMIT" || ai.verdict === "ambiguous") {
      // Спорный случай — передать администратору
      return {
        action: "human",
        aiNote: ai.note,
        needHuman: true,
        source: "ai",
        category: ai.category,
        modLevel: ai.level,
        aiAction: ai.action,
        aiConfidence: ai.confidence,
        aiSignal: ai.signal,
      };
    }
    // Нормальное сообщение — публиковать
    return {
      action: "allow",
      aiNote: ai.note,
      needHuman: false,
      source: "ai",
      category: ai.category,
      modLevel: ai.level,
      aiAction: ai.action,
      aiConfidence: ai.confidence,
      aiSignal: ai.signal,
    };
  } catch {
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
