/// <reference types="bun-types" />
/**
 * Тесты универсального механизма линий «кто кому ответил»
 * (useReplyLines + ReplyLinesOverlay + ForumThread). Сценарии из ТЗ:
 *   1. линии рисуются для постов с parent_id;
 *   2. линии не рисуются для корневых постов;
 *   3. при смене страницы линии пересчитываются (родитель на другой
 *      странице — линии нет);
 *   4. при добавлении нового поста линии обновляются.
 * Плюс прямая проверка чистой функции buildReplyLines (несколько ответов
 * одному родителю сливаются в ОДНУ шину).
 *
 * Запуск: bun test tests/reply-lines.test.tsx
 * DOM-глобалы поднимает preload tests/setup-dom.ts (bunfig.toml).
 */
import { describe, it, expect } from "bun:test";
import { createElement } from "react";
import { render, act } from "@testing-library/react";
import { buildReplyLines } from "../src/hooks/use-reply-lines";
import ForumThread from "../src/components/forum/forum-thread";

type P = { id: string; parentId?: string | null; num: number };

const rect = (left: number, top: number, w = 40, h = 40) =>
  ({ left, top, right: left + w, bottom: top + h, width: w, height: h, x: left, y: top, toJSON: () => {} }) as DOMRect;

/** Прямоугольники: контейнер в (0,0), карточки лесенкой 25px, шаг 48px. */
const patchRects = (root: HTMLElement, posts: P[]) => {
  root.getBoundingClientRect = () => rect(0, 0, 800, posts.length * 48 + 8);
  posts.forEach((p, i) => {
    const el = root.querySelector<HTMLElement>(`[data-id="${p.id}"]`);
    if (el) el.getBoundingClientRect = () => rect(i === 0 ? 100 : 125, i * 48);
  });
};

const card = (p: P) =>
  createElement("div", { key: p.id, "data-id": p.id, className: "sakh-comment" }, `#${p.num}`);

const mount = (posts: P[]) =>
  render(
    createElement(ForumThread, {
      posts,
      renderPost: (p: P) => card(p),
    }),
  );

/** Дать хуку досчитать (rAF-заглушка = setTimeout 0). */
const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
};

const visPaths = (root: HTMLElement) => root.querySelectorAll("path.rl-vis");

describe("useReplyLines / ForumThread", () => {
  it("1) линии рисуются для постов с parent_id", async () => {
    const posts: P[] = [
      { id: "a", num: 1 },
      { id: "b", num: 2, parentId: "a" },
    ];
    const { container } = mount(posts);
    patchRects(container.firstChild as HTMLElement, posts);
    await flush();
    expect(visPaths(container.firstChild as HTMLElement).length).toBe(1); // a → b
  });

  it("2) линии не рисуются для корневых постов", async () => {
    const posts: P[] = [
      { id: "a", num: 1 },
      { id: "b", num: 2 },
      { id: "c", num: 3 },
    ];
    const { container } = mount(posts);
    patchRects(container.firstChild as HTMLElement, posts);
    await flush();
    expect(visPaths(container.firstChild as HTMLElement).length).toBe(0);
  });

  it("3) при смене страницы линии пересчитываются (родитель на другой странице — линии нет)", async () => {
    const page1: P[] = [
      { id: "a", num: 1 },
      { id: "b", num: 2, parentId: "a" },
    ];
    const page2: P[] = [{ id: "c", num: 3, parentId: "a" }]; // «a» осталась на стр. 1
    const utils = mount(page1);
    const root = () => utils.container.firstChild as HTMLElement;
    patchRects(root(), page1);
    await flush();
    expect(visPaths(root()).length).toBe(1);

    // Страница 2: родитель не виден — линия не рисуется
    utils.rerender(createElement(ForumThread, { posts: page2, renderPost: (p: P) => card(p) }));
    patchRects(root(), page2);
    await flush();
    expect(visPaths(root()).length).toBe(0);

    // Возврат на страницу 1: линия снова появляется
    utils.rerender(createElement(ForumThread, { posts: page1, renderPost: (p: P) => card(p) }));
    patchRects(root(), page1);
    await flush();
    expect(visPaths(root()).length).toBe(1);
    utils.unmount();
  });

  it("4) при добавлении нового поста линии обновляются", async () => {
    const before: P[] = [
      { id: "a", num: 1 },
      { id: "b", num: 2, parentId: "a" },
    ];
    const after: P[] = [
      { id: "a", num: 1 },
      { id: "b", num: 2, parentId: "a" },
      { id: "c", num: 3, parentId: "a" }, // новый ответ — шина удлиняется до него
    ];
    const utils = mount(before);
    const root = () => utils.container.firstChild as HTMLElement;
    patchRects(root(), before);
    await flush();
    const d1 = visPaths(root())[0].getAttribute("d") || "";
    expect(d1.length).toBeGreaterThan(0);

    utils.rerender(createElement(ForumThread, { posts: after, renderPost: (p: P) => card(p) }));
    patchRects(root(), after);
    await flush();
    const paths = visPaths(root());
    expect(paths.length).toBe(1); // всё так же ОДНА шина на родителя
    const d2 = paths[0].getAttribute("d") || "";
    expect(d2).not.toBe(d1); // …но её путь пересчитан (стала длиннее)
    utils.unmount();
  });
});

describe("buildReplyLines (чистая геометрия)", () => {
  it("несколько ответов одному родителю сливаются в ОДНУ шину", () => {
    const win = (globalThis as unknown as { document: Document }).document;
    const cont = win.createElement("div");
    const mk = (id: string, left: number, top: number) => {
      const el = win.createElement("div");
      el.dataset.id = id;
      el.getBoundingClientRect = () => rect(left, top);
      cont.appendChild(el);
      return el;
    };
    mk("p", 100, 0);
    mk("c1", 125, 48);
    mk("c2", 125, 96);
    cont.getBoundingClientRect = () => rect(0, 0, 800, 200);
    const res = buildReplyLines(
      cont,
      [
        { id: "p", num: 1 },
        { id: "c1", num: 2, parentId: "p" },
        { id: "c2", num: 3, parentId: "p" },
      ],
      {},
    );
    expect(res.lines.length).toBe(1); // одна шина
    expect(res.lines[0].parentNum).toBe(1);
    // основной путь + один промежуточный отвод = 2 подконтура
    expect(res.lines[0].d.split(" M ").length - 1).toBe(1);
    // шина приходит к левому краю родителя (100 + заводка 2)
    expect(res.lines[0].d.startsWith("M 102 ")).toBe(true);
  });

  it("родитель не найден среди видимых постов — линия не рисуется", () => {
    const win = (globalThis as unknown as { document: Document }).document;
    const cont = win.createElement("div");
    const el = win.createElement("div");
    el.dataset.id = "c";
    el.getBoundingClientRect = () => rect(125, 0);
    cont.appendChild(el);
    cont.getBoundingClientRect = () => rect(0, 0, 800, 100);
    const res = buildReplyLines(cont, [{ id: "c", num: 5, parentId: "gone" }], {});
    expect(res.lines.length).toBe(0);
  });
});
