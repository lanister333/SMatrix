/** Проверка: публикация в «Нужна помощь» без контактных данных (контакт теперь необязателен). */
import { PrismaClient } from "@prisma/client";
import { randomUUID, scryptSync, randomBytes } from "crypto";

const p = new PrismaClient();
const BASE = "http://localhost:3000";

async function main() {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync("Test12345!", salt, 64).toString("hex");
  const u = await p.user.create({
    data: {
      email: "nocontact@test.local",
      passwordHash: `scrypt:${salt}:${hash}`,
      nickname: "БезКонтактаТест",
      gender: "male",
      emailVerified: true,
    },
  });
  const token = randomUUID();
  await p.session.create({ data: { token, userId: u.id } });

  const r = await fetch(`${BASE}/api/help`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      title: "Помогите донести продукты",
      body: "Нужна помощь донести сумки до дома, без контактных данных.",
      place: "",
      contact: "",
    }),
  });
  const d = await r.json();
  const okPublish = r.status === 200 && !d.hidden;
  console.log(`POST без контакта: ${r.status} hidden=${d.hidden} | ${d.note ?? d.error}`);
  console.log(okPublish ? "✓ контакт необязателен" : "✗ контакт всё ещё обязателен");

  // чистка
  if (d.id) await p.helpPublication.delete({ where: { id: d.id } }).catch(() => {});
  await p.helpComplaint.deleteMany({ where: { request: { authorId: u.id } } });
  await p.helpPublication.deleteMany({ where: { authorId: u.id } });
  await p.sanction.deleteMany({ where: { userId: u.id } });
  await p.session.deleteMany({ where: { userId: u.id } });
  await p.user.delete({ where: { id: u.id } });
  console.log("чистка выполнена");
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
