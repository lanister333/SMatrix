import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto("http://localhost:3000/gde-kupit", { waitUntil: "networkidle" });
await p.waitForSelector('[data-e2e-panel="wtb"]', { timeout: 30000 });
const info = await p.evaluate(() => {
  const panel = document.querySelector('[data-e2e-panel="wtb"]');
  const cards = document.querySelector('[data-e2e-panel="wtb"] [data-e2e-cards="1"]');
  const scen = panel.querySelector(".e2e-scen");
  const actrow = scen.querySelector(".e2e-actrow");
  const pair = scen.querySelector(".e2e-pair");
  const btns = [...pair.querySelectorAll("button, a")];
  const w = (el) => el.getBoundingClientRect().width;
  const cs = (el) => {
    const c = getComputedStyle(el);
    return `flex:${c.flex} | display:${c.display} | w:${w(el).toFixed(1)}`;
  };
  return {
    panel: w(panel), cards: w(cards), scen: w(scen),
    actrow: w(actrow), actrowCS: cs(actrow),
    pair: w(pair), pairCS: cs(pair),
    btn0: `${w(btns[0]).toFixed(1)} ${cs(btns[0])}`,
    btn1: `${w(btns[1]).toFixed(1)} ${cs(btns[1])}`,
    report: scen.querySelector(".e2e-report") ? w(scen.querySelector(".e2e-report")).toFixed(1) : "none",
  };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
