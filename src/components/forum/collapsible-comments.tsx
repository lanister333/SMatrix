// v4
"use client";

import { useState, useMemo } from "react";
import type { Msg } from "@/lib/ui";

/**
 * Сворачиваемые комментарии (Excel-стиль с +/-).
 * 
 * По умолчанию — линейный список (без отступов).
 * Под комментарием с ответами — кнопка "↩ N ответов".
 * Клик — раскрывает лесенку с вложенными ответами.
 * Повторный клик — сворачивает.
 * Рекурсивно на любой глубине.
 * 
 * Вертикальные линии через CSS ::before — соединяют родителя с каждым ребёнком.
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
  
  // isLastChild — последний ребёнок в массиве (для CSS линий)
  // передаём через пропс
  
  return (
    <div className={`cc-node${level === 0 ? " cc-root" : ""}`} data-level={level}>
      {/* Если раскрыто и есть дети — общий контейнер .cc-branch */}
      {expanded && replyCount > 0 ? (
        <div className="cc-branch cc-anim-expand">
          {/* Родительский комментарий — сверху */}
          <div className="cc-card sakh-comment cc-parent-in-branch" data-level="1" data-id={node.msg.id} data-msgnum={node.msg.num}>
            {renderMsg(node.msg, quoteOfFor(node.msg))}
          </div>
          
          {/* Кнопка "Свернуть" */}
          <button
            className="cc-toggle cc-toggle-open"
            onClick={() => setExpanded(false)}
            aria-expanded={false}
          >
            <span className="cc-toggle-icon">▼</span>
            <span className="cc-toggle-text">Свернуть</span>
          </button>
          
          {/* Дочерние ответы — внутри общего контейнера */}
          <div className="cc-children">
            {node.children.map((child, idx) => (
              <div key={child.msg.id} className={`cc-child-wrapper${idx === node.children.length - 1 ? " cc-last-child" : ""}`}>
                <CommentNode
                  node={child}
                  level={Math.min(level + 1, 4)}
                  renderMsg={renderMsg}
                  quoteOfFor={quoteOfFor}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Свёрнуто — просто карточка */}
          <div className="cc-card sakh-comment" data-level="1" data-id={node.msg.id} data-msgnum={node.msg.num}>
            {renderMsg(node.msg, quoteOfFor(node.msg))}
          </div>
          
          {/* Кнопка "↩ N ответов" */}
          {replyCount > 0 && (
            <button
              className="cc-toggle"
              onClick={() => setExpanded(true)}
              aria-expanded={false}
            >
              <span className="cc-toggle-icon">▶</span>
              <span className="cc-toggle-text">
                ↩ {totalReplies} {pluralReplies(totalReplies)}
              </span>
            </button>
          )}
        </>
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
