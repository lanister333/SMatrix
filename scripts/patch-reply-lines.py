# -*- coding: utf-8 -*-
# Патч «линии = кто кому ответил»: API считает настоящую depth, компонент
# рисует нити только по реальным связям + штырёк родителя вниз к ответу.
# Каждая замена с проверкой единственности (count == 1), иначе exit(1).
import re, sys

def patch(path, subs):
    with open(path, encoding="utf-8") as f:
        src = f.read()
    changed = False
    for tag, pattern, repl, marker in subs:
        if marker in src:
            print(f"[skip] {path}: {tag} — уже применено (маркер найден)")
            continue
        n = len(re.findall(pattern, src, flags=re.S))
        if n != 1:
            print(f"[FAIL] {path}: «{tag}» найдено {n} раз (ожидался 1)")
            sys.exit(1)
        src = re.sub(pattern, repl, src, count=1, flags=re.S)
        changed = True
        print(f"[ok] {path}: {tag}")
    if changed:
        with open(path, "w", encoding="utf-8") as f:
            f.write(src)

# ---------- 1. API: настоящая глубина ----------
ROUTE = "src/app/api/topics/[id]/route.ts"
route_sub = ("вставка depthOf перед выборкой страницы",
r"""    const messages = await db\.message\.findMany\(\{
      where: \{ topicId \},
      orderBy: \{ num: "asc" \},""",
r"""    // Настоящая глубина каждого сообщения в дереве ответов темы. Поле
    // depth в БД не поддерживается (везде 0), а лесенке нужен честный
    // уровень для ответов, чей родитель остался на другой странице
    // (цепочка предков в компоненте обрывается на границе страниц).
    // Считаем по всей теме лёгким select двух колонок с мемоизацией.
    const treeRows = await db.message.findMany({ where: { topicId }, select: { id: true, parentId: true } });
    const parentOf = new Map(treeRows.map((r) => [r.id, r.parentId]));
    const depthMemo = new Map<string, number>();
    const depthOf = (id: string): number => {
      const hit = depthMemo.get(id);
      if (hit !== undefined) return hit;
      depthMemo.set(id, 0); // страховка от цикла в parentId (схемой не предусмотрен)
      const p = parentOf.get(id);
      const d = p ? depthOf(p) + 1 : 0;
      depthMemo.set(id, d);
      return d;
    };

    const messages = await db.message.findMany({
      where: { topicId },
      orderBy: { num: "asc" },""")

route_sub2 = ("depth: m.depth → depthOf(m.id)",
r"""        depth: m\.depth,""",
r"""        depth: depthOf(m.id),""")

patch(ROUTE, [
    route_sub + ("const depthOf",),
    route_sub2 + ("depth: depthOf(m.id)",),
])

# ---------- 2. Компонент: цепочки предков + честные нити + штырьки ----------
VIEW = "src/components/forum/topic-view.tsx"

# 2а. Комментарий директивы, пункт 5 — новая семантика линий
view_a = ("комментарий п.5 — линии = кто кому ответил",
r"""  // 5\) Нити ветвей — НЕПРЕРЫВНЫЕ вертикальные линии #249790 \(цвет морской
  //    волны с образца\), 2px, строго СНАРУЖИ рамок\. Нить уровня K стоит на
  //    колонке x = 25·K − 13 \(13px левее рамок уровня K\+1\); карточка
  //    уровня L рисует нити K = 1\.\.L−1 на всю свою высоту, а если снизу
  //    лента продолжается карточкой уровня ≥ K\+1 — плюс 8px зазора до её
  //    края \(нить сшивается сквозь зазор в непрерывную линию ветки\)\.
  //    Никаких Г\-уголков и никаких заходов линии в чужие рамки\.""",
r"""  // 5) Нити ветвей — НЕПРЕРЫВНЫЕ вертикальные линии #249790 (цвет морской
  //    волны с образца), 2px, строго СНАРУЖИ рамок. Нить уровня K стоит на
  //    колонке x = 25·K − 13 (13px левее рамок уровня K+1). Директива
  //    «линии соединяют исключительно кто кому ответил и не висят в
  //    воздухе»: нить K — это ветка ответов предка уровня K, рисуется
  //    только если предок виден на странице; верх линии доведён штырьком
  //    родителя до его нижней рамки, низ — до нижней рамки последнего
  //    ответа ветки; несколько ответов одному сообщению сливаются в одну
  //    вертикаль. Никаких Г-уголков и никаких заходов линии в чужие рамки.""")

# 2б. Уровни: сохраняем цепочки видимых предков (ancOf) + honest depth-фолбэк
view_b = ("ancOf + комментарий depth",
r"""  const flatMsgs = \[\.\.\.visible\]\.sort\(\(a, b\) => a\.num - b\.num\);
  const byId = new Map\(flatMsgs\.map\(\(m\) => \[m\.id, m\]\)\);
  // Уровень каждой плашки: цепочка предков \(корень → непосредственный
  // родитель\)\. Если родитель на другой странице \(цепочка оборвалась\) —
  // уровень берём из поля depth \(фолбэк, минимум 2: это точно ответ\)\.
  const lvlOf = new Map<string, number>\(\);
  for \(const m of flatMsgs\) \{""",
r"""  const flatMsgs = [...visible].sort((a, b) => a.num - b.num);
  const byId = new Map(flatMsgs.map((m) => [m.id, m]));
  // Уровень каждой плашки: цепочка предков (корень → непосредственный
  // родитель). Если родитель на другой странице (цепочка оборвалась) —
  // уровень берём из поля depth: API считает НАСТОЯЩУЮ глубину сообщения
  // в дереве ответов всей темы (поле depth в БД не поддерживается — там
  // везде 0), минимум 2: это точно ответ. Цепочка ВИДИМЫХ предков
  // сохраняется в ancOf — нити рисуются только к реальным предкам.
  const lvlOf = new Map<string, number>();
  const ancOf = new Map<string, Msg[]>();
  for (const m of flatMsgs) {""")

view_b2 = ("ancOf.set в цикле уровней",
r"""    lvlOf\.set\(m\.id, reachedRoot \? Math\.min\(6, Math\.max\(1, chain\.length \+ 1\)\) : Math\.min\(6, Math\.max\(2, \(m\.depth \?\? 0\) \+ 1\)\)\);
  \}""",
r"""    ancOf.set(m.id, chain);
    lvlOf.set(m.id, reachedRoot ? Math.min(6, Math.max(1, chain.length + 1)) : Math.min(6, Math.max(2, (m.depth ?? 0) + 1)));
  }""")

# 2в. Блок нитей целиком: от «// Нити:» до конца railsOf.forEach
view_c = ("блок расчёта нитей → честные связи + штырьки",
r"""  // Нити: плашка уровня L рисует нити K = 1\.\.L−1 \(колонка 25·K − 13 в
  // координатах контейнера; относительно самой карточки left =
  // \(K − L\)·25 \+ 12px — ОТРИЦАТЕЛЬНОЕ, строго левее рамки, в зазоре
  // margin\-left\)\. Нить тянется до конца непрерывного куска ленты с
  // уровнем ≥ K\+1: если СЛЕДУЮЩАЯ карточка тоже уровня ≥ K\+1 — хвост
  // calc\(100%\+10px\) сшивает её с нитью следующей карточки сквозь 8px
  // зазор; иначе calc\(100%\+2px\) — линия кончается на нижней рамке
  // этой карточки \(замер с образца: нить не выходит за ветку\)\.
  const railLeft = \(k: number, level: number\) => \(k - level\) \* 25 \+ 12;
  const railsOf = new Map<string, \{ k: number; tail: boolean \}\[\]>\(\);
  flatMsgs\.forEach\(\(m, i\) => \{
    const L = lvlOf\.get\(m\.id\) \?\? 1;
    if \(L < 2\) return;
    const next = flatMsgs\[i \+ 1\];
    const nextL = next \? \(lvlOf\.get\(next\.id\) \?\? 1\) : 0;
    const rails: \{ k: number; tail: boolean \}\[\] = \[\];
    for \(let k = 1; k < L; k\+\+\) rails\.push\(\{ k, tail: nextL >= k \+ 1 \}\);
    railsOf\.set\(m\.id, rails\);
  \}\);""",
r"""  // Нити = карта «кто кому ответил» (директива: линии соединяют сообщения
  // исключительно реальными связями ответов и не висят в воздухе).
  // Колонка нити K: 25·K − 13 в координатах контейнера (относительно
  // плашки уровня L: left = (K − L)·25 + 12px — ОТРИЦАТЕЛЬНОЕ, строго
  // левее рамки, в зазоре margin-left).
  const railLeft = (k: number, level: number) => (k - level) * 25 + 12;
  // Предок уровня K в цепочке root-first: chain[i] стоит на уровне
  // L − chain.length + i, т.е. индекс K − L + chain.length (если в границах).
  const ancAtLevel = (chain: Msg[], k: number, level: number): string | null => {
    const i = k - level + chain.length;
    return i >= 0 && i < chain.length ? chain[i].id : null;
  };
  const railsOf = new Map<string, { k: number; tail: boolean }[]>();
  const stubOf = new Map<string, boolean>();
  flatMsgs.forEach((m, i) => {
    const L = lvlOf.get(m.id) ?? 1;
    const anc = ancOf.get(m.id) ?? [];
    const next = flatMsgs[i + 1];
    const nextL = next ? (lvlOf.get(next.id) ?? 1) : 0;
    // ШТЫРЁК родителя: следующая плашка — наш РЕАЛЬНЫЙ ребёнок (по
    // parentId) ровно на уровень глубже → короткая линия (9px = 1px
    // нижней рамки + 8px зазора) от нашей нижней рамки до верхней рамки
    // ответа. Верх каждой линии упирается в само сообщение-адресат,
    // а не висит в 8px воздухе под ним.
    if (next && next.parentId === m.id && nextL === L + 1) stubOf.set(m.id, true);
    if (L < 2) return;
    const nextAnc = next ? (ancOf.get(next.id) ?? []) : [];
    const rails: { k: number; tail: boolean }[] = [];
    // Нить K рисуется, только если предок уровня K ВИДЕН на этой странице
    // (у оборванных страницей ответов честно нет линий к невидимым).
    // Хвост: нить продолжается вниз, только если следующая карточка
    // принадлежит ТОЙ ЖЕ ветке (у неё тот же предок уровня K) — тогда
    // calc(100%+10px) сшивает нить сквозь 8px зазор, и несколько ответов
    // одному сообщению дают ОДНУ вертикаль; иначе calc(100%+2px) — линия
    // кончается на нижней рамке последнего ответа ветки.
    for (let k = Math.max(1, L - anc.length); k < L; k++) {
      const a = ancAtLevel(anc, k, L);
      if (!a) continue;
      rails.push({ k, tail: next ? ancAtLevel(nextAnc, k, nextL) === a : false });
    }
    railsOf.set(m.id, rails);
  });""")

# 2г. Рендер: штырёк после обычных нитей
view_d = ("рендер штырька",
r"""                \{renderMsg\(m\)\}
              </div>
            \);
          \}\)}
        </div>
      \)\}""",
r"""                {stubOf.has(m.id) && (
                  /* Штырёк родителя: от его нижней рамки до верхней рамки
                     первого ответа — линия «ведёт к сообщению» */
                  <span key="rail-stub" data-stub="1" className="sakh-comment-connector" style={{ left: railLeft(L, L), top: "100%", height: 9 }} aria-hidden="true" />
                )}
                {renderMsg(m)}
              </div>
            );
          })}
        </div>
      )}""")

patch(VIEW, [
    view_a + ("линии соединяют исключительно кто кому ответил и не висят в",),
    view_b + ("const ancOf",),
    view_b2 + ("ancOf.set(m.id, chain);",),
    view_c + ("const stubOf",),
    view_d + ("data-stub",),
])
print("PATCH OK")
