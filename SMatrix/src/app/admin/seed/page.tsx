"use client";

import { useState } from "react";

/**
 * /admin/seed — страница для заливки тем через JSON (мобильный браузер).
 *
 * 2026-11-02: читает token из localStorage["sm_auth"] и POSTит на /api/admin/seed.
 */

const AUTH_KEY = "sm_auth";

const EXAMPLE_JSON = `{
  "section": "wheretobuy",
  "title": "Подскажите толкового сантехника для частного дома",
  "bodyText": "Добрый день, форумчане! Подскажите, пожалуйста, толкового сантехника по адекватной цене — нужно посмотреть трубы и батареи в частном доме.",
  "postType": "service",
  "place": "",
  "createdAt": "2026-10-28T12:00:00+11:00",
  "authorGender": "female",
  "messages": [
    { "gender": "male",   "body": "Написал вам в личные сообщения.", "createdAt": "2026-10-28T13:10:00+11:00", "parentIndex": null },
    { "gender": "male",   "body": "89025588388", "createdAt": "2026-10-28T13:12:00+11:00", "parentIndex": null },
    { "gender": "female",  "body": "Спасибо!", "createdAt": "2026-10-28T13:42:00+11:00", "parentIndex": 1 }
  ]
}`;

export default function AdminSeedPage() {
  const [json, setJson] = useState(EXAMPLE_JSON);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string>("");
  const [cleanupError, setCleanupError] = useState<string>("");

  async function readToken(): Promise<string | null> {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.token || null;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  async function handleCleanup() {
    if (!confirm("Удалить все тестовые темы и публикации? Закреплённые темы останутся. Это действие необратимо.")) {
      return;
    }
    setCleanupLoading(true);
    setCleanupError("");
    setCleanupResult("");

    const token = await readToken();
    if (!token) {
      setCleanupError("Не найден token в localStorage. Залогинитесь как админ.");
      setCleanupLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/seed", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, mode: "cleanup-test" }),
      });
      const data = await res.json();
      setCleanupResult(JSON.stringify(data, null, 2));
      if (!res.ok) {
        setCleanupError(`HTTP ${res.status}`);
      }
    } catch (e: any) {
      setCleanupError("Сетевая ошибка: " + (e?.message ?? String(e)));
    } finally {
      setCleanupLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult("");

    const token = await readToken();
    if (!token) {
      setError("Не найден token в localStorage. Залогинитесь как админ на сайте и вернитесь.");
      setLoading(false);
      return;
    }

    // Парсим JSON.
    let payload: unknown;
    try {
      payload = JSON.parse(json);
    } catch (e: any) {
      setError("JSON невалиден: " + (e?.message ?? String(e)));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, payload }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
      }
    } catch (e: any) {
      setError("Сетевая ошибка: " + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: "20px auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Импорт темы на форум</h1>

      {/* BLOCK: Cleanup test data */}
      <div style={{ marginBottom: 24, padding: 16, background: "#fff5f5", border: "1px solid #c08080", borderRadius: 4 }}>
        <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 8, color: "#800" }}>Очистка тестовых данных</h2>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
          Удаляет все темы и публикации, кроме закреплённых (Правила, Быстрые подсказки).
          Пользователи и рубрики остаются. Действие необратимо.
        </p>
        <button
          onClick={handleCleanup}
          disabled={cleanupLoading}
          style={{
            padding: "10px 20px",
            background: cleanupLoading ? "#999" : "#c08080",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: cleanupLoading ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {cleanupLoading ? "Очищаю..." : "Очистить тестовые данные"}
        </button>
        {cleanupError && (
          <div style={{ marginTop: 12, padding: 8, background: "#fee", border: "1px solid #c00", borderRadius: 4, fontSize: 13 }}>
            <strong>Ошибка:</strong> {cleanupError}
          </div>
        )}
        {cleanupResult && (
          <pre style={{
            marginTop: 12,
            padding: 12,
            background: "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: 4,
            overflow: "auto",
            fontFamily: "ui-monospace, monospace",
            fontSize: 12,
          }}>
            {cleanupResult}
          </pre>
        )}
      </div>

      {/* BLOCK: Import topic via JSON */}
      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
          JSON (вставьте сформированный JSON):
        </label>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          style={{
            width: "100%",
            minHeight: 320,
            padding: 12,
            fontFamily: "ui-monospace, monospace",
            fontSize: 12,
            border: "1px solid #ccc",
            borderRadius: 4,
            resize: "vertical",
          }}
          spellCheck={false}
        />
        <div style={{ marginTop: 12 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 20px",
              background: loading ? "#999" : "#0a5caa",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {loading ? "Заливаю..." : "Залить тему"}
          </button>
        </div>
      </form>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: "#fee", border: "1px solid #c00", borderRadius: 4 }}>
          <strong>Ошибка:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16 }}>
          <strong>Результат:</strong>
          <pre
            style={{
              marginTop: 8,
              padding: 12,
              background: "#f5f5f5",
              border: "1px solid #ddd",
              borderRadius: 4,
              overflow: "auto",
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
            }}
          >
            {result}
          </pre>
        </div>
      )}

      <div style={{ marginTop: 24, padding: 12, background: "#f9f9f9", borderRadius: 4, fontSize: 13, color: "#666" }}>
        <p style={{ margin: "0 0 8px 0" }}>
          <strong>Как использовать:</strong>
        </p>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li>Залогиньтесь на сайте как админ (admin@sakhmatrix.ru).</li>
          <li>Откройте эту страницу: /admin/seed</li>
          <li>Вставьте сформированный JSON в поле выше.</li>
          <li>Нажмите «Залить тему».</li>
          <li>В результате получите topicId и количество сообщений.</li>
        </ol>
      </div>
    </div>
  );
}
