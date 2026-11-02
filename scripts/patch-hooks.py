# -*- coding: utf-8 -*-
# Патч «крючки и углы как на autokochka.ru (движок Сахкома)».
# Каждая замена обязана встретиться РОВНО 1 раз (count==1), иначе exit(1).
import io, sys

TSX = '/home/z/my-project/src/components/forum/topic-view.tsx'
VS = '/home/z/my-project/scripts/verify-reply-lines.mjs'

def patch(path, pairs):
    src = io.open(path, encoding='utf-8').read()
    for old, new in pairs:
        n = src.count(old)
        if n != 1:
            print('FAIL %s: count=%d для фрагмента: %r' % (path, n, old[:90]))
            sys.exit(1)
        src = src.replace(old, new)
    io.open(path, 'w', encoding='utf-8').write(src)
    print('OK', path, '(%d замен)' % len(pairs))

# ---------- topic-view.tsx ----------
tsx_pairs = [
    # 1) Директива-комментарий: добавить пункт 6 про крючки/углы эталона
    ("//    ответа ветки; несколько ответов одному сообщению сливаются в одну\n"
     "  //    вертикаль. Никаких Г-уголков и никаких заходов линии в чужие рамки.",
     "//    ответа ветки; несколько ответов одному сообщению сливаются в одну\n"
     "  //    вертикаль. Никаких заходов линии в чужие рамки.\n"
     "  // 6) КРЮЧКИ и УГЛЫ по эталону autokochka.ru/forum/thread/1910375 (движок\n"
     "  //    Сахкома, разметка tree-t/tree-l/tree-i): ответ висит на колонке СВОЕЙ\n"
     "  //    ветки (K = L−1) горизонтальным отростком на высоте шапки — «├» (tree-t),\n"
     "  //    если ветка ниже продолжается, и «└» (tree-l: вертикаль НЕ доходит до\n"
     "  //    нижней рамки, а загибается в карточку), если ответ последний. Колонки\n"
     "  //    предков (K < L−1) — сквозные «│» (tree-i) без крючков."),
    # 2) Тип railsOf: добавить own
    ("  const railsOf = new Map<string, { k: number; tail: boolean }[]>();",
     "  const railsOf = new Map<string, { k: number; tail: boolean; own: boolean }[]>();"),
    # 3) rails.push: флаг own (колонка непосредственного родителя)
    ("      rails.push({ k, tail: next ? ancAtLevel(nextAnc, k, nextL) === a : false });",
     "      // own = колонка СВОЕЙ ветки (нити непосредственного родителя, K = L−1):\n"
     "      // на неё ответ вешается крючком «├/└»; предковые K < L−1 — сквозные «│».\n"
     "      rails.push({ k, tail: next ? ancAtLevel(nextAnc, k, nextL) === a : false, own: k === L - 1 });"),
    # 4) JSX: рендер нитей + крючков
    ("                {(railsOf.get(m.id) ?? []).map(({ k, tail }) => (\n"
     "                  <span\n"
     "                    key={`rail-${k}`}\n"
     "                    className=\"sakh-comment-connector\"\n"
     "                    style={{ left: railLeft(k, L), height: tail ? \"calc(100% + 10px)\" : \"calc(100% + 2px)\" }}\n"
     "                    aria-hidden=\"true\"\n"
     "                  />\n"
     "                ))}",
     "                {(railsOf.get(m.id) ?? []).map(({ k, tail, own }) => (\n"
     "                  <span\n"
     "                    key={`rail-${k}`}\n"
     "                    className=\"sakh-comment-connector\"\n"
     "                    style={{ left: railLeft(k, L), height: own && !tail ? 22 : tail ? \"calc(100% + 10px)\" : \"calc(100% + 2px)\" }}\n"
     "                    aria-hidden=\"true\"\n"
     "                  />\n"
     "                ))}\n"
     "                {(railsOf.get(m.id) ?? []).filter((r) => r.own).map(({ k }) => (\n"
     "                  /* Крючок «├/└» (эталон autokochka/Sakhcom tree-t:after): от колонки\n"
     "                     СВОЕЙ ветки до рамки карточки на высоте шапки — линия зримо\n"
     "                     «втыкается» в каждый ответ. 22 = 21 (середина шапки) + 1 рамка;\n"
     "                     у последнего ответа ветки вертикаль кончается ровно на крючке. */\n"
     "                  <span key={`hook-${k}`} data-hook=\"1\" className=\"sakh-comment-connector\" style={{ left: railLeft(k, L), top: 21, width: 13, height: 2 }} aria-hidden=\"true\" />\n"
     "                ))}"),
]
patch(TSX, tsx_pairs)

# ---------- verify-reply-lines.mjs ----------
vs_pairs = [
    # 1) Шапка комментария
    ("// с DOM 1:1. Плюс глобальный инвариант честности: каждый конец каждого\n"
     "// вертикального отрезка обязан лежать на рамке карточки (ничего не висит\n"
     "// в воздухе), плюс слияние линий у многодетных родителей, плюс регресс\n"
     "// геометрии лесенки и метки «└ ответ …».",
     "// с DOM 1:1. Плюс КРЮЧКИ/УГЛЫ по эталону autokochka (tree-t/tree-l/tree-i):\n"
     "// каждый ответ висит крючком на колонке своей ветки (K = L−1) на высоте\n"
     "// шапки; последний ответ ветки — «└» (вертикаль кончается на крючке).\n"
     "// Плюс глобальный инвариант честности: каждый конец каждого вертикального\n"
     "// отрезка обязан лежать на рамке карточки ЛИБО на крючке (ничего не висит\n"
     "// в воздухе), плюс слияние линий у многодетных родителей, плюс регресс\n"
     "// геометрии лесенки и метки «└ ответ …»."),
    # 2) buildExpected: own-флаг
    ("      cur.rails.push({ k, tail });",
     "      cur.rails.push({ k, tail, own: k === cur.lvl - 1 });"),
    # 3) DOM-сбор: помечать крючки
    ("      return { num: +card.dataset.msgnum, stub: s.dataset.stub === '1', left: r.left - contLeft, top: r.top + y0, bottom: r.bottom + y0, w: r.width, color: cs.backgroundColor, disp: cs.display };",
     "      return { num: +card.dataset.msgnum, stub: s.dataset.stub === '1', hook: s.dataset.hook === '1', left: r.left - contLeft, top: r.top + y0, bottom: r.bottom + y0, w: r.width, color: cs.backgroundColor, disp: cs.display };"),
    # 4) railsDom: исключить крючки
    ("    const railsDom = mine.filter((s) => !s.stub);",
     "    const railsDom = mine.filter((s) => !s.stub && !s.hook);\n"
     "    const hooksDom = mine.filter((s) => s.hook);"),
    # 5) Геометрия нити: угол «└» для own && !tail
    ("      ok(Math.abs(seg.top - card.top) <= 1.5, `#${m.num} нить K=${er.k} начинается на верхней рамке карточки`);\n"
     "      const hExp = card.h + (er.tail ? 9 : 0);\n"
     "      ok(Math.abs(seg.bottom - (card.bottom + (er.tail ? 9 : 0))) <= 1.5, `#${m.num} нить K=${er.k} хвост ${er.tail ? 'сквозь зазор (+9)' : 'до своей нижней рамки (+0)'}`);\n"
     "      ok(Math.abs((seg.bottom - seg.top) - hExp) <= 2, `#${m.num} нить K=${er.k} длина ок`);",
     "      ok(Math.abs(seg.top - card.top) <= 1.5, `#${m.num} нить K=${er.k} начинается на верхней рамке карточки`);\n"
     "      if (er.own && !er.tail) {\n"
     "        // УГОЛ «└»: последний ответ ветки — вертикаль кончается на крючке (y = +22 от верха)\n"
     "        ok(Math.abs(seg.bottom - (card.top + 22)) <= 1.5, `#${m.num} нить K=${er.k} угол «└»: вертикаль кончается на крючке (${(seg.bottom - card.top).toFixed(1)} от верха, ждём 22)`);\n"
     "      } else {\n"
     "        const hExp = card.h + (er.tail ? 9 : 0);\n"
     "        ok(Math.abs(seg.bottom - (card.bottom + (er.tail ? 9 : 0))) <= 1.5, `#${m.num} нить K=${er.k} хвост ${er.tail ? 'сквозь зазор (+9)' : 'до своей нижней рамки (+0)'}`);\n"
     "        ok(Math.abs((seg.bottom - seg.top) - hExp) <= 2, `#${m.num} нить K=${er.k} длина ок`);\n"
     "      }"),
    # 6) Крючки: 1:1 после проверок нитей (перед проверкой штырька)
    ("    const stubDom = mine.find((s) => s.stub);",
     "    const expHooks = exp.rails.filter((r) => r.own);\n"
     "    ok(hooksDom.length === expHooks.length, `#${m.num} крючков ${hooksDom.length} (ожидалось ${expHooks.length})`);\n"
     "    for (const eh of expHooks) {\n"
     "      const colExp = 25 * eh.k - 12;\n"
     "      const hk = hooksDom.find((s) => Math.abs(s.left - colExp) <= 1.5);\n"
     "      ok(!!hk, `#${m.num} крючок K=${eh.k} на колонке ${colExp} есть`);\n"
     "      if (!hk) continue;\n"
     "      ok(Math.abs(hk.top - (card.top + 22)) <= 1.5, `#${m.num} крючок K=${eh.k} на высоте шапки (y=${(hk.top - card.top).toFixed(1)} от верха, ждём 22)`);\n"
     "      ok(Math.abs(hk.w - 13) <= 1 && Math.abs(hk.bottom - hk.top - 2) <= 1, `#${m.num} крючок K=${eh.k} размер 13x2`);\n"
     "      ok(Math.abs((hk.left + hk.w) - (colExp + 14)) <= 2.5, `#${m.num} крючок K=${eh.k} дотягивается до рамки карточки`);\n"
     "      ok(hk.color === 'rgb(36, 151, 144)', `#${m.num} крючок K=${eh.k} цвет #249790`);\n"
     "    }\n"
     "    const stubDom = mine.find((s) => s.stub);"),
    # 7) Инвариант: крючки — не вертикальные отрезки; конец на крючке валиден
    ("  const byCol = new Map();\n"
     "  for (const s of dom.segs) {\n"
     "    const col = Math.round(s.left);\n"
     "    if (!byCol.has(col)) byCol.set(col, []);\n"
     "    byCol.get(col).push(s);\n"
     "  }\n"
     "  const endOnFrame = (y) => dom.cards.some((c) => Math.abs(c.top - y) <= 1.5 || Math.abs(c.bottom - y) <= 1.5);",
     "  const hooksAll = dom.segs.filter((s) => s.hook);\n"
     "  const endOnHook = (col, y) => hooksAll.some((h) => Math.abs(h.left - col) <= 1.5 && y >= h.top - 1.5 && y <= h.bottom + 1.5);\n"
     "  const byCol = new Map();\n"
     "  for (const s of dom.segs) {\n"
     "    if (s.hook) continue; // крючки горизонтальны — в вертикальную сводку не идут\n"
     "    const col = Math.round(s.left);\n"
     "    if (!byCol.has(col)) byCol.set(col, []);\n"
     "    byCol.get(col).push(s);\n"
     "  }\n"
     "  const endOnFrame = (col, y) => dom.cards.some((c) => Math.abs(c.top - y) <= 1.5 || Math.abs(c.bottom - y) <= 1.5) || endOnHook(col, y);"),
    ("      if (!endOnFrame(cur.top)) { floats++; console.log(`  ✗ висящий ВЕРХ линии x=${col}: y=${cur.top.toFixed(1)}`); }\n"
     "      if (!endOnFrame(cur.bottom)) { floats++; console.log(`  ✗ висящий НИЗ линии x=${col}: y=${cur.bottom.toFixed(1)}`); }",
     "      if (!endOnFrame(col, cur.top)) { floats++; console.log(`  ✗ висящий ВЕРХ линии x=${col}: y=${cur.top.toFixed(1)}`); }\n"
     "      if (!endOnFrame(col, cur.bottom)) { floats++; console.log(`  ✗ висящий НИЗ линии x=${col}: y=${cur.bottom.toFixed(1)}`); }"),
    # 8) Слияние у многодетных: ствол обязан покрывать крючок КАЖДОГО ответа и кончаться на крючке последнего
    ("    const lastKid = Math.max(...kids.map((k) => cardByNum.get(k)?.bottom ?? -1));\n"
     "    ok(!!iv && iv.bottom >= lastKid - 1.5,\n"
     "      `родитель #${pn} (дети ${kids.join(', ')}): ОДНА непрерывная линия от его рамки до последнего ответа` +\n"
     "      (!iv ? ' — интервал не найден!' : ` — линия ${iv.top.toFixed(0)}..${iv.bottom.toFixed(0)}, нужно до ${lastKid.toFixed(0)}`));",
     "    const kidCards = kids.map((k) => cardByNum.get(k)).filter(Boolean);\n"
     "    if (kidCards.length === 0) continue;\n"
     "    const lastKidCard = kidCards[kidCards.length - 1];\n"
     "    const lastHookY = lastKidCard.top + 22; // крючок последнего ответа\n"
     "    const allHooksCovered = kidCards.every((kc) => {\n"
     "      const hy = kc.top + 22;\n"
     "      return !!iv && iv.top <= hy + 1.5 && iv.bottom >= hy - 1.5;\n"
     "    });\n"
     "    ok(!!iv && iv.bottom >= lastHookY - 1.5 && allHooksCovered,\n"
     "      `родитель #${pn} (дети ${kids.join(', ')}): ОДНА непрерывная линия от его рамки до крючка последнего ответа, крючки всех ответов на стволе` +\n"
     "      (!iv ? ' — интервал не найден!' : ` — линия ${iv.top.toFixed(0)}..${iv.bottom.toFixed(0)}, нужно до ${lastHookY.toFixed(0)}`));"),
]
patch(VS, vs_pairs)
print('ВСЁ ОК')
