/**
 * ШАГ 12. Миграция ролей и настроек:
 *  — «Админ» (admin@sakhmatrix.ru) становится «Главный администратор / Владелец» (role=owner);
 *  — роль moderator остаётся ограниченной;
 *  — сидируем настройки сайта по умолчанию (совпадают с текущей шапкой).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DEFAULT_SETTINGS = {
  siteSlogan: "Спроси у города — город ответит.",
  siteSubtitle: "Сахалинская матрица взаимопомощи",
  siteDescription:
    "Независимый форум-портал для жителей острова: советы, рекомендации мастеров, дороги, рыбалка и жизнь Сахалина. Спроси — и город ответит.",
  footerNote: "Спроси у города — город ответит.",
  registrationEnabled: "1",
  newTopicsEnabled: "1",
};

async function main() {
  const admin = await db.user.findUnique({ where: { email: "admin@sakhmatrix.ru" } });
  if (admin && admin.role !== "owner") {
    await db.user.update({ where: { id: admin.id }, data: { role: "owner" } });
    console.log(`role: ${admin.nickname} admin -> owner`);
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.siteSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  console.log("settings seeded:", Object.keys(DEFAULT_SETTINGS).join(", "));
  const users = await db.user.findMany({ where: { role: { not: "user" } }, select: { nickname: true, role: true } });
  console.log("staff:", JSON.stringify(users));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
