"use client";

import { useRef, useState } from "react";

interface Props {
  token: string | null;
  /** Колбэк после загрузки файла — получает URL, alt, kind */
  onUploaded: (url: string, alt: string, kind: "image" | "video") => void;
  notify?: (msg: string) => void;
}

/**
 * UploadMediaButton — загрузка фото ИЛИ видео в сообщение.
 * 2026-11-12: расширение UploadPhotoButton для поддержки видео.
 *
 * По клику открывается выбор файла (image/* или video/mp4, video/webm),
 * после загрузки URL + kind передаётся через колбэк onUploaded.
 *
 * Используется в:
 *  - Домовых чатах (TOPIC VIEW + FREE CHAT VIEW) — для сообщений
 *  - Может использоваться в форуме (как замена UploadPhotoButton)
 */
export function UploadMediaButton({ token, onUploaded, notify }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleClick = () => {
    if (!token) {
      notify?.("Чтобы загрузить фото или видео — войдите в аккаунт.");
      return;
    }
    if (busy) return;
    inputRef.current?.click();
  };

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
        notify?.(data.error || "Не удалось загрузить файл.");
        return;
      }
      const kind: "image" | "video" = data.kind === "video" ? "video" : "image";
      const alt = file.name.replace(/\.[^.]+$/, "").slice(0, 50) || (kind === "video" ? "видео" : "фото");
      onUploaded(data.url, alt, kind);
      notify?.(kind === "video" ? "Видео загружено." : "Фото загружено.");
    } catch {
      notify?.("Сеть недоступна — попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        title="Добавить фото или видео"
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
        }}
      >
        {busy ? "Загрузка…" : "📎 Фото/видео"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
        onChange={handleFile}
        style={{ display: "none" }}
      />
    </>
  );
}
