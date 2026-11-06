"use client";

import { useState } from "react";

/**
 * /admin/cleanup-all — атомарная очистка всего сайта.
 *
 * 2026-11-02: одна кнопка, которая удаляет ВСЁ кроме ботов и закреплённых
 * тем форума. Объединяет /admin/topics-cleanup и /admin/blocks-cleanup
 * в одну атомарную транзакцию.
 *
 * Токен читается из localStorage["sm_auth"] (как на /admin/seed).
 */

const AUTH_KEY = "sm_auth";

interface CleanupResult {
  ok: boolean;
  before?: any;
  after?: any;
  deleted?: any;
  note?: string;
  error?: string;
}

export default function AdminCleanupAllPage() {
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function doCleanup() {
    setConfirmOpen(false);
    setLoading(true);
    setError("");
    setResult(null);

    let token = "";
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        token = parsed.token || "";
      }
    } catch {
      /* ignore */
    }

    if (!token) {
      setError("Не найден token в localStorage. Залогинитесь как админ на сайте и вернитесь.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/cleanup-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setResult(data as CleanupResult);
      }
    } catch (e: any) {
      setError("Сетевая ошибка: " + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "20px auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Полная очистка сайта</h1>

      <div
        style={{
          padding: 16,
          background: "#fff0f0",
          border: "2px solid #c00",
          borderRadius: 6,
          marginBottom: 16,
        }}
      >
        <p style={{ margin: "0 0 8px 0", fontWeight: 700, color: "#c00" }}>⚠️ ОПАСНАЯ ОПЕРАЦИЯ (необратима)</p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
          Эта операция в <strong>одной транзакции</strong> удалит:
        </p>
        <ul style={{ margin: "8px 0 0 0", paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
          <li>Все публикации в 9 спецразделах (Объявления, Где купить, Где дешевле, Знакомства,
            О работодателях, Подслушано, Рекомендую, ЖКХ, Нужна помощь)</li>
          <li>Все ответы, жалобы, фото, медиа, голоса, подсказки в этих разделах</li>
          <li>Все темы форума, где <code>isPinned = false</code></li>
          <li>Все сообщения в этих темах</li>
          <li>Все жалобы на сообщения (Complaint)</li>
          <li>Историю модерации (ModerationHistory)</li>
          <li>Очереди ботов (BotQueue, BotReplyQueue)</li>
        </ul>
        <p style={{ margin: "12px 0 0 0", fontSize: 14, lineHeight: 1.5, fontWeight: 600 }}>
          ✓ НЕ ТРОГАЕТ:
        </p>
        <ul style={{ margin: "0 0 0 0", paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
          <li>Пользователей и ботов (User) — все сохранятся</li>
          <li>Закреплённые темы форума (isPinned = true) и сообщения в них</li>
          <li>Рубрики форума (Rubric)</li>
          <li>Настройки сайта (SiteSetting)</li>
          <li>Сессии и токены авторизации</li>
          <li>Курсы валют (CurrencyRate)</li>
        </ul>
      </div>

      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={loading}
        style={{
          padding: "12px 24px",
          background: loading ? "#999" : "#c00",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: loading ? "not-allowed" : "pointer",
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        {loading ? "Очищаю..." : "Удалить всё, кроме ботов и закреплённых"}
      </button>

      {error && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: "#fee",
            border: "1px solid #c00",
            borderRadius: 4,
          }}
        >
          <strong>Ошибка:</strong> {error}
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            background: "#e8f5e9",
            border: "1px solid #4caf50",
            borderRadius: 4,
          }}
        >
          <strong>✓ Готово!</strong>
          <p style={{ margin: "8px 0 0 0", fontSize: 14, fontWeight: 600 }}>
            {result.note}
          </p>

          {result.before && result.after && (
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 13 }}>
              <div style={{ padding: 8, background: "#fff", borderRadius: 4, border: "1px solid #ddd" }}>
                <strong>До:</strong><br/>
                Пользователей: {result.before.users}<br/>
                Тем форума: {result.before.topics}<br/>
                (закреплённых: {result.before.topicsPinned})<br/>
                Сообщений: {result.before.messages}
              </div>
              <div style={{ padding: 8, background: "#fff", borderRadius: 4, border: "1px solid #ddd" }}>
                <strong>После:</strong><br/>
                Пользователей: {result.after.users}<br/>
                Тем форума: {result.after.topics}<br/>
                (закреплённых: {result.after.topicsPinned})<br/>
                Сообщений: {result.after.messages}
              </div>
              <div style={{ padding: 8, background: "#fff", borderRadius: 4, border: "1px solid #ddd" }}>
                <strong>Удалено:</strong><br/>
                Тем: {result.deleted?.topics}<br/>
                Сообщений: {result.deleted?.messages}<br/>
                Объявлений: {result.deleted?.adListings}<br/>
                «Где купить»: {result.deleted?.wtbPosts}<br/>
                «Где дешевле»: {result.deleted?.cheapPosts}<br/>
                Знакомств: {result.deleted?.datingPosts}<br/>
                Отзывов: {result.deleted?.empPosts}<br/>
                Подслушано: {result.deleted?.overheardPosts}<br/>
                Рекомендаций: {result.deleted?.recPosts}<br/>
                ЖКХ: {result.deleted?.gkhProblems}<br/>
                Помощь: {result.deleted?.helpPublications}
              </div>
            </div>
          )}

          <details style={{ marginTop: 12, fontSize: 12 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Полный отчёт</summary>
            <pre style={{ marginTop: 8, padding: 8, background: "#fff", border: "1px solid #ddd", borderRadius: 4, overflow: "auto" }}>
{JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {confirmOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setConfirmOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 6,
              maxWidth: 500,
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            }}
          >
            <p style={{ margin: "0 0 16px 0", fontWeight: 700, fontSize: 16, color: "#c00" }}>
              ⚠️ ОПЕРАЦИЯ НЕОБРАТИМА!
            </p>
            <p style={{ margin: "0 0 16px 0", fontSize: 14, lineHeight: 1.5 }}>
              Будут удалены все публикации в спецразделах, все незакреплённые темы форума и
              сообщения в них. <strong>Восстановить данные будет невозможно.</strong>
              <br/>
              <br/>
              Останутся только: <strong>пользователи/боты</strong> и <strong>закреплённые темы форума</strong>.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                style={{
                  padding: "8px 16px",
                  background: "#f0f0f0",
                  border: "1px solid #ccc",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={doCleanup}
                style={{
                  padding: "8px 16px",
                  background: "#c00",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Да, удалить всё
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, padding: 12, background: "#f9f9f9", borderRadius: 4, fontSize: 13, color: "#666" }}>
        <p style={{ margin: "0 0 8px 0", fontWeight: 600 }}>Как использовать:</p>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li>Залогиньтесь на сайте как админ (admin@sakhmatrix.ru).</li>
          <li>Откройте эту страницу: /admin/cleanup-all</li>
          <li>Нажмите «Удалить всё, кроме ботов и закреплённых».</li>
          <li>Подтвердите в модальном окне.</li>
          <li>В результате увидите полный отчёт: что было, что стало, что удалено.</li>
        </ol>
      </div>
    </div>
  );
}
