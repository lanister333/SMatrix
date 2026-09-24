# Сэмплирование цветов дневного виджета meteoblue со скриншота
# (небо ячеек, бейдж дневной температуры, бейдж ночной температуры)
from PIL import Image

img = Image.open("/home/z/my-project/scripts/shots/vivid-after-desktop.png").convert("RGB")
W, H = img.size
print("size:", W, H)

# Виджет «Прогноз по дням»: колонки Пн..Вс центры ~ x=375,510,645,780,915,1050 (шаг ~135)
# иконки ~y=770, дневной бейдж ~y=825, ночной бейдж ~y=850, ветер ~y=872
def hexat(x, y):
    r, g, b = img.getpixel((x, y))
    return f"#{r:02x}{g:02x}{b:02x}"

for label, y in [("sky(icon-zone)", 765), ("sky(below-icon)", 800), ("day-badge", 826), ("night-badge", 851), ("wind-row", 872)]:
    samples = [hexat(x, y) for x in (340, 375, 410, 475, 510, 545, 610, 645, 680, 745, 780, 815)]
    print(f"{label:>18} y={y}: {samples}")
