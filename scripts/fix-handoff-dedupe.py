#!/usr/bin/env python3
"""Чистка HANDOFF.md после неатомарных MultiEdit: дедуп блока «Раунды 18–21.09»."""
import re, sys

p = "/home/z/my-project/HANDOFF.md"
src = open(p, encoding="utf-8").read()

# Удалить ВСЕ варианта блока «Раунды 18–21.09» (от строки "- Раунды 18–21.09" до конца блока)
pat = re.compile(r"- Раунды 18–21\.09 \(детали.*?(?:паттерн «раунд 2»)\)\n(?:  .*\n)*", re.S)
found = pat.findall(src)
src = pat.sub("", src)

canonical = (
    "- Раунды 18–21.09 (детали и приёмки — worklog.md): форум (обсуждение/жалобы/reply-линии),\n"
    "  «Нужна помощь» (/help — модалка, лента, клиентский фильтр банковских карт + серверный\n"
    "  ИИ-модератор реквизитов), «Рекомендую / Не рекомендую» (/rekomenduyu — карточка отзыва\n"
    "  .matrix-review-card: полезность с toggle, выделение человека П.6, официальный ответ П.13),\n"
    "  бизнес-страница «Анива Тимбер», блог; CSS-раунды заказчика 1-в-1 (паттерн «раунд 2»):\n"
    "  блог, лента помощи, карточка отзыва\n"
)
anchor = "- Скриншоты приёмки: download/t3-*.png, t4-*.png\n"
assert anchor in src, "anchor lost"
src = src.replace(anchor, anchor + canonical, 1)

open(p, "w", encoding="utf-8").write(src)
print(f"removed {len(found)} stale block(s); inserted 1 canonical")
print("upload-full-project mentions left:", len(re.findall(r"upload-full-project", src)))
