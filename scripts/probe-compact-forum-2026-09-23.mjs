/**
 * ПРОБА ТЗ 2026-09-23 «Компактный форум» — единообразная компактность всего
 * форума + сохранение логики Сахкома (лесенка/линии/цитаты/без аватаров).
 * Проверяет: /?topic=183 (контрольная), /?topic=179 (другая тема),
 * /?rubric=120 (список тем), форму ответа, пагинацию, крошки, консоль,
 * мобайл 375. Запуск: node scripts/probe-compact-forum-2026-09-23.mjs
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
let ok = 0, fail = 0;
const errors = [];
const O = (name, cond, detail) => {
  if (cond) { ok++; console.log("  OK", name, detail !== undefined ? "— " + detail : ""); }
  else { fail++; errors.push(name); console.log("  FAIL", name, detail !== undefined ? "— " + detail : ""); }
};

const browser = await chromium.launch();

/* ---------- РАУНД 1: тема #183 (контрольная) ---------- */
{
  const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const consoleErrors = [];
  pg.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  pg.on("pageerror", (e) => consoleErrors.push(String(e)));
  await pg.goto(BASE + "/?topic=183", { waitUntil: "networkidle" });
  await pg.waitForTimeout(800);

  console.log("РАУНД 1: тема #183 — компактность карточек");
  const m = await pg.evaluate(`(() => {
    const num = (s, p) => { const e = document.querySelector(s); if (!e) return null; return parseFloat(getComputedStyle(e)[p]); };
    const card = document.querySelector(".sakh-comment");
    const cs = card ? getComputedStyle(card) : null;
    const body = document.querySelector(".sk-msg-body");
    const bcs = body ? getComputedStyle(body) : null;
    const head = document.querySelector(".sk-msg-head");
    const hcs = head ? getComputedStyle(head) : null;
    const quote = document.querySelector(".sk-quote");
    const qcs = quote ? getComputedStyle(quote) : null;
    const btn = document.querySelector(".sk-btn-reply");
    const bbtn = btn ? getComputedStyle(btn) : null;
    const thanks = document.querySelector(".sk-btn-thanks");
    const tbtn = thanks ? getComputedStyle(thanks) : null;
    const cards = [...document.querySelectorAll(".sakh-comment")];
    const gaps = [];
    for (let i = 1; i < cards.length; i++) gaps.push(Math.round((cards[i].getBoundingClientRect().top - cards[i-1].getBoundingClientRect().bottom) * 10) / 10);
    return {
      cardPadT: cs && parseFloat(cs.paddingTop), cardPadL: cs && parseFloat(cs.paddingLeft), cardMB: cs && parseFloat(cs.marginBottom),
      headPadT: hcs && parseFloat(hcs.paddingTop), headPadL: hcs && parseFloat(hcs.paddingLeft), headMT: hcs && parseFloat(hcs.marginTop),
      bodyFS: bcs && parseFloat(bcs.fontSize), bodyLH: bcs && parseFloat(bcs.lineHeight),
      qMT: qcs && parseFloat(qcs.marginTop), qPT: qcs && parseFloat(qcs.paddingTop), qLH: qcs && parseFloat(qcs.lineHeight), qFS: qcs && parseFloat(qcs.fontSize),
      btnPT: bbtn && parseFloat(bbtn.paddingTop), btnFS: bbtn && parseFloat(bbtn.fontSize),
      thanksPT: tbtn && parseFloat(tbtn.paddingTop),
      gaps, cardCount: cards.length,
      levels: cards.map((c) => c.getAttribute("data-level")),
      lines: document.querySelectorAll(".sakh-reply-lines .rl-vis").length,
      avatars: document.querySelectorAll(".sakh-comment img, .sakh-comment .avatar").length,
      quotes: document.querySelectorAll(".sakh-comment .sk-quote").length,
      quoteTexts: [...document.querySelectorAll(".sakh-comment .sk-quote-head")].map((e) => e.textContent.trim()).slice(0, 6),
      nums: [...document.querySelectorAll(".sk-msg-num")].map((e) => e.textContent.trim()).slice(0, 6),
      btnRow: !!document.querySelector(".sk-btn-reply") && !!document.querySelector(".sk-btn-thanks") && !!document.querySelector(".sk-flood-btn"),
    };
  })()`);
  O("карточка padding 2/9", m.cardPadT === 2 && m.cardPadL === 9, `t=${m.cardPadT} l=${m.cardPadL}`);
  O("зазор карточек 6px", m.cardMB === 6 && m.gaps.every((g) => Math.abs(g - 6) < 0.6), `mb=${m.cardMB} gaps=${JSON.stringify(m.gaps)}`);
  O("шапка padding 2/7, margin-top 0", m.headPadT === 2 && m.headPadL === 7 && m.headMT === 0, `t=${m.headPadT} l=${m.headPadL} mt=${m.headMT}`);
  O("тело 13.5px / lh≤17px", m.bodyFS === 13.5 && m.bodyLH <= 17, `fs=${m.bodyFS} lh=${m.bodyLH}`);
  O("цитата compact (m3/p2/lh≤16, fs 12.5)", m.qMT === 3 && m.qPT === 2 && m.qLH <= 16 && m.qFS === 12.5, `mt=${m.qMT} pt=${m.qPT} lh=${m.qLH} fs=${m.qFS}`);
  O("кнопка Ответить 2/8 fs12", m.btnPT === 2 && m.btnFS === 12, `pt=${m.btnPT} fs=${m.btnFS}`);
  O("кнопка Спасибо 2/8", m.thanksPT === 2, `pt=${m.thanksPT}`);
  O("ряд кнопок полный (Ответить/Спасибо/Пожаловаться)", m.btnRow);

  console.log("РАУНД 1б: логика Сахкома не сломана");
  O("6 сообщений", m.cardCount === 6, `count=${m.cardCount}`);
  O("уровни [1,1,1,1,2,3]", JSON.stringify(m.levels) === JSON.stringify(["1","1","1","1","2","3"]), JSON.stringify(m.levels));
  O("линий ровно 2 (только ответы-на-ответ)", m.lines === 2, `lines=${m.lines}`);
  O("аватаров 0", m.avatars === 0, `avatars=${m.avatars}`);
  O("цитат 5", m.quotes === 5, `quotes=${m.quotes}`);
  O("№ сообщения справа присутствуют", m.nums.length === 6 && m.nums.every((n) => /^#\d+$/.test(n)), JSON.stringify(m.nums));

  console.log("РАУНД 1в: форма ответа, пагинация, крошки");
  const f = await pg.evaluate(`(() => {
    const g = (s, p) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); return { v: parseFloat(c[p]), h: Math.round(e.getBoundingClientRect().height * 10) / 10 }; };
    const ta = document.querySelector(".sk-qr textarea");
    return {
      qrMT: g(".sk-qr", "marginTop"), taMinH: ta ? Math.round(parseFloat(getComputedStyle(ta).minHeight)) : null,
      taLH: ta ? parseFloat(getComputedStyle(ta).lineHeight) : null, taFS: ta ? parseFloat(getComputedStyle(ta).fontSize) : null,
      btnMT: g(".sk-qr .sk-btn-classic", "marginTop"), btnH: g(".sk-qr .sk-btn-classic", "height"),
      pager: g(".sk-pager", "paddingTop"), crumbs: g(".sk-crumbs", "paddingTop"),
      pagerVisible: !!document.querySelector(".sk-pager"),
    };
  })()`);
  O("форма ответа margin-top 8", f.qrMT && f.qrMT.v === 8, `mt=${f.qrMT && f.qrMT.v}`);
  O("textarea 80px / 14px / lh≤19", f.taMinH === 80 && f.taFS === 14 && f.taLH <= 19, `minH=${f.taMinH} fs=${f.taFS} lh=${f.taLH}`);
  O("кнопка формы mt6 h≤32", f.btnMT && f.btnMT.v === 6 && f.btnH && f.btnH.v <= 32, `mt=${f.btnMT && f.btnMT.v} h=${f.btnH && f.btnH.v}`);
  O("пагинация на странице", f.pagerVisible);
  if (f.pager) O("пагинация padding 3px", f.pager.v === 3, `pt=${f.pager.v}`);
  if (f.crumbs) O("крошки padding 4px", f.crumbs.v === 4, `pt=${f.crumbs.v}`);

  console.log("РАУНД 1г: консоль");
  O("консоль без ошибок", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | ") || "чисто");
  await pg.close();
}

/* ---------- РАУНД 2: список тем /?rubric=120 ---------- */
{
  const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await pg.goto(BASE + "/?rubric=120", { waitUntil: "networkidle" });
  await pg.waitForTimeout(800);
  console.log("РАУНД 2: список тем — компактные ряды");
  const L = await pg.evaluate(`(() => {
    const rows = [...document.querySelectorAll(".sk-row")].slice(0, 5);
    const cs0 = rows[0] ? getComputedStyle(rows[0]) : null;
    const title = document.querySelector(".sk-row .r-title");
    const tcs = title ? getComputedStyle(title) : null;
    const sub = document.querySelector(".sk-row .r-sub");
    const scs = sub ? getComputedStyle(sub) : null;
    const lh = document.querySelector(".sk-listhead");
    const toolbar = document.querySelector(".sk-toolbar");
    const pagers = [...document.querySelectorAll(".sk-pager")];
    return {
      rowCount: document.querySelectorAll(".sk-row").length,
      padT: cs0 && parseFloat(cs0.paddingTop), padL: cs0 && parseFloat(cs0.paddingLeft),
      rowH: rows[0] ? Math.round(rows[0].getBoundingClientRect().height * 10) / 10 : null,
      titleFS: tcs && parseFloat(tcs.fontSize), titleLH: tcs && parseFloat(tcs.lineHeight),
      subMT: scs && parseFloat(scs.marginTop), subFS: scs && parseFloat(scs.fontSize),
      lhPad: lh ? parseFloat(getComputedStyle(lh).paddingTop) : null,
      tbPad: toolbar ? parseFloat(getComputedStyle(toolbar).paddingTop) : null,
      pagerCount: pagers.length,
      pagerPad: pagers[0] ? parseFloat(getComputedStyle(pagers[0]).paddingTop) : null,
    };
  })()`);
  O("ряды на странице", L.rowCount > 0, `rows=${L.rowCount}`);
  O("ряд padding 4/8", L.padT === 4 && L.padL === 8, `t=${L.padT} l=${L.padL}`);
  O("ряд высота ≤47px", L.rowH !== null && L.rowH <= 47, `h=${L.rowH}`);
  O("титул 14px / lh 1.3", L.titleFS === 14 && Math.abs(L.titleLH - 18.2) < 0.5, `fs=${L.titleFS} lh=${L.titleLH}`);
  O("подстрока mt1 11.5px", L.subMT === 1 && L.subFS === 11.5, `mt=${L.subMT} fs=${L.subFS}`);
  O("шапка списка padding 3px", L.lhPad === 3, `pt=${L.lhPad}`);
  O("тулбар padding 4px", L.tbPad === 4, `pt=${L.tbPad}`);
  O("пагинация padding 3px", L.pagerPad === 3, `pt=${L.pagerPad}`);
  await pg.screenshot({ path: "download/compact-forum-topiclist-2026-09-23.png" });
  await pg.close();
}

/* ---------- РАУНД 3: другая тема #179 + скриншоты #183 ---------- */
{
  const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await pg.goto(BASE + "/?topic=183", { waitUntil: "networkidle" });
  await pg.waitForTimeout(700);
  await pg.screenshot({ path: "download/compact-forum-topic183-2026-09-23.png" });
  await pg.close();

  const pg2 = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await pg2.goto(BASE + "/?topic=179", { waitUntil: "networkidle" });
  await pg2.waitForTimeout(700);
  console.log("РАУНД 3: другая тема #179 (ГРМ) — та же компактность");
  const T = await pg2.evaluate(`(() => {
    const cards = [...document.querySelectorAll(".sakh-comment")];
    if (!cards.length) return { none: true };
    const cs = getComputedStyle(cards[0]);
    const body = document.querySelector(".sk-msg-body");
    const bcs = body ? getComputedStyle(body) : null;
    const quote = document.querySelector(".sk-quote");
    const qcs = quote ? getComputedStyle(quote) : null;
    const gaps = [];
    for (let i = 1; i < cards.length; i++) gaps.push(Math.round((cards[i].getBoundingClientRect().top - cards[i-1].getBoundingClientRect().bottom) * 10) / 10);
    return {
      none: false, count: cards.length,
      padT: parseFloat(cs.paddingTop), padL: parseFloat(cs.paddingLeft), mb: parseFloat(cs.marginBottom),
      bodyFS: bcs && parseFloat(bcs.fontSize),
      qPT: qcs && parseFloat(qcs.paddingTop),
      gaps, levels: cards.map((c) => c.getAttribute("data-level")),
      lines: document.querySelectorAll(".sakh-reply-lines .rl-vis").length,
    };
  })()`);
  O("тема #179 существует", !T.none, `сообщений=${T.count}`);
  if (!T.none) {
    O("#179: карточка padding 2/9", T.padT === 2 && T.padL === 9, `t=${T.padT} l=${T.padL}`);
    O("#179: зазор 6px", T.mb === 6 && T.gaps.every((g) => Math.abs(g - 6) < 0.6), `mb=${T.mb} gaps=${JSON.stringify(T.gaps)}`);
    O("#179: тело 13.5px", T.bodyFS === 13.5, `fs=${T.bodyFS}`);
    if (T.qPT !== null) O("#179: цитата padding 2px", T.qPT === 2, `pt=${T.qPT}`);
    O("#179: линии только для level≥2", T.lines === T.levels.filter((l) => Number(l) >= 2).length, `lines=${T.lines} levels2+=${T.levels.filter((l) => Number(l) >= 2).length}`);
  }
  await pg2.screenshot({ path: "download/compact-forum-topic179-2026-09-23.png" });
  await pg2.close();
}

/* ---------- РАУНД 4: мобайл 375 ---------- */
{
  const pg = await browser.newPage({ viewport: { width: 375, height: 720 } });
  await pg.goto(BASE + "/?topic=183", { waitUntil: "networkidle" });
  await pg.waitForTimeout(700);
  console.log("РАУНД 4: мобайл 375");
  const M = await pg.evaluate(`(() => {
    const card = document.querySelector(".sakh-comment");
    const cs = card ? getComputedStyle(card) : null;
    return {
      scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      cards: document.querySelectorAll(".sakh-comment").length,
      padT: cs && parseFloat(cs.paddingTop),
      linesHidden: (() => { const l = document.querySelector(".sakh-reply-lines"); return !l || getComputedStyle(l).display === "none"; })(),
      quoteVisible: !!document.querySelector(".sk-quote"),
    };
  })()`);
  O("нет горизонтального скролла", M.scroll <= 0, `diff=${M.scroll}`);
  O("карточки на месте", M.cards === 6, `count=${M.cards}`);
  O("мобильный padding применён", M.padT === 2, `pt=${M.padT}`);
  O("линии скрыты на мобиле", M.linesHidden);
  O("цитаты видны (связь через цитату)", M.quoteVisible);
  await pg.screenshot({ path: "download/compact-forum-topic183-mobile-2026-09-23.png" });
  await pg.close();
}

await browser.close();
console.log(`ИТОГО: ${ok} OK / ${fail} FAIL`);
if (fail) { console.log("Упавшие проверки:", errors.join("; ")); process.exit(1); }
