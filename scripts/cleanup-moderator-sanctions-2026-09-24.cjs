/* Очистка активных санкций limit_1h/limit_24h у тестового аккаунта
 * u1_модератор — артефакт диагностических POST-вызовов проб 2026-09-24
 * (ИИ-проверка конкретности повесила часовое ограничение). Удаляются
 * только активные ограничительные санкции этого тестового юзера. */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

(async () => {
  const user = await db.user.findFirst({ where: { email: "u1_модератор@sakhmatrix.local" } });
  if (!user) { console.log("пользователь не найден"); return; }
  const rows = await db.sanction.findMany({
    where: { userId: user.id, kind: { in: ["ban", "limit_1h", "limit_24h", "limit_3d"] } },
    orderBy: { createdAt: "desc" },
  });
  const now = Date.now();
  const active = rows.filter((s) => !s.expiresAt || new Date(s.expiresAt).getTime() > now);
  console.log(`активных санкций: ${active.length} (всего ${rows.length})`);
  for (const s of active) {
    await db.sanction.delete({ where: { id: s.id } });
    console.log(`удалена: ${s.kind} до ${s.expiresAt ? new Date(s.expiresAt).toISOString() : "∞"}`);
  }
  await db.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
