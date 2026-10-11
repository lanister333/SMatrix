"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { Msg } from "@/lib/ui";

interface QuoteOf {
  author: string;
  num: number;
  body: string;
  onGo?: () => void;
}

interface CollapsibleCommentsProps {
  messages: Msg[];
  renderMsg: (m: Msg, quoteOf?: QuoteOf | null) => React.ReactNode;
  quoteOfFor: (m: Msg) => QuoteOf | null;
}

interface TreeNode {
  msg: Msg;
  children: TreeNode[];
}

function buildTree(messages: Msg[]): TreeNode[] {
  const childrenMap = new Map<string | null, Msg[]>();
  for (const m of messages) {
    const parentKey = m.parentId;
    if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
    childrenMap.get(parentKey)!.push(m);
  }
  function buildNode(msg: Msg): TreeNode {
    const kids = childrenMap.get(msg.id) || [];
    return { msg, children: kids.map(buildNode) };
  }
  const roots = childrenMap.get(null) || [];
  return roots.map(buildNode);
}

function countAllReplies(node: TreeNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countAllReplies(child), 0);
}

function pluralReplies(n: number): string {
  if (n === 1) return "ответ";
  if (n >= 2 && n <= 4) return "ответа";
  return "ответов";
}

const TEAL = "#249790";
const WIRE_LEFT = 12;     // X координата вертикального провода
const WIRE_H_WIDTH = 14;   // длина горизонтального провода
const WIRE_H_TOP = 14;     // Y координата горизонтального провода (у верха карточки)

function CommentNode({ node, level, renderMsg, quoteOfFor }: {
  node: TreeNode;
  level: number;
  renderMsg: (m: Msg, quoteOf?: QuoteOf | null) => React.ReactNode;
  quoteOfFor: (m: Msg) => QuoteOf | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const replyCount = node.children.length;
  const totalReplies = useMemo(() => countAllReplies(node), [node]);
  const indent = level === 0 ? 0 : WIRE_LEFT + WIRE_H_WIDTH;

  // Реф на контейнер детей — для измерения высоты
  const childrenRef = useRef<HTMLDivElement>(null);
  const [wireHeight, setWireHeight] = useState(0);

  useEffect(() => {
    if (expanded && childrenRef.current) {
      const update = () => {
        if (childrenRef.current) {
          // Высота = от верха до верха последнего ребёнка
          const children = childrenRef.current.children;
          if (children.length > 0) {
            const last = children[children.length - 1];
            const rect = childrenRef.current.getBoundingClientRect();
            const lastRect = last.getBoundingClientRect();
            const h = lastRect.top - rect.top + WIRE_H_TOP;
            setWireHeight(h);
          }
        }
      };
      update();
      // Повтор через 100мс — после рендера
      setTimeout(update, 100);
    }
  }, [expanded, replyCount]);

  return (
    <div style={{ position: "relative", marginBottom: "8px", paddingLeft: indent + "px" }}>
      {/* Карточка сообщения */}
      <div
        className="sakh-comment"
        data-level="1"
        data-id={node.msg.id}
        data-msgnum={node.msg.num}
        style={{ position: "relative", zIndex: 1 }}
      >
        {renderMsg(node.msg, quoteOfFor(node.msg))}
      </div>

      {/* Кнопка раскрытия */}
      {replyCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            width: "100%",
            padding: "5px 8px",
            margin: "2px 0",
            background: expanded ? "#e8f5f2" : "#f0f7f5",
            border: "1px solid #b9d4cd",
            borderLeft: "3px solid " + TEAL,
            borderRadius: "3px",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "12px",
            fontWeight: 600,
            color: TEAL,
            textAlign: "left",
            boxSizing: "border-box",
            position: "relative",
            zIndex: 2,
          }}
        >
          <span style={{ display: "inline-block", width: "12px", fontSize: "9px" }}>
            {expanded ? "▼" : "▶"}
          </span>
          <span>
            {expanded ? "Свернуть" : "↩ " + totalReplies + " " + pluralReplies(totalReplies)}
          </span>
        </button>
      )}

      {/* Раскрытые дети */}
      {expanded && replyCount > 0 && (
        <div ref={childrenRef} style={{ position: "relative", marginTop: "4px" }}>
          {/* 
            Вертикальный провод — от верха первого ребёнка до верха последнего.
            КАСАЕТСЯ горизонтальных проводов, которые касаются карточек.
            НЕ висит в воздухе.
          */}
          <div style={{
            position: "absolute",
            left: WIRE_LEFT + "px",
            top: "0",
            height: (wireHeight > 0 ? wireHeight : "100%") + "px",
            width: "2px",
            background: TEAL,
            zIndex: 0,
          }} />

          {node.children.map((child, idx) => (
            <div key={child.msg.id} style={{ position: "relative", paddingLeft: (WIRE_LEFT + WIRE_H_WIDTH) + "px", marginBottom: "8px" }}>
              {/* 
                Горизонтальный провод — от вертикальной линии до ЛЕВОГО КРАЯ карточки.
                КАСАЕТСЯ вертикальной (слева) и карточки (справа).
              */}
              <div style={{
                position: "absolute",
                left: WIRE_LEFT + "px",
                top: WIRE_H_TOP + "px",
                width: WIRE_H_WIDTH + "px",
                height: "2px",
                background: TEAL,
                zIndex: 0,
              }} />
              {/* Сам ребёнок */}
              <CommentNode
                node={child}
                level={Math.min(level + 1, 4)}
                renderMsg={renderMsg}
                quoteOfFor={quoteOfFor}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CollapsibleComments({ messages, renderMsg, quoteOfFor }: CollapsibleCommentsProps) {
  const tree = useMemo(() => buildTree(messages), [messages]);
  return (
    <div
      className="sakh-comments-container"
      style={{ position: "relative", overflowX: "hidden", maxWidth: "100%" }}
    >
      {tree.map((node) => (
        <CommentNode
          key={node.msg.id}
          node={node}
          level={0}
          renderMsg={renderMsg}
          quoteOfFor={quoteOfFor}
        />
      ))}
    </div>
  );
}
