import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ответ представителя — ЖКХ — SakhMatrix",
  description: "Как стать представителем организации и дать официальный ответ на проблему ЖКХ.",
};

export default function GkhOrgResponsePage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 60px" }}>
      <div style={{ marginBottom: 16 }}>
        <a href="/gkh" style={{ color: "#0a5caa", fontSize: 14 }}>← Назад к проблемам</a>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1E3A5F", marginBottom: 20 }}>🏢 Ответ представителя</h1>

      <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1E3A5F", margin: "20px 0 8px" }}>Как стать представителем:</h2>
      <ol style={{ paddingLeft: 22, lineHeight: 1.8, fontSize: 15 }}>
        <li>Зарегистрируйтесь на сайте (если ещё нет аккаунта).</li>
        <li>Обратитесь к администрации — напишите на почту или через форму связи с просьбой подтвердить статус представителя вашей организации (УК, ТСЖ, администрация).</li>
        <li>Администратор назначит вам статус и укажет название организации.</li>
        <li>После подтверждения — под каждой проблемой появится кнопка «🏢 Ответ организации».</li>
        <li>Нажмите кнопку, введите текст официального ответа — он появится под проблемой.</li>
      </ol>

      <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1E3A5F", margin: "24px 0 8px" }}>Кто может ответить</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: "#333" }}>
        Только подтверждённый представитель организации. Обычный пользователь не может присвоить себе этот статус.
      </p>

      <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1E3A5F", margin: "24px 0 8px" }}>Сколько ответов</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: "#333" }}>
        Ровно один официальный ответ на каждую проблему. После ответа кнопка исчезает — публичная переписка не ведётся.
      </p>

      <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1E3A5F", margin: "24px 0 8px" }}>Что писать</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: "#333" }}>
        Официальная позиция организации, пояснение обстоятельств, ход работ, план решения. Без эмоций и обвинений — только факты.
      </p>

      <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1E3A5F", margin: "24px 0 8px" }}>Ответ НЕ меняет статус</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: "#333" }}>
        Ответ организации — это позиция, а не приговор. Статус «Решено» ставит только автор проблемы.
      </p>

      <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1E3A5F", margin: "24px 0 8px" }}>Разногласия сторон</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: "#333" }}>
        Разногласия сторон не являются основанием для удаления ответа или проблемы. SakhMatrix не принимает чью-либо сторону.
      </p>

      <div style={{ marginTop: 30, padding: 16, background: "#f0f4f8", borderRadius: 8, fontSize: 14, color: "#475569" }}>
        <a href="/gkh" style={{ color: "#0a5caa", fontWeight: 600 }}>← Вернуться к проблемам</a>
      </div>
    </div>
  );
}
