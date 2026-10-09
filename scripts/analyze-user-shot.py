#!/usr/bin/env python3
# Попиксельный анализ скриншота пользователя: найти ВСЕ бирюзовые вертикальные
# сегменты и проверить, касаются ли их концы горизонтальных рамок карточек.
# Сегмент "висит", если его верхний или нижний конец не примыкает ни к одной
# серой рамке (#CED4DA) в пределах допуска.
from PIL import Image
import sys

src = "/home/z/my-project/upload/Скриншот-20260919-121252.jpg"
img = Image.open(src).convert("RGB")
W, H = img.size
print(f"image: {W}x{H}")
px = img.load()

def is_teal(r, g, b):
    # эталон #249790 = (36,151,144); JPEG размывает, берём допуск
    return abs(r - 36) < 60 and abs(g - 151) < 60 and abs(b - 144) < 60 and g > r + 30 and g > b + 10

def is_border_gray(r, g, b):
    # #CED4DA = (206,212,218)
    return abs(r - 206) < 25 and abs(g - 212) < 25 and abs(b - 218) < 25

# 1) Горизонтальные линии рамок: строки, где много серых пикселей подряд
border_rows = []
for y in range(H):
    run = best = 0
    for x in range(W):
        if is_border_gray(*px[x, y]):
            run += 1
            best = max(best, run)
        else:
            run = 0
    if best > W * 0.35:
        border_rows.append(y)
# Схлопываем соседние строки в полосы
bands = []
for y in border_rows:
    if bands and y - bands[-1][1] <= 2:
        bands[-1][1] = y
    else:
        bands.append([y, y])
print("горизонтальных рамок-полос:", len(bands), bands[:24])

# 2) Вертикальные бирюзовые сегменты по колонкам
cols = {}
for x in range(W):
    ys = [y for y in range(H) if is_teal(*px[x, y])]
    if len(ys) < 6:
        continue
    # схлопываем в сегменты (разрыв > 3px = новый сегмент)
    segs = []
    for y in ys:
        if segs and y - segs[-1][1] <= 3:
            segs[-1][1] = y
        else:
            segs.append([y, y])
    segs = [s for s in segs if s[1] - s[0] >= 6]
    if segs:
        cols[x] = segs

# Группируем соседние колонки (линия ~2-3px шириной) в линии
xs = sorted(cols.keys())
lines = []
for x in xs:
    if lines and x - lines[-1]["x2"] <= 2:
        lines[-1]["x2"] = x
        for s in cols[x]:
            lines[-1]["segs"].append(s)
    else:
        lines.append({"x1": x, "x2": x, "segs": list(cols[x])})

def near_band(y):
    return any(b0 - 4 <= y <= b1 + 4 for b0, b1 in bands)

print("\n=== ВЕРТИКАЛЬНЫЕ ЛИНИИ ===")
hangs = 0
for ln in lines:
    xc = (ln["x1"] + ln["x2"]) // 2
    # объединяем сегменты линии
    merged = []
    for s in sorted(ln["segs"]):
        if merged and s[0] - merged[-1][1] <= 4:
            merged[-1][1] = max(merged[-1][1], s[1])
        else:
            merged.append(list(s))
    for y0, y1 in merged:
        top_touch = near_band(y0)
        bot_touch = near_band(y1)
        tag = "OK " if (top_touch and bot_touch) else "ВИСИТ"
        if tag == "ВИСИТ":
            hangs += 1
        print(f"x~{xc:4d} y[{y0:4d}..{y1:4d}] h={y1-y0:3d}  верх:{'рамка' if top_touch else 'ВОЗДУХ'} низ:{'рамка' if bot_touch else 'ВОЗДУХ'}  {tag}")
print(f"\nИТОГО висящих концов: {hangs}")
