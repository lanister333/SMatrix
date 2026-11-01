#!/usr/bin/env python3
"""Скан вертикали по центральной колонке скриншота пользователя:
ищем зазоры между карточками и классифицируем их цвет (серый фон vs белый)."""
from PIL import Image

img = Image.open("/home/z/my-project/upload/Скриншот-20260917-154009.jpg").convert("RGB")
W, H = img.size

def avg(x, y, r=2):
    px = []
    for dx in range(-r, r + 1):
        for dy in range(-r, r + 1):
            xx, yy = min(max(x + dx, 0), W - 1), min(max(y + dy, 0), H - 1)
            px.append(img.getpixel((xx, yy)))
    n = len(px)
    return tuple(round(sum(c[i] for c in px) / n) for i in range(3))

def classify(c):
    r, g, b = c
    if abs(r - 30) < 25 and abs(g - 58) < 25 and abs(b - 95) < 25:
        return "NAVY(плашка)"
    if r >= 251 and g >= 251 and b >= 251:
        return "WHITE(карточка)"
    if 238 <= r <= 250 and 240 <= g <= 251 and 241 <= b <= 252 and b >= r:
        return "GRAY-F4F6F7?(фон)"
    if r < 40 and g < 40 and b < 40:
        return "DARK(чат-сайдбар)"
    return f"прочее{c}"

X = 1115  # центр центральной колонки сайта в превью
print(f"Скан вертикали x={X}, y=350..640, шаг 2:")
prev = None
for y in range(350, 640, 2):
    c = avg(X, y)
    cl = classify(c)
    if cl != prev:
        print(f"  y={y:4}: {cl:22} {c}")
        prev = cl

# Итоговая статистика по зоне зазора между «Подслушано» и «Последние темы»
print("\nТочки для ручной сверки (реальные координаты):")
for name, (x, y) in {
    "зазор под «Подслушано» (центр)": (X, 425),
    "зазор под «Последние темы» (центр)": (X, 655),
    "белая карточка «Последние темы» (тело)": (X, 500),
    "внешнее поле фона над карточками (между шапкой и колонками)": (X, 300),
}.items():
    c = avg(x, y)
    print(f"  {name:50} {c}  -> {classify(c)}")
