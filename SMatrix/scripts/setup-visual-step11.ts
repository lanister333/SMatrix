/** Подготовка браузерной проверки ШАГ 11: пользователь с ограничением + скрытое сообщение. */
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { applySanction } from "../src/lib/moderation/sanctions";

const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");

async function main() {
  const u = await db.user.create({
    data: {
      email: `vis.${stamp}@test.local`,
      passwordHash: hashPassword("Test12345678"),
      nickname: `vischeck${stamp}`,
      emailVerified: true,
    },
  });
  const token = "vis" + Math.random().toString(36).slice(2, 24);
  await db.session.create({ data: { token, userId: u.id } });

  // Ограничение на 24 часа (как после повторного нарушения ИИ)
  const sanction = await applySanction({
    userId: u.id,
    kind: "limit_24h",
    reason: "повторные оскорбления участников (визуальная проверка ШАГ 11)",
    source: "ai",
  });

  // Скрытое ИИ сообщение этого пользователя в свежей теме для проверки «Оспорить решение»
  const rubric = await db.rubric.findFirst({ where: { parentId: null } });
  const topic = await db.topic.create({
    data: {
      number: 90000 + Math.floor(Math.random() * 9999),
      title: `Визуальная проверка ШАГ 11 (${stamp})`,
      authorName: u.nickname,
      authorId: u.id,
      rubricId: rubric!.id,
    },
  });
  const msg = await db.message.create({
    data: {
      topicId: topic.id,
      num: 1,
      authorName: u.nickname,
      authorId: u.id,
      body: "Сообщение с нарушением для проверки кнопки Оспорить решение.",
      isHiddenByAi: true,
      hiddenReason: "оскорбление участника обсуждения",
      aiNote: "ИИ: прямое оскорбление собеседника",
    },
  });

  console.log(JSON.stringify({ token, nickname: u.nickname, topicId: topic.id, msgId: msg.id, sanctionId: sanction.id }));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
