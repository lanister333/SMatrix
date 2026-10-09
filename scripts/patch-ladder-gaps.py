# -*- coding: utf-8 -*-
# Патч лесенки, часть 2: остаток после частично применившегося MultiEdit
import io, sys

CSS = "/home/z/my-project/src/app/globals.css"
TSX = "/home/z/my-project/src/components/forum/topic-view.tsx"

def patch(path, pairs):
    src = io.open(path, encoding="utf-8").read()
    for i, (old, new) in enumerate(pairs):
        n = src.count(old)
        if n != 1:
            print(f"[FAIL] {path} пара#{i}: найдено {n} вхождений (нужно 1): {old[:70]!r}")
            sys.exit(1)
        src = src.replace(old, new)
        print(f"[OK]   {path.split('/')[-1]} пара#{i}")
    io.open(path, "w", encoding="utf-8").write(src)

patch(CSS, [
    ("calc(100%+8px) — карточка + 6px зазора до верхнего края следующей",
     "calc(100%+10px) — карточка + 8px зазора до верхнего края следующей"),
])
patch(TSX, [
    ('height: tail ? "calc(100% + 8px)" : "calc(100% + 2px)"',
     'height: tail ? "calc(100% + 10px)" : "calc(100% + 2px)"'),
    ("#CED4DA со всех четырёх сторон, белый фон, зазор 6px снизу (CSS).",
     "#CED4DA со всех четырёх сторон, белый фон, зазор 8px снизу (CSS)."),
    ("лента продолжается карточкой уровня ≥ K+1 — плюс 6px зазора до её",
     "лента продолжается карточкой уровня ≥ K+1 — плюс 8px зазора до её"),
    ("calc(100%+8px) сшивает её с нитью следующей карточки сквозь 6px",
     "calc(100%+10px) сшивает её с нитью следующей карточки сквозь 8px"),
])
print("\nВсе замены применены.")
