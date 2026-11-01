# -*- coding: utf-8 -*-
"""Проба источников реальных кассовых JPY/KRW по Южно-Сахалинску.
1) kovalut.ru — страницы всех 7 банков города: у каких валют есть живые пары (не «—»).
2) primbank.ru / solidbank.ru — сайты островных банков: есть ли JPY/KRW.
"""
import re
import subprocess

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

BANKS = ["ekspobank", "solid-bank", "bank-dolinsk", "rosselhozbank",
         "bank-vtb", "sovkombank", "gazprombank"]

# блок валюты на странице банка kovalut:
# <div class="text-sm">JPY</div><div class="-mt-1 font-sans text-lg font-bold">—<!-- --> / <!-- -->—</div>
CUR_RE = re.compile(
    r'class="text-sm">([A-Z]{3})</div>'
    r'<div class="-mt-1 font-sans text-lg font-bold">([^<]*(?:<!-- -->)?[^<]*?)'
    r'(?:<!-- -->)? / (?:<!-- -->)?([^<]*)</div>'
)


def fetch(url, out):
    r = subprocess.run(
        ["curl", "-sL", "-m", "40", "-A", UA, "-H", "Accept-Language: ru-RU,ru;q=0.9",
         "-o", out, "-w", "%{http_code} %{size_download}", url],
        capture_output=True, text=True)
    return r.stdout.strip()


def clean(s):
    return s.replace("<!-- -->", "").replace("&nbsp;", " ").strip()


print("=== KOVALUT: страницы банков ===")
for b in BANKS:
    url = f"https://kovalut.ru/{b}/juzhno-sahalinsk"
    info = fetch(url, "/tmp/probe-bank.html")
    try:
        html = open("/tmp/probe-bank.html", encoding="utf-8").read()
    except Exception as e:
        print(f"{b}: READ FAIL {e}")
        continue
    found = {}
    for m in CUR_RE.finditer(html):
        cur, buy, sell = m.group(1), clean(m.group(2)), clean(m.group(3))
        if cur not in found:  # первый блок валюты — таблица города
            found[cur] = (buy, sell)
    live = {c: v for c, v in found.items() if v[0] != "—" and v[1] != "—"}
    dash = [c for c, v in found.items() if c not in live]
    print(f"{b}: {info} | коды: {sorted(found)} | ЖИВЫЕ: {live} | прочерки: {sorted(dash)}")

print("\n=== ПРИМОРЬЕ / СОЛИД ===")
for url in ["https://primbank.ru/private-persons/services/currency/",
            "https://www.solidbank.ru/"]:
    info = fetch(url, "/tmp/probe-site.html")
    try:
        html = open("/tmp/probe-site.html", encoding="utf-8").read()
        marks = {p: html.count(p) for p in ["JPY", "KRW", "йен", "Иен", "вон", "Вон"]
                 if html.count(p)}
        print(f"{url}: {info} | маркеры: {marks}")
    except Exception as e:
        print(f"{url}: {info} | READ FAIL {e}")
