"use client";

import { markdownToPhotos, stripPhotoMarkdown } from "@/components/forum/photo-preview";
import { TwemojiText } from "@/components/forum/twemoji-text";

interface Props {
  text: string;
  /** Максимальная ширина фото (px). По умолчанию 100% контейнера. */
  maxWidth?: number;
  /** Колбэк при клике на фото (для открытия в lightbox). */
  onImageClick?: (url: string, alt: string) => void;
}

/**
 * TextWithPhotos — рендерит текст с встроенными markdown-фото.
 *
 * Парсит markdown-синтаксис ![alt](url) из текста, разделяет на:
 *   - обычный текст (показывается как <p>)
 *   - фото (показываются как <img> галерея под текстом)
 *
 * Используется во всех спецразделах (Рекомендую, Где купить, ЖКХ и т.д.),
 * чтобы фотографии загруженные через /api/upload отображались в публикациях.
 *
 * Создан 2026-11-03.
 */
export function TextWithPhotos({ text, maxWidth, onImageClick }: Props) {
  const photos = markdownToPhotos(text);
  const textWithoutPhotos = stripPhotoMarkdown(text);

  return (
    <>
      {textWithoutPhotos && (
        <p className="rc-qtext" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          <TwemojiText text={textWithoutPhotos} size={20} />
        </p>
      )}
      {photos.length > 0 && (
        <div
          className="text-photos-gallery"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 8,
          }}
        >
          {photos.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={img.url}
              alt={img.alt}
              onClick={() => onImageClick?.(img.url, img.alt)}
              style={{
                maxWidth: maxWidth ?? 220,
                maxHeight: 220,
                width: "auto",
                height: "auto",
                objectFit: "cover",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                cursor: onImageClick ? "pointer" : "default",
                display: "block",
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
