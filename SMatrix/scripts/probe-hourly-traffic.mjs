/**
 * ПРОБА: ① шапка «Пробки» = верх карточки (без треугольника, по центру);
 * ② редизайн «Почасовой прогноз на сегодня» (иконки WMO, текущий час,
 *    snap-скролл, цвета температуры/влажности, стрелка ветра, детали по клику).
 * Скриншоты: download/traffic-header-after.png, hourly-forecast-desktop.png,
 *            hourly-forecast-details.png, hourly-forecast-mobile.png
 */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const OUT = "/home/z/my-project/download";
const problems = [];
const ok = (cond, label) => {
  console.log(`${cond ? "OK  " : "FAIL"} ${label}`);
  if (!cond) problems.push(label);
};
const info = (label) => console.log(`INFO ${label}`);

const TEMP_COLORS = { veryhot: [217, 83, 79], hot: [232, 163, 61], warm: [107, 191, 89], cool: [58, 156, 165], cold: [30, 111, 184] };
const parseTemp = (txt) => Number(txt.replace("+", "").replace("−", "-").replace("°", ""));
function expectTempColor(t, rgb) {
  if (t >= 25) return same(rgb, TEMP_COLORS.veryhot);
  if (t >= 20) return same(rgb, TEMP_COLORS.hot);
  if (t >= 16) return same(rgb, TEMP_COLORS.warm);
  if (t >= 12) return same(rgb, TEMP_COLORS.cool);
  if (t < 0) return same(rgb, TEMP_COLORS.cold);
  return true; // 0…+11 — нейтральный, цвет не задан ТЗ
}
function same(a, b) {
  return a.length === 3 && b.every((v, i) => Math.abs(a[i] - v) <= 2);
}

const browser = await chromium.launch();
try {
  /* ---------- ① /traffic.php ---------- */
  const t = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await t.goto(`${BASE}/traffic.php`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await t.waitForTimeout(2500);
  const sec = t.locator('section[aria-label="Карта пробок Южно-Сахалинска"]');
  const head = sec.locator(".mp-paneltitle").first();
  const h1 = await head.evaluate((el) => {
    const cs = getComputedStyle(el);
    const card = el.closest("section");
    return {
      text: (el.textContent || "").trim(),
      hasTri: (el.textContent || "").includes("▼"),
      plain: el.classList.contains("mp-paneltitle-plain"),
      align: cs.textAlign,
      flush: Math.round(el.getBoundingClientRect().top - card.getBoundingClientRect().top),
      bg: cs.backgroundColor,
      color: cs.color,
    };
  });
  ok(h1.text === "Пробки", `[Пробки] текст шапки = «Пробки» (получено: «${h1.text}»)`);
  ok(!h1.hasTri, "[Пробки] в шапке НЕТ треугольника");
  ok(h1.plain, "[Пробки] класс mp-paneltitle-plain");
  ok(h1.align === "center", `[Пробки] text-align=center (${h1.align})`);
  ok(h1.flush <= 2, `[Пробки] шапка прижата к верху карточки (зазор ${h1.flush}px)`);
  ok(h1.bg === "rgb(30, 58, 95)", `[Пробки] фон шапки = --sm-navy (${h1.bg})`);
  const noStub = await sec.locator(".sm-stub-home").count();
  ok(noStub === 0, `[Пробки] .sm-stub-home внутри карточки нет (${noStub})`);
  const mapOk = await t.locator("iframe.trf-map").count();
  ok(mapOk === 1, `[Пробки] iframe.trf-map на месте и не тронут (${mapOk})`);
  const mapBox = await t.locator("iframe.trf-map").first().evaluate((el) => ({ w: el.getBoundingClientRect().width.toFixed(0) }));
  info(`[Пробки] ширина карты ${mapBox.w}px`);
  await t.screenshot({ path: `${OUT}/traffic-header-after.png` });
  await t.close();

  /* ---------- ② /weather.php, десктоп ---------- */
  const w = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await w.goto(`${BASE}/weather.php`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await w.waitForSelector(".hourly-forecast .hour-cell", { timeout: 30000 });
  await w.waitForTimeout(1500);

  const box = await w.locator(".hourly-forecast").evaluate((el) => {
    const cs = getComputedStyle(el);
    return { ox: cs.overflowX, snap: cs.scrollSnapType, sw: el.scrollWidth, cw: el.clientWidth, n: el.querySelectorAll(".hour-cell").length };
  });
  ok(box.ox === "auto", `[почасовой] overflow-x=auto (${box.ox})`);
  ok(box.snap.includes("mandatory"), `[почасовой] scroll-snap-type x mandatory (${box.snap})`);
  ok(box.n >= 5, `[почасовой] ячеек ${box.n} (≥5)`);
  info(`[почасовой] scrollWidth=${box.sw} clientWidth=${box.cw} → скролл ${box.sw > box.cw ? "ЕСТЬ" : "не нужен (все влезли)"}`);

  const cells = await w.locator(".hour-cell").evaluateAll((els) =>
    els.map((el) => {
      const cs = getComputedStyle(el);
      const icon = el.querySelector(".hour-icon");
      const temp = el.querySelector(".hour-temp");
      const hum = el.querySelector(".hour-humidity");
      const wind = el.querySelector(".hour-wind");
      const arrow = el.querySelector(".wind-arrow");
      return {
        time: el.querySelector(".hour-time")?.textContent?.trim() ?? "",
        isCurrent: el.classList.contains("current"),
        bg: cs.backgroundColor,
        borderColor: cs.borderTopColor,
        timeW: getComputedStyle(el.querySelector(".hour-time")).fontWeight,
        icon: icon?.textContent?.trim() ?? "",
        iconTitle: icon?.getAttribute("title") ?? "",
        tempText: temp?.textContent?.trim() ?? "",
        tempColor: temp ? getComputedStyle(temp).color : "",
        tempClass: temp ? [...temp.classList].filter((c) => c !== "hour-temp").join(",") : "",
        humText: hum?.textContent?.trim() ?? "",
        humBg: hum ? getComputedStyle(hum).backgroundColor : "",
        humColor: hum ? getComputedStyle(hum).color : "",
        windText: wind?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        arrowTransform: arrow ? getComputedStyle(arrow).transform : "",
      };
    })
  );

  const nowHH = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Magadan", hour: "2-digit", hourCycle: "h23" }).format(new Date());
  info(`текущий час Asia/Magadan = ${nowHH}:00`);

  let curCount = 0;
  for (const c of cells) {
    const tNum = parseTemp(c.tempText);
    const col = c.tempColor.match(/\d+/g)?.map(Number) ?? [];
    ok(c.icon.length > 0, `[почасовой ${c.time}] иконка есть («${c.icon}», title=«${c.iconTitle}»)`);
    ok(c.iconTitle.length > 0, `[почасовой ${c.time}] у иконки title-подпись источника`);
    ok(expectTempColor(tNum, col), `[почасовой ${c.time}] цвет температуры ${c.tempText} (${c.tempClass}) = ${c.tempColor}`);
    const hb = c.humBg.match(/\d+/g)?.map(Number) ?? [];
    const humNum = Number((c.humText.match(/\d+/) ?? ["0"])[0]);
    const wantHum = humNum >= 90 ? [74, 144, 217] : humNum >= 70 ? [58, 156, 165] : [138, 151, 163];
    ok(same(hb, wantHum), `[почасовой ${c.time}] бейдж влажн. ${humNum}% фон = ${c.humBg}`);
    ok(c.humColor === "rgb(255, 255, 255)", `[почасовой ${c.time}] текст бейджа белый`);
    ok(/м\/с · /.test(c.windText), `[почасовой ${c.time}] ветер с румбом: «${c.windText}»`);
    ok(c.arrowTransform !== "" && c.arrowTransform !== "none", `[почасовой ${c.time}] стрелка повёрнута (${c.arrowTransform})`);
    if (c.isCurrent) {
      curCount++;
      ok(same(c.bg.match(/\d+/g)?.map(Number) ?? [], [255, 248, 225]), `[почасовой ${c.time}] текущий час: фон #fff8e1 (${c.bg})`);
      ok(same(c.borderColor.match(/\d+/g)?.map(Number) ?? [], [232, 163, 61]), `[почасовой ${c.time}] текущий час: рамка #e8a33d (${c.borderColor})`);
      ok(c.timeW === "700" || c.timeW === "bold", `[почасовой ${c.time}] время жирное (${c.timeW})`);
    }
  }
  if (cells.some((c) => c.isCurrent)) {
    ok(curCount === 1, `[почасовой] ячейка «сейчас» ровно одна (${curCount})`);
    ok(cells.some((c) => c.isCurrent && c.time === `${nowHH}:00`), `[почасовой] подсвечен именно текущий час ${nowHH}:00`);
  } else {
    info("ячейка текущего часа не попала в серию (граница часа) — подсветка не проверяется");
  }
  const nowBadge = await w.locator(".hour-now").count();
  if (curCount > 0) ok(nowBadge === 1, `[почасовой] подпись «сейчас» под текущей ячейкой (${nowBadge})`);

  await w.screenshot({ path: `${OUT}/hourly-forecast-desktop.png` });

  /* детали по клику */
  const first = w.locator(".hour-cell").first();
  await first.click();
  await w.waitForTimeout(400);
  let det = await w.locator(".hour-details").textContent().catch(() => null);
  ok(!!det && /Давление/.test(det) && /мм рт\. ст\./.test(det) && /Влажность/.test(det) && /Ощущается как/.test(det) && /Ветер/.test(det), `[почасовой] панель деталей по клику содержит температуру/ощущается/влажность/давление/ветер: «${(det ?? "").replace(/\s+/g, " ").slice(0, 160)}»`);
  await w.screenshot({ path: `${OUT}/hourly-forecast-details.png` });
  await first.click();
  await w.waitForTimeout(400);
  det = await w.locator(".hour-details").count();
  ok(det === 0, "[почасовой] повторный клик закрывает панель деталей");

  /* ---------- ② мобайл 375px ---------- */
  const m = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await m.goto(`${BASE}/weather.php`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await m.waitForSelector(".hourly-forecast .hour-cell", { timeout: 30000 });
  await m.waitForTimeout(1200);
  const mob = await m.locator(".hourly-forecast").evaluate((el) => {
    const cell = el.querySelector(".hour-cell");
    return { sw: el.scrollWidth, cw: el.clientWidth, basis: getComputedStyle(cell).flexBasis };
  });
  ok(mob.basis === "68px", `[мобайл] ячейка уже: flex-basis 68px (${mob.basis})`);
  ok(mob.sw > mob.cw, `[мобайл] горизонтальный скролл работает: scrollWidth ${mob.sw} > clientWidth ${mob.cw}`);
  await m.screenshot({ path: `${OUT}/hourly-forecast-mobile.png` });
  await m.close();
  await w.close();
} finally {
  await browser.close();
}

console.log(problems.length === 0 ? "\n=== ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ ===" : `\n=== ПРОВАЛОВ: ${problems.length} ===`);
problems.forEach((p) => console.log("  - " + p));
process.exit(problems.length === 0 ? 0 : 1);
