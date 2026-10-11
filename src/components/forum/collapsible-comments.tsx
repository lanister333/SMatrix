// VERSION_WIRES_1791701500 (2026-10-11 v2: extend rail up by 16px to bridge parent margin-bottom:8 + container marginTop:4)

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
  // expanded удалён — ответы всегда раскрыты
  const replyCount = node.children.length;
  // totalReplies удалён
  
  const TEAL = "#249790";
  const WIRE_X = 12;        // X вертикальной линии
  const WIRE_W = 18;        // ширина горизонтальной (до рамки карточки + 2px заход)
  const PAD = WIRE_X + WIRE_W; // отступ детей = 30px
  const H_TOP = 10;         // Y горизонтальной — касается верхней рамки
  
  return (
    <div style={{ position: "relative", marginBottom: "8px" }} data-level={level}>
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
      
      {/* Ответы всегда раскрыты — с линиями-проводами */}
      {replyCount > 0 && (
        <div style={{ position: "relative", marginTop: "4px" }}>
          {node.children.map((child, idx) => {
            const isLast = idx === node.children.length - 1;
            return (
              <div key={child.msg.id} style={{ position: "relative", paddingLeft: PAD + "px", marginBottom: "4px" }}>
                {/* 2026-10-11 FIX: вертикальная линия должна КОСАТЬСЯ окон ответов
                    (родительской карточки сверху и следующей sibling-карточки снизу).
                    Раньше top:0 + height:100% оставляли зазор 4px в каждом стыке
                    (marginBottom:4 обрывал линию). Теперь:
                    - top:-16 — линия поднимается на 16px вверх, перекрывая
                      margin-bottom:8 родительской .sakh-comment + marginTop:4
                      контейнера детей + 4px запаса (заход ПОД нижнюю рамку
                      родителя, zIndex:0 за карточкой с zIndex:1 — видимого
                      наложения нет, но гарантированное касание);
                    - height: calc(100% + 20px) для НЕ-последнего — линия уходит
                      на 16px вверх и на 4px вниз (перекрывая собственный
                      marginBottom:4), смыкается с верхней частью линии след.
                      sibling'а;
                    - height: (H_TOP + 2 + 16)px = 28px для последнего —
                      начинается от родительской рамки (-16) и доходит до
                      горизонтального отвода (y=12), длина = 12 + 16 = 28. */}
                <div style={{
                  position: "absolute",
                  left: WIRE_X + "px",
                  top: "-16px",
                  height: isLast ? (H_TOP + 2 + 16) + "px" : "calc(100% + 20px)",
                  width: "2px",
                  background: TEAL,
                  zIndex: 0,
                }} />
                {/* Горизонтальная линия — от вертикальной до рамки карточки
                    (+2px заводится ПОД рамку карточки: zIndex:0 за карточкой
                    с zIndex:1, видимого наложения нет — но гарантированно
                    касается левого края окна ответа без под-пиксельного зазора). */}
                <div style={{
                  position: "absolute",
                  left: WIRE_X + "px",
                  top: H_TOP + "px",
                  width: (WIRE_W + 2) + "px",
                  height: "2px",
                  background: TEAL,
                  zIndex: 0,
                }} />
                {/* Ребёнок */}
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
