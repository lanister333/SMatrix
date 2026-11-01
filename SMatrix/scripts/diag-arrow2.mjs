import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("li.sk-rubric-row .sk-rubric-name", { timeout: 30000 });
const d = await page.evaluate(() => {
  const li = [...document.querySelectorAll("li.sk-rubric-row")].find(l => l.querySelector(".sk-rubric-name .arr"));
  const arr = li.querySelector(".arr");
  const name = li.querySelector(".sk-rubric-name");
  const cs = getComputedStyle(arr);
  const csn = getComputedStyle(name);
  return {
    arr: { y: arr.getBoundingClientRect().y, h: arr.getBoundingClientRect().height, fs: cs.fontSize, lh: cs.lineHeight, disp: cs.display, transform: cs.transform, vert: cs.verticalAlign },
    name: { y: name.getBoundingClientRect().y, h: name.getBoundingClientRect().height, lh: csn.lineHeight, fs: csn.fontSize, pad: csn.padding },
    diff: arr.getBoundingClientRect().y - name.getBoundingClientRect().y,
  };
});
console.log(JSON.stringify(d, null, 2));
await browser.close();
