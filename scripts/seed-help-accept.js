/** Сид тестовой публикации для приёмки UI (удаляется cleanup-скриптом). */
const { PrismaClient } = require("@prisma/client");
const { randomUUID, randomBytes, scryptSync } = require("crypto");
const p = new PrismaClient();
(async () => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync("Test12345!", salt, 64).toString("hex");
  const u = await p.user.create({
    data: { email: "helpseed@test.local", passwordHash: `${salt}:${hash}`, nickname: "ТестСид", gender: "male", emailVerified: true },
  });
  const token = randomUUID();
  await p.session.create({ data: { token, userId: u.id } });
  const longBody = "Прошу помощи у неравнодушных жителей города. " + "Нужно помочь пожилому человеку — отнести продукты из аптеки и магазина, подняться на четвёртый этаж без лифта, немного прибраться на балконе перед зимой. ".repeat(12) + "Буду очень благодарен за любую помощь.";
  const items = [
    { title: "Помочь пожилому соседке с продуктами", body: longBody, contact: "", status: "open" },
    { title: "Найти потерянного кота во дворе", body: "Потерялся рыжий кот, откликается на «Барсик». Возможно убежал в сторону парка.", contact: "@barsik_owner", status: "open" },
    { title: "Помочь разобраться в документах", body: "Нужен совет по заполнению заявления — уже решено, спасибо всем!", contact: "тел. в личке", status: "resolved" },
    { title: "Отдам коробку книг", body: "Просьба потеряла актуальность — книги уже забрали волонтёры.", contact: "", status: "irrelevant" },
  ];
  let delay = items.length;
  for (const it of items) {
    await p.helpPublication.create({
      data: { title: it.title, body: it.body, place: "", contact: it.contact, authorId: u.id, authorName: u.nickname, status: it.status, aiStatus: "ok", aiNote: "тестовое объявление" },
    });
  }
  console.log("seeded:", items.length, "userId:", u.id);
  await p.$disconnect();
})();
