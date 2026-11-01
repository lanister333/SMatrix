#!/usr/bin/env python3
# Спека ReplyLines: линии «кто кому ответил» переводятся с попостовых
# спан-коннекторов (rails/hooks/stub) на ЕДИНЫЙ SVG-оверлей (одна шина
# на родителя, отводы к каждому ответу, приход к левому краю родителя).
# Все замены count==1; файл пишется ОДИН раз после всех проверок.
import sys

PATH = "/home/z/my-project/src/components/forum/topic-view.tsx"
src = open(PATH, encoding="utf-8").read()

def patch(old, new, note):
    global src
    n = src.count(old)
    if n != 1:
        print(f"FAIL [{note}]: count={n}"); sys.exit(1)
    src = src.replace(old, new)
    print(f"OK [{note}]")

# 1) Импорт компонента
patch(
    'import { AppealModal } from "@/components/forum/modals";',
    'import { AppealModal } from "@/components/forum/modals";\nimport ReplyLines from "@/components/forum/reply-lines";',
    "import ReplyLines",
)

# 2) Директива, пункты 5-6: описание новой системы линий
patch(
    """  // 5) Нити ветвей — НЕПРЕРЫВНЫЕ вертикальные линии #249790 (цвет морской
  //    волны с образца), 2px, строго СНАРУЖИ рамок. Нить уровня K стоит на
  //    колонке x = 25·K − 13 (13px левее рамок уровня K+1). Директива
  //    «линии соединяют исключительно кто кому ответил и не висят в
  //    воздухе»: нить K — это ветка ответов предка уровня K, рисуется
  //    только если предок виден на странице; верх линии доведён штырьком
  //    родителя до его нижней рамки, низ — до нижней рамки последнего
  //    ответа ветки; несколько ответов одному сообщению сливаются в одну
  //    вертикаль. Никаких заходов линии в чужие рамки. Директива «вертикали,
  //    которые не доходят до конца и висят, — их не должно быть»: нить
  //    НИКОГДА не обрывается на крючке в шапке — всегда до нижней рамки
  //    (эталон autokochka.ru/forum/thread/1910375: концы нити только
  //    штырёк родителя и нижняя рамка последнего ответа ветки).
  // 6) КРЮЧКИ и УГЛЫ по эталону autokochka.ru/forum/thread/1910375 (движок
  //    Сахкома, разметка tree-t/tree-l/tree-i): ответ висит на колонке СВОЕЙ
  //    ветки (K = L−1) горизонтальным отростком на высоте шапки — «├» (tree-t),
  //    если ветка ниже продолжается, и «└» (tree-l: вертикаль НЕ доходит до
  //    нижней рамки, а загибается в карточку), если ответ последний. Колонки
  //    предков (K < L−1) — сквозные «│» (tree-i) без крючков.""",
    """  // 5) Линии «кто кому ответил» — SVG-оверлей (компонент ReplyLines):
  //    бирюзовые линии var(--sm-rail) 2px, рисуются поверх фона, но ПОД
  //    карточками (z-index 0 против 1 у карточек). Для каждого родителя —
  //    ОДНА вертикальная шина в левом маргинесе уровня его ответов (шаг
  //    25px; конфликтующие шины расходятся колонками дальше влево);
  //    каждый ответ подключается горизонтальным отводом от левого края
  //    своей карточки на высоте шапки (22px), шина приходит к левому краю
  //    поста-родителя. Стыки скруглены (r=5). Линия не рисуется, если
  //    родитель не виден на странице (метка «└ ответ …» остаётся); если
  //    родитель удалён — линия ведёт к заглушке «Сообщение №N удалено…».
  // 6) Ни один конец линии не висит в воздухе: концы лежат на рамках
  //    карточек (под рамку линия заводится на 2px — белый фон карточки
  //    прячет заводку, видимый конец точно касается рамки); участки шины
  //    за чужими карточками честно уходят под белый фон, в зазорах 8px
  //    линия касается обеих рамок. Наведение на линию подсвечивает её и
  //    показывает подсказку «ответ на #N». Мобайл ≤768px: оверлей скрыт.""",
    "directive items 5-6",
)

# 3) Расчёт уровней: без ancOf (нитей-спанов больше нет)
patch(
    """  // везде 0), минимум 2: это точно ответ. Цепочка ВИДИМЫХ предков
  // сохраняется в ancOf — нити рисуются только к реальным предкам.
  const lvlOf = new Map<string, number>();
  const ancOf = new Map<string, Msg[]>();
  for (const m of flatMsgs) {
    const chain: Msg[] = [];
    let p = m.parentId ? byId.get(m.parentId) : undefined;
    let reachedRoot = !m.parentId;
    while (p) {
      chain.unshift(p);
      const pp = p.parentId ? byId.get(p.parentId) : undefined;
      if (!pp) {
        reachedRoot = !p.parentId;
        break;
      }
      p = pp;
    }
    ancOf.set(m.id, chain);
    lvlOf.set(m.id, reachedRoot ? Math.min(6, Math.max(1, chain.length + 1)) : Math.min(6, Math.max(2, (m.depth ?? 0) + 1)));
  }
  // Нити = карта «кто кому ответил» (директива: линии соединяют сообщения
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
  const railsOf = new Map<string, { k: number; tail: boolean; own: boolean }[]>();
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
    const rails: { k: number; tail: boolean; own: boolean }[] = [];
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
      // own = колонка СВОЕЙ ветки (нити непосредственного родителя, K = L−1):
      // на неё ответ вешается крючком «├/└»; предковые K < L−1 — сквозные «│».
      rails.push({ k, tail: next ? ancAtLevel(nextAnc, k, nextL) === a : false, own: k === L - 1 });
    }
    railsOf.set(m.id, rails);
  });""",
    """  // везде 0), минимум 2: это точно ответ. Уровень нужен только для
  // data-level (сдвиг лесенки); геометрию линий «кто кому ответил»
  // строит компонент ReplyLines по parentId и фактическим координатам.
  const lvlOf = new Map<string, number>();
  for (const m of flatMsgs) {
    let len = 0;
    let p = m.parentId ? byId.get(m.parentId) : undefined;
    let reachedRoot = !m.parentId;
    while (p) {
      len += 1;
      const pp = p.parentId ? byId.get(p.parentId) : undefined;
      if (!pp) {
        reachedRoot = !p.parentId;
        break;
      }
      p = pp;
    }
    lvlOf.set(m.id, reachedRoot ? Math.min(6, Math.max(1, len + 1)) : Math.min(6, Math.max(2, (m.depth ?? 0) + 1)));
  }
  // ЛИНИИ «КТО КОМУ ОТВЕТИЛ»: прежняя система попостовых спанов
  // (rails/hooks/stub) удалена — все линии рисует ЕДИНЫЙ SVG-оверлей
  // <ReplyLines msgs={flatMsgs} /> внутри .sakh-comments-container:
  // одна шина на родителя, отводы к каждому ответу, приход к левому
  // краю родителя, скругления, подсветка и подсказка при наведении.""",
    "lvl/rails computation",
)

# 4) Вставка оверлея в контейнер
patch(
    """        <div className="sakh-comments-container">
          {flatMsgs.map((m) => {""",
    """        <div className="sakh-comments-container">
          {/* SVG-оверлей «кто кому ответил»: линии ПОД карточками, одна шина на родителя */}
          <ReplyLines msgs={flatMsgs} />
          {flatMsgs.map((m) => {""",
    "container overlay",
)

# 5) Удаление спан-коннекторов из карточки
patch(
    """              <div key={m.id} className="sakh-comment" data-level={String(L)} data-id={m.id} data-msgnum={m.num}>
                {(railsOf.get(m.id) ?? []).map(({ k, tail, own }) => (
                  <span
                    key={`rail-${k}`}
                    className="sakh-comment-connector"
                    style={{ left: railLeft(k, L), height: tail ? "calc(100% + 10px)" : "calc(100% + 2px)" }}
                    aria-hidden="true"
                  />
                ))}
                {(railsOf.get(m.id) ?? []).filter((r) => r.own).map(({ k }) => (
                  /* Крючок «├» (отметка ответа на колонке СВОЕЙ ветки): от колонки
                     до рамки карточки на высоте шапки. 22 = 21 (середина шапки) + 1
                     рамка. Сама вертикаль крючок НЕ обрывает: по директиве «линии
                     не висят и не доходят до конца — их не должно быть» она всегда
                     идёт от верхней рамки до нижней (эталон autokochka: нить ветки
                     заканчивается ТОЛЬКО на нижней рамке последнего ответа). */
                  <span key={`hook-${k}`} data-hook="1" className="sakh-comment-connector" style={{ left: railLeft(k, L), top: 21, width: 13, height: 2 }} aria-hidden="true" />
                ))}
                {stubOf.has(m.id) && (
                  /* Штырёк родителя: от его нижней рамки до верхней рамки
                     первого ответа — линия «ведёт к сообщению» */
                  <span key="rail-stub" data-stub="1" className="sakh-comment-connector" style={{ left: railLeft(L, L), top: "100%", height: 9 }} aria-hidden="true" />
                )}
                {renderMsg(m)}
              </div>""",
    """              <div key={m.id} className="sakh-comment" data-level={String(L)} data-id={m.id} data-msgnum={m.num}>
                {renderMsg(m)}
              </div>""",
    "card spans removed",
)

open(PATH, "w", encoding="utf-8").write(src)
print("saved")
