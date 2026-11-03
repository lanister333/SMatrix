"use client";

import { memo, useMemo } from "react";
import twemoji from "twemoji";

/**
 * TwemojiText — рендерит текст с цветными emoji через Twemoji SVG.
 *
 * Парсит текст, находит Unicode-emoji и заменяет их на <img> с CDN.
 * Не-emoji части текста остаются как есть.
 *
 * Используется для отображения сообщений с emoji на форуме и в спецразделах,
 * чтобы смайлики были цветными и весёлыми на любой системе (включая Linux
 * где системных emoji-шрифтов нет).
 *
 * Создан 2026-11-04.
 */

/** Получить URL SVG-картинки для emoji через Twemoji CDN. */
function emojiUrl(emoji: string): string {
  const code = twemoji.convert.toCodepoint(emoji);
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${code}.svg`;
}

/** Регулярка для поиска emoji в тексте.
 *  Покрывает основные диапазоны Unicode emoji. */
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2700}-\u{27BF}][\u{FE00}-\u{FE0F}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]?/gu;

interface Props {
  text: string;
  /** Размер emoji в px (по умолчанию 20). */
  size?: number;
  /** Класс для текстовых частей. */
  className?: string;
}

export const TwemojiText = memo(function TwemojiText({ text, size = 20, className }: Props) {
  const parts = useMemo(() => {
    const result: Array<{ type: "text"; value: string } | { type: "emoji"; value: string }> = [];
    let last = 0;
    let match: RegExpExecArray | null;
    const re = new RegExp(EMOJI_REGEX);
    while ((match = re.exec(text)) !== null) {
      if (match.index > last) {
        result.push({ type: "text", value: text.slice(last, match.index) });
      }
      result.push({ type: "emoji", value: match[0] });
      last = match.index + match[0].length;
    }
    if (last < text.length) {
      result.push({ type: "text", value: text.slice(last) });
    }
    return result;
  }, [text]);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.type === "emoji") {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={emojiUrl(part.value)}
              alt={part.value}
              width={size}
              height={size}
              style={{ display: "inline-block", verticalAlign: "middle", margin: "0 1px" }}
              loading="lazy"
            />
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </span>
  );
});
