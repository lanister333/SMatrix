"use client";

/**
 * УНИВЕРСАЛЬНЫЙ хук данных «посты темы с пагинацией» — канонический
 * источник данных для <ForumThread> в любых местах (страница темы,
 * страница раздела, будущие страницы). Плоский список по num с parent_id —
 * бэкенд (/api/topics/:id) отдаёт его как есть; никаких хардкодов тем.
 * Страница темы (topic-view.tsx) пока использует собственный загрузчик
 * (метки просмотра, счётчики нового, ИИ-модерация) — его переезд сюда
 * опционален: ForumThread принимает готовый массив posts из ЛЮБОГО источника,
 * включая refetch после POST /api/posts или WebSocket-событие.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReplyLinesPost } from "@/hooks/use-reply-lines";

export interface ForumTopic {
  id: string;
  title?: string;
  [key: string]: unknown;
}

export interface UsePostsResult {
  topic: ForumTopic | null;
  /** Плоские посты страницы: id/num/parentId (+ все поля API). */
  posts: (ReplyLinesPost & Record<string, unknown>)[];
  pages: number;
  perPage: number;
  total: number;
  loading: boolean;
  error: string | null;
  /** Повторная загрузка (например, после добавления поста или WebSocket). */
  reload: () => void;
}

export function usePosts(topicId: string | number, page = 1): UsePostsResult {
  const [topic, setTopic] = useState<ForumTopic | null>(null);
  const [posts, setPosts] = useState<(ReplyLinesPost & Record<string, unknown>)[]>([]);
  const [pages, setPages] = useState(1);
  const [perPage, setPerPage] = useState(35);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadId = useRef(0);

  const load = useCallback(() => {
    const id = ++loadId.current;
    setLoading(true);
    fetch(`/api/topics/${topicId}?page=${page}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Тема не найдена");
        return data;
      })
      .then((data) => {
        if (id !== loadId.current) return; // устаревший ответ — игнорируем
        setError(null);
        setTopic(data.topic ?? null);
        setPosts(data.messages || []);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
        if (data.perPage) setPerPage(data.perPage);
      })
      .catch((e) => {
        if (id === loadId.current) setError(e instanceof Error ? e.message : "Ошибка загрузки");
      })
      .finally(() => {
        if (id === loadId.current) setLoading(false);
      });
  }, [topicId, page]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  return { topic, posts, pages, perPage, total, loading, error, reload: load };
}
