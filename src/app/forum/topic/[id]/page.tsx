import type { Metadata } from "next";
import { db } from "@/lib/db";

/**
 * Отдельная страница темы форума: /forum/topic/1034
 * Серверный компонент — сразу рендерит тему, без вспышки главной.
 * Данные темы загружаются на сервере (SSR), клиент получает готовый HTML.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const topicId = parseInt(id, 10);
  if (!Number.isFinite(topicId)) return { title: "Тема форума — SakhMatrix" };
  const topic = await db.topic.findUnique({ where: { id: topicId }, select: { title: true } });
  return {
    title: topic ? `${topic.title} — SakhMatrix` : "Тема форума — SakhMatrix",
  };
}

export default async function ForumTopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const topicId = parseInt(id, 10);

  // Рендерим тот же клиентский компонент, но с правильным initialSearchParams
  const { default: App } = await import("../../app-client");

  return (
    <App
      initialSearchParams={{
        view: "forum",
        topic: String(topicId),
      }}
    />
  );
}
