"use client";

import { markdownToPhotos, markdownToMedia, stripPhotoMarkdown } from "@/components/forum/photo-preview";
import { TwemojiText } from "@/components/forum/twemoji-text";

interface Props {
  text: string;
  /** Максимальная ширина фото (px). По умолчанию 100% контейнера. */
  maxWidth?: number;
  /** Колбэк при клике на фото (для открытия в lightbox). */
  onImageClick?: (url: string, alt: string) => void;
}

/**
 * TextWithPhotos — рендерит текст с встроенными markdown-фото и видео.
 *
 * Парсит markdown-синтаксис ![alt](url) из текста, разделяет на:
 *   - обычный текст (показывается как <p>)
 *   - медиа (фото как <img>, видео как <video>) галерея под текстом
 *
 * 2026-11-12: добавлена поддержка видео (mp4, webm) — определяется
 * по расширению URL. Видео показывается через <video controls>.
 *
 * Используется во всех спецразделах (Рекомендую, Где купить, ЖКХ и т.д.)
 * и в домовых чатах.
 */
export function TextWithPhotos({ text, maxWidth, onImageClick }: Props) {
  const media = markdownToMedia(text);
  const textWithoutPhotos = stripPhotoMarkdown(text);

  return (
    <>
      {textWithoutPhotos && (
        <p className="rc-qtext" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          <TwemojiText text={textWithoutPhotos} size={20} />
        </p>
      )}
      {media.length > 0 && (
        <div
          className="text-photos-gallery"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 8,
          }}
        >
          {media.map((item, i) =>
            item.kind === "video" ? (
              <video
                key={i}
                src={item.url}
                controls
                style={{
                  maxWidth: maxWidth ?? 320,
                  maxHeight: 320,
                  width: "100%",
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                  display: "block",
                }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={item.url}
                alt={item.alt}
                onClick={() => onImageClick?.(item.url, item.alt)}
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
            )
          )}
        </div>
      )}
    </>
  );
}
