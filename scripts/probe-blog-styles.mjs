/**
 * Проба ТЗ 2026-09-21: стили блога заказчика (slate/teal, радиусы 6/8px).
 * Проверки computed-styles:
 *  1) .btn-open-blog в списке: bg #f1f5f9, teal #0f766e, radius 6px, w600;
 *     hover → bg teal, текст белый;
 *  2) блог: контейнер белый/радиус 8/паддинг 30; шапка БЕЗ navy-фона,
 *     border-bottom 2px #f1f5f9; h2 22px #1e293b; автор 13px #64748b;
 *  3) посты: разделитель dashed #e2e8f0 (у последнего нет), дата 12px
 *     #94a3b8, заголовок 16px, текст 14px/1.6 #334155; плейсхолдер
 *     bg #f8fafc + dashed #cbd5e1 + radius 6;
 *  4) футер: bg #f8fafc, только border-top, радиус 8; WA-кнопка radius 6;
 *  5) мобайл 375: docW === vw в списке и в блоге.
 * Скриншоты: scripts/shots/blog-styles-*.png
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:3000";
const SHOTS = "scripts/shots";
fs.mkdirSync(SHOTS, { recursive: true });

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const ok = (name, cond, extra = "") =>
  console.log(`${cond ? "OK  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/startup.php", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector(".startup-stream", { timeout: 45000 });
  await page.waitForTimeout(1000);

  // 1) кнопка в списке
  const btn = page.locator('.startup-card[data-company-id="aniva-timber"] .btn-open-blog');
  const bs = await btn.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, color: s.color, r: s.borderRadius, w: s.fontWeight, bd: s.borderColor };
  });
  ok("1. кнопка списка: bg #f1f5f9", bs.bg === rgb("#f1f5f9"), bs.bg);
  ok("1a. текст teal #0f766e, рамка #cbd5e1", bs.color === rgb("#0f766e") && bs.bd === rgb("#cbd5e1"), `${bs.color}/${bs.bd}`);
  ok("1b. radius 6px, вес 600", bs.r === "6px" && bs.w === "600", `${bs.r}/${bs.w}`);
  await btn.hover();
  await page.waitForTimeout(350);
  const bsH = await btn.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, color: s.color };
  });
  ok("1c. hover: bg teal, текст белый", bsH.bg === rgb("#0f766e") && bsH.color === rgb("#ffffff"), `${bsH.bg}/${bsH.color}`);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  await page.locator('.startup-card[data-company-id="aniva-timber"]').screenshot({ path: `${SHOTS}/blog-styles-card.png` });

  // открыть блог
  await btn.click();
  await page.waitForSelector(".matrix-brand-blog-container", { timeout: 10000 });
  await page.waitForTimeout(500);

  // 2) контейнер + шапка
  const cs = await page.locator(".matrix-brand-blog-container").evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, r: s.borderRadius, p: s.paddingTop, bd: s.borderColor };
  });
  ok("2. контейнер: белый, radius 8, паддинг 30", cs.bg === rgb("#ffffff") && cs.r === "8px" && cs.p === "30px", JSON.stringify(cs));
  const hs = await page.locator(".blog-brand-header").evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, bbw: s.borderBottomWidth, bbc: s.borderBottomColor, gap: s.gap };
  });
  ok("2a. шапка без navy-фона, черта 2px #f1f5f9", hs.bg === "rgba(0, 0, 0, 0)" && hs.bbw === "2px" && hs.bbc === rgb("#f1f5f9"), JSON.stringify(hs));
  const h2 = await page.locator(".brand-meta h2").evaluate((el) => {
    const s = getComputedStyle(el);
    return { fs: s.fontSize, c: s.color };
  });
  ok("2b. h2 22px #1e293b", h2.fs === "22px" && h2.c === rgb("#1e293b"), JSON.stringify(h2));
  const au = await page.locator(".brand-author").evaluate((el) => {
    const s = getComputedStyle(el);
    return { fs: s.fontSize, c: s.color };
  });
  ok("2c. автор 13px #64748b", au.fs === "13px" && au.c === rgb("#64748b"), JSON.stringify(au));

  // 3) посты
  const items = await page.locator(".blog-post-item").evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el);
      return { bbw: s.borderBottomWidth, bbs: s.borderBottomStyle, bc: s.borderBottomColor, pb: s.paddingBottom };
    })
  );
  ok("3. разделитель dashed #e2e8f0 у первого", items[0]?.bbs === "dashed" && items[0]?.bc === rgb("#e2e8f0"), JSON.stringify(items[0]));
  ok("3a. у последнего разделителя нет", items[items.length - 1]?.bbw === "0px", JSON.stringify(items[items.length - 1]));
  const pd = await page.locator(".post-date").first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { fs: s.fontSize, c: s.color, bg: s.backgroundColor, w: s.fontWeight };
  });
  ok("3b. дата 12px #94a3b8 без подложки", pd.fs === "12px" && pd.c === rgb("#94a3b8") && pd.bg === "rgba(0, 0, 0, 0)" && pd.w === "600", JSON.stringify(pd));
  const pt = await page.locator(".post-title").first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { fs: s.fontSize, c: s.color };
  });
  ok("3c. заголовок 16px #1e293b", pt.fs === "16px" && pt.c === rgb("#1e293b"), JSON.stringify(pt));
  const pc = await page.locator(".post-content").first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { fs: s.fontSize, lh: s.lineHeight, c: s.color };
  });
  ok("3d. текст 14px / 1.6 #334155", pc.fs === "14px" && Math.abs(parseFloat(pc.lh) - 22.4) < 0.5 && pc.c === rgb("#334155"), JSON.stringify(pc));
  const mp = await page.locator(".post-media-placeholder").first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, bds: s.borderStyle, bdc: s.borderColor, r: s.borderRadius };
  });
  ok("3e. плейсхолдер #f8fafc dashed #cbd5e1 radius 6", mp.bg === rgb("#f8fafc") && mp.bds === "dashed" && mp.bdc === rgb("#cbd5e1") && mp.r === "6px", JSON.stringify(mp));

  // 4) футер
  const ft = await page.locator(".blog-brand-footer").evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, btw: s.borderTopWidth, bbw: s.borderBottomWidth, r: s.borderRadius, ta: s.textAlign };
  });
  ok("4. футер #f8fafc, только border-top, radius 8, центр", ft.bg === rgb("#f8fafc") && ft.btw === "1px" && ft.bbw === "0px" && ft.r === "8px" && ft.ta === "center", JSON.stringify(ft));
  const wa = await page.locator(".btn-startup-whatsapp-large").evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, r: s.borderRadius };
  });
  ok("4a. WA-кнопка зелёная, radius 6", wa.bg === rgb("#2E7D32") && wa.r === "6px", JSON.stringify(wa));

  await page.locator(".matrix-brand-blog-container").screenshot({ path: `${SHOTS}/blog-styles-desktop.png` });
  await page.close();

  // 5) мобайл 375
  const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mob.goto(BASE + "/startup.php", { waitUntil: "domcontentloaded", timeout: 45000 });
  await mob.waitForSelector(".startup-stream", { timeout: 45000 });
  await mob.waitForTimeout(800);
  ok("5. мобайл список: docW=375", (await mob.evaluate(() => document.documentElement.scrollWidth)) === 375);
  await mob.locator('.startup-card[data-company-id="aniva-timber"] .btn-open-blog').click();
  await mob.waitForSelector(".matrix-brand-blog-container", { timeout: 10000 });
  await mob.waitForTimeout(500);
  const docW = await mob.evaluate(() => document.documentElement.scrollWidth);
  ok("5a. мобайл блог: docW=375 (без горскролла)", docW === 375, `docW=${docW}`);
  await mob.locator(".matrix-brand-blog-container").screenshot({ path: `${SHOTS}/blog-styles-mobile.png` });
  await mob.close();
} finally {
  await browser.close();
}
console.log("PROBE DONE");
