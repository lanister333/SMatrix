"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #c8d8e8",
  borderRadius: 4,
  fontSize: 15,
  boxSizing: "border-box",
};

/**
 * 2026-11-07: страница смены пароля /reset?token=...
 * Пользователь открывает ссылку из письма восстановления пароля,
 * вводит новый пароль (2 раза для подтверждения) — API меняет пароль
 * и автоматически логинит пользователя.
 *
 * Suspense-обёртка нужна, потому что useSearchParams() в Next.js 16
 * требует её при static rendering.
 */
function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== password2) {
      setError("Пароли не совпадают");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, password2 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось сменить пароль");
        setLoading(false);
        return;
      }
      if (data.user?.token) {
        // 2026-11-08: cookie + localStorage (как в /login) — иначе шапка сайта
        // не видит залогиненного пользователя после смены пароля.
        document.cookie = `session=${data.user.token}; path=/; max-age=${30 * 24 * 60 * 60}; samesite=lax`;
        try {
          localStorage.setItem("sm_auth", JSON.stringify({ token: data.user.token, user: data.user }));
        } catch {}
      }
      router.push("/");
    } catch {
      setError("Сеть недоступна");
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ color: "#1E3A5F", fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
          Ссылка недействительна
        </h2>
        <p style={{ fontSize: 14, color: "#56657a", marginBottom: 16 }}>
          В ссылке отсутствует токен для сброса пароля.
        </p>
        <Link href="/recover" style={{ color: "#1E3A5F", fontWeight: 600 }}>
          Запросить восстановление снова
        </Link>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div style={{ background: "#fee", border: "1px solid #fcc", borderRadius: 4, padding: "10px 14px", color: "#c33", fontSize: 14, marginBottom: 16 }}>
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#33415a", marginBottom: 4 }}>Новый пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoFocus
            style={inputStyle}
          />
          <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Минимум 8 символов, буквы и цифры</p>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#33415a", marginBottom: 4 }}>Повторите пароль</label>
          <input
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            required
            style={inputStyle}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px",
            background: loading ? "#8a97a3" : "#1E3A5F",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            fontSize: 16,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            marginTop: 4,
          }}
        >
          {loading ? "Сохраняем..." : "Сменить пароль и войти"}
        </button>
      </form>
    </>
  );
}

export default function ResetPage() {
  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: "0 16px" }}>
      <div style={{ background: "#fff", border: "1px solid #d6e4f0", borderRadius: 8, padding: 24 }}>
        <h1 style={{ color: "#1E3A5F", fontSize: 22, fontWeight: 700, textAlign: "center", marginBottom: 20 }}>
          Новый пароль
        </h1>
        <Suspense fallback={<div style={{ textAlign: "center", color: "#888", padding: 20 }}>Загрузка...</div>}>
          <ResetForm />
        </Suspense>
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#56657a" }}>
          Вспомнили пароль?{" "}
          <Link href="/login" style={{ color: "#1E3A5F", fontWeight: 600 }}>
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
