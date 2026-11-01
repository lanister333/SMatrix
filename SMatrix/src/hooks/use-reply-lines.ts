"use client";

/**
 * УНИВЕРСАЛЬНЫЙ механизм линий «кто кому ответил» (SVG-оверлей над плоским
 * списком постов). Не зависит от темы, страницы и места использования:
 *   - на входе: ref на контейнер со списком + массив постов с parent_id;
 *   - на выходе: массив линий для отрисовки в SVG (см. ReplyLinesOverlay);
 *   - пересчёт: монтирование, изменение массива posts (пагинация, новый
 *     пост, удаление, редактирование, переход между темами), ресайз
 *     (ResizeObserver + window resize с debounce), догрузка шрифтов;
 *     скролл страницы пересчёта НЕ требует — линии считаются в координатах
 *     контейнера, оверлей absolute внутри скролл-контейнера едет вместе
 *     с ним (вариант «absolute внутри скролл-контейнера» из спеки);
 *   - производительность: один batch-read координат за кадр через
 *     requestAnimationFrame, debounce ресайза (180мс по умолчанию),
 *     IntersectionObserver — контейнер не виден, пересчёт откладывается,
 *     повторный setState подавляется, если геометрия не изменилась.
 * Пара «ответ → родитель» берётся ТОЛЬКО из parentId — ничего не выводится
 * из текста, никаких хардкодов id тем/постов, работает в будущих темах.
 */

import { useEffect, useMemo, useRef, useState } from "react";

/** Минимальный набор полей поста, необходимый для построения линий. */
export interface ReplyLinesPost {
  id: string;
  parentId?: string | null;
  num: number;
}

/** Готовая «шина» «родитель → его ответы» в координатах контейнера списка. */
export interface ReplyLine {
  /** id поста-родителя (ключ группы и React-ключ). */
  key: string;
  /** Номер поста-родителя для подсказки «ответ на #N». */
  parentNum: number;
  /** Видимый путь: приход к родителю, шина, отводы к ответам (скругления). */
  d: string;
}

/** Результат хука: линии + размеры svg + эхо-настроек для оверлея. */
export interface ReplyLinesGeometry {
  lines: ReplyLine[];
  width: number;
  height: number;
  color?: string;
  thickness?: number;
}

export interface UseReplyLinesOptions {
  /** Цвет линий (по умолчанию — CSS var(--sm-rail) из globals.css). */
  lineColor?: string;
  /** Толщина линий (по умолчанию 2 — из globals.css). */
  lineWidth?: number;
  /** Шаг колонок лесенки в px (равен margin-left одного уровня). */
  columnWidth?: number;
  /** false — механизм выключен (линии не строятся вовсе). */
  enabled?: boolean;
  /** Debounce ресайза, мс (150–200 по спеке). */
  debounceMs?: number;
  /** Как найти карточки постов внутри контейнера (по умолчанию — прямые
   *  дети с data-id, равным id поста). */
  postSelector?: string;
}

/* ------- Константы геометрии (как в утверждённом эталоне) ------- */
const R = 5; // радиус скругления стыков, px
const TAP_DY = 22; // вход линии в карточку: середина шапки (21) + 1px рамки
const OVER = 2; // заводка конца линии под рамку карточки (прячется её фоном)
const MIN_SPAN = 8; // короче этого шину не рисуем (родитель сразу над ответом)
const LANE_GAP = 6; // зазор между шинами на одной колонке
const MAX_LANE_TRIES = 6; // до стольких колонок влево уходит конфликтующая шина

const EMPTY: ReplyLinesGeometry = { lines: [], width: 0, height: 0 };

/**
 * Чистая функция геометрии: по фактическому DOM контейнера и списку постов
 * строит шины. Экспортируется для юнит-тестов. Правила (спека ReplyLines):
 *  - все ответы одного родителя сливаются в ОДНУ вертикальную шину;
 *  - шина идёт от родителя вниз до ПОСЛЕДНЕГО ответа, промежуточные ответы
 *    подключаются горизонтальными отводами от левого края своих карточек;
 *  - шина приходит к левому краю поста-родителя — ни один конец не висит
 *    в воздухе, все концы лежат на рамках карточек;
 *  - колонка шины — в маргинесе лесенки левее карточек ответов; если колонка
 *    занята другой шиной с пересекающимся размахом, шина уходит колонкой
 *    влево с шагом columnWidth — разные ветки не сливаются;
 *  - родитель не виден на странице (другая страница пагинации / другая
 *    тема) → пара пропускается, линия не рисуется;
 *  - удалённый родитель виден карточкой-заглушкой — линия приходит и к ней.
 */
export function buildReplyLines(
  cont: HTMLElement,
  posts: ReplyLinesPost[],
  opts: { columnWidth?: number; postSelector?: string } = {},
): { lines: ReplyLine[]; width: number; height: number } {
  const columnWidth = opts.columnWidth ?? 25;
  const selector = opts.postSelector ?? ":scope > [data-id]";
  const busOffset = Math.ceil(columnWidth / 2); // 25px шаг → колонка на 13px левее карточек

  const cbox = cont.getBoundingClientRect();
  if (!cbox.width && !cbox.height) return { lines: [], width: 0, height: 0 };

  // 1) Координаты карточек относительно контейнера — один batch-read.
  const rectOf = new Map<string, { left: number; top: number }>();
  cont.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    const id = el.dataset.id;
    if (!id) return;
    const r = el.getBoundingClientRect();
    rectOf.set(id, { left: r.left - cbox.left, top: r.top - cbox.top });
  });

  // 2) Группы ответов по parentId: только пары, где оба видны на странице.
  const numOf = new Map(posts.map((p) => [p.id, p.num] as const));
  const kidsOf = new Map<string, string[]>();
  for (const p of posts) {
    if (!p.parentId || !rectOf.has(p.id) || !rectOf.has(p.parentId)) continue;
    const arr = kidsOf.get(p.parentId);
    if (arr) arr.push(p.id);
    else kidsOf.set(p.parentId, [p.id]);
  }

  // 3) Черновики шин: вертикальный размах и базовая колонка.
  type Draft = {
    pid: string;
    pNum: number;
    parentLeft: number;
    pY: number;
    childLeft: number;
    tapsY: number[];
    lastY: number;
    base: number;
  };
  const draft: Draft[] = [];
  for (const [pid, kidIds] of kidsOf) {
    const kids = kidIds
      .map((id) => rectOf.get(id)!)
      .sort((a, b) => a.top - b.top);
    const pr = rectOf.get(pid)!;
    const tapsY = kids.map((k) => k.top + TAP_DY);
    const lastY = Math.max(...tapsY);
    const pY = pr.top + TAP_DY;
    // Все дети одного родителя лежат на одном уровне лесенки → общий левый
    // край; базовая колонка шины — левее него на busOffset.
    const childLeft = Math.min(...kids.map((k) => k.left));
    draft.push({
      pid,
      pNum: numOf.get(pid) ?? 0,
      parentLeft: pr.left,
      pY,
      childLeft,
      tapsY,
      lastY,
      base: childLeft - busOffset,
    });
  }
  // Хронология списка гарантирует: ответ создан позже родителя → лежит ниже.
  // Аномалии (родитель ниже ребёнка) честно пропускаем — линию не рисуем.
  const ordered = draft.filter((g) => g.lastY - g.pY > MIN_SPAN).sort((a, b) => a.pY - b.pY);

  // 4) Раскладка колонок: две шины на одном x с пересекающимся размахом
  // выглядели бы одной линией — запрещаем.
  const lanes = new Map<number, Array<[number, number]>>();
  const lines: ReplyLine[] = [];
  for (const g of ordered) {
    let busX = NaN;
    for (let i = 0; i < MAX_LANE_TRIES; i += 1) {
      const x = g.base - columnWidth * i;
      const segs = lanes.get(x) ?? [];
      if (!segs.some(([t, b]) => g.pY < b + LANE_GAP && g.lastY > t - LANE_GAP)) {
        segs.push([g.pY, g.lastY]);
        lanes.set(x, segs);
        busX = x;
        break;
      }
    }
    if (!Number.isFinite(busX)) continue; // колонки исчерпаны — линию не рисуем

    // 5) Путь: левый край родителя → скругление → шина вниз → скругление →
    // левый край ПОСЛЕДНЕГО ответа; промежуточные ответы — отводами от шины.
    const r = Math.max(2, Math.min(R, (g.lastY - g.pY) / 2 - 2));
    const toBus = Math.sign(busX - g.parentLeft) || 1; // от родителя к шине
    const toChild = Math.sign(g.childLeft - busX) || 1; // от шины к ответам (вправо)
    let d =
      `M ${g.parentLeft + OVER} ${g.pY}` +
      ` L ${busX - toBus * r} ${g.pY}` +
      ` Q ${busX} ${g.pY} ${busX} ${g.pY + r}` +
      ` L ${busX} ${g.lastY - r}` +
      ` Q ${busX} ${g.lastY} ${busX + toChild * r} ${g.lastY}` +
      ` L ${g.childLeft + OVER} ${g.lastY}`;
    for (let i = 0; i < g.tapsY.length - 1; i += 1) {
      const y = g.tapsY[i];
      d += ` M ${busX} ${y - r} Q ${busX} ${y} ${busX + toChild * r} ${y} L ${g.childLeft + OVER} ${y}`;
    }
    lines.push({ key: g.pid, parentNum: g.pNum, d });
  }

  return { lines, width: Math.ceil(cont.scrollWidth), height: Math.ceil(cont.scrollHeight) };
}

/** Стабильное сравнение результата — чтобы не звать setState впустую. */
function sameGeom(a: ReplyLinesGeometry, b: { lines: ReplyLine[]; width: number; height: number }): boolean {
  if (a.width !== b.width || a.height !== b.height || a.lines.length !== b.lines.length) return false;
  for (let i = 0; i < a.lines.length; i += 1) {
    if (a.lines[i].key !== b.lines[i].key || a.lines[i].d !== b.lines[i].d) return false;
  }
  return true;
}

/**
 * Хук useReplyLines(containerRef, posts, options) → линии для SVG.
 * Подробности триггеров пересчёта и производительности — в шапке файла.
 */
export function useReplyLines(
  containerRef: React.RefObject<HTMLElement | null>,
  posts: ReplyLinesPost[],
  { lineColor, lineWidth, columnWidth = 25, enabled = true, debounceMs = 180, postSelector }: UseReplyLinesOptions = {},
): ReplyLinesGeometry {
  const [geom, setGeom] = useState<ReplyLinesGeometry>(EMPTY);

  // Мемоизированная сигнатура набора постов: единственный триггер эффекта
  // по данным. Любая смена набора (страница пагинации, новый пост, удаление,
  // редактирование, другая тема) меняет сигнатуру → пересчёт на след. кадре.
  // Пересоздание того же массива без изменения содержимого — НЕ триггер.
  const sig = useMemo(() => posts.map((p) => `${p.id}:${p.parentId ?? ""}`).join("|"), [posts]);
  const postsRef = useRef(posts);
  postsRef.current = posts; // свежий массив без пересоздания эффекта

  useEffect(() => {
    if (!enabled) {
      setGeom((prev) => (prev === EMPTY ? prev : EMPTY));
      return undefined;
    }
    let raf = 0;
    let timer = 0;
    let visible = true; // IntersectionObserver: виден ли контейнер
    let dirty = false; // накопился ли пропуск при невидимости

    const measure = () => {
      const cont = containerRef.current;
      if (!cont) return;
      const res = buildReplyLines(cont, postsRef.current, { columnWidth, postSelector });
      setGeom((prev) => {
        if (sameGeom(prev, res)) return prev;
        return { lines: res.lines, width: res.width, height: res.height, color: lineColor, thickness: lineWidth };
      });
    };

    // Пересчёт — строго один batch-read на кадр (requestAnimationFrame).
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!visible) {
          dirty = true; // контейнер не виден — отложим до появления
          return;
        }
        measure();
      });
    };

    // Ресайз — с debounce (150–200мс), затем всё равно через rAF.
    const debounced = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(schedule, debounceMs);
    };

    schedule(); // монтирование / смена набора постов / смена страницы

    const cont = containerRef.current;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;
    if (cont) {
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(debounced); // ресайз контейнера (и его содержимого)
        ro.observe(cont);
      }
      if (typeof IntersectionObserver !== "undefined") {
        io = new IntersectionObserver((entries) => {
          const wasVisible = visible;
          visible = entries.some((e) => e.isIntersecting);
          if (visible && !wasVisible && dirty) {
            dirty = false;
            schedule(); // контейнер снова виден — досчитать пропущенное
          }
        });
        io.observe(cont);
      }
      window.addEventListener("resize", debounced);
      // Догрузка шрифтов меняет метрики карточек — пересчитать.
      try {
        void document.fonts.ready.then(schedule).catch(() => undefined);
      } catch {
        /* окружение без FontFaceSet (тесты) — не важно */
      }
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      ro?.disconnect();
      io?.disconnect();
      window.removeEventListener("resize", debounced);
    };
  }, [sig, enabled, columnWidth, debounceMs, postSelector, lineColor, lineWidth, containerRef]);

  return geom;
}
