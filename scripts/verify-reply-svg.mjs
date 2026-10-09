// Аудит SVG-оверлея «кто кому ответил» (ReplyLines) по всем темам.
// Инварианты (спека):
//  A. каждый КОНЕЦ каждого подпутика касается рамки карточки ИЛИ лежит
//     на шине своей группы (стыки) — линий, висящих в воздухе, нет;
//  B. шина каждой группы начинается у родителя и кончается у последнего
//     ответа; колонка шины = childLeft − 13 − 25·i (ритм лесенки);
//  C. слияние: у родителя с N видимыми ответами ровно одна группа,
//     N отводов, каждый ответ затронут ровно одним отводом;
//  D. число групп == число ожидаемых родителей (по API, parentId);
//  E. старых спан-коннекторов нет; ровно один svg.sakh-reply-lines;
//  F. линии ПОД карточками (elementFromPoint в теле карточки — не svg);
//  G. hover: подсказка «ответ на #N» + подсветка группы;
//  H. мобилка 390px: оверлей скрыт, горскролла нет.
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const TOPICS = 34;
const browser = await chromium.launch();

let checks = 0;
const fails = [];
const ok = (cond, msg) => {
  checks += 1;
  if (!cond) fails.push(msg);
};

const api = (t, p) => fetch(`${BASE}/api/topics/${t}?page=${p}`).then((r) => r.json());

function parseSubpaths(d) {
  const toks = d.match(/[MLQ][^MLQ]*/g) ?? [];
  const subs = [];
  let pts = null;
  for (const t of toks) {
    const cmd = t[0];
    const nums = t.slice(1).trim().split(/\s+/).map(Number);
    if (cmd === "M") {
      if (pts && pts.length) subs.push(pts);
      pts = [{ x: nums[0], y: nums[1] }];
    } else if (cmd === "L") {
      for (let i = 0; i < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
    } else if (cmd === "Q") {
      pts.push({ x: nums[0], y: nums[1] });
      pts.push({ x: nums[2], y: nums[3] });
    }
  }
  if (pts && pts.length) subs.push(pts);
  return subs;
}

for (let t = 1; t <= TOPICS; t += 1) {
  const j1 = await api(t, 1).catch(() => null);
  if (!j1 || !Array.isArray(j1.messages)) {
    ok(false, `тема ${t}: API недоступен`);
    continue;
  }
  const pages = j1.pages ?? 1;
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(`${BASE}/?topic=${t}`, { waitUntil: "networkidle", timeout: 30000 });
  for (let p = 1; p <= pages; p += 1) {
    const data = p === 1 ? j1 : await api(t, p);
    if (p > 1) {
      // Пагинация работает КЛИКОМ по пейджеру (URL-параметр page клиент
      // игнорирует — существующее поведение). Заодно проверяем перерисовку.
      const clicked = await page.evaluate((pn) => {
        const links = [...document.querySelectorAll(".sk-pager a.pg-num")];
        const el = links.find((e) => e.textContent?.trim() === String(pn));
        if (el) { el.click(); return true; }
        return false;
      }, p);
      if (!clicked) { ok(false, `тема ${t}: кнопка страницы ${p} не найдена`); break; }
      await page.waitForTimeout(800);
      const rng = await page.evaluate(() => {
        const n = [...document.querySelectorAll(".sakh-comment[data-msgnum]")].map((el) => Number(el.dataset.msgnum));
        return { min: Math.min(...n), max: Math.max(...n) };
      });
      const expMin = data.messages[0].num;
      const expMax = data.messages[data.messages.length - 1].num;
      ok(rng.min === expMin && rng.max === expMax, `тема ${t}: стр.${p} показала №${rng.min}..№${rng.max}, ожидалось №${expMin}..№${expMax}`);
    }
    await page.waitForTimeout(300);
    try {
      const dom = await page.evaluate(() => {
        const cont = document.querySelector(".sakh-comments-container");
        if (!cont) return { no: "container" };
        const svg = cont.querySelector(":scope > svg.sakh-reply-lines");
        const cbox = cont.getBoundingClientRect();
        const cards = [...cont.querySelectorAll(":scope > .sakh-comment[data-id]")].map((el) => {
          const r = el.getBoundingClientRect();
          return {
            id: el.dataset.id,
            num: Number(el.dataset.msgnum),
            left: r.left - cbox.left,
            top: r.top - cbox.top,
            bottom: r.bottom - cbox.top,
          };
        });
        const groups = svg
          ? [...svg.querySelectorAll(":scope > g")].map((g) => {
              const vis = g.querySelector("path.rl-vis");
              return { d: vis ? vis.getAttribute("d") : "", on: g.classList.contains("rl-on") };
            })
          : null;
        return {
          hasSvg: !!svg,
          svgCount: cont.querySelectorAll(":scope > svg.sakh-reply-lines").length,
          oldSpans: document.querySelectorAll(".sakh-comment-connector").length,
          cards,
          groups,
        };
      });

      const tag = `тема ${t} стр. ${p}`;
      if (dom.no) { ok(false, `${tag}: ${dom.no} не найден`); continue; }
      ok(dom.hasSvg && dom.svgCount === 1, `${tag}: svg-оверлей не один/нет`);
      ok(dom.oldSpans === 0, `${tag}: остались старые спан-коннекторы (${dom.oldSpans})`);

      const byId = new Map(dom.cards.map((c) => [c.id, c]));
      const expected = new Map(); // parentId -> Set(childId)
      for (const m of data.messages) {
        if (!m.parentId || !byId.has(m.id) || !byId.has(m.parentId)) continue;
        if (!expected.has(m.parentId)) expected.set(m.parentId, new Set());
        expected.get(m.parentId).add(m.id);
      }

      ok((dom.groups ?? []).length === expected.size, `${tag}: групп ${dom.groups?.length}, ожидалось ${expected.size}`);

      const tapTouch = new Map(); // childId -> число отводов
      for (let gi = 0; gi < (dom.groups ?? []).length; gi += 1) {
        const subs = parseSubpaths(dom.groups[gi].d);
        ok(subs.length >= 1 && subs[0].length >= 6, `${tag} g${gi}: главная ветка пути не распознана`);
        if (!subs.length || subs[0].length < 6) continue;
        const main = subs[0];
        // busX: самая частая x среди точек главной ветки
        const freq = new Map();
        for (const pt of main) freq.set(pt.x, (freq.get(pt.x) ?? 0) + 1);
        let busX = NaN, best = 0;
        for (const [x, n] of freq) if (n > best) { best = n; busX = x; }
        const ys = main.filter((pt) => Math.abs(pt.x - busX) <= 2.5).map((pt) => pt.y);
        const busTop = Math.min(...ys, main[0].y);
        const busBottom = Math.max(...ys);
        const touch = (pt) => {
          for (const c of dom.cards) {
            if (Math.abs(pt.x - c.left) <= 3.5 && pt.y >= c.top - 3 && pt.y <= c.bottom + 3) return c;
          }
          return null;
        };
        const onBus = (pt) => Math.abs(pt.x - busX) <= 3 && pt.y >= busTop - 4 && pt.y <= busBottom + 4;
        // A/B: концы подпутей — на рамках или на шине
        for (let si = 0; si < subs.length; si += 1) {
          const s = subs[si];
          const ends = [s[0], s[s.length - 1]];
          for (const e of ends) {
            ok(touch(e) !== null || onBus(e), `${tag} g${gi} s${si}: конец (${e.x.toFixed(1)},${e.y.toFixed(1)}) висит в воздухе`);
          }
        }
        // B: родитель — карточка, к которой приходит начало главной ветки
        const parentCard = touch(main[0]);
        ok(!!parentCard, `${tag} g${gi}: начало пути не пришло к рамке родителя`);
        if (!parentCard) continue;
        const expKids = expected.get(parentCard.id);
        ok(!!expKids, `${tag} g${gi}: группа у поста без ожидаемых детей (№${parentCard.num})`);
        // отводы заканчиваются на детях именно этого родителя
        const gotKids = new Set();
        for (let si = 0; si < subs.length; si += 1) {
          const e = subs[si][subs[si].length - 1];
          const c = touch(e);
          if (c) gotKids.add(c.id);
        }
        if (expKids) {
          ok(gotKids.size === expKids.size && [...expKids].every((id) => gotKids.has(id)),
            `${tag} g${gi}: отводы ${JSON.stringify([...gotKids])} ≠ дети ${JSON.stringify([...expKids])}`);
        }
        for (const id of gotKids) tapTouch.set(id, (tapTouch.get(id) ?? 0) + 1);
        // B: колонка шины в ритме лесенки
        const kidLeft = Math.min(...[...(expKids ?? [])].map((id) => byId.get(id)?.left ?? NaN));
        const k = (kidLeft - 13 - busX) / 25;
        ok(Math.abs(k - Math.round(k)) <= 0.12 && k >= -0.12,
          `${tag} g${gi}: шина x=${busX.toFixed(1)} вне колонок лесенки (childLeft=${kidLeft.toFixed(1)})`);
        // B: шина сверху приходит от родителя
        ok(Math.abs(busTop - (parentCard.top + 22)) <= 4, `${tag} g${gi}: верх шины не у шапки родителя`);
      }
      // C: каждый ребёнок затронут ровно одним отводом
      for (const [pid, kids] of expected) {
        for (const kid of kids) {
          ok((tapTouch.get(kid) ?? 0) === 1, `${tag}: ответ №${byId.get(kid)?.num} затронут ${tapTouch.get(kid) ?? 0} отводами`);
        }
      }
      // F: линии под карточками (тема 1, стр. 1 — один раз)
      if (t === 1 && p === 1 && (dom.groups ?? []).length) {
        const c = dom.cards.find((x) => expected.has(x.id));
        if (c) {
          const z = await page.evaluate((cx) => {
            const cont = document.querySelector(".sakh-comments-container");
            const box = cont.getBoundingClientRect();
            const card = [...cont.querySelectorAll(":scope > .sakh-comment[data-id]")][0];
            const r = card.getBoundingClientRect();
            const el = document.elementFromPoint(r.left + 20, r.top + 30);
            const svg = document.querySelector(".sakh-reply-lines");
            return { insideSvg: svg ? svg.contains(el) : false, tag: el ? el.tagName : "" };
          }, null);
          ok(z && !z.insideSvg, `${tag}: точка внутри карточки отдаёт элемент svg (линии НЕ под карточками)`);
        }
        // G: hover → подсказка «ответ на #N» + подсветка
        const g0 = parseSubpaths(dom.groups[0].d);
        if (g0.length && g0[0].length >= 6) {
          const main = g0[0];
          const a = main[main.length - 2];
          const b = main[main.length - 1];
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          await page.evaluate(() => {
            document.querySelector(".sakh-comments-container")?.scrollIntoView({ block: "start" });
          });
          await page.waitForTimeout(300);
          const vp = await page.evaluate((pt) => {
            const box = document.querySelector(".sakh-comments-container").getBoundingClientRect();
            return { x: box.left + pt.x, y: box.top + pt.y };
          }, mid);
          if (Number.isFinite(vp.x) && Number.isFinite(vp.y)) {
            await page.mouse.move(vp.x, vp.y, { steps: 4 });
            await page.waitForTimeout(250);
            const tip = await page.evaluate(() => ({
              text: document.querySelector(".sakh-reply-tip")?.textContent ?? "",
              on: !!document.querySelector("svg.sakh-reply-lines g.rl-on"),
            }));
            ok(/^ответ на #\d+$/.test(tip.text), `${tag}: подсказка не показалась («${tip.text}»)`);
            ok(tip.on, `${tag}: подсветка группы при наведении не включилась`);
          } else {
            ok(false, `${tag}: точка наведения не число (${JSON.stringify(vp)})`);
          }
        }
      }
    } catch (e) {
      ok(false, `тема ${t} стр. ${p}: исключение ${e.message?.slice(0, 120)}`);
    }
  }
  } catch (e) {
    ok(false, `тема ${t}: исключение ${e.message?.slice(0, 120)}`);
  } finally {
    await page.close();
  }
}

// H: мобилка 390px
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp = await ctx.newPage();
  await mp.goto(`${BASE}/?topic=1`, { waitUntil: "networkidle", timeout: 30000 });
  await mp.waitForTimeout(500);
  const m = await mp.evaluate(() => {
    const svg = document.querySelector(".sakh-reply-lines");
    const tip = document.querySelector(".sakh-reply-tip");
    return {
      svgHidden: !svg || getComputedStyle(svg).display === "none",
      tipHidden: !tip || getComputedStyle(tip).display === "none",
      noHScroll: document.documentElement.scrollWidth <= 391,
      labels: [...document.querySelectorAll(".sk-msg-parent, .sk-msg-parentlink")].length,
    };
  });
  ok(m.svgHidden, `мобилка: svg-оверлей не скрыт`);
  ok(m.tipHidden, `мобилка: тултип не скрыт`);
  ok(m.noHScroll, `мобилка: горскролл ${"#"}>390`);
  await ctx.close();
}

await browser.close();
console.log(`ИТОГО проверок: ${checks}, провалов: ${fails.length}`);
for (const f of fails.slice(0, 40)) console.log("FAIL:", f);
process.exit(fails.length ? 1 : 0);
