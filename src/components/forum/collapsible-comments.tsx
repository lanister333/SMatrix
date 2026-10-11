// v6 — inline styles для обхода кэша
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

// Inline styles — не зависят от CSS-кэша
const S = {
  container: { position: "relative" as const, overflowX: "hidden", maxWidth: "100%" },
  node: { position: "relative" as const, marginBottom: "8px" },
  card: { position: "relative" as const, zIndex: 1 },
  branch: {
    background: "#f8fbfa",
    border: "1px solid #b9d4cd",
    borderLeft: "3px solid #249790",
    borderRadius: "4px",
    padding: "8px 8px 8px 12px",
    marginBottom: "8px",
    boxSizing: "border-box" as const,
    position: "relative" as const,
  },
  parentInBranch: {
    border: "0",
    background: "transparent",
    marginBottom: "0",
    padding: "4px 0",
  },
  toggle: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    width: "100%",
    padding: "6px 10px",
    margin: "2px 0 4px",
    background: "#f0f7f5",
    border: "1px solid #b9d4cd",
    borderRadius: "3px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "12.5px",
    fontWeight: 600,
    color: "#249790",
    textAlign: "left" as const,
    boxSizing: "border-box" as const,
    position: "relative" as const,
    zIndex: 1,
  },
  toggleOpen: {
    background: "#e8f5f2",
    borderColor: "#249790",
  },
  toggleIcon: { display: "inline-block", width: "14px", fontSize: "10px", textAlign: "center" as const },
  children: { position: "relative" as const, marginTop: "4px" },
  childWrapper: {
    position: "relative" as const,
    paddingLeft: "22px",
  },
  // Вертикальная линия — псевдоэлемент через CSS не работает в inline,
  // поэтому рисуем реальный div
  vLine: {
    position: "absolute" as const,
    left: "0",
    top: "0",
    bottom: "0",
    width: "2px",
    background: "#249790",
    borderRadius: "1px",
  },
  vLineLast: {
    position: "absolute" as const,
    left: "0",
    top: "0",
    width: "2px",
    height: "16px",
    background: "#249790",
    borderRadius: "1px",
  },
  hLine: {
    position: "absolute" as const,
    left: "0",
    top: "16px",
    width: "22px",
    height: "2px",
    background: "#249790",
    borderRadius: "1px",
  },
};

function CommentNode({ node, level, renderMsg, quoteOfFor }: {
  node: TreeNode;
  level: number;
  renderMsg: (m: Msg, quoteOf?: QuoteOf | null) => React.ReactNode;
  quoteOfFor: (m: Msg) => QuoteOf | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const replyCount = node.children.length;
  const totalReplies = useMemo(() => countAllReplies(node), [node]);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const padLeft = isMobile ? 16 : 22;
  const hLineW = isMobile ? 16 : 22;
  const vLineH = isMobile ? 12 : 16;

  if (expanded && replyCount > 0) {
    return (
      <div style={S.node} data-level={level}>
        <div style={{...S.branch, paddingLeft: padLeft + 4}}>
          {/* Родитель */}
          <div style={{...S.card, ...S.parentInBranch}} className="sakh-comment" data-level="1" data-id={node.msg.id} data-msgnum={node.msg.num}>
            {renderMsg(node.msg, quoteOfFor(node.msg))}
          </div>
          {/* Кнопка Свернуть */}
          <button
            style={{...S.toggle, ...S.toggleOpen}}
            onClick={() => setExpanded(false)}
          >
            <span style={S.toggleIcon}>▼</span>
            <span>Свернуть</span>
          </button>
          {/* Дети */}
          <div style={S.children}>
            {node.children.map((child, idx) => {
              const isLast = idx === node.children.length - 1;
              return (
                <div key={child.msg.id} style={{...S.childWrapper, paddingLeft: padLeft}}>
                  {/* Вертикальная линия */}
                  <div style={isLast ? {...S.vLineLast, height: vLineH} : S.vLine} />
                  {/* Горизонтальная линия */}
                  <div style={{...S.hLine, top: vLineH, width: hLineW}} />
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
        </div>
      </div>
    );
  }

  return (
    <div style={S.node} data-level={level}>
      <div style={S.card} className="sakh-comment" data-level="1" data-id={node.msg.id} data-msgnum={node.msg.num}>
        {renderMsg(node.msg, quoteOfFor(node.msg))}
      </div>
      {replyCount > 0 && (
        <button
          style={S.toggle}
          onClick={() => setExpanded(true)}
        >
          <span style={S.toggleIcon}>▶</span>
          <span>↩ {totalReplies} {pluralReplies(totalReplies)}</span>
        </button>
      )}
    </div>
  );
}

export default function CollapsibleComments({ messages, renderMsg, quoteOfFor }: CollapsibleCommentsProps) {
  const tree = useMemo(() => buildTree(messages), [messages]);
  return (
    <div style={S.container} className="sakh-comments-container cc-container">
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
