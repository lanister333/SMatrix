"use client";

import { useState } from "react";

/**
 * /admin/topics-cleanup — страница массового удаления тем форума со всеми сообщениями.
 *
 * 2026-11-02: удаляет ВСЕ темы форума и сообщения в них, кроме тем с isPinned = true
 * (закреплённых, выделенных жёлтым). Soft delete — данные остаются в БД, можно откатить.
 *
 * Токен читается из localStorage["sm_auth"] (как на /admin/seed).
 */

const AUTH_KEY = "sm_auth";

interface CleanupResult {
  ok: boolean;
  deletedTopics: number;
  deletedMessages: number;
  keptPinnedTopics: number;
  alreadyDeletedTopicsBefore: number;
  activeTopicsBefore: number;
  note?: string;
  error?: string;
}

export default function AdminTopicsCleanupPage() {
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
      const res = await fetch("/api/admin/topics/cleanup", {
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
    <div style={{ maxWidth: 800, margin: "20px auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Очистка форума</h1>

      <div
        style={{
          padding: 16,
          background: "#fff8e1",
          border: "2px solid #ffb300",
          borderRadius: 6,
          marginBottom: 16,
        }}
      >
        <p style={{ margin: "0 0 8px 0", fontWeight: 700, color: "#b8860b" }}>⚠️ Опасная операция</p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
          Будут удалены <strong>все темы форума со всеми сообщениями в них</strong>, кроме
          закреплённых тем (выделенных жёлтым) и сообщений в закреплённых темах.
          Удаление мягкое (soft delete) — темы и сообщения исчезнут из ленты, но останутся в БД.
          Откат возможен SQL-командами:
        </p>
        <pre
          style={{
            marginTop: 8,
            padding: 8,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 4,
            fontFamily: "ui-monospace, monospace",
            fontSize: 12,
            overflow: "auto",
          }}
        >
{`UPDATE Topic SET deletedAt = NULL WHERE isPinned = 0;
UPDATE Message SET isDeleted = 0
  WHERE topicId IN (SELECT id FROM Topic WHERE isPinned = 0);`}
        </pre>
      </div>

      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={loading}
        style={{
          padding: "12px 24px",
          background: loading ? "#999" : "#c08080",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: loading ? "not-allowed" : "pointer",
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        {loading ? "Удаляю..." : "Удалить все незакреплённые темы и сообщения"}
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
          <strong>Готово:</strong>
          <ul style={{ margin: "8px 0 0 0", paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
            <li>Удалено тем: <strong>{result.deletedTopics}</strong></li>
            <li>Удалено сообщений: <strong>{result.deletedMessages}</strong></li>
            <li>Закреплённых тем оставлено: <strong>{result.keptPinnedTopics}</strong></li>
            <li>Было активных тем до операции: {result.activeTopicsBefore}</li>
            <li>Уже было удалено тем до операции: {result.alreadyDeletedTopicsBefore}</li>
          </ul>
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
              maxWidth: 400,
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            }}
          >
            <p style={{ margin: "0 0 16px 0", fontWeight: 700, fontSize: 16 }}>
              Точно удалить все незакреплённые темы и сообщения?
            </p>
            <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "#666" }}>
              Это действие удалит все темы форума (кроме закреплённых) и все сообщения в них.
              Откат — только через SQL.
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
                  background: "#c08080",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Да, удалить
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, padding: 12, background: "#f9f9f9", borderRadius: 4, fontSize: 13, color: "#666" }}>
        <p style={{ margin: "0 0 8px 0" }}>
          <strong>Как использовать:</strong>
        </p>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li>Залогиньтесь на сайте как админ (admin@sakhmatrix.ru).</li>
          <li>Откройте эту страницу: /admin/topics-cleanup</li>
          <li>Нажмите «Удалить все незакреплённые темы и сообщения».</li>
          <li>Подтвердите в модальном окне.</li>
          <li>В результате увидите количество удалённых тем и сообщений.</li>
        </ol>
      </div>
    </div>
  );
}
