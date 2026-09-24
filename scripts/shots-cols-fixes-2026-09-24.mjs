/* Скриншоты правок колонок 2026-09-24: страницы целиком + карточка крупно
   (цветные ники, рамки, кнопки левой колонки). Реальная карточка ленты —
   создаётся тестовый пост (уникальный заголовок), после снимка удаляется. */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/download";
const RUN = Date.now().toString(36);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // 1) /gde-kupit целиком (левая колонка + центральная с карточками)
  await page.goto(`${BASE}/gde-kupit`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/sm-cols-fixes-gde-kupit-page-2026-09-24.png` });

  // 2) карточка e2e-сценария крупно (шапка с цветным ником, кнопки)
  const card = await page.$(`[data-e2e-panel="wtb"] [data-e2e-scenario="2"]`);
  if (card) await card.screenshot({ path: `${OUT}/sm-cols-fixes-gde-kupit-card-2026-09-24.png` });

  // 3) левая колонка крупно (одинаковые кнопки)
  const aside = await page.$(`.wb-col-left`);
  if (aside) await aside.screenshot({ path: `${OUT}/sm-cols-fixes-gde-kupit-leftcol-2026-09-24.png` });

  // 4) /gde-deshevle целиком
  await page.goto(`${BASE}/gde-deshevle`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/sm-cols-fixes-gde-deshevle-page-2026-09-24.png` });
  const card2 = await page.$(`[data-e2e-panel="cheap"] [data-e2e-scenario="5"]`);
  if (card2) await card2.screenshot({ path: `${OUT}/sm-cols-fixes-gde-deshevle-card-2026-09-24.png` });

  // 5) реальная карточка ленты с ответом (создать → ответить → снять → удалить)
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
  if (d.id) {
    await page.request.patch(`${BASE}/api/wheretobuy/${d.id}`, {
      data: { token: user.token, action: "answer", answerText: "Есть в «ЯпонДеталь» на Пуркаева, 152 — в наличии, 2450 руб." },
    });
    await page.goto(`${BASE}/gde-kupit`, { waitUntil: "networkidle" });
    const el = await page.$(`.wb-item[data-wb-id="${d.id}"]`);
    if (el) await el.screenshot({ path: `${OUT}/sm-cols-fixes-realcard-answers-2026-09-24.png` });
    await page.request.patch(`${BASE}/api/wheretobuy/${d.id}`, { data: { token: user.token, action: "delete" } });
  }
  await browser.close();
  console.log("скриншоты готовы");
})().catch((e) => { console.error(e); process.exit(1); });
