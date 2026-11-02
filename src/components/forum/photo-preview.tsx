"use client";

interface PhotoItem {
  url: string;
  alt: string;
}

interface Props {
  photos: PhotoItem[];
  onRemove: (url: string) => void;
}

/**
 * Превью загруженных фото над textarea.
 * Показывает миниатюры из массива photos (не парсит markdown).
 * Кнопка × удаляет фото из списка.
 */
export function PhotoPreview({ photos, onRemove }: Props) {
  if (photos.length === 0) return null;

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
      {photos.map((img) => (
        <div key={img.url} style={{
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

/** Собрать markdown-строку из массива фото (для вставки в тело сообщения перед отправкой) */
export function photosToMarkdown(photos: PhotoItem[]): string {
  if (photos.length === 0) return "";
  return photos.map((p) => `![${p.alt}](${p.url})`).join("\n");
}

/** Распарсить markdown-фото из текста (для инициализации при редактировании) */
export function markdownToPhotos(text: string): PhotoItem[] {
  const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const result: PhotoItem[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    result.push({ alt: m[1] || "фото", url: m[2] });
  }
  return result;
}

/** Убрать markdown-фото из текста (оставить только обычный текст) */
export function stripPhotoMarkdown(text: string): string {
  return text.replace(/!\[[^\]]*\]\([^)]+\)\n?/g, "").trim();
}
