#!/usr/bin/env node
/**
 * Этап 5: Авто-удаление ботов по росту реальных пользователей.
 * Запускается по cron (systemd-timer) раз в сутки.
 *
 * Логика:
 *   - Считаем живых пользователей (email НЕ содержит @theatre.local)
 *   - По порогам помечаем ботов как удалённых (bio.deleted = true)
 *   - Удалённые боты больше не выбираются loadTheatreBots()
 *   - Их старые сообщения сохраняются (для истории)
 *
 * Пороги (можно изменить в переменной THRESHOLDS):
 *   50 живых → пометить 10 ботов (останется 35)
 *   100 живых → пометить 15 ботов (останется 20)
 *   200 живых → пометить 15 ботов (останется 5)
 *   300 живых → пометить 5 ботов (останется 0)
 *
 * Лог: /var/log/smatrix-bot-cleanup.log
 */

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const p = new PrismaClient();

const LOG_FILE = "/var/log/smatrix-bot-cleanup.log";

const THRESHOLDS = [
  { minRealUsers: 50, botsToRemove: 10, label: "stage1" },
  { minRealUsers: 100, botsToRemove: 15, label: "stage2" },
  { minRealUsers: 200, botsToRemove: 15, label: "stage3" },
  { minRealUsers: 300, botsToRemove: 5, label: "stage4" },
];

function log(msg) {
  const line = new Date().toISOString() + " " + msg;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + "\n"); } catch {}
}

async function main() {
  log("=== Bot cleanup started ===");

  // 1. Считаем живых пользователей
  const realUsers = await p.user.count({
    where: {
      email: { not: { contains: "@theatre.local" } },
      status: "active",
    },
  });
  log("Real active users: " + realUsers);

  // 2. Считаем оставшихся активных ботов
  const theatreBots = await p.user.findMany({
    where: { email: { contains: "@theatre.local" } },
    select: { id: true, nickname: true, bio: true, status: true },
  });

  const activeBots = theatreBots.filter((b) => {
    if (!b.bio) return false;
    try {
      const meta = JSON.parse(b.bio);
      return meta.role === "theatre_bot" && !meta.deleted;
    } catch { return false; }
  });
  log("Active theatre bots: " + activeBots.length);

  if (activeBots.length === 0) {
    log("No active bots — nothing to do.");
    await p.$disconnect();
    return;
  }

  // 3. Определяем, какой порог пройден
  // Идём от самого высокого порога к низкому
  let stage = null;
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
    if (realUsers >= THRESHOLDS[i].minRealUsers) {
      stage = THRESHOLDS[i];
      break;
    }
  }

  if (!stage) {
    log("No threshold reached yet. Need >= " + THRESHOLDS[0].minRealUsers + " real users.");
    await p.$disconnect();
    return;
  }

  log("Threshold reached: " + stage.label + " (>= " + stage.minRealUsers + " users, will remove " + stage.botsToRemove + " bots)");

  // 4. Считаем сколько ботов УЖЕ помечено как удалённые
  const deletedBots = theatreBots.filter((b) => {
    if (!b.bio) return false;
    try {
      const meta = JSON.parse(b.bio);
      return meta.role === "theatre_bot" && meta.deleted === true;
    } catch { return false; }
  }).length;

  // 5. Сколько ещё нужно пометить на этом этапе
  // Считаем, какой порог был пройден ранее (по количеству уже удалённых)
  let alreadyRemovedByThisStage = 0;
  let prevThresholdsCount = 0;
  for (const t of THRESHOLDS) {
    if (t.label === stage.label) {
      alreadyRemovedByThisStage = Math.max(0, deletedBots - prevThresholdsCount);
      break;
    }
    prevThresholdsCount += t.botsToRemove;
  }

  const toRemoveNow = Math.max(0, stage.botsToRemove - alreadyRemovedByThisStage);
  if (toRemoveNow === 0) {
    log("Already removed " + alreadyRemovedByThisStage + " bots at stage " + stage.label + " — nothing to do.");
    await p.$disconnect();
    return;
  }

  log("Need to mark " + toRemoveNow + " more bots as deleted at stage " + stage.label);

  // 6. Выбираем ботов для удаления (random выбор — берём последние по дате создания)
  // Чтобы выбор был детерминированным — сортируем по createdAt desc и берём первые N
  const botsToDelete = await p.user.findMany({
    where: {
      email: { contains: "@theatre.local" },
    },
    select: { id: true, nickname: true, bio: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: toRemoveNow * 3, // берём с запасом, потом отфильтруем
  });

  const candidates = botsToDelete.filter((b) => {
    if (!b.bio) return false;
    try {
      const meta = JSON.parse(b.bio);
      return meta.role === "theatre_bot" && !meta.deleted;
    } catch { return false; }
  }).slice(0, toRemoveNow);

  if (candidates.length === 0) {
    log("No candidates to delete.");
    await p.$disconnect();
    return;
  }

  log("Marking " + candidates.length + " bots as deleted:");
  for (const bot of candidates) {
    const meta = JSON.parse(bot.bio);
    meta.deleted = true;
    meta.deletedAt = new Date().toISOString();
    meta.deletedReason = "auto-cleanup-stage-" + stage.label;

    await p.user.update({
      where: { id: bot.id },
      data: { bio: JSON.stringify(meta) },
    });
    log("  - " + bot.nickname + " (id=" + bot.id + ") marked as deleted");
  }

  log("=== Cleanup complete. " + candidates.length + " bots marked as deleted. ===");
  await p.$disconnect();
}

main().catch((e) => {
  log("[ERROR] " + e.message);
  console.error(e);
  process.exit(1);
});
