/**
 * Проба ТЗ 2026-09-21 (раунд 2): бизнес-страница «Анива Тимбер» —
 * обновлённый CSS заказчика. Проверки:
 *  1) список: кнопка .btn-open-blog + зелёная карточная WA (регрессы);
 *  2) клик → список скрыт, видна #bizpage-aniva-timber + возврат;
 *     контейнер radius 12/padding 32/color #1e293b;
 *  3) hero: БЕЗ подложки, черта снизу 1px #f1f5f9 (pb/mb 24);
 *     тег #ccfbf1 uppercase; заголовок teal 26px/800; слоган 15px;
 *     бейдж-пилюля #f1f5f9/#cbd5e1 radius 20 #64748b;
 *  4) сетка фактов: 3 колонки (десктоп), gap 16, карточки 16/12;
 *  5) дневник: h4 18px, рельс border-left 2px #e2e8f0 (padding-left 16),
 *     записи БЕЗ dashed, дата 11px, тексты 1-в-1, 13px #475569;
 *  6) блок действия: полная рамка, аватар 24px без чипа, WA
 *     #22c55e → hover #16a34a, 14px/600, padding 12/24, radius 6;
 *  7) возврат в список;
 *  8) мобайл 375: docW === vw, hero переносит бейдж, сетка 1 колонка.
 * Скриншоты: scripts/shots/biz-page-*.png
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
const norm = (t) => (t || "").replace(/\s+/g, " ").trim();

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/startup.php", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector(".startup-stream", { timeout: 45000 });
  await page.waitForTimeout(800);

  // 1) регрессы списка
  const card = page.locator('.startup-card[data-company-id="aniva-timber"]');
  await card.locator(".startup-card-main").screenshot({ path: `${SHOTS}/biz-page-card.png` });
  const bs = await card.locator(".btn-open-blog").evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, color: s.color, r: s.borderRadius };
  });
  ok("1. кнопка списка (регресс): bg #f1f5f9/teal/radius 6",
    bs.bg === rgb("#f1f5f9") && bs.color === rgb("#0f766e") && bs.r === "6px",
    `${bs.bg}/${bs.color}/${bs.r}`);
  const waCard = await card.locator(".btn-startup-whatsapp").evaluate((el) => {
    const s = getComputedStyle(el);
    return { color: s.color, td: s.textDecorationLine, bg: s.backgroundColor };
  });
  ok("1b. карточная WA-кнопка: зелёный текст, без подчёркивания",
    waCard.color === rgb("#2E7D32") && waCard.td === "none" && waCard.bg === rgb("#ffffff"),
    JSON.stringify(waCard));

  // 2) клик → бизнес-страница
  await card.locator(".btn-open-blog").click();
  await page.waitForSelector("#bizpage-aniva-timber", { timeout: 45000 });
  await page.waitForTimeout(500);
  const listHidden = await page
    .locator(".sakh-matrix-startup-container")
    .evaluate((el) => getComputedStyle(el).display === "none");
  ok("2. список скрыт display:none при открытой странице", listHidden);
  const backTxt = norm(await page.locator(".biz-backrow .btn-back-to-list").textContent());
  ok("2a. возврат «⬅️ К списку стартапов» присутствует",
    backTxt.includes("К списку стартапов"), backTxt);
  const cont = await page.locator(".matrix-business-page").evaluate((el) => {
    const s = getComputedStyle(el);
    return { r: s.borderRadius, p: s.padding, c: s.color };
  });
  ok("2b. контейнер: radius 12, padding 32, color #1e293b",
    cont.r === "12px" && cont.p === "32px" && cont.c === rgb("#1e293b"), JSON.stringify(cont));

  // 3) hero-баннер
  const hero = page.locator("#bizpage-aniva-timber .biz-hero-section");
  const heroSt = await hero.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, bbw: s.borderBottomWidth, bbc: s.borderBottomColor, pb: s.paddingBottom, mb: s.marginBottom, jc: s.justifyContent, fw: s.flexWrap };
  });
  ok("3. hero: без подложки, черта 1px #f1f5f9, pb/mb 24, space-between",
    heroSt.bg === "rgba(0, 0, 0, 0)" && heroSt.bbw === "1px" && heroSt.bbc === rgb("#f1f5f9") &&
    heroSt.pb === "24px" && heroSt.mb === "24px" && heroSt.jc === "space-between" && heroSt.fw === "wrap",
    JSON.stringify(heroSt));
  const tagTxt = norm(await hero.locator(".biz-category-tag").textContent());
  ok("3a. тег категории «Крафтовая мастерская»", tagTxt === "Крафтовая мастерская", tagTxt);
  const tagSt = await hero.locator(".biz-category-tag").evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, color: s.color, r: s.borderRadius, fs: s.fontSize, tt: s.textTransform };
  });
  ok("3b. тег: #ccfbf1/teal, radius 6, 12px, UPPERCASE",
    tagSt.bg === rgb("#ccfbf1") && tagSt.color === rgb("#0f766e") && tagSt.r === "6px" &&
    tagSt.fs === "12px" && tagSt.tt === "uppercase", JSON.stringify(tagSt));
  const titleTxt = norm(await hero.locator(".biz-title").textContent());
  const titleSt = await hero.locator(".biz-title").evaluate((el) => {
    const s = getComputedStyle(el);
    return { fs: s.fontSize, fw: s.fontWeight, c: s.color };
  });
  ok("3c. заголовок «Анива Тимбер» 26px/800 teal",
    titleTxt === "Анива Тимбер" && titleSt.fs === "26px" && titleSt.fw === "800" && titleSt.c === rgb("#0f766e"),
    `${titleTxt} ${JSON.stringify(titleSt)}`);
  const taglineTxt = norm(await hero.locator(".biz-tagline").textContent());
  const taglineSt = await hero.locator(".biz-tagline").evaluate((el) => getComputedStyle(el).fontSize);
  ok("3d. слоган 1-в-1 (с 🔥), 15px",
    taglineTxt === "🔥 Создаем мебель и декор из штормового дерева Анивского залива" && taglineSt === "15px",
    `${taglineTxt} / ${taglineSt}`);
  const badgeTxt = norm(await hero.locator(".biz-status-badge").textContent());
  const badgeSt = await hero.locator(".biz-status-badge").evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, bc: s.borderColor, r: s.borderRadius, c: s.color };
  });
  ok("3e. бейдж-пилюля: #f1f5f9/#cbd5e1, radius 20, #64748b",
    badgeTxt === "Стартап на SakhMatrix" && badgeSt.bg === rgb("#f1f5f9") &&
    badgeSt.bc === rgb("#cbd5e1") && badgeSt.r === "20px" && badgeSt.c === rgb("#64748b"),
    `${badgeTxt} ${JSON.stringify(badgeSt)}`);

  // 4) сетка ключевых фактов
  const feats = page.locator("#bizpage-aniva-timber .feature-card");
  const featCount = await feats.count();
  const gridSt = await page.locator("#bizpage-aniva-timber .biz-features-grid").evaluate((el) => {
    const s = getComputedStyle(el);
    return { cols: s.gridTemplateColumns.split(" ").length, gap: s.columnGap, mb: s.marginBottom };
  });
  ok("4. сетка фактов: 3 карточки, 3 колонки, gap 16",
    featCount === 3 && gridSt.cols === 3 && gridSt.gap === "16px", `count=${featCount}, ${JSON.stringify(gridSt)}`);
  const featLabels = await feats.locator("h6").allTextContents();
  ok("4a. подписи фактов 1-в-1",
    norm(featLabels.join("|")) === "Локация|Материал|Честный подход",
    featLabels.join(" / "));
  const featTexts = await feats.locator("p").allTextContents();
  ok("4b. тексты фактов 1-в-1",
    norm(featTexts[0]) === "Производство в г. Анива. Доставка по всему Сахалину." &&
    norm(featTexts[1]) === "Настоящий сахалинский плавник, мореная древесина, эпоксидная смола." &&
    norm(featTexts[2]) === "Личная ответственность мастеров. Договор. Без скрытых наценок.",
    featTexts.map(norm).join(" | "));
  const featSt = await feats.first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, r: s.borderRadius, p: s.padding, gap: s.columnGap };
  });
  ok("4c. карточка факта: #f8fafc, radius 8, padding 16, gap 12",
    featSt.bg === rgb("#f8fafc") && featSt.r === "8px" && featSt.p === "16px" && featSt.gap === "12px",
    JSON.stringify(featSt));

  // 5) Дневник основателя
  const h4Txt = norm(await page.locator("#bizpage-aniva-timber .biz-content-section h4").textContent());
  const h4St = await page.locator("#bizpage-aniva-timber .biz-content-section h4").evaluate((el) => {
    const s = getComputedStyle(el);
    return { fs: s.fontSize, bbw: s.borderBottomWidth, mb: s.marginBottom };
  });
  ok("5. «Дневник основателя» 18px, без черты снизу",
    h4Txt === "Дневник основателя" && h4St.fs === "18px" && h4St.bbw === "0px", `${h4Txt} ${JSON.stringify(h4St)}`);
  const rail = await page.locator("#bizpage-aniva-timber .biz-timeline").evaluate((el) => {
    const s = getComputedStyle(el);
    return { blw: s.borderLeftWidth, blc: s.borderLeftColor, pl: s.paddingLeft };
  });
  ok("5a. рельс: border-left 2px #e2e8f0, padding-left 16",
    rail.blw === "2px" && rail.blc === rgb("#e2e8f0") && rail.pl === "16px", JSON.stringify(rail));
  const items = page.locator("#bizpage-aniva-timber .timeline-item");
  const itemCount = await items.count();
  const itemSt = await items.evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el);
      return { bbw: s.borderBottomWidth, pos: s.position };
    })
  );
  ok("5b. 2 записи; БЕЗ dashed-разделителей, position:relative",
    itemCount === 2 && itemSt.every((x) => x.bbw === "0px" && x.pos === "relative"),
    `count=${itemCount} ${JSON.stringify(itemSt)}`);
  const metaTxt = norm(await items.nth(0).locator(".item-meta").textContent());
  const metaSt = await items.nth(0).locator(".item-meta").evaluate((el) => getComputedStyle(el).fontSize);
  ok("5c. дата 1-в-1, 11px",
    metaTxt === "21 сентября 2026" && metaSt === "11px", `${metaTxt} / ${metaSt}`);
  const h5Txts = (await items.locator("h5").allTextContents()).map(norm);
  ok("5d. заголовки записей 1-в-1",
    h5Txts[0] === "Борьба с влажностью и смолой" && h5Txts[1] === "Первый шаг на SakhMatrix",
    h5Txts.join(" / "));
  const pTxts = (await items.locator("p").allTextContents()).map(norm);
  ok("5e. текст записи №1 1-в-1 (с 5000₽)",
    pTxts[0] === "Из-за высокой островной влажности первый слой заливки пошел пузырями. Полностью сошлифовали материал, потеряли 5000₽, но клиенту отдадим идеальный стол. Качество важнее денег.",
    pTxts[0].slice(0, 60) + "…");
  ok("5f. текст записи №2 1-в-1",
    pTxts[1] === "Ушли с наемной стройки, открыли свой цех в гараже. Готовы делом доказать качество каждому земляку!",
    pTxts[1]);
  const pSt = await items.first().locator("p").evaluate((el) => {
    const s = getComputedStyle(el);
    return { fs: s.fontSize, c: s.color };
  });
  ok("5g. текст записи: 13px #475569",
    pSt.fs === "13px" && pSt.c === rgb("#475569"), JSON.stringify(pSt));

  // 6) блок действия
  const bar = page.locator("#bizpage-aniva-timber .biz-action-bar");
  const barSt = await bar.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, bw: s.borderTopWidth, bc: s.borderTopColor, p: s.padding, r: s.borderRadius, mt: s.marginTop };
  });
  ok("6. блок действия: #f8fafc, полная рамка, padding 16px 24px, radius 8",
    barSt.bg === rgb("#f8fafc") && barSt.bw === "1px" && barSt.bc === rgb("#e2e8f0") &&
    barSt.p === "16px 24px" && barSt.r === "8px" && barSt.mt === "32px", JSON.stringify(barSt));
  const avatarTxt = norm(await bar.locator(".owner-avatar").textContent());
  const avatarSt = await bar.locator(".owner-avatar").evaluate((el) => {
    const s = getComputedStyle(el);
    return { fs: s.fontSize, bg: s.backgroundColor };
  });
  const ownerTxts = await bar.locator(".action-owner-info h6, .action-owner-info p").allTextContents();
  ok("6a. владелец: 👨‍💻 (24px, без чипа) Игорь Радченко — Основатель мастерской",
    avatarTxt === "👨‍💻" && avatarSt.fs === "24px" && avatarSt.bg === "rgba(0, 0, 0, 0)" &&
    norm(ownerTxts[0]) === "Игорь Радченко" && norm(ownerTxts[1]) === "Основатель мастерской",
    `${avatarTxt} ${JSON.stringify(avatarSt)} ${ownerTxts.map(norm).join(" / ")}`);
  const wa = bar.locator(".btn-action-wa");
  const waAttr = await wa.evaluate((el) => ({
    href: el.getAttribute("href"),
    target: el.getAttribute("target"),
    txt: el.textContent,
  }));
  const waSt = await wa.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, color: s.color, r: s.borderRadius, fs: s.fontSize, fw: s.fontWeight, p: s.padding };
  });
  ok("6b. WA-кнопка: https://wa.me, _blank, текст 1-в-1, #22c55e 14px/600 12/24 radius 6",
    waAttr.href === "https://wa.me" && waAttr.target === "_blank" &&
    norm(waAttr.txt) === "💬 Написать мастеру в WhatsApp" &&
    waSt.bg === rgb("#22c55e") && waSt.color === rgb("#ffffff") && waSt.r === "6px" &&
    waSt.fs === "14px" && waSt.fw === "600" && waSt.p === "12px 24px",
    JSON.stringify({ ...waAttr, ...waSt }));
  await wa.hover();
  await page.waitForTimeout(300);
  const waHover = await wa.evaluate((el) => getComputedStyle(el).backgroundColor);
  ok("6c. WA hover: #16a34a", waHover === rgb("#16a34a"), waHover);

  await page.locator(".matrix-business-page").screenshot({ path: `${SHOTS}/biz-page-desktop.png` });

  // 7) возврат в список
  await page.locator(".biz-backrow .btn-back-to-list").click();
  await page.waitForTimeout(400);
  const listBack = await page
    .locator(".sakh-matrix-startup-container")
    .evaluate((el) => getComputedStyle(el).display !== "none");
  const pageGone = (await page.locator("#bizpage-aniva-timber").count()) === 0;
  ok("7. возврат: список виден, страница удалена из DOM", listBack && pageGone);

  // 8) мобайл 375
  const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mob.goto(BASE + "/startup.php", { waitUntil: "domcontentloaded", timeout: 45000 });
  await mob.waitForSelector(".startup-stream", { timeout: 45000 });
  await mob.waitForTimeout(600);
  const mobDocW1 = await mob.evaluate(() => document.documentElement.clientWidth);
  ok("8. мобайл список: docW === 375", mobDocW1 === 375, `docW=${mobDocW1}`);
  await mob.locator('.startup-card[data-company-id="aniva-timber"] .btn-open-blog').click();
  await mob.waitForSelector("#bizpage-aniva-timber", { timeout: 45000 });
  await mob.waitForTimeout(500);
  const mobDocW2 = await mob.evaluate(() => document.documentElement.clientWidth);
  ok("8a. мобайл страница: docW === 375 (без горскролла)", mobDocW2 === 375, `docW=${mobDocW2}`);
  const mobCols = await mob
    .locator("#bizpage-aniva-timber .biz-features-grid")
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  ok("8b. мобайл: сетка фактов в 1 колонку", mobCols === 1, `cols=${mobCols}`);
  const mobBadgeWrapped = await mob.evaluate(() => {
    const hero = document.querySelector("#bizpage-aniva-timber .biz-hero-section");
    const badge = hero.querySelector(".biz-status-badge");
    const title = hero.querySelector(".biz-title");
    return badge.getBoundingClientRect().top > title.getBoundingClientRect().top;
  });
  ok("8c. мобайл: бейдж переносится под шапку", mobBadgeWrapped);
  await mob.locator(".matrix-business-page").screenshot({ path: `${SHOTS}/biz-page-mobile.png` });

  console.log("PROBE DONE");
} finally {
  await browser.close();
}
