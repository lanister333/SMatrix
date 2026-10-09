/**
 * 2026-10-04: Уведомления администратора.
 *
 * Когда что-то требует вмешательства администратора (новая жалоба,
 * апелляция, сообщение от ИИ-модерации, обращение через feedback-форму) —
 * отправляется уведомление.
 *
 * Каналы (по приоритету):
 *   1. Telegram Bot — если заданы env TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.
 *      Бесплатно, мгновенно, надёжно. Создать бота: @BotFather → /newbot.
 *      Узнать chat_id: напишите боту любое сообщение, затем откройте
 *      https://api.telegram.org/bot<TOKEN>/getUpdates → поле chat.id.
 *   2. Email — если задан env ADMIN_NOTIFY_EMAIL + SMTP_*. Пока не
 *      реализовано (требует SMTP-шлюз), заготовка на будущее.
 *   3. Server log — всегда (fallback): console.log в dev-режиме и
 *      для аудита в проде.
 *
 * Использование в API routes:
 *   import { notifyAdmin } from "@/lib/notifications";
 *   await notifyAdmin({ type: "complaint", section: "forum", ... });
 */

export type AdminNotifyEvent = {
  /** Тип события: новая жалоба / апелляция / сообщение от ИИ / обращение. */
  type: "complaint" | "appeal" | "ai_flag" | "feedback" | "new_publication_hidden";
  /** Раздел сайта: forum / help / recommend / wheretobuy / gdedeshevle / employers / gkh / overheard / znakomstva / obyavleniya. */
  section?: string;
  /** Краткое описание для уведомления. */
  title: string;
  /** Дополнительные детали (ник автора, категория жалобы, и т.п.). */
  details?: string;
  /** Ссылка на админ-панель (если применимо). */
  adminUrl?: string;
};

/** Кэш env-переменных (читаются один раз). */
let _tgConfig: { token: string; chatId: string } | null | undefined;

function getTgConfig(): { token: string; chatId: string } | null {
  if (_tgConfig !== undefined) return _tgConfig;
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim() ?? "";
  _tgConfig = token && chatId ? { token, chatId } : null;
  return _tgConfig;
}

/** Сброс кэша (для тестов). */
export function _resetNotifyCache(): void {
  _tgConfig = undefined;
}

/** Отправить уведомление администратору. */
export async function notifyAdmin(event: AdminNotifyEvent): Promise<void> {
  const text = formatEvent(event);

  // 1. Server log — всегда.
  console.log(`[notifyAdmin] ${event.type}: ${event.title}`);

  // 2. Telegram — если настроен.
  const tg = getTgConfig();
  if (tg) {
    try {
      const url = `https://api.telegram.org/bot${tg.token}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tg.chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[notifyAdmin] Telegram error ${res.status}: ${body.slice(0, 200)}`);
      }
    } catch (e) {
      // Сеть/таймаут — не блокируем основной запрос.
      console.error(`[notifyAdmin] Telegram send failed:`, e instanceof Error ? e.message : e);
    }
  }
}

/** Форматирование события в текст уведомления. */
function formatEvent(event: AdminNotifyEvent): string {
  const icons: Record<AdminNotifyEvent["type"], string> = {
    complaint: "🚨",
    appeal: "⚖️",
    ai_flag: "🛡",
    feedback: "📨",
    new_publication_hidden: "🚫",
  };
  const typeLabels: Record<AdminNotifyEvent["type"], string> = {
    complaint: "Новая жалоба",
    appeal: "Новая апелляция",
    ai_flag: "Скрыто модерацией",
    feedback: "Обращение администратору",
    new_publication_hidden: "Публикация скрыта",
  };
  const icon = icons[event.type] ?? "🔔";
  const label = typeLabels[event.type] ?? event.type;
  const section = event.section ? `\n📂 Раздел: ${event.section}` : "";
  const details = event.details ? `\n📝 ${event.details}` : "";
  const link = event.adminUrl ? `\n🔗 ${event.adminUrl}` : "";
  return `${icon} <b>${label}</b>\n${event.title}${section}${details}${link}`;
}
