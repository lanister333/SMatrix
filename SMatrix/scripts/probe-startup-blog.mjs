/**
 * Проба ТЗ 2026-09-21 (доработка): блог «Анива Тимбер» на /startup.php.
 * Проверки:
 *  1) по умолчанию блога нет — виден список стартапов;
 *  2) «Читать блог новичка» на карточке aniva-timber → блог виден,
 *     список display:none, шапка/автор/2 поста (свежий сверху)/фото-
 *     плейсхолдер/футер + WA-ссылка — тексты 1-в-1 из ТЗ;
 *  3) «⬅️ К списку стартапов» → блог скрыт, список вернулся;
 *  4) «Клоп и Ко» и «СахКлимат» — тост-заглушка, блог НЕ открывается;
 *  5) мобайл 375: docW === vw, шапка блога переносится без горскролла.
 * Скриншоты: scripts/shots/startup-blog-*.png
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:3000";
const SHOTS = "scripts/shots";
fs.mkdirSync(SHOTS, { recursive: true });

const ok = (name, cond, extra = "") =>
  console.log(`${cond ? "OK  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`);

const browser = await chromium.launch();
try {
  // ---------- ДЕСКТОП ----------
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/startup.php", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector(".startup-stream", { timeout: 45000 });
  await page.waitForTimeout(1000);
  ok("1. по умолчанию блога нет, список виден",
    (await page.locator(".matrix-brand-blog-container").count()) === 0 &&
    await page.locator(".startup-stream").isVisible());

  // 2) открыть блог «Анивы Тимбер»
  await page.locator('.startup-card[data-company-id="aniva-timber"] .btn-open-blog').click();
  await page.waitForSelector(".matrix-brand-blog-container", { timeout: 10000 });
  await page.waitForTimeout(400);
  const listDisplay = await page.locator(".sakh-matrix-startup-container").evaluate((el) => getComputedStyle(el).display);
  ok("2. блог открыт, список display:none", listDisplay === "none", `display=${listDisplay}`);
  ok("2a. id контейнера = blog-aniva-timber",
    (await page.locator(".matrix-brand-blog-container").getAttribute("id")) === "blog-aniva-timber");

  const headTxt = (await page.locator(".blog-brand-header .brand-meta").innerText()).replace(/\s+/g, " ").trim();
  ok("2b. шапка: заголовок + автор из ТЗ",
    headTxt.includes("Блог мастерской «Анива Тимбер»") && headTxt.includes("Автор дневника: Игорь Радченко"), headTxt);

  const dates = (await page.locator(".blog-post-item .post-date").allTextContents()).map((s) => s.trim());
  const titles = (await page.locator(".blog-post-item .post-title").allTextContents()).map((s) => s.trim());
  ok("2c. два поста, свежий сверху (порядок ТЗ)",
    dates.length === 2 && dates[0] === "21 сентября 2026" && dates[1] === "10 сентября 2026",
    JSON.stringify(dates));
  ok("2d. заголовки постов 1-в-1",
    titles[0] === "Борьба с капризной смолой и первыми заказами" &&
    titles[1] === "Как хобби превратилось в бизнес. Первые шаги на SakhMatrix",
    JSON.stringify(titles));

  const content1 = (await page.locator(".blog-post-item .post-content").first().textContent()).trim();
  ok("2e. текст свежего поста из ТЗ (влажность/смола)",
    content1.includes("высокой влажности воздуха") && content1.includes("микропузырями") && content1.includes("5 тысяч рублей"));

  ok("2f. фото-плейсхолдер только у свежего поста",
    (await page.locator(".post-media-placeholder").allTextContents()).map((s) => s.trim()).join("|") ===
      "[Фото: Процесс шлифовки стола в мастерской]");

  const footTxt = (await page.locator(".blog-brand-footer").innerText()).replace(/\s+/g, " ").trim();
  const waHref = await page.locator(".btn-startup-whatsapp-large").getAttribute("href");
  ok("2g. футер: призыв + WA-кнопка (https://wa.me)",
    footTxt.includes("Понравился подход ребят? Поддержите островной бизнес делом!") &&
    footTxt.includes("💬 Обсудить заказ с Игорем в WhatsApp") && waHref === "https://wa.me", `href=${waHref}`);

  await page.locator(".matrix-brand-blog-container").screenshot({ path: `${SHOTS}/startup-blog-aniva.png` });

  // 3) возврат к списку
  await page.locator(".btn-back-to-list").click();
  await page.waitForTimeout(400);
  ok("3. «К списку стартапов» → блог скрыт, список вернулся",
    (await page.locator(".matrix-brand-blog-container").count()) === 0 &&
    await page.locator(".startup-stream").isVisible());

  // 4) у остальных — тост-заглушка
  await page.locator('.startup-card[data-company-id="клоп-и-ко"] .btn-open-blog').click();
  await page.waitForTimeout(400);
  const toast1 = await page.locator("div.fixed.bottom-4").textContent().catch(() => "");
  ok("4. «Клоп и Ко» — тост-заглушка, блог не открыт",
    (toast1 || "").includes("Блог компании скоро откроется") && (await page.locator(".matrix-brand-blog-container").count()) === 0);
  await page.locator('.startup-card[data-company-id="sakh-climat"] .btn-open-blog').click();
  await page.waitForTimeout(300);
  ok("4a. «СахКлимат» — тоже заглушка", (await page.locator(".matrix-brand-blog-container").count()) === 0);
  await page.close();

  // ---------- МОБАЙЛ 375 ----------
  const mp = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mp.goto(BASE + "/startup.php", { waitUntil: "domcontentloaded", timeout: 45000 });
  await mp.waitForSelector(".startup-stream", { timeout: 45000 });
  await mp.waitForTimeout(800);
  await mp.locator('.startup-card[data-company-id="aniva-timber"] .btn-open-blog').click();
  await mp.waitForSelector(".matrix-brand-blog-container", { timeout: 10000 });
  await mp.waitForTimeout(400);
  const docW = await mp.evaluate(() => document.documentElement.scrollWidth);
  ok("5. мобайл 375: блог без горскролла", docW === 375, `docW=${docW}`);
  const headWrap = await mp.locator(".blog-brand-header").evaluate((el) => {
    const s = getComputedStyle(el);
    return { display: s.display, wrap: s.flexWrap, h: el.getBoundingClientRect().height };
  });
  ok("5a. шапка блога: flex, перенос без @media", headWrap.display === "flex" && headWrap.wrap === "wrap" && headWrap.h > 40, JSON.stringify(headWrap));
  await mp.locator(".matrix-brand-blog-container").screenshot({ path: `${SHOTS}/startup-blog-mobile.png` });
  await mp.close();
} finally {
  await browser.close();
}
console.log("PROBE DONE");
