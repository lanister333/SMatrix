"use client";

import { useState, useMemo } from "react";
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
  const byId = new Map(messages.map(m => [m.id, m]));
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

function CommentNode({ node, level, renderMsg, quoteOfFor }: {
  node: TreeNode;
  level: number;
  renderMsg: (m: Msg, quoteOf?: QuoteOf | null) => React.ReactNode;
  quoteOfFor: (m: Msg) => QuoteOf | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const replyCount = node.children.length;
  const totalReplies = useMemo(() => countAllReplies(node), [node]);
  const indent = level === 0 ? 0 : 20;

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

      {/* Раскрытые дети — линии-провода соединяют окна */}
      {expanded && replyCount > 0 && (
        <div style={{ position: "relative", marginTop: "4px" }}>
          {/* Вертикальная линия-провод от кнопки вниз через всех детей */}
          <div style={{
            position: "absolute",
            left: "10px",
            top: "0",
            bottom: "0",
            width: "2px",
            background: TEAL,
            zIndex: 0,
          }} />

          {node.children.map((child, idx) => {
            const isLast = idx === node.children.length - 1;
            return (
              <div key={child.msg.id} style={{ position: "relative", paddingLeft: "24px", marginBottom: isLast ? "0" : "0" }}>
                {/* Горизонтальный провод — от вертикальной к карточке ребёнка */}
                <div style={{
                  position: "absolute",
                  left: "10px",
                  top: "12px",
                  width: "14px",
                  height: "2px",
                  background: TEAL,
                  zIndex: 0,
                }} />
                {/* Если последний — обрезаем вертикальную ниже горизонтальной */}
                {isLast && (
                  <div style={{
                    position: "absolute",
                    left: "10px",
                    top: "0",
                    width: "2px",
                    height: "13px",
                    background: "#fff",
                    zIndex: 0,
                  }} />
                )}
                {/* Сам ребёнок */}
                <CommentNode
                  node={child}
                  level={Math.min(level + 1, 4)}
                  renderMsg={renderMsg}
                  quoteOfFor={quoteOfFor}
                />
              </div>
            );
          })}
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
