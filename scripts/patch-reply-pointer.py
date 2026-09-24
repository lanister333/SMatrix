# -*- coding: utf-8 -*-
# Патч «указатель ответа как на Сахкоме»: parentNum в типе/API + синяя ссылка-метка └ ответ
import io, sys

def patch(path, pairs):
    src = io.open(path, encoding="utf-8").read()
    for i, (old, new) in enumerate(pairs):
        n = src.count(old)
        if n != 1:
            print(f"[FAIL] {path.split('/')[-1]} пара#{i}: найдено {n} вхождений (нужно 1): {old[:70]!r}")
            sys.exit(1)
        src = src.replace(old, new)
        print(f"[OK]   {path.split('/')[-1]} пара#{i}")
    io.open(path, "w", encoding="utf-8").write(src)

# 1) Тип Msg: поле parentNum (номер сообщения-родителя для перемотки)
patch("/home/z/my-project/src/lib/ui.tsx", [
    ("  parentId: string | null;\n  parentAuthor: string | null;\n  parentAuthorGender: string | null;",
     "  parentId: string | null;\n  parentAuthor: string | null;\n  parentAuthorGender: string | null;\n  parentNum: number | null;"),
])

# 2) API темы: отдавать parentNum (номер родителя; Prisma include parent уже есть)
patch("/home/z/my-project/src/app/api/topics/[id]/route.ts", [
    ("        parentAuthor: m.parent?.authorName ?? null,\n        parentAuthorGender: m.parent?.author?.gender ?? null,",
     "        parentAuthor: m.parent?.authorName ?? null,\n        parentAuthorGender: m.parent?.author?.gender ?? null,\n        parentNum: m.parent?.num ?? null,"),
])

# 3) CSS: метка «└ ответ …» — кликабельная синяя ссылка + правка комментариев (стрелка)
patch("/home/z/my-project/src/app/globals.css", [
    # базовый стиль метки: цвет ссылки форума, курсор-рука, без подчёркивания (hover — с ним)
    (".sk-msg-parent{color:#33669b;background:#edf4fb;border:1px solid #c9daec;border-radius:2px;padding:0 6px;font-size:12px;font-weight:600;line-height:1.7}",
     ".sk-msg-parent{color:#0a5caa;cursor:pointer;background:#edf4fb;border:1px solid #c9daec;border-radius:2px;padding:0 6px;font-size:12px;font-weight:600;line-height:1.7;text-decoration:none;white-space:nowrap}\n"
     ".sk-msg-parent:hover{color:#084c8b;text-decoration:underline}"),
    # комментарии: стрелка теперь └
    ("показывает «↳ ответ Автор» в шапке. */", "показывает «└ ответ Автор» в шапке. */"),
    ("   текстовое @имя и метку «↳ ответ» */", "   текстовое @имя и метку «└ ответ» */"),
    ("     @упоминания автора (@имя) и метку «↳ ответ». */", "     @упоминания автора (@имя) и метку «└ ответ». */"),
    ("   своих сообщений) плюс метка «↳ ответ …». Внешний отступ между", "   своих сообщений) плюс метка «└ ответ …». Внешний отступ между"),
])
print("\nВсе замены применены.")
