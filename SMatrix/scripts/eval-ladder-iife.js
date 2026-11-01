(
() => {
  const c = document.querySelector('.sakh-comments-container');
  if (!c) return 'НЕТ .sakh-comments-container';
  const all = Array.from(document.querySelectorAll('.sakh-comment'));
  const plates = Array.from(c.querySelectorAll(':scope > .sakh-comment'));
  const nested = all.filter(function (el) { return el.parentElement !== c; }).length;
  const levels = {};
  plates.forEach(function (p) { const L = p.getAttribute('data-level'); levels[L] = (levels[L] || 0) + 1; });
  let rails = 0; const railIssues = []; const cornerIssues = [];
  plates.forEach(function (p) {
    const cs = getComputedStyle(p);
    const pl = parseFloat(cs.paddingLeft);
    const L = parseInt(p.getAttribute('data-level'), 10);
    if (window.innerWidth > 768 && Math.abs(pl - 20 * L) > 0.5) railIssues.push('padding-left ' + pl + ' != 20*' + L + ' (msg ' + p.dataset.msgnum + ')');
    const rs = p.querySelectorAll(':scope > .sakh-comment-connector');
    rails += rs.length;
    rs.forEach(function (r) {
      const rx = r.getBoundingClientRect();
      const px = p.getBoundingClientRect();
      const rxRel = rx.left - px.left;
      if (rxRel + rx.width > pl + 0.5) railIssues.push('нить x=' + rxRel + ' заходит на контент ' + pl + ' (msg ' + p.dataset.msgnum + ', level ' + L + ')');
      if (rx.height < 5) railIssues.push('нить короче 5px (msg ' + p.dataset.msgnum + ')');
    });
    if (L > 1) {
      const cb = getComputedStyle(p, '::before');
      if (cb.content === 'none' || cb.display === 'none') cornerIssues.push('нет уголка (msg ' + p.dataset.msgnum + ', level ' + L + ')');
      else {
        const cl = parseFloat(cb.left); const cw = parseFloat(cb.width);
        if (cl + cw > pl + 0.5) cornerIssues.push('уголок left+width=' + (cl + cw) + ' заходит за контент ' + pl + ' (msg ' + p.dataset.msgnum + ')');
        if (cl < 0) cornerIssues.push('уголок left=' + cl + ' вылезает влево за плашку (msg ' + p.dataset.msgnum + ')');
      }
    }
  });
  const l1bad = plates.filter(function (p) { return p.getAttribute('data-level') === '1' && getComputedStyle(p, '::before').content !== 'none'; }).length;
  const borders = plates.filter(function (p) {
    const b = getComputedStyle(p).borderTopStyle;
    const bl = getComputedStyle(p).borderLeftStyle;
    const br = getComputedStyle(p).borderRightStyle;
    return (b !== 'none' && parseFloat(getComputedStyle(p).borderTopWidth) > 0) || (bl !== 'none' && parseFloat(getComputedStyle(p).borderLeftWidth) > 0) || (br !== 'none' && parseFloat(getComputedStyle(p).borderRightWidth) > 0);
  }).length;
  const overflow = document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth;
  const innerFrames = c.querySelectorAll('.sakh-comment > .sk-msg').length ? Array.from(c.querySelectorAll('.sakh-comment > .sk-msg')).filter(function (m) { return parseFloat(getComputedStyle(m).borderLeftWidth) > 0; }).length : 0;
  const sample = plates.slice(0, 30).map(function (p) { return p.dataset.msgnum + '/L' + p.getAttribute('data-level') + '/r' + p.querySelectorAll('.sakh-comment-connector').length; }).join(' ');
  return JSON.stringify({
    plates: plates.length, allCommentEls: all.length, nested: nested, levels: levels,
    railsTotal: rails, railIssues: railIssues.slice(0, 6), cornerIssues: cornerIssues.slice(0, 6),
    l1WithCorner: l1bad, platesWithSideBorders: borders, innerFramedMsgs: innerFrames,
    overflowPx: overflow, sample: sample
  });
}
)()
