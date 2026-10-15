// src/lib/auto-bots.ts
// 2026-10-15: Auto-bots — подмена автора на рандомного бота + очередь авто-ответов.
// Используется во всех 10 разделах (Где купить, Объявления, ЖКХ, и т.д.)

import { db } from "@/lib/db";

/**
 * Pick a random theatre bot.
 * Theatre bots are User records with email LIKE '%@theatre.local' and bio JSON { role: "theatre_bot" }.
 */
export async function pickRandomBot(excludeIds: string[] = []) {
  const users = await db.user.findMany({
    where: {
      email: { contains: "@theatre.local" },
      id: { notIn: excludeIds },
    },
    select: { id: true, nickname: true, gender: true, bio: true },
  });
  const bots = users.filter((u) => {
    if (!u.bio) return false;
    try {
      const meta = JSON.parse(u.bio);
      return meta.role === "theatre_bot";
    } catch {
      return false;
    }
  });
  if (bots.length === 0) return null;
  return bots[Math.floor(Math.random() * bots.length)];
}

/**
 * Schedule 1-2 auto-replies for a publication.
 * Replies will be picked up by the local auto-bot-publisher script (z-ai CLI).
 */
export async function scheduleBotReplies(params: {
  section: string;       // "wheretobuy", "obyavleniya", "gkh", etc.
  postId: string;        // ID of the publication
  topicTitle: string;    // Original title
  topicText: string;     // Original text
  authorId: string;       // Original author ID (the bot who created the post)
  authorNickname: string;
}) {
  // Random count: 1 or 2 replies
  const replyCount = Math.random() < 0.6 ? 1 : 2;
  // Random delay: 5-30 minutes
  const baseDelay = 5 + Math.floor(Math.random() * 25); // 5..29 minutes
  // Pick distinct bots for replies (exclude original author)
  const replyBots = [];
  const used = [params.authorId];
  for (let i = 0; i < replyCount; i++) {
    const bot = await pickRandomBot(used);
    if (!bot) break;
    used.push(bot.id);
    replyBots.push(bot);
  }
  // Create queue entries (one per reply)
  const entries = [];
  for (let i = 0; i < replyBots.length; i++) {
    const bot = replyBots[i];
    const delayMin = baseDelay + i * (3 + Math.floor(Math.random() * 7)); // stagger 3-10 min between replies
    const scheduledAt = new Date(Date.now() + delayMin * 60 * 1000);
    const entry = await db.botReplyQueue.create({
      data: {
        section: params.section,
        postId: params.postId,
        topicTitle: params.topicTitle,
        topicText: params.topicText,
        authorId: params.authorId,
        authorNickname: params.authorNickname,
        botId: bot.id,
        botNickname: bot.nickname,
        botGender: bot.gender,
        scheduledAt,
        status: "pending",
      },
    });
    entries.push(entry);
  }
  return entries;
}
