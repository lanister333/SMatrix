"use client";

/**
 * УНИВЕРСАЛЬНЫЙ SVG-оверлей «кто кому ответил». Принимает готовый массив
 * линий (из хука useReplyLines) и рендерит <svg> внутри контейнера списка:
 *   - absolute внутри скролл-контейнера (top:0/left:0 контейнера) — при
 *     скролле страницы оверлей едет вместе со списком, пересчёт не нужен;
 *   - pointer-events: none на всём svg, НО pointer-events: stroke на
 *     прозрачных зонах наведения .rl-hit — линии интерактивны;
 *   - CSS (globals.css) держит оверлей на z-index:0 ПОД карточками
 *     (z-index:1) — линии физически соединяют посты, проходя за чужими
 *     карточками под их белым фоном, в зазорах линия касается рамок;
 *   - наведение на линию: подсветка всей группы (.rl-on) + подсказка
 *     «ответ на #N» у курсора (.sakh-reply-tip).
 * Используется только вместе с useReplyLines / ForumThread — сам координаты
 * не считает (чистый рендер), что и делает его переиспользуемым везде.
 */

import { useRef, useState, type MouseEvent } from "react";
import type { ReplyLine } from "@/hooks/use-reply-lines";

export interface ReplyLinesOverlayProps {
  /** Линии из useReplyLines (массив шин с готовыми path d). */
  lines: ReplyLine[];
  /** Размер svg = размер контейнера списка на момент замера. */
  width: number;
  height: number;
  /** Цвет/толщина линий; если не заданы — берутся из CSS (var(--sm-rail), 2px). */
  lineColor?: string;
  lineWidth?: number;
}

export default function ReplyLinesOverlay({ lines, width, height, lineColor, lineWidth }: ReplyLinesOverlayProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

  // Наведение на линию: подсветка группы + подсказка «ответ на #N» у курсора.
  const moveTip = (l: ReplyLine) => (e: MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    setTip({
      x: Math.max(0, Math.min(e.clientX - box.left + 14, box.width - 150)),
      y: e.clientY - box.top + 16,
      text: `ответ на #${l.parentNum}`,
    });
  };

  const leave = () => {
    setHover(null);
    setTip(null);
  };

  return (
    <>
      <svg
        ref={svgRef}
        className="sakh-reply-lines"
        width={width}
        height={height}
        aria-hidden="true"
        focusable="false"
      >
        {lines.map((l) => (
          <g
            key={l.key}
            className={hover === l.key ? "rl-on" : undefined}
            onMouseEnter={() => setHover(l.key)}
            onMouseMove={moveTip(l)}
            onMouseLeave={leave}
          >
            {/* Прозрачная зона наведения (шире линии) + видимый след */}
            <path className="rl-hit" d={l.d} />
            <path className="rl-vis" d={l.d} style={lineColor || lineWidth ? { stroke: lineColor, strokeWidth: lineWidth } : undefined} />
          </g>
        ))}
      </svg>
      {tip && (
        <div className="sakh-reply-tip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      )}
    </>
  );
}
