// src/scripts/publish-bot-queue.ts
// Cron-скрипт: каждые 5 минут проверяет BotQueue на approved + scheduledAt <= NOW()
// и публикует эти реплики в форум. Запускается через cron:
//   */5 * * * * cd /opt/smatrix && bun run scripts/publish-bot-queue.ts >> /var/log/bot-publisher.log 2>&1

import { db } from "@/lib/db";
import { publishApprovedQueueItem } from "@/lib/bot-theatre";

async function main() {
  const now = new Date();
  const due = await db.botQueue.findMany({
    where: {
      status: "approved",
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: "asc" },
    take: 20, // максимум 20 за запуск
  });

  console.log(`[${now.toISOString()}] Found ${due.length} due items`);

  let published = 0;
  let failed = 0;
  for (const item of due) {
    try {
      const r = await publishApprovedQueueItem(item.id);
      console.log(`  ✓ Published: topic #${r.topicId}, msg ${r.messageId.slice(-8)} (bot: ${item.botNickname})`);
      published++;
    } catch (e) {
      console.error(`  ❌ Failed: ${item.id} (${item.botNickname}):`, e instanceof Error ? e.message : e);
      failed++;
    }
  }
  console.log(`Done: published=${published}, failed=${failed}`);
}

main()
  .catch((e) => {
    console.error("Publisher error:", e);
    process.exit(1);
  })
  .then(() => process.exit(0));
