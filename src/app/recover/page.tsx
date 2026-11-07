"use client";
import { useState } from "react";
import Link from "next/link";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #c8d8e8",
  borderRadius: 4,
  fontSize: 15,
  boxSizing: "border-box",
};

/**
 * 2026-11-07: страница восстановления пароля /recover.
 * Двухшаговый flow с проверкой секретного вопроса:
 *   Шаг 1: вводишь email → API возвращает secretQuestion пользователя
 *   Шаг 2: вводишь ответ на секретный вопрос → если верно, на email
 *          приходит ссылка /reset?token=... для смены пароля
 */
export default function RecoverPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [secretQuestion, setSecretQuestion] = useState("");
  const [secretAnswer, setSecretAnswer] = useState("");

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Пользователь не найден");
        setLoading(false);
        return;
      }
      setSecretQuestion(data.secretQuestion || "");
      setStep(2);
    } catch {
      setError("Сеть недоступна");
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, secretAnswer }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Неверный ответ");
        setLoading(false);
        return;
      }
      setStep(3);
    } catch {
      setError("Сеть недоступна");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: "0 16px" }}>
      <div style={{ background: "#fff", border: "1px solid #d6e4f0", borderRadius: 8, padding: 24 }}>
        <h1 style={{ color: "#1E3A5F", fontSize: 22, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>
          Восстановление пароля
        </h1>

        {step === 1 && (
          <>
            <p style={{ fontSize: 14, color: "#56657a", textAlign: "center", marginBottom: 20 }}>
              Введите ваш email — мы покажем ваш секретный вопрос
            </p>
            {error && (
              <div style={{ background: "#fee", border: "1px solid #fcc", borderRadius: 4, padding: "10px 14px", color: "#c33", fontSize: 14, marginBottom: 16 }}>
                {error}
              </div>
            )}
            <form onSubmit={submitEmail} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#33415a", marginBottom: 4 }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="example@mail.ru"
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
                }}
              >
                {loading ? "Проверяем..." : "Далее"}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <p style={{ fontSize: 14, color: "#56657a", textAlign: "center", marginBottom: 20 }}>
              Ответьте на свой секретный вопрос
            </p>
            {error && (
              <div style={{ background: "#fee", border: "1px solid #fcc", borderRadius: 4, padding: "10px 14px", color: "#c33", fontSize: 14, marginBottom: 16 }}>
                {error}
              </div>
            )}
            <form onSubmit={submitAnswer} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#33415a", marginBottom: 4 }}>
                  Секретный вопрос
                </label>
                <div style={{ padding: "10px 12px", background: "#f0f5fa", border: "1px solid #d6e4f0", borderRadius: 4, fontSize: 15, color: "#1E3A5F", fontWeight: 500 }}>
                  {secretQuestion}
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#33415a", marginBottom: 4 }}>Ответ</label>
                <input
                  type="text"
                  value={secretAnswer}
                  onChange={(e) => setSecretAnswer(e.target.value)}
                  required
                  autoFocus
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
                }}
              >
                {loading ? "Проверяем ответ..." : "Сбросить пароль"}
              </button>
            </form>
          </>
        )}

        {step === 3 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
            <h2 style={{ color: "#1E3A5F", fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
              Письмо отправлено
            </h2>
            <p style={{ fontSize: 14, color: "#56657a", lineHeight: 1.6 }}>
              Мы отправили на <b>{email}</b> ссылку для сброса пароля.
              <br />
              Открой письмо и нажми кнопку «Сбросить пароль».
            </p>
            <p style={{ fontSize: 13, color: "#999", marginTop: 16 }}>
              Ссылка действительна 1 час. Не забудь проверить папку «Спам».
            </p>
          </div>
        )}

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
