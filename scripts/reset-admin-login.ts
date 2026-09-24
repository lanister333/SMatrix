/**
 * ТЗ 2026-09-21: «обнули вход для меня админа — не могу зайти в админку».
 *
 * Контекст (worklog, задача tz7 2026-09-21, пункт Т1): пароль
 * admin@sakhmatrix.ru был ОТЗОВЁН — passwordHash заменён случайным scrypt,
 * все сессии удалены. Владельцу предписывалось зарегистрироваться заново,
 * но вход в админку так и не восстановлен.
 *
 * Этот скрипт возвращает вход владельца к документированному исходному
 * состоянию (README-NEW-SESSION.md: «админ: admin@sakhmatrix.ru / admin»):
 *   1) passwordHash = scrypt("admin") — формат РОВНО как hashPassword()
 *      в src/lib/auth.ts: соль 16 байт hex, ключ 64 байта hex, «salt:hash»;
 *   2) все сессии пользователя удаляются («обнули вход» — чистый старт);
 *   3) ничего больше не меняется (ник, роль owner, email, темы, сообщения).
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
  const email = "admin@sakhmatrix.ru";
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error("Пользователь не найден: " + email);

  const passwordHash = hashPassword("admin");
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
