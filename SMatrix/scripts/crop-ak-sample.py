from PIL import Image

src = "/home/z/my-project/upload/Скриншот-20260919-105250.jpg"
img = Image.open(src)
print("size:", img.size)

# Зона глубокой вложенности: "Не рискнула покупать)" -> "Пожалуйста"
crop1 = img.crop((280, 330, 780, 670)).resize((1000, 680), Image.LANCZOS)
crop1.save("/home/z/my-project/download/ak-crop-deep-nesting.png")

# Зона окончания веток: gatta / Step@n_2nd / Vkontakteid
crop2 = img.crop((280, 650, 780, 880)).resize((1000, 460), Image.LANCZOS)
crop2.save("/home/z/my-project/download/ak-crop-branch-ends.png")
print("saved crops")
