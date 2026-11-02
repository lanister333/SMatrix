import { chromium } from "playwright";
const b = await chromium.launch();
for (const [name, url] of [["Подслушано","/podslyshano"],["ЖКХ","/gkh"],["Знакомства","/znakomstva"],["Где дешевле","/gde-deshevle"]]) {
  const pg = await b.newPage({ viewport: { width: 1920, height: 900 } });
  await pg.goto("http://localhost:3000" + url, { waitUntil: "networkidle", timeout: 45000 }).catch(()=>{});
  await pg.waitForTimeout(1200);
  const m = await pg.evaluate(() => {
    const r = (el) => el ? el.getBoundingClientRect() : null;
    const L = r(document.querySelector(".main-grid-container > .left-column"));
    const C = r(document.querySelector(".main-grid-container > .center-column"));
    const R = r(document.querySelector(".main-grid-container > .right-column"));
    const K = r(document.querySelector(".main-grid-container"));
    return !K ? "нет каркаса" :
      `каркас ${Math.round(K.width)} gap=${getComputedStyle(document.querySelector(".main-grid-container")).gap} | L=${(C.left-L.right).toFixed(1)} R=${(R.left-C.right).toFixed(1)} | скролл ${document.documentElement.scrollWidth}x${document.documentElement.clientWidth}`;
  });
  console.log(`${name.padEnd(14)} ${m}`);
  await pg.close();
}
await b.close();
