"use client";

import { useMemo } from "react";

interface Props {
  text: string;
  onRemove: (url: string) => void;
}

/**
 * Превью загруженных фото над textarea.
 * Парсит markdown ![alt](url) из текста и показывает миниатюры.
 * Кнопка × удаляет фото (и markdown) из текста.
 */
export function PhotoPreview({ text, onRemove }: Props) {
  const images = useMemo(() => {
    const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const result: { alt: string; url: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      result.push({ alt: m[1] || "фото", url: m[2] });
    }
    return result;
  }, [text]);

  if (images.length === 0) return null;

  return (
    <div style={{
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      marginBottom: 8,
      padding: 6,
      background: "#f8fafc",
      borderRadius: 6,
      border: "1px solid #e2e8f0",
    }}>
      {images.map((img, i) => (
        <div key={i} style={{
          position: "relative",
          width: 72,
          height: 72,
          borderRadius: 6,
          overflow: "hidden",
          border: "1px solid #cbd5e1",
          background: "#fff",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt={img.alt}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <button
            type="button"
            onClick={() => onRemove(img.url)}
            title="Удалить фото"
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              width: 20,
              height: 20,
              borderRadius: "50%",
              border: "none",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              fontSize: 13,
              lineHeight: "20px",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
