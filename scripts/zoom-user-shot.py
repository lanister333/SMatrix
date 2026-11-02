#!/usr/bin/env python3
from PIL import Image

src = "/home/z/my-project/upload/Скриншот-20260919-121252.jpg"
img = Image.open(src).convert("RGB")

# (a) зона детекта x~84 y[119..155]: стык #2 -> #3
img.crop((30, 100, 250, 200)).resize((660, 300), Image.LANCZOS).save(
    "/home/z/my-project/download/user-shot-zoom-2-3.png")
# (b) стык #6 -> #7 и левый край #7
img.crop((30, 395, 250, 528)).resize((660, 399), Image.LANCZOS).save(
    "/home/z/my-project/download/user-shot-zoom-6-7.png")
print("saved")
