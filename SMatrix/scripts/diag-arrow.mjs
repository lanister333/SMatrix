import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("li.sk-rubric-row .sk-rubric-name", { timeout: 30000 });
const d = await page.evaluate(() => {
  const li = [...document.querySelectorAll("li.sk-rubric-row")].find(l => l.querySelector(".sk-rubric-name .arr"));
  const name = li.querySelector(".sk-rubric-name");
  const nameText = name.childNodes[0]; // текстовый узел
  const arr = li.querySelector(".arr");
  const tr = document.createRange();
  tr.selectNodeContents(name.childNodes[0]);
  const tb = tr.getBoundingClientRect();
  const ab = arr.getBoundingClientRect();
  const cs = getComputedStyle(arr);
  return {
    nameRect: { y: name.getBoundingClientRect().y, h: name.getBoundingClientRect().height },
    textBox: { y: tb.y, h: tb.height },
    arrBox: { y: ab.y, h: ab.height, w: ab.width },
    diffArrMinusName: ab.y - name.getBoundingClientRect().y,
    va: cs.verticalAlign, lh: cs.lineHeight, fs: cs.fontSize, disp: cs.display,
  };
});
console.log(JSON.stringify(d, null, 2));
await browser.close();
