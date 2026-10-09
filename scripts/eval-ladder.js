() => {
  const c = document.querySelector('.sakh-comments-container');
  if (!c) return 'НЕТ .sakh-comments-container';
  const all = Array.from(document.querySelectorAll('.sakh-comment'));
  const plates = Array.from(c.querySelectorAll(':scope > .sakh-comment'));
  const nested = all.filter(function (el) { return el.parentElement !== c; }).length;
  const desktop = window.innerWidth > 768;
  const levels = {};
  plates.forEach(function (p) { const L = p.getAttribute('data-level'); levels[L] = (levels[L] || 0) + 1; });
  let rails = 0; const railIssues = []; const cornerIssues = []; const cardIssues = [];
  const rects = plates.map(function (p) { return p.getBoundingClientRect(); });
  plates.forEach(function (p, i) {
    const cs = getComputedStyle(p);
    const L = parseInt(p.getAttribute('data-level'), 10);
    const px = rects[i];
    // 1) Карточка: сплошная рамка #CED4DA со всех четырёх сторон, белый фон, зазор 12px
    if (cs.borderTopStyle !== 'solid' || cs.borderRightStyle !== 'solid' || cs.borderBottomStyle !== 'solid' || cs.borderLeftStyle !== 'solid') cardIssues.push('рамка не сплошная со всех сторон (msg ' + p.dataset.msgnum + ')');
    ['Top', 'Right', 'Bottom', 'Left'].forEach(function (s) {
      if (parseFloat(cs['border' + s + 'Width']) !== 1 || cs['border' + s + 'Color'] !== 'rgb(206, 212, 218)') cardIssues.push('border-' + s.toLowerCase() + ' != 1px #CED4DA (msg ' + p.dataset.msgnum + '): ' + cs['border' + s + 'Width'] + ' ' + cs['border' + s + 'Color']);
    });
    if (cs.backgroundColor !== 'rgb(255, 255, 255)') cardIssues.push('фон не белый (msg ' + p.dataset.msgnum + '): ' + cs.backgroundColor);
    if (Math.abs(parseFloat(cs.marginBottom) - 12) > 0.5) cardIssues.push('margin-bottom != 12px (msg ' + p.dataset.msgnum + '): ' + cs.marginBottom);
    // 2) Сдвиг лесенки: margin-left = 20·(L−1)
    if (desktop && Math.abs(parseFloat(cs.marginLeft) - 20 * (L - 1)) > 0.5) cardIssues.push('margin-left ' + cs.marginLeft + ' != 20*(' + L + '-1) (msg ' + p.dataset.msgnum + ')');
    // 3) Нити: left = (K − L)·20 + 4 (отрицательное), целиком СНАРУЖИ рамки и не в ЧУЖИХ рамках
    const rs = p.querySelectorAll(':scope > .sakh-comment-connector');
    rails += rs.length;
    rs.forEach(function (r) {
      const rcs = getComputedStyle(r);
      const k = Math.round((parseFloat(rcs.left) - 4) / 20) + L; // обратная формула: left = (K−L)·20+4
      const expect = (k - L) * 20 + 4;
      if (Math.abs(parseFloat(rcs.left) - expect) > 0.5) railIssues.push('нить left ' + rcs.left + ' != (K-L)*20+4 (msg ' + p.dataset.msgnum + ', L ' + L + ')');
      const rx = r.getBoundingClientRect();
      if (rx.width > 1.5) railIssues.push('нить шире 1px (msg ' + p.dataset.msgnum + ')');
      if (rx.height < 5) railIssues.push('нить короче 5px (msg ' + p.dataset.msgnum + ')');
      if (rx.right > px.left + 0.5) railIssues.push('нить заходит ВНУТЬ СВОЕЙ рамки (msg ' + p.dataset.msgnum + '): right ' + rx.right + ' > frame ' + px.left);
      rects.forEach(function (o, j) {
        if (rx.left < o.right - 0.5 && rx.right > o.left + 0.5 && rx.top < o.bottom - 0.5 && rx.bottom > o.top + 0.5) railIssues.push('нить msg ' + p.dataset.msgnum + ' пересекает рамку msg ' + plates[j].dataset.msgnum);
      });
    });
    // 4) Уголок: left:-16, width 15, top:-13, height 34; правый край = левая рамка карточки (касание снаружи)
    if (L > 1) {
      const cb = getComputedStyle(p, '::before');
      if (cb.content === 'none' || cb.display === 'none') cornerIssues.push('нет уголка (msg ' + p.dataset.msgnum + ', level ' + L + ')');
      else {
        const cl = parseFloat(cb.left); const cw = parseFloat(cb.width); const ct = parseFloat(cb.top); const ch = parseFloat(cb.height);
        if (cl !== -16 || cw !== 15) cornerIssues.push('уголок left/width ' + cl + '/' + cw + ' != -16/15 (msg ' + p.dataset.msgnum + ')');
        if (ct !== -13 || ch !== 34) cornerIssues.push('уголок top/height ' + ct + '/' + ch + ' != -13/34 (msg ' + p.dataset.msgnum + ')');
        if (cb.borderLeftColor !== 'rgb(176, 190, 197)' || cb.borderBottomColor !== 'rgb(176, 190, 197)') cornerIssues.push('уголок не #B0BEC5 (msg ' + p.dataset.msgnum + ')');
        // правый край уголка в координатах страницы: px.left - 1(рамка) + (cl + 1) + cw = px.left + cl + cw
        if (px.left + cl + cw > px.left + 0.5) cornerIssues.push('уголок заходит внутрь рамки (msg ' + p.dataset.msgnum + ')');
      }
    }
  });
  const l1bad = plates.filter(function (p) { return p.getAttribute('data-level') === '1' && getComputedStyle(p, '::before').content !== 'none'; }).length;
  const overflow = document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth;
  const innerFrames = Array.from(c.querySelectorAll('.sakh-comment > .sk-msg')).filter(function (m) { return parseFloat(getComputedStyle(m).borderLeftWidth) > 0; }).length;
  const sample = plates.slice(0, 30).map(function (p) { return p.dataset.msgnum + '/L' + p.getAttribute('data-level') + '/r' + p.querySelectorAll('.sakh-comment-connector').length; }).join(' ');
  return JSON.stringify({
    plates: plates.length, allCommentEls: all.length, nested: nested, levels: levels,
    railsTotal: rails, railIssues: railIssues.slice(0, 6), cornerIssues: cornerIssues.slice(0, 6),
    cardIssues: cardIssues.slice(0, 6), l1WithCorner: l1bad, innerFramedMsgs: innerFrames,
    overflowPx: overflow, sample: sample
  });
}
