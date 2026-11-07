"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid #c8d8e8", borderRadius: 4, fontSize: 15, boxSizing: "border-box" };
export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Ошибка входа"); setLoading(false); return; }
      if (data.user?.token) document.cookie = `session=${data.user.token}; path=/; max-age=${30*24*60*60}; samesite=lax`;
      router.push("/");
    } catch { setError("Сеть недоступна"); } finally { setLoading(false); }
  }
  return (<div style={{ maxWidth: 420, margin: "40px auto", padding: "0 16px" }}><div style={{ background: "#fff", border: "1px solid #d6e4f0", borderRadius: 8, padding: 24 }}><h1 style={{ color: "#1E3A5F", fontSize: 22, fontWeight: 700, textAlign: "center", marginBottom: 20 }}>Вход</h1>{error && <div style={{ background: "#fee", border: "1px solid #fcc", borderRadius: 4, padding: "10px 14px", color: "#c33", fontSize: 14, marginBottom: 16 }}>{error}</div>}<form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}><div><label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#33415a", marginBottom: 4 }}>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="example@mail.ru" style={inputStyle} /></div><div><label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#33415a", marginBottom: 4 }}>Пароль</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} /></div><button type="submit" disabled={loading} style={{ padding: "12px", background: loading ? "#8a97a3" : "#1E3A5F", color: "#fff", border: "none", borderRadius: 4, fontSize: 16, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", marginTop: 4 }}>{loading ? "Вход..." : "Войти"}</button></form><p style={{ textAlign: "center", marginTop: 16, fontSize: 14, color: "#56657a" }}>Нет аккаунта? <Link href="/register" style={{ color: "#1E3A5F", fontWeight: 600 }}>Зарегистрироваться</Link></p><p style={{ textAlign: "center", marginTop: 8, fontSize: 14, color: "#56657a" }}><Link href="/recover" style={{ color: "#1E3A5F", fontWeight: 500 }}>Забыли пароль?</Link></p></div></div>);
}
