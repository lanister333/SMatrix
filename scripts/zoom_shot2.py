"""Full vertical scan through the Форум button in the user's screenshot."""
from PIL import Image
import os

UP = "/home/z/my-project/upload"
im = Image.open(os.path.join(UP, "Скриншот-20260921-134105.jpg")).convert("RGB")
w, h = im.size
print("size:", w, h)

def classify(c):
    r, g, b = c
    if g > 150 and b > 140 and r < 90:
        return "TURQ"       # turquoise
    if r < 60 and g < 100 and b > 60 and b < 140:
        return "NAVY"       # dark navy
    if r > 200 and g > 200 and b > 200:
        return "WHITE"
    return f"other{c}"

for x in [58, 68, 78, 100, 30]:
    rows = []
    for y in range(h):
        rows.append(classify(im.getpixel((x, y))))
    # compress runs
    runs = []
    cur = rows[0]; start = 0
    for y in range(1, h):
        if rows[y] != cur and not (rows[y].startswith("other") and cur.startswith("other")):
            runs.append((start, y - 1, cur))
            cur = rows[y]; start = y
    runs.append((start, h - 1, cur))
    print(f"\nx={x}:")
    for s, e, c in runs:
        print(f"  y {s:2d}-{e:2d} ({e-s+1:2d}px) {c}")
