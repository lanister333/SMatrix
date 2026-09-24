import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(`${BASE}/rekomenduyu`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("[data-rc-id], .rc-sideblock", { timeout: 30000 });
const info = await page.evaluate(() => {
  const blocks = [...document.querySelectorAll(".rc-sideblock")].slice(0, 3).map((b) => {
    const cs = getComputedStyle(b);
    return { border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`, radius: cs.borderRadius };
  });
  const addbtns = [...document.querySelectorAll(".rc-addbtn")].map((b) => ({ where: b.closest(".rc-col-left") ? "left" : "center", bg: getComputedStyle(b).backgroundColor }));
  const newbtns = [...document.querySelectorAll(".rc-newbtn")].map((b) => getComputedStyle(b).backgroundColor);
  const find = [...document.querySelectorAll(".rc-search button")].map((b) => getComputedStyle(b).backgroundColor);
  const forumBtns = [...document.querySelectorAll(".rc-btn-forum")].map((b) => ({ text: (b.textContent || "").trim(), bg: getComputedStyle(b).backgroundColor }));
  const cards = document.querySelectorAll("[data-rc-id]").length;
  return { blocks, addbtns, newbtns: newbtns.length, find, forumBtns, cards };
});
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: "scripts/shot-rc-before.png" });
await browser.close();
