"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, password2, nickname, gender, captchaId: "", captchaAnswer: "" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Ошибка регистрации"); setLoading(false); return; }
      setSuccess(true);
    } catch { setError("Сеть недоступна"); } finally { setLoading(false); }
  }

  if (success) {
    return (
      <div style={{ maxWidth: 420, margin: "40px auto", padding: "0 16px" }}>
        <div style={{ background: "#fff", border: "1px solid #d6e4f0", borderRadius: 8, padding: 32, textAlign: "center" }}>
          <h2 style={{ color: "#1E3A5F", marginBottom: 16 }}>✓ Регистрация завершена</h2>
          <p style={{ color: "#33415a", fontSize: 15, lineHeight: 1.5 }}>
            Мы отправили письмо с подтверждением на <b>{email}</b>.<br />
            Откройте письмо и нажмите «Подтвердить email».
          </p>
          <p style={{ color: "#8a97a3", fontSize: 13, marginTop: 16 }}>Ссылка действительна 1 час.</p>
          <Link href="/login" style={{ display: "inline-block", marginTop: 20, padding: "10px 24px", background: "#1E3A5F", color: "#fff", textDecoration: "none", borderRadius: 6, fontWeight: 600, fontSize: 14 }}>На страницу входа</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: "0 16px" }}>
      <div style={{ background: "#fff", border: "1px solid #d6e4f0", borderRadius: 8, padding: 24 }}>
        <h1 style={{ color: "#1E3A5F", fontSize: 22, fontWeight: 700, textAlign: "center", marginBottom: 20 }}>Регистрация</h1>
        {error && <div style={{ background: "#fee", border: "1px solid #fcc", borderRadius: 4, padding: "10px 14px", color: "#c33", fontSize: 14, marginBottom: 16 }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#33415a", marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="example@mail.ru" style={{ width: "100%", padding: "10px 12px", border: "1px solid #c8d8e8", borderRadius: 4, fontSize: 15, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#33415a", marginBottom: 4 }}>Никнейм</label>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} required minLength={3} maxLength={20} placeholder="3-20 символов" style={{ width: "100%", padding: "10px 12px", border: "1px solid #c8d8e8", borderRadius: 4, fontSize: 15, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#33415a", marginBottom: 4 }}>Пароль</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="минимум 6 символов" style={{ width: "100%", padding: "10px 12px", border: "1px solid #c8d8e8", borderRadius: 4, fontSize: 15, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#33415a", marginBottom: 4 }}>Повторите пароль</label>
            <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required minLength={6} style={{ width: "100%", padding: "10px 12px", border: "1px solid #c8d8e8", borderRadius: 4, fontSize: 15, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#33415a", marginBottom: 4 }}>Пол</label>
            <select value={gender} onChange={(e) => setGender(e.target.value as "male" | "female")} style={{ width: "100%", padding: "10px 12px", border: "1px solid #c8d8e8", borderRadius: 4, fontSize: 15, boxSizing: "border-box", background: "#fff" }}>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
            </select>
          </div>
          <button type="submit" disabled={loading} style={{ padding: "12px", background: loading ? "#8a97a3" : "#1E3A5F", color: "#fff", border: "none", borderRadius: 4, fontSize: 16, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", marginTop: 4 }}>
            {loading ? "Регистрация..." : "Зарегистрироваться"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 14, color: "#56657a" }}>Уже есть аккаунт? <Link href="/login" style={{ color: "#1E3A5F", fontWeight: 600 }}>Войти</Link></p>
      </div>
    </div>
  );
}
