"use client";

import { useRef, useState } from "react";

interface Props {
  token: string | null;
  /** Колбэк после загрузки фото — получает URL загруженного файла */
  onUploaded: (url: string, alt: string) => void;
  notify?: (msg: string) => void;
}

/**
 * Кнопка «📷 Фото» — простая загрузка изображения в сообщение.
 * Использует <label> + <input type=file> (нативный способ, работает на всех
 * мобильных браузерах, в отличие от input.click() из JS).
 */
export function UploadPhotoButton({ token, onUploaded, notify }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !token) return;

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await fetch(`/api/upload?token=${encodeURIComponent(token)}`, {
        method: "POST",
        body: formData,
      });
      const data = await r.json();
      if (!r.ok) {
        notify?.(data.error || "Не удалось загрузить фото.");
        return;
      }
      const alt = file.name.replace(/\.[^.]+$/, "").slice(0, 50) || "фото";
      onUploaded(data.url, alt);
      notify?.("Фото загружено.");
    } catch {
      notify?.("Сеть недоступна — попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <label
      style={{
        background: "transparent",
        border: "1px solid #cbd5e1",
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 13,
        cursor: busy ? "wait" : "pointer",
        opacity: busy ? 0.6 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color: "#1E3A5F",
        fontWeight: 600,
        userSelect: "none",
      }}
    >
      {busy ? "Загрузка…" : "📷 Фото"}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFile}
        disabled={busy || !token}
        style={{ display: "none" }}
      />
    </label>
  );
}
