/**
 * Замеры директивы nav-discuss-restyle-2026-09-18: блок «Обсудить на
 * форуме» — одна цельная плашка, строки 1:1 как у «Рубрики форума».
 * Запуск: agent-browser eval "$(cat scripts/eval-discuss.js)"
 * Возвращает JSON-отчёт.
 */
(() => {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const cs = (el) => getComputedStyle(el);
  const pick = (el, props) => { const s = cs(el); const o = {}; props.forEach((p) => (o[p] = s[p])); return o; };
  const out = {};

  const card = $(".sk-discuss-card");
  out.cardExists = !!card;
  if (!card) return JSON.stringify(out);

  // 1. Единая структура: одна белая плашка + синяя шапка, вложенных карточек нет
  out.isSakhCard = card.classList.contains("sakh-card");
  out.isSideblock = card.classList.contains("sk-sideblock");
  const title = $(".sk-blocktitle", card);
  out.titleText = title ? title.textContent.replace("▼", "").trim() : null;
  out.titleBg = title ? cs(title).backgroundColor : null;
  out.cardBg = cs(card).backgroundColor;
  out.cardChildren = Array.from(card.children).map((c) => c.tagName + "." + String(c.className).split(" ").join("."));
  out.directUlChild = card.children.length === 2 && card.children[1].classList.contains("sk-navlist");

  // 2. Список: 5 строк дословно из директивы, каждая — одна ссылка в ветку *-discuss
  const rows = $$(".sk-navlist > li", card);
  out.rowCount = rows.length;
  out.rowsRubricClasses = rows.every((li) => li.classList.contains("sk-rubric-row") && li.classList.contains("sk-navico-row"));
  out.links = $$(".sk-rubric-name", card).map((a) => ({
    text: a.childNodes[0].textContent.trim(),
    href: a.getAttribute("href"),
    arrIn: !!$(".arr", a),
    ico: !!$(".sk-navico", a.parentElement),
  }));
  out.hrefsAllDiscuss = out.links.every((l) => /\/\?rubric=[a-z]+-discuss$/.test(l.href));

  // 3. Старый брак отсутствует во всём DOM
  out.oldJunk = { row: $$(".sk-discuss-row").length, btn: $$(".sk-discuss-btn").length, name: $$(".sk-discuss-name").length };

  // 4. Идентичность строк с блоком «Рубрики форума»
  const rubBlock = $$(".sk-sideblock").find((b) => { const t = $(".sk-blocktitle", b); return t && t.textContent.includes("Рубрики форума"); });
  if (rubBlock) {
    const rubA = $(".sk-rubric-name", rubBlock);
    const disA = $(".sk-rubric-name", card);
    const rubIco = $(".sk-navico", rubBlock);
    const disIco = $(".sk-navico", card);
    const rubArr = $(".sk-rubric-name .arr", rubBlock);
    const disArr = $(".sk-rubric-name .arr", card);
    const LP = ["fontSize", "color", "textDecorationLine", "fontFamily", "fontWeight", "paddingTop", "paddingBottom", "cursor"];
    out.linkRubric = pick(rubA, LP);
    out.linkDiscuss = pick(disA, LP);
    out.linkIdentical = JSON.stringify(out.linkRubric) === JSON.stringify(out.linkDiscuss);
    out.icoRubric = rubIco ? pick(rubIco, ["width", "height", "color"]) : null;
    out.icoDiscuss = disIco ? pick(disIco, ["width", "height", "color"]) : null;
    out.icoIdentical = JSON.stringify(out.icoRubric) === JSON.stringify(out.icoDiscuss);
    out.arrRubric = rubArr ? pick(rubArr, ["fontSize", "color"]) : null;
    out.arrDiscuss = disArr ? pick(disArr, ["fontSize", "color"]) : null;
    out.arrIdentical = rubArr && disArr ? JSON.stringify(out.arrRubric) === JSON.stringify(out.arrDiscuss) : null;
    // выравнивание: x левой границы текста первой строки обоих блоков совпадает
    out.xRubric = Math.round(rubA.getBoundingClientRect().left);
    out.xDiscuss = Math.round(disA.getBoundingClientRect().left);
    out.xIndentical = out.xRubric === out.xDiscuss;
  }

  // 5. Ширина/скролл
  out.hscroll = document.documentElement.scrollWidth > document.documentElement.clientWidth;

  return JSON.stringify(out);
})()
