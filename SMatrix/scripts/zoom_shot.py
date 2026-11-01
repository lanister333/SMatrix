"""Zoom into the user's screenshots to see nav button edges and msg-head colors."""
from PIL import Image
import os

UP = "/home/z/my-project/upload"
OUT = "/home/z/my-project/scripts/shots"
os.makedirs(OUT, exist_ok=True)

for name, crop, scale in [
    ("Скриншот-20260921-134105.jpg", None, 6),   # nav button zoom
    ("Скриншот-20260921-134123.jpg", (0, 0, 900, 80), 2),  # msg head
]:
    p = os.path.join(UP, name)
    im = Image.open(p).convert("RGB")
    print(name, "size:", im.size)
    if crop:
        im = im.crop(crop)
    im2 = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    out = os.path.join(OUT, "zoom-" + name.replace(".jpg", ".png"))
    im2.save(out)
    print("saved:", out)

# Sample pixel colors from the nav screenshot: scan a vertical column through "Форум"
im = Image.open(os.path.join(UP, "Скриншот-20260921-134105.jpg")).convert("RGB")
w, h = im.size
print("\nnav shot size:", w, h)
# scan several columns in the middle of the Форум button area
for x in [w // 2 - 10, w // 2, w // 2 + 10]:
    col = []
    prev = None
    for y in range(h):
        c = im.getpixel((x, y))
        # quantize to detect bands
        key = (c[0] // 24, c[1] // 24, c[2] // 24)
        if key != prev:
            col.append((y, c))
            prev = key
    print(f"x={x}: bands:", col[:14])
