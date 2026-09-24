import { chromium } from "playwright";
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1920, height: 900 } });
await pg.goto("http://localhost:3000/obyavleniya", { waitUntil: "networkidle", timeout: 45000 }).catch(()=>{});
await pg.waitForSelector(".main-grid-container", { timeout: 20000 }).catch(()=>{});
await pg.waitForTimeout(2000);
const info = await pg.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const r = (el) => el ? (({left,right,width}) => ({left:Math.round(left),right:Math.round(right),width:Math.round(width)}))(el.getBoundingClientRect()) : null;
  return {
    hasGrid: !!q(".main-grid-container"),
    adGrid: !!q(".ad-grid"),
    bodySnippet: document.body.innerText.slice(0, 120).replace(/\n/g, " | "),
    left: r(q(".ad-grid > .left-column")),
    center: r(q(".ad-grid > .center-column")),
    right: r(q(".ad-grid > .right-column")),
    gap: q(".main-grid-container") ? getComputedStyle(q(".main-grid-container")).gap : null,
  };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
