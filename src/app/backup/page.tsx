import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Скачать резервную копию SakhMatrix",
};

export default function BackupPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0F1B2D", color: "#FFFFFF", fontFamily: "system-ui, -apple-system, sans-serif", padding: "32px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px", color: "#FFFFFF" }}>
          Резервная копия проекта SakhMatrix
        </h1>
        <p style={{ fontSize: 14, color: "#9FB3C8", margin: "0 0 24px" }}>
          Снимок от 24.09.2026 · все правки «Где купить» / «Где дешевле» и 6 разделов включены
        </p>

        <a
          href="/sakhmatrix-backup.zip"
          download
          style={{
            display: "block",
            width: "100%",
            boxSizing: "border-box",
            background: "#0a5caa",
            color: "#FFFFFF",
            textAlign: "center",
            textDecoration: "none",
            fontSize: 18,
            fontWeight: 700,
            padding: "18px 24px",
            border: "1px solid #4A688C",
            marginBottom: 8,
          }}
        >
          ⬇ Скачать ZIP целиком (11 МБ)
        </a>
        <p style={{ fontSize: 12, color: "#6B8299", margin: "0 0 28px" }}>
          Если ничего не скачалось — нажмите кнопку ещё раз или используйте части ниже.
        </p>

        <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 12px", color: "#FFFFFF" }}>
          Вариант 2: скачать по частям (3 × 4 МБ)
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {["00", "01", "02"].map((n) => (
            <a
              key={n}
              href={`/sakhmatrix-backup.zip.part-${n}`}
              download
              style={{
                display: "block",
                background: "#1E3A5F",
                color: "#FFFFFF",
                textDecoration: "none",
                fontSize: 14,
                padding: "12px 16px",
                border: "1px solid #4A688C",
              }}
            >
              ⬇ Часть {Number(n) + 1} из 3 — sakhmatrix-backup.zip.part-{n}
            </a>
          ))}
        </div>

        <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 12px", color: "#FFFFFF" }}>
          Как собрать части в один ZIP
        </h2>
        <div style={{ background: "#16283F", border: "1px solid #4A688C", padding: 16, marginBottom: 28 }}>
          <p style={{ fontSize: 13, color: "#9FB3C8", margin: "0 0 6px" }}>Windows (cmd, в папке с частями):</p>
          <code style={{ fontSize: 13, color: "#7FD1A8", display: "block", marginBottom: 14, wordBreak: "break-all" }}>
            copy /b sakhmatrix-backup.zip.part-00+sakhmatrix-backup.zip.part-01+sakhmatrix-backup.zip.part-02 sakhmatrix-backup.zip
          </code>
          <p style={{ fontSize: 13, color: "#9FB3C8", margin: "0 0 6px" }}>macOS / Linux:</p>
          <code style={{ fontSize: 13, color: "#7FD1A8", display: "block", wordBreak: "break-all" }}>
            cat sakhmatrix-backup.zip.part-* &gt; sakhmatrix-backup.zip
          </code>
        </div>

        <div style={{ borderTop: "1px solid #4A688C", paddingTop: 16 }}>
          <p style={{ fontSize: 12, color: "#6B8299", margin: 0 }}>
            Проверка целостности — MD5: <span style={{ color: "#9FB3C8" }}>665da78524b4379ee1b51dd333f3b170</span>
            <br />
            Внутри архива: NEW_SESSION_MESSAGE.txt — готовое первое сообщение для новой сессии.
          </p>
        </div>
      </div>
    </div>
  );
}
