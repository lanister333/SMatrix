/**
 * ТЗ 2026-09-21: «обнули вход для меня админа — не могу зайти в админку».
 *
 * К-2 (аудит 2026-10-04): пароль администратора НЕ хардкодится в
 * скрипте. Скрипт требует env ADMIN_PASSWORD и падает, если переменная
 * не задана — иначе можно случайно получить слабый пароль по умолчанию.
 *
 * Контекст (worklog, задача tz7 2026-09-21, пункт Т1): пароль
 * admin@sakhmatrix.ru был ОТЗОВЁН — passwordHash заменён случайным scrypt,
 * все сессии удалены. Владельцу предписывалось зарегистрироваться заново,
 * но вход в админку так и не восстановлен.
 *
 * Этот скрипт возвращает вход владельца:
 *   1) passwordHash = scrypt(env.ADMIN_PASSWORD) — формат РОВНО как
 *      hashPassword() в src/lib/auth.ts: соль 16 байт hex, ключ 64 байта
 *      hex, «salt:hash»;
 *   2) все сессии пользователя удаляются («обнули вход» — чистый старт);
 *   3) ничего больше не меняется (ник, роль owner, email, темы,
 *      сообщения).
 *
 * Использование:
 *   ADMIN_PASSWORD='your-strong-password' bun scripts/reset-admin-login.ts
 */
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const db = new PrismaClient();

/** Копия hashPassword() из src/lib/auth.ts (совместимо с verifyPassword и scripts/seed.js). */
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  // K-2: пароль берём ТОЛЬКО из env. Без hardcoded fallback.
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 1) {
    console.error(
      "K-2: ADMIN_PASSWORD env required. " +
      "Usage: ADMIN_PASSWORD='your-password' bun scripts/reset-admin-login.ts"
    );
    process.exit(1);
  }
  const email = process.env.ADMIN_EMAIL || "admin@sakhmatrix.ru";
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error("Пользователь не найден: " + email);

  const passwordHash = hashPassword(password);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  const gone = await db.session.deleteMany({ where: { userId: user.id } });

  console.log(
    JSON.stringify({
      ok: true,
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      sessionsDeleted: gone.count,
      hashPrefix: passwordHash.slice(0, 8) + "…",
    })
  );
}

main()
  .catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
