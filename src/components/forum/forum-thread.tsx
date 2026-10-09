"use client";

/**
 * УНИВЕРСАЛЬНЫЙ компонент списка постов форума. ЕДИНСТВЕННОЕ место, где
 * собираются «плоский список карточек» + «SVG-линии кто кому ответил».
 * Используется ВЕЗДЕ, где показываются посты: страница темы, страница
 * раздела, лента сообщений, любые будущие места — без изменений кода:
 *   - никакого хардкода id темы/постов: всё строится из props.posts
 *     (parentId, num) и фактического DOM;
 *   - смена массива posts (пагинация, новый пост через refetch/WebSocket/
 *     optimistic update, удаление, переход в другую тему) → хук
 *     useReplyLines пересчитывает линии автоматически;
 *   - карточку поста рисует ВЫЗЫВАЮЩИЙ (renderPost) — ForumThread ничего
 *     не знает о дизайне карточек; единственное требование: корневой
 *     элемент карточки обязан иметь data-id={post.id} (по нему хук
 *     сопоставляет посты и DOM) — селектор можно переопределить опцией
 *     postSelector.
 *
 * Пример:
 *   <ForumThread
 *     posts={posts}
 *     renderPost={(p) => <PostCard key={p.id} post={p} data-id={p.id} />}
 *   />
 */

import { useRef } from "react";
import { useReplyLines, type ReplyLinesPost, type UseReplyLinesOptions } from "@/hooks/use-reply-lines";
import ReplyLinesOverlay from "@/components/forum/reply-lines-overlay";

export interface ForumThreadProps<T extends ReplyLinesPost = ReplyLinesPost> extends UseReplyLinesOptions {
  /** Плоский массив постов текущей страницы (каждый с id, num и parentId). */
  posts: T[];
  /** Рендер одной карточки; корневой элемент должен нести data-id={post.id}. */
  renderPost: (post: T) => React.ReactNode;
  /** Дополнительные классы контейнера списка (например sakh-comments-container). */
  className?: string;
}

export default function ForumThread<T extends ReplyLinesPost = ReplyLinesPost>({
  posts,
  renderPost,
  className,
  ...lineOpts
}: ForumThreadProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { lines, width, height, color, thickness } = useReplyLines(containerRef, posts, lineOpts);

  return (
    <div ref={containerRef} className={`forum-thread posts-list${className ? ` ${className}` : ""}`}>
      {/* Оверлей — первый ребёнок: SVG absolute, z-index 0 (под карточками) */}
      <ReplyLinesOverlay lines={lines} width={width} height={height} lineColor={color} lineWidth={thickness} />
      {posts.map((p) => renderPost(p))}
    </div>
  );
}
