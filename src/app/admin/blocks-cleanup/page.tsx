"use client";

import { useState } from "react";

/**
 * /admin/blocks-cleanup — страница жёсткого удаления публикаций во всех спецразделах.
 *
 * 2026-11-02: удаляет ВСЕ публикации и ответы в самостоятельных спецразделах
 * (Объявления, Где купить, Где дешевле, Знакомства, О работодателях,
 *  Подслушано, Рекомендую, ЖКХ, Нужна помощь), включая связанные темы форума
 * и сообщения в них. Ботов и пользователей НЕ трогает.
 *
 * ВНИМАНИЕ: операция необратима — жёсткое DELETE, не soft-delete.
 *
 * Токен читается из localStorage["sm_auth"] (как на /admin/seed).
 */

const AUTH_KEY = "sm_auth";

interface DeletedCounts {
  topics: number;
  messages: number;
  messagesBefore: number;
  adListings: number;
  adMedia: number;
  adComplaints: number;
  wtbPosts: number;
  wtbAnswers: number;
  wtbComplaints: number;
  wtbHints: number;
  cheapPosts: number;
  cheapAnswers: number;
  cheapComplaints: number;
  cheapHints: number;
  datingPosts: number;
  datingPhotos: number;
  datingComplaints: number;
  empPosts: number;
  empVotes: number;
  empComplaints: number;
  overheardPosts: number;
  overheardComplaints: number;
  recPosts: number;
  recVotes: number;
  recComplaints: number;
  gkhProblems: number;
  gkhUpdates: number;
  gkhStatusLogs: number;
  gkhMedia: number;
  gkhComplaints: number;
  helpPublications: number;
  helpComplaints: number;
}

interface CleanupResult {
  ok: boolean;
  deleted: DeletedCounts;
  note?: string;
  error?: string;
}

const SECTION_LABELS: { key: keyof DeletedCounts; label: string }[] = [
  { key: "adListings", label: "Объявления" },
  { key: "wtbPosts", label: "Где купить" },
  { key: "cheapPosts", label: "Где дешевле" },
  { key: "datingPosts", label: "Знакомства" },
  { key: "empPosts", label: "О работодателях" },
  { key: "overheardPosts", label: "Подслушано" },
  { key: "recPosts", label: "Рекомендую / Не рекомендую" },
  { key: "gkhProblems", label: "ЖКХ проблемы" },
  { key: "helpPublications", label: "Нужна помощь" },
];

export default function AdminBlocksCleanupPage() {
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
      const res = await fetch("/api/admin/blocks/cleanup", {
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
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Очистка всех спецразделов</h1>

      <div
        style={{
          padding: 16,
          background: "#fff0f0",
          border: "2px solid #c00",
          borderRadius: 6,
          marginBottom: 16,
        }}
      >
        <p style={{ margin: "0 0 8px 0", fontWeight: 700, color: "#c00" }}>⚠️ ОПАСНАЯ И НЕОБРАТИМАЯ ОПЕРАЦИЯ</p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
          Будут <strong>жёстко удалены (DELETE FROM БД, без возможности отката)</strong> все
          публикации, ответы, жалобы, фото и связанные темы форума с сообщениями в разделах:
        </p>
        <ul style={{ margin: "8px 0 0 0", paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
          <li>Объявления /obyavleniya</li>
          <li>Где купить /gde-kupit</li>
          <li>Где дешевле /gde-deshevle</li>
          <li>Знакомства /znakomstva</li>
          <li>О работодателях /o-rabotodatelyah</li>
          <li>Подслушано /podslyshano</li>
          <li>Рекомендую /rekomenduyu</li>
          <li>ЖКХ /gkh</li>
          <li>Нужна помощь /help</li>
        </ul>
        <p style={{ margin: "12px 0 0 0", fontSize: 14, lineHeight: 1.5 }}>
          <strong>Не трогаются:</strong> пользователи и боты, обычные темы форума,
          закреплённые темы форума, курсы валют, рубрики.
        </p>
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
        {loading ? "Удаляю..." : "Удалить все публикации в спецразделах"}
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
            <li>Удалено тем форума: <strong>{result.deleted.topics}</strong></li>
            <li>Удалено сообщений форума: <strong>{result.deleted.messages}</strong></li>
          </ul>
          <p style={{ margin: "12px 0 4px 0", fontSize: 14, fontWeight: 600 }}>Публикаций в разделах:</p>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
            {SECTION_LABELS.map(({ key, label }) => (
              <li key={key}>{label}: <strong>{result.deleted[key]}</strong></li>
            ))}
          </ul>
          <p style={{ margin: "12px 0 0 0", fontSize: 13, color: "#666" }}>
            Жалобы, ответы, фото, медиа — удалены каскадом.
          </p>
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
            <p style={{ margin: "0 0 16px 0", fontWeight: 700, fontSize: 16, color: "#c00" }}>
              ⚠️ Операция необратима!
            </p>
            <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "#666" }}>
              Будут жёстко удалены все публикации, ответы, жалобы и связанные темы форума
              во всех 9 спецразделах. Восстановить данные будет невозможно.
              Ботов и пользователей не тронет.
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
                Да, удалить навсегда
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
          <li>Откройте эту страницу: /admin/blocks-cleanup</li>
          <li>Нажмите «Удалить все публикации в спецразделах».</li>
          <li>Подтвердите в модальном окне.</li>
          <li>В результате увидите количество удалённых тем, сообщений и публикаций.</li>
        </ol>
      </div>
    </div>
  );
}
