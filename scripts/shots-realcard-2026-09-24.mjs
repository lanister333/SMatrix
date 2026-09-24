/* Повтор: реальная карточка ленты с ответом (цветной ник в шапке и в ответе). */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3000";
const RUN = Date.now().toString(36);
const prisma = new PrismaClient();

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const login = await page.request.post(`${BASE}/api/auth/login`, {
    data: { email: "u1_модератор@sakhmatrix.local", password: "Moderator2026" },
  });
  const { user } = await login.json();
  const r = await page.request.post(`${BASE}/api/wheretobuy`, {
    data: {
      token: user.token,
      title: `Где купить подшипник NSK 6205-DDU (скрин ${RUN})`,
      text: "Ищу оригинальный подшипник NSK 6205-DDU (25х52х15), нужен магазин в Южно-Сахалинске с наличием.",
      place: "Южно-Сахалинск",
      confirmSimilar: true,
    },
  });
  const d = await r.json();
  console.log("создан:", d.id, "hidden:", d.hidden);
  if (d.id) {
    const a = await page.request.patch(`${BASE}/api/wheretobuy/${d.id}`, {
      data: { token: user.token, action: "answer", answerText: "Есть в «ЯпонДеталь» на Пуркаева, 152 — в наличии, 2450 руб." },
    });
    console.log("ответ:", a.status(), JSON.stringify(await a.json()).slice(0, 120));
    await page.goto(`${BASE}/gde-kupit`, { waitUntil: "domcontentloaded" });
    const el = await page.waitForSelector(`.wb-item[data-wb-id="${d.id}"]`, { timeout: 30000 });
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await el.screenshot({ path: "/home/z/my-project/download/sm-cols-fixes-realcard-answers-2026-09-24.png" });
    await page.request.patch(`${BASE}/api/wheretobuy/${d.id}`, { data: { token: user.token, action: "delete" } });
  }
  await browser.close();

  // физическая уборка скрин-постов
  const rows = await prisma.whereToBuyPost.findMany({ where: { title: { contains: "(скрин " } }, select: { id: true, isDeleted: true } });
  for (const p of rows) { await prisma.whereToBuyPost.delete({ where: { id: p.id } }); console.log("удалён физически:", p.id, "isDeleted=" + p.isDeleted); }
  console.log("живых wtb:", await prisma.whereToBuyPost.count({ where: { isDeleted: false } }), "| живых cd:", await prisma.cheapPost.count({ where: { isDeleted: false } }));
})()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
