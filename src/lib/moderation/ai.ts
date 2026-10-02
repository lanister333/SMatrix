/**
 * ШАГ 10. ИИ-модератор — первая инстанция модерации форума.
 *
 * Принципы (по ПРОМТУ №2):
 *  — ИИ рассматривает текст ПЕРВЫМ и автоматически разбирает очевидные
 *    нарушения: угрозы; травлю/преследование; спам; мошенничество;
 *    персональные данные; запрещённый контент; нецензурную и явно
 *    оскорбительную лексику; другие очевидные нарушения правил;
 *  — критика, несогласие и отрицательное мнение сами по себе нарушением
 *    НЕ являются («не нравится мнение ≠ нарушение»);
 *  — учитывается контекст, включая цитируемый текст, соседние сообщения,
 *    тему, жалобу и историю нарушений автора;
 *  — спорные/неоднозначные случаи передаются человеку-модератору.
 *
 * Формат ответа (ПРОМТ №2):
 *   КЛАСС:    Уровень 1/2/3/4
 *   РЕШЕНИЕ:  что сделать (WATCH/LIMIT/STOP/ALERT)
 *   УВЕРЕННОСТЬ: низкая/средняя/высокая
 *   ПРИЧИНА:  краткое объяснение
 *   КОНТЕКСТ: обстоятельства (что вокруг, что за тема, что за жалоба)
 *   ИСТОРИЯ:  релевантные предыдущие нарушения автора
 *   ТРЕБУЕТСЯ ЧЕЛОВЕК: да/нет
 *
 *   В JSON мы эти поля кодируем как level/action/confidence/reason/context/
 *   history/needsHuman. Сам промпт даёт ИИ человекочитаемые инструкции,
 *   а парсер понимает оба представления.
 */

import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import crypto from "crypto";

export type AiVerdict = "ok" | "violation" | "ambiguous";

/** Контекст, передаваемый в ИИ-модератор (ПРОМТ №2: «анализируй контекст»). */
export interface AiModerationContext {
  /** Соседние сообщения до (хронологически раньше). */
  before?: { authorName: string; body: string; createdAt: Date }[];
  /** Соседние сообщения после (если есть — например, при повторной проверке). */
  after?: { authorName: string; body: string; createdAt: Date }[];
  /** Название темы (для форума). */
  topicTitle?: string;
  /** Название раздела (рубрики). */
  sectionName?: string;
  /** Жалобы, уже поданные на это сообщение. */
  complaints?: { category: string; comment: string; createdAt: Date }[];
  /** История нарушений автора (краткая сводка). */
  authorHistory?: {
    totalViolations: number;
    recentViolations: number;
    lastViolationAt?: Date;
    categoriesBreakdown?: Record<string, number>;
  };
  /** Тип объекта: новый текст, жалоба, повторная проверка. */
  reviewType?: "new" | "complaint" | "rerun";
  /** Дополнительные заметки (для AI). */
  notes?: string;
}

export interface AiModerationVerdict {
  verdict: AiVerdict;
  category: string;
  reason: string;
  note: string;
  /** Уровень нарушения (1=критическая опасность, 2=серьёзное,
   *  3=нарушение правил общения, 4=нарушения нет). */
  level: number;
  /** Технический статус AI: WATCH | LIMIT | STOP | ALERT. */
  action: string;
  /** Уверенность AI: "low" | "medium" | "high". */
  confidence: string;
  /** Сработавший сигнал (короткое описание). */
  signal: string;
  /** Требуется человек-модератор (да/нет). */
  needsHuman: boolean;
  /** 2026-10-02 (ПРОМТ №2): обстоятельства, которые ИИ учёл. */
  context?: string;
  /** 2026-10-02 (ПРОМТ №2): релевантные предыдущие нарушения автора. */
  history?: string;
  /** 2026-10-02 (ПРОМТ №2): источник вердикта — cache/llm/fallback. */
  source?: "cache" | "llm" | "fallback";
}

const SYSTEM_PROMPT = `Ты — ИИ-помощник модератора общественной платформы SakhMatrix (Сахалин). Ты — ПЕРВАЯ инстанция модерации: проверяешь пользовательский контент, учитываешь контекст и помогаешь администратору соблюдать правила.

ПРОВЕРЯЕТСЯ ВЕСЬ текст сообщения, включая цитируемые фрагменты. Нарушение в цитате — тоже нарушение.

ЧТО АНАЛИЗИРОВАТЬ:
- Текст сообщения;
- Несколько сообщений до и после (если есть в контексте);
- Тему и раздел;
- Жалобу (если есть);
- Историю нарушений автора;
- Повторяемость поведения и контекст конфликта.

ЧТО НЕ ЯВЛЯЕТСЯ НАРУШЕНИЕМ САМО ПО СЕБЕ:
- Критика, несогласие, негативное мнение, жалоба, резкое содержательное несогласие, неприятная точка зрения и обычное предложение своих услуг НЕ являются нарушением только из-за их содержания.
- «Это решение вредно», «я считаю иначе», «работает плохо» — РАЗРЕШЕНО, даже если тон негативный.
- Грубоватая, но содержательная критика по делу — РАЗРЕШЕНА.

УРОВНИ НАРУШЕНИЯ:
- Уровень 4 — нарушения нет: обычная критика, спор, отрицательное мнение, аргументированное несогласие, нормальное общение. Действие: WATCH (наблюдение).
- Уровень 3 — нарушение правил общения: оскорбления, неуместная грубость, провокации, флуд, бессмысленные повторы, систематический оффтопик, агрессивное поведение, спам. Действие: WATCH или LIMIT (замечание/предупреждение/ограничение в зависимости от уверенности и повторяемости).
- Уровень 2 — серьёзное нарушение: систематическая травля, преследование, серьёзные оскорбления, дискриминация, злонамеренная дезинформация, обход блокировки. Действие: LIMIT или STOP (передать администратору с рекомендацией).
- Уровень 1 — критическая опасность: прямая угроза физического вреда, опасные призывы, очевидное мошенничество через платформу, особо опасные персональные данные (доксинг). Действие: ALERT (скрыть и немедленно уведомить администратора). Длительный бан автоматически не выдавать.

ДОПУСТИМЫЕ ДЕЙСТВИЯ AI:
- Нормальное сообщение — публиковать (WATCH).
- Лёгкое нарушение — публиковать или помечать (WATCH).
- Очевидный флуд — скрывать (STOP).
- Очевидный спам — останавливать (STOP).
- Критическое запрещённое содержание — не публиковать (ALERT).
- Угроза или опасный контент — скрыть и срочно передать администратору (ALERT).
- Сомнительное — передать администратору (LIMIT).
- Повторные нарушения — показать историю и рекомендацию (LIMIT или STOP).

САНКЦИИ (не выдаёт AI — только рекомендует):
- Лестница: замечание → предупреждение → временное ограничение функции → временная полная блокировка.
- Базовые сроки: 1 час → 6 часов → 1 день → 3 дня → 7 дней.
- AI не выдаёт самостоятельно длительные блокировки.

ГЛАВНЫЙ ПРИНЦИП: AI — помощник администратора, а не окончательный судья. В спорных случаях последнее слово остаётся за администратором.

Ответь СТРОГО валидным JSON без пояснений, в формате:
{
  "level": 1|2|3|4,
  "action": "WATCH|LIMIT|STOP|ALERT",
  "confidence": "low|medium|high",
  "reason": "краткая причина на русском (до 200 символов)",
  "context": "обстоятельства: что вокруг, тема, жалоба, конфликт (до 300 символов)",
  "history": "релевантные предыдущие нарушения автора (до 200 символов)",
  "signal": "что сработало (до 100 символов)",
  "needsHuman": true|false,
  "category": "threat|bullying|spam|fraud|personal_data|forbidden|insult|other"
}`;

export function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

const VALID_CATEGORIES = new Set([
  "threat", "bullying", "spam", "fraud", "personal_data", "forbidden", "insult", "other",
]);

/** Хэш текста для кэша вердиктов (SHA-1, 40 символов). */
export function hashText(text: string): string {
  return crypto.createHash("sha1").update(text).digest("hex");
}

/**
 * Формирует user-сообщение для LLM: текст + контекст (если есть).
 * Контекст добавляется отдельными блоками, чтобы модель видела окружение.
 */
function buildUserPayload(text: string, ctx?: AiModerationContext): string {
  const parts: string[] = [];
  parts.push('Проверь сообщение форума (проверь весь текст, включая цитаты):');
  parts.push(`"""`);
  parts.push(text.slice(0, 8000));
  parts.push(`"""`);

  if (ctx) {
    if (ctx.topicTitle) parts.push(`\nТЕМА: ${ctx.topicTitle.slice(0, 200)}`);
    if (ctx.sectionName) parts.push(`РАЗДЕЛ: ${ctx.sectionName.slice(0, 100)}`);

    if (ctx.before && ctx.before.length > 0) {
      parts.push(`\nСООБЩЕНИЯ ДО (хронологически раньше):`);
      for (const m of ctx.before.slice(-5)) {
        const time = m.createdAt.toLocaleString("ru-RU");
        parts.push(`[${time}] ${m.authorName}: ${m.body.slice(0, 500)}`);
      }
    }

    if (ctx.after && ctx.after.length > 0) {
      parts.push(`\nСООБЩЕНИЯ ПОСЛЕ (если есть):`);
      for (const m of ctx.after.slice(0, 5)) {
        const time = m.createdAt.toLocaleString("ru-RU");
        parts.push(`[${time}] ${m.authorName}: ${m.body.slice(0, 500)}`);
      }
    }

    if (ctx.complaints && ctx.complaints.length > 0) {
      parts.push(`\nЖАЛОБЫ НА ЭТО СООБЩЕНИЕ:`);
      for (const c of ctx.complaints.slice(0, 10)) {
        parts.push(`- ${c.category}: ${c.comment.slice(0, 200)}`);
      }
    }

    if (ctx.authorHistory) {
      const h = ctx.authorHistory;
      const cats = h.categoriesBreakdown
        ? Object.entries(h.categoriesBreakdown)
            .map(([k, v]) => `${k}:${v}`)
            .join(", ")
        : "";
      parts.push(
        `\nИСТОРИЯ НАРУШЕНИЙ АВТОРА: всего ${h.totalViolations}, за последнее время ${h.recentViolations}` +
          (h.lastViolationAt ? `, последнее: ${h.lastViolationAt.toLocaleDateString("ru-RU")}` : "") +
          (cats ? `, по категориям: ${cats}` : "")
      );
    }

    if (ctx.reviewType === "complaint") {
      parts.push(`\nЭто повторная проверка по факту жалобы — перепроверь текст внимательнее.`);
    } else if (ctx.reviewType === "rerun") {
      parts.push(`\nЭто повторная проверка в очереди модерации — решение может отличаться от первичного.`);
    }

    if (ctx.notes) {
      parts.push(`\nДОПОЛНИТЕЛЬНО: ${ctx.notes.slice(0, 500)}`);
    }
  }

  return parts.join("\n");
}

/**
 * ИИ-вердикт по тексту сообщения. Бросает исключение при недоступности ИИ.
 * Принимает опциональный контекст (ПРОМТ №2): соседние сообщения, тема,
 * жалобы, история нарушений автора.
 *
 * Кэшируется по text-hash (TTL 7 дней) — см. ai-cache.ts.
 */
export async function aiModerate(text: string, ctx?: AiModerationContext): Promise<AiModerationVerdict> {
  // ПРОМТ №2: проверяем кэш по text-hash.
  const textHash = hashText(text);
  const cached = await getCachedVerdict(textHash);
  if (cached) {
    return { ...cached, source: "cache" };
  }

  const zai = await ZAI.create();
  const completion = await Promise.race([
    zai.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: buildUserPayload(text, ctx),
        },
      ],
      thinking: { type: "disabled" },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI timeout")), 45000)
    ),
  ]);

  const content = completion.choices[0]?.message?.content ?? "";
  const parsed = extractJson(content);
  if (!parsed) throw new Error("AI: не удалось разобрать ответ");

  // 2026-10-01: новый формат ответа с уровнями 1-4 и действиями AI
  const level = Math.max(1, Math.min(4, parseInt(String(parsed.level ?? "4"), 10) || 4));
  const rawAction = String(parsed.action ?? "WATCH").toUpperCase();
  const action = ["WATCH", "LIMIT", "STOP", "ALERT"].includes(rawAction) ? rawAction : "WATCH";
  const rawConfidence = String(parsed.confidence ?? "low").toLowerCase();
  const confidence = ["low", "medium", "high"].includes(rawConfidence) ? rawConfidence : "low";
  const reason = String(parsed.reason ?? "").trim().slice(0, 200);
  const signal = String(parsed.signal ?? "").trim().slice(0, 100);
  // ПРОМТ №2: новые поля context и history.
  const contextNote = String(parsed.context ?? "").trim().slice(0, 300);
  const historyNote = String(parsed.history ?? "").trim().slice(0, 200);
  const needsHuman =
    parsed.needsHuman === true || action === "ALERT" || action === "LIMIT" || level <= 2;

  let category = String(parsed.category ?? "other").toLowerCase();
  if (!VALID_CATEGORIES.has(category)) category = "other";

  // Маппинг нового формата → старый verdict (обратная совместимость)
  let verdict: AiVerdict;
  if (level <= 2) verdict = "violation";
  else if (level === 3) verdict = "ambiguous";
  else verdict = "ok";

  const note = reason || signal || (level === 4 ? "нарушений не найдено" : level === 3 ? "нарушение правил общения" : level === 2 ? "серьёзное нарушение" : "критическая опасность");

  const verdictObj: AiModerationVerdict = {
    verdict,
    category,
    reason,
    note,
    level,
    action,
    confidence,
    signal,
    needsHuman,
    context: contextNote,
    history: historyNote,
    source: "llm",
  };

  // ПРОМТ №2: кэшируем вердикт.
  await setCachedVerdict(textHash, verdictObj).catch(() => {});

  return verdictObj;
}

/**
 * Кэш вердиктов по text-hash. Хранится в БД (таблица AiVerdictCache),
 * TTL — 7 дней. Это защищает от спам-атак на бюджет LLM: одинаковые тексты
 * не дёргают модель повторно.
 *
 * Создаётся через schema.prisma — см. model AiVerdictCache.
 */
const AI_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней

interface AiVerdictCacheRow {
  id: string;
  textHash: string;
  verdictJson: string;
  level: number;
  action: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Читает вердикт из кэша, если он есть и не истёк.
 * Использует динамический доступ к db.aiVerdictCache (модель создаётся в схеме).
 */
async function getCachedVerdict(textHash: string): Promise<AiModerationVerdict | null> {
  try {
    const row = await (db as unknown as Record<string, {
      findFirst: (args: unknown) => Promise<AiVerdictCacheRow | null>;
    }>)["aiVerdictCache"]?.findFirst({
      where: {
        textHash,
        expiresAt: { gt: new Date() },
      },
    });
    if (!row) return null;
    const parsed = JSON.parse(row.verdictJson) as AiModerationVerdict;
    return parsed;
  } catch {
    // Таблица ещё не создана или ошибка — продолжаем без кэша.
    return null;
  }
}

/** Сохраняет вердикт в кэш. Молча игнорирует ошибки. */
async function setCachedVerdict(textHash: string, verdict: AiModerationVerdict): Promise<void> {
  try {
    await (db as unknown as Record<string, {
      upsert: (args: unknown) => Promise<unknown>;
      create?: (args: unknown) => Promise<unknown>;
    }>)["aiVerdictCache"]?.upsert({
      where: { textHash },
      update: {
        verdictJson: JSON.stringify(verdict),
        level: verdict.level,
        action: verdict.action,
        expiresAt: new Date(Date.now() + AI_CACHE_TTL_MS),
      },
      create: {
        textHash,
        verdictJson: JSON.stringify(verdict),
        level: verdict.level,
        action: verdict.action,
        expiresAt: new Date(Date.now() + AI_CACHE_TTL_MS),
      },
    });
  } catch {
    // Таблица ещё не создана или ошибка — продолжаем без кэша.
  }
}
