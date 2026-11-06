"use client";

import { useState } from "react";

/**
 * /admin/db-restore — аварийная страница восстановления БД.
 *
 * 2026-11-02: если Prisma падает с "Unable to open the database file",
 * эта страница позволяет:
 *   1. Запустить диагностику (GET /api/admin/db/restore) — без авторизации.
 *   2. Восстановить БД из снапшота (POST с action=restore).
 *
 * Авторизация работает двумя способами:
 *   - Если БД жива — токен из localStorage["sm_auth"] проверяется через БД.
 *   - Если БД мертва — нужно ввести emergency-токен из .env (DB_RESTORE_TOKEN).
 */

const AUTH_KEY = "sm_auth";

interface Diagnose {
  timestamp: string;
  cwd: string;
  databaseUrlEnv: string | null;
  dbFile: string | null;
  dbFileExists: boolean;
  dbDir: string | null;
  snapshot: string | null;
  snapshotExists: boolean;
  sqlite3Available: boolean;
  sqliteCheck: { ok: boolean; error?: string } | null;
  dbFileSize?: number;
  dbFileMode?: string;
  dbFileOwner?: number;
}

interface RestoreResult {
  ok: boolean;
  authMethod?: string;
  restoredFrom?: string;
  target?: string;
  backupCreated?: string;
  sqliteCheck?: { ok: boolean; error?: string };
  note?: string;
  error?: string;
  diagnose?: Diagnose;
}

export default function AdminDbRestorePage() {
  const [token, setToken] = useState("");
  const [diagnose, setDiagnose] = useState<Diagnose | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [loading, setLoading] = useState<"diagnose" | "restore" | null>(null);
  const [error, setError] = useState("");

  // При загрузке страницы — пробуем прочитать токен из localStorage.
  useState(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.token) setToken(parsed.token);
      }
    } catch {
      /* ignore */
    }
  });

  async function doDiagnose() {
    setLoading("diagnose");
    setError("");
    setDiagnose(null);
    try {
      const res = await fetch("/api/admin/db/restore");
      const data = await res.json();
      setDiagnose(data.diagnose);
    } catch (e: any) {
      setError("Сетевая ошибка: " + (e?.message ?? String(e)));
    } finally {
      setLoading(null);
    }
  }

  async function doRestore() {
    if (!token) {
      setError("Нужен token. Если БД недоступна — введите emergency-токен из .env (DB_RESTORE_TOKEN).");
      return;
    }
    if (!confirm("Точно восстановить БД из снапшота? Текущая БД будет сохранена как .broken-*.")) {
      return;
    }
    setLoading("restore");
    setError("");
    setRestoreResult(null);
    try {
      const res = await fetch("/api/admin/db/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "restore" }),
      });
      const data = await res.json();
      setRestoreResult(data);
      if (!res.ok) setError(data.error || `HTTP ${res.status}`);
    } catch (e: any) {
      setError("Сетевая ошибка: " + (e?.message ?? String(e)));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "20px auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Восстановление БД</h1>

      <div style={{ padding: 16, background: "#fff8e1", border: "2px solid #ffb300", borderRadius: 6, marginBottom: 16 }}>
        <p style={{ margin: "0 0 8px 0", fontWeight: 700, color: "#b8860b" }}>⚠️ Аварийная страница</p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
          Эта страница работает даже если БД повреждена и Prisma падает с «Unable to open the database file».
          Можно запустить диагностику (без авторизации) или восстановить БД из снапшота.
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={doDiagnose}
          disabled={loading !== null}
          style={{
            padding: "10px 20px",
            background: loading === "diagnose" ? "#999" : "#0a5caa",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: loading !== null ? "not-allowed" : "pointer",
            fontWeight: 600,
            marginRight: 12,
          }}
        >
          {loading === "diagnose" ? "Проверяю..." : "1. Запустить диагностику"}
        </button>
        <span style={{ fontSize: 13, color: "#666" }}>без авторизации — просто проверить, что не так</span>
      </div>

      {diagnose && (
        <div style={{ padding: 12, background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 4, marginBottom: 16, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(diagnose, null, 2)}</pre>
        </div>
      )}

      <hr style={{ margin: "24px 0", border: "none", borderTop: "1px solid #ddd" }} />

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>2. Восстановить из снапшота</h2>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
          Токен администратора:
        </label>
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="обычный админский токен ИЛИ emergency-токен из .env"
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #ccc",
            borderRadius: 4,
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
          }}
        />
        <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "#666" }}>
          Если БД жива — подойдёт ваш обычный токен из localStorage. Если БД повреждена —
          добавьте в <code>.env</code> переменную <code>DB_RESTORE_TOKEN=ваш_секрет</code> и используйте её как токен.
        </p>
      </div>

      <button
        type="button"
        onClick={doRestore}
        disabled={loading !== null || !token}
        style={{
          padding: "12px 24px",
          background: loading === "restore" ? "#999" : "#c08080",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: loading !== null || !token ? "not-allowed" : "pointer",
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        {loading === "restore" ? "Восстанавливаю..." : "Восстановить БД из снапшота"}
      </button>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: "#fee", border: "1px solid #c00", borderRadius: 4 }}>
          <strong>Ошибка:</strong> {error}
        </div>
      )}

      {restoreResult && (
        <div style={{
          marginTop: 16,
          padding: 16,
          background: restoreResult.ok ? "#e8f5e9" : "#fee",
          border: `1px solid ${restoreResult.ok ? "#4caf50" : "#c00"}`,
          borderRadius: 4,
        }}>
          <strong>{restoreResult.ok ? "✓ Готово" : "Ошибка"}</strong>
          {restoreResult.authMethod && (
            <p style={{ margin: "8px 0 0 0", fontSize: 13 }}>
              Авторизация: <code>{restoreResult.authMethod}</code>
            </p>
          )}
          {restoreResult.restoredFrom && (
            <p style={{ margin: "8px 0 0 0", fontSize: 13 }}>
              Восстановлено из: <code>{restoreResult.restoredFrom}</code><br />
              Целевой файл: <code>{restoreResult.target}</code><br />
              Бэкап старой БД: <code>{restoreResult.backupCreated}</code>
            </p>
          )}
          {restoreResult.note && (
            <p style={{ margin: "8px 0 0 0", fontSize: 14, fontWeight: 600 }}>
              {restoreResult.note}
            </p>
          )}
        </div>
      )}

      <div style={{ marginTop: 24, padding: 12, background: "#f9f9f9", borderRadius: 4, fontSize: 13, color: "#666" }}>
        <p style={{ margin: "0 0 8px 0", fontWeight: 600 }}>Как восстановить вручную (через SSH):</p>
        <pre style={{ margin: 0, padding: 8, background: "#fff", border: "1px solid #ddd", borderRadius: 4, fontSize: 12, overflow: "auto" }}>
{`cd /path/to/SMatrix         # директория проекта
ls -la db/custom.db*         # проверить, что есть
mv db/custom.db db/custom.db.broken-$(date +%s)  # переименовать старую
cp db/custom.db.snapshot-* db/custom.db          # восстановить из снапшота
chmod 644 db/custom.db        # права
# удалить WAL/journal если есть:
rm -f db/custom.db-wal db/custom.db-journal db/custom.db-shm
# перезапустить процесс:
pm2 restart smatrix  # или systemctl restart smatrix`}
        </pre>
      </div>
    </div>
  );
}
