"use client";

import { useRef, useState } from "react";

interface Props {
  token: string | null;
  onUploaded: (markdownUrl: string) => void;
  notify?: (msg: string) => void;
}

/**
 * Кнопка «📷 Фото» — простая загрузка изображения в сообщение.
 * По клику открывается выбор файла, после загрузки URL вставляется
 * в textarea через колбэк onUploaded.
 *
 * Используется в:
 *  - Модалке «Новая тема»
 *  - Быстром ответе в теме
 *  - Редактировании сообщения
 */
export function UploadPhotoButton({ token, onUploaded, notify }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleClick = () => {
    if (!token) {
      notify?.("Чтобы загрузить фото — войдите в аккаунт.");
      return;
    }
    if (busy) return;
    inputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Сбросить input чтобы можно было выбрать тот же файл снова
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
      // Вставляем markdown в textarea
      const alt = file.name.replace(/\.[^.]+$/, "").slice(0, 50) || "фото";
      onUploaded(`![${alt}](${data.url})`);
      notify?.("Фото загружено.");
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
        title="Добавить фото"
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
        {busy ? "Загрузка…" : "📷 Фото"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFile}
        style={{ display: "none" }}
      />
    </>
  );
}
