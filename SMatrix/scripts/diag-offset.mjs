// Диагностика: почему на /?topic=1&msg=36|71 лестница уехала вправо на 185px
import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const url of ['/?topic=1', '/?topic=1&msg=36', '/?topic=1&msg=71']) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto('http://127.0.0.1:3000' + url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const d = await p.evaluate(() => {
    const cont = document.querySelector('.sakh-comments-container');
    const cr = cont?.getBoundingClientRect();
    const card = document.querySelector('.sakh-comment');
    const kel = [...document.querySelectorAll('body *')].filter((e) => e.scrollWidth > e.clientWidth + 1).slice(0, 6).map((e) => ({
      cls: (e.className || '').toString().slice(0, 60), tag: e.tagName,
      sw: e.scrollWidth, cw: e.clientWidth,
      left: Math.round(e.getBoundingClientRect().left),
    }));
    return {
      url: location.href,
      contLeft: cr ? Math.round(cr.left) : null,
      contW: cr ? Math.round(cr.width) : null,
      cardLeft: card ? Math.round(card.getBoundingClientRect().left) : null,
      bodyScrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      scrollX: window.scrollX,
      wide: kel,
    };
  });
  console.log(JSON.stringify(d, null, 1));
  await p.close();
}
await browser.close();
