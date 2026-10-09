/**
 * ШАГ 10. Конвейер модерации: детерминированный фильтр лексики →
 * ИИ-модератор (первая инстанция) → при спорном случае человек-модератор.
 *
 * ПРОМТ №2 (2026-10-02):
 *   - Теневой режим (shadow mode): если SiteSetting aiShadowMode = "1",
 *     ИИ предлагает решение, но НЕ применяет hide/block автоматически.
 *     Вместо этого помечает needHuman и пишет ModerationHistory.
 *     По умолчанию включён — админ проверяет качество и отключает.
 *   - Контекст: moderateNewTextWithContext принимает соседние сообщения,
 *     тему, жалобы, историю нарушений автора — передаётся в LLM.
 *   - Кэш: если SiteSetting aiCacheEnabled = "1", вердикты кэшируются
 *     по text-hash (см. ai.ts).
 */

import { checkProfanity } from "./profanity";
import { aiModerate, type AiModerationVerdict, type AiModerationContext } from "./ai";
import { db } from "@/lib/db";

export { aiModerate };
export type { AiModerationVerdict, AiModerationContext };

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
  /** Уровень нарушения (1-4). */
  modLevel?: number;
  /** Технический статус AI: WATCH | LIMIT | STOP | ALERT. */
  aiAction?: string;
  /** Уверенность AI: low | medium | high. */
  aiConfidence?: string;
  /** Сработавший сигнал. */
  aiSignal?: string;
  /** ПРОМТ №2: контекст, который ИИ учёл. */
  aiContext?: string;
  /** ПРОМТ №2: релевантные предыдущие нарушения автора. */
  aiHistory?: string;
  /** ПРОМТ №2: shadow mode — вердикт ИИ только предложение, не действие. */
  shadowMode?: boolean;
  /** ПРОМТ №2: источник вердикта (cache/llm/fallback). */
  aiSource?: "cache" | "llm" | "fallback";
}

/**
 * Проверка НОВОГО текста перед публикацией (сообщение, тема, правка).
 * Текст проверяется целиком, включая цитируемые фрагменты.
 *
 * ПРОМТ №2: опциональный контекст — соседние сообщения, тема, жалобы,
 * история нарушений автора. Если контекст есть, он передаётся в LLM
 * в виде отдельных блоков (см. ai.ts buildUserPayload).
 */
export async function moderateNewText(
  text: string,
  ctx?: AiModerationContext
): Promise<ModerationOutcome> {
  // Шаг 1. Детерминированный фильтр нецензурной/оскорбительной лексики.
  // В shadow mode фильтр тоже не блокирует — но фиксирует hits.
  const prof = checkProfanity(text);
  const shadowMode = await isShadowMode();
  if (prof.blocked && !shadowMode) {
    return {
      action: "block",
      blockMessage: PROFANITY_BLOCK_MESSAGE,
      aiNote: "нецензурная лексика (автофильтр)",
      needHuman: false,
      source: "profanity",
      hits: prof.hits,
      shadowMode: false,
    };
  }
  if (prof.blocked && shadowMode) {
    // В shadow mode — не блокируем, передаём человеку.
    return {
      action: "human",
      aiNote: "[shadow] нецензурная лексика (автофильтр) — передано человеку",
      needHuman: true,
      source: "profanity",
      hits: prof.hits,
      shadowMode: true,
    };
  }

  // Шаг 2. ИИ-модератор: контекст, скрытые нарушения, защита мнений.
  try {
    const ai = await aiModerate(text, ctx);
    const aiSource = ai.source ?? "llm";

    // ПРОМТ №2: shadow mode — ИИ предлагает решение, но НЕ действует.
    // Любое решение (кроме allow) → передать человеку.
    if (shadowMode) {
      // Даже если ИИ говорит ALERT/STOP — в shadow mode не скрываем автоматически.
      return {
        action: ai.needsHuman || ai.level <= 3 ? "human" : "allow",
        aiNote: `[shadow] ${ai.note}`,
        aiContext: ai.context,
        aiHistory: ai.history,
        needHuman: ai.level <= 3 || ai.needsHuman,
        source: "ai",
        category: ai.category,
        modLevel: ai.level,
        aiAction: ai.action,
        aiConfidence: ai.confidence,
        aiSignal: ai.signal,
        shadowMode: true,
        aiSource,
      };
    }

    // Обычный режим (не shadow) — автоматические действия разрешены.
    if (ai.action === "ALERT" || ai.level <= 1) {
      // Критическая опасность — скрыть и уведомить администратора
      return {
        action: "hide",
        hiddenReason: ai.reason || "критическая опасность — скрыто ИИ",
        aiNote: ai.note,
        aiContext: ai.context,
        aiHistory: ai.history,
        needHuman: true,
        source: "ai",
        category: ai.category,
        modLevel: ai.level,
        aiAction: ai.action,
        aiConfidence: ai.confidence,
        aiSignal: ai.signal,
        shadowMode: false,
        aiSource,
      };
    }
    if (ai.action === "STOP" || ai.verdict === "violation") {
      // Серьёзное нарушение — скрыть
      return {
        action: "hide",
        hiddenReason: ai.reason || "нарушение правил — скрыто ИИ",
        aiNote: ai.note,
        aiContext: ai.context,
        aiHistory: ai.history,
        needHuman: false,
        source: "ai",
        category: ai.category,
        modLevel: ai.level,
        aiAction: ai.action,
        aiConfidence: ai.confidence,
        aiSignal: ai.signal,
        shadowMode: false,
        aiSource,
      };
    }
    if (ai.needsHuman || ai.action === "LIMIT" || ai.verdict === "ambiguous") {
      // Спорный случай — передать администратору
      return {
        action: "human",
        aiNote: ai.note,
        aiContext: ai.context,
        aiHistory: ai.history,
        needHuman: true,
        source: "ai",
        category: ai.category,
        modLevel: ai.level,
        aiAction: ai.action,
        aiConfidence: ai.confidence,
        aiSignal: ai.signal,
        shadowMode: false,
        aiSource,
      };
    }
    // Нормальное сообщение — публиковать
    return {
      action: "allow",
      aiNote: ai.note,
      aiContext: ai.context,
      aiHistory: ai.history,
      needHuman: false,
      source: "ai",
      category: ai.category,
      modLevel: ai.level,
      aiAction: ai.action,
      aiConfidence: ai.confidence,
      aiSignal: ai.signal,
      shadowMode: false,
      aiSource,
    };
  } catch {
    return {
      action: "human",
      aiNote: "ИИ-модератор недоступен — требуется проверка человеком",
      needHuman: true,
      source: "fallback",
      shadowMode,
    };
  }
}

/**
 * Повторная проверка УЖЕ опубликованного сообщения (по жалобе или в очереди).
 * Блокировка отправки здесь неприменима: очевидное нарушение → скрыть.
 *
 * ПРОМТ №2: в shadow mode даже по жалобе — не скрывать автоматически,
 * только помечать needHuman.
 */
export async function moderatePublishedText(
  text: string,
  ctx?: AiModerationContext
): Promise<ModerationOutcome> {
  const outcome = await moderateNewText(text, ctx);
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
 * ПРОМТ №2: проверка, включён ли теневой режим AI-модерации.
 * True = ИИ предлагает, не действует. False = автоматические действия разрешены.
 *
 * Кэшируется в памяти (60 сек) — частые запросы не дёргают БД.
 */
let _shadowModeCache: { value: boolean; expiresAt: number } | null = null;
const SHADOW_MODE_TTL_MS = 60 * 1000; // 1 минута

export async function isShadowMode(): Promise<boolean> {
  const now = Date.now();
  if (_shadowModeCache && _shadowModeCache.expiresAt > now) {
    return _shadowModeCache.value;
  }
  try {
    const row = await db.siteSetting.findUnique({ where: { key: "aiShadowMode" } });
    // По умолчанию (если записи нет) — shadow mode ВКЛЮЧЁН (значение "1").
    const value = !row || row.value !== "0";
    _shadowModeCache = { value, expiresAt: now + SHADOW_MODE_TTL_MS };
    return value;
  } catch {
    // БД недоступна — fallback на shadow mode (безопаснее).
    return true;
  }
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
