/**
 * Preload для bun test: поднимает happy-dom как глобальное окружение —
 * React + @testing-library/react рендерят компоненты в этот DOM.
 * ResizeObserver/IntersectionObserver отсутствуют в happy-dom — хук
 * useReplyLines умеет работать без них (typeof-guard), но добавляем
 * пустые заглушки, чтобы любой код мог их использовать.
 */
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/" });
const g = globalThis as unknown as Record<string, unknown>;

g.window = win;
g.document = win.document;
g.navigator = win.navigator;
g.HTMLElement = win.HTMLElement;
g.HTMLDivElement = win.HTMLDivElement;
g.HTMLInputElement = win.HTMLInputElement;
g.HTMLTextAreaElement = win.HTMLTextAreaElement;
g.Element = win.Element;
g.Node = win.Node;
g.NodeList = win.NodeList;
g.SVGElement = win.SVGElement;
g.CustomEvent = win.CustomEvent;
g.Event = win.Event;
g.MouseEvent = win.MouseEvent;
g.getComputedStyle = win.getComputedStyle.bind(win);
// rAF через таймер: детерминированно срабатывает в await-очереди теста
g.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0) as unknown as number;
g.cancelAnimationFrame = (id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
// React act(): среда тестирования
g.IS_REACT_ACT_ENVIRONMENT = true;

class StubObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): unknown[] {
    return [];
  }
}
g.ResizeObserver = StubObserver;
g.IntersectionObserver = class extends StubObserver {
  root = null;
  rootMargin = "";
  thresholds = [];
};
