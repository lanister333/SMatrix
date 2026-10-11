"use client";

import { useState, useMemo } from "react";
import type { Msg } from "@/lib/ui";

/**
 * Сворачиваемые комментарии (как в Excel с +/-).
 * 
 * По умолчанию — линейный список (без отступов).
 * Под комментарием с ответами — кнопка "↩ N ответов".
 * Клик — раскрывает лесенку с вложенными ответами.
 * Повторный клик — сворачивает.
 * Рекурсивно на любой глубине.
 */

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

/** Построить дерево из плоского массива по parentId */
function buildTree(messages: Msg[]): TreeNode[] {
  const byId = new Map(messages.map(m => [m.id, m]));
  const childrenMap = new Map<string | null, Msg[]>();
  
  for (const m of messages) {
    const parentKey = m.parentId;
    if (!childrenMap.has(parentKey)) {
      childrenMap.set(parentKey, []);
    }
    childrenMap.get(parentKey)!.push(m);
  }
  
  function buildNode(msg: Msg): TreeNode {
    const kids = childrenMap.get(msg.id) || [];
    return {
      msg,
      children: kids.map(buildNode),
    };
  }
  
  // Корневые сообщения (parentId = null)
  const roots = childrenMap.get(null) || [];
  return roots.map(buildNode);
}

/** Подсчитать ВСЕ ответы (включая вложенные) */
function countAllReplies(node: TreeNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countAllReplies(child), 0);
}

/** Рекурсивный компонент комментария */
function CommentNode({
  node,
  level,
  renderMsg,
  quoteOfFor,
}: {
  node: TreeNode;
  level: number;
  renderMsg: (m: Msg, quoteOf?: QuoteOf | null) => React.ReactNode;
  quoteOfFor: (m: Msg) => QuoteOf | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const replyCount = node.children.length;
  const totalReplies = useMemo(() => countAllReplies(node), [node]);
  
  return (
    <div className="cc-node" data-level={level}>
      {/* Карточка сообщения — линейная, без отступов */}
      <div className="cc-card sakh-comment" data-level="1" data-id={node.msg.id} data-msgnum={node.msg.num}>
        {renderMsg(node.msg, quoteOfFor(node.msg))}
      </div>
      
      {/* Кнопка "↩ N ответов" — если есть ответы */}
      {replyCount > 0 && (
        <button
          className={`cc-toggle${expanded ? " cc-toggle-open" : ""}`}
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          <span className="cc-toggle-icon">{expanded ? "▼" : "▶"}</span>
          <span className="cc-toggle-text">
            {expanded ? "Свернуть" : `↩ ${totalReplies} ${pluralReplies(totalReplies)}`}
          </span>
        </button>
      )}
      
      {/* Раскрытая лесенка с вложенными ответами */}
      {expanded && replyCount > 0 && (
        <div className="cc-children cc-anim-expand">
          {node.children.map((child) => (
            <CommentNode
              key={child.msg.id}
              node={child}
              level={Math.min(level + 1, 4)}
              renderMsg={renderMsg}
              quoteOfFor={quoteOfFor}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function pluralReplies(n: number): string {
  if (n === 1) return "ответ";
  if (n >= 2 && n <= 4) return "ответа";
  return "ответов";
}

export default function CollapsibleComments({
  messages,
  renderMsg,
  quoteOfFor,
}: CollapsibleCommentsProps) {
  const tree = useMemo(() => buildTree(messages), [messages]);
  
  return (
    <div className="sakh-comments-container cc-container">
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
