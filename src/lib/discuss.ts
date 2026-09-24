"use client";

/**
 * ТЗ 2026-09-24 «Обсудить на форуме — авто-создание темы»:
 * клиентский helper для всех 5 разделов сайта (recommend, wheretobuy,
 * gdedeshevle, employers, gkh).
 *
 * Поведение:
 *  1. Если пользователь не залогинен — вызывает onNeedAuth() (открывает
 *     AuthModal). После входа пользователь должен снова кликнуть кнопку.
 *  2. Если залогинен — POST /api/discuss/[kind]/[id] с токеном.
 *  3. Сервер создаёт тему или возвращает существующую, отдаёт {redirect}.
 *  4. Клиент делает window.location.href = redirect — пользователь попадает
 *     прямо в тему форума, где уже может писать комментарии.
 *  5. Если сервер вернул needAuth (маловероятно — мы уже проверили token) —
 *     открывает AuthModal. Если вернул error — показывает alert.
 *
 * Этот helper ИЗБАВЛЯЕТ от дублирования кода в 5 карточках: каждая карточка
 * просто вызывает discussOnForum(kind, postId, token, onNeedAuth).
 */

export type DiscussKind = "recommend" | "wheretobuy" | "gdedeshevle" | "employers" | "gkh";

/**
 * Инициирует авто-создание (или поиск существующей) темы для обсуждения
 * публикации на форуме. После ответа сервера — редиректит пользователя.
 *
 * @param kind        Тип публикации (recommend/wheretobuy/gdedeshevle/employers/gkh).
 * @param postId      Cuid публикации (как в card.id).
 * @param token       Токен текущего пользователя (null для гостя).
 * @param onNeedAuth  Колбэк, который открывает AuthModal, если гость.
 * @returns Promise<void> — после редиректа функция не вернётся.
 */
export async function discussOnForum(
  kind: DiscussKind,
  postId: string,
  token: string | null,
  onNeedAuth: () => void,
): Promise<void> {
  // Гостю — открыть окно входа (тема создаётся от имени пользователя).
  if (!token) {
    onNeedAuth();
    return;
  }

  try {
    const r = await fetch(`/api/discuss/${kind}/${encodeURIComponent(postId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const d = await r.json().catch(() => ({}));

    if (!r.ok) {
      // needAuth — открыть AuthModal (токен мог протухнуть).
      if (d.needAuth) {
        onNeedAuth();
        return;
      }
      // Иная ошибка — показать сообщение (не редиректить).
      alert(String(d.error || "Не удалось создать тему для обсуждения"));
      return;
    }

    // Успешный ответ — редирект на созданную/существующую тему.
    if (d.redirect && typeof d.redirect === "string") {
      window.location.href = d.redirect;
    }
  } catch {
    alert("Сеть недоступна — попробуйте ещё раз через несколько секунд");
  }
}
