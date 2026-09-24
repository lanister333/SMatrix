#!/usr/bin/env python3
# Шаг «Единый футер как на Главной»: замена тонкого .sk-footer на общий
# SiteFooter (chrome.tsx) во всех 14 самостоятельных экранах + импорт.
import glob
import sys

OLD_FOOTER = '''        <footer className="sk-footer">
          <div className="inner">
            <span>© 2026 SakhMatrix — Сахалинская матрица взаимопомощи · ИИ-модерация · вход по email</span>
            <span>{settings?.footerNote || "Спроси у города — город ответит."}</span>
          </div>
        </footer>'''

NEW_FOOTER = '''        {/* Шаг «Единый футер как на Главной»: общий SiteFooter — тот же футер,
            что на Главной (строка ссылок, сведения, дисклеймер, версия),
            размер/состав 1-в-1; до этого здесь был тонкий .sk-footer */}
        <SiteFooter settings={settings} />'''

OLD_IMPORT = 'import { DEFAULT_SETTINGS, isStaffRole, MainNav, Masthead, useAuth, type SiteSettings } from "@/components/site/chrome";'
NEW_IMPORT = 'import { DEFAULT_SETTINGS, isStaffRole, MainNav, Masthead, SiteFooter, useAuth, type SiteSettings } from "@/components/site/chrome";'

files = sorted(glob.glob("/home/z/my-project/src/components/site/*-screen.tsx"))
changed = 0
for f in files:
    src = open(f, encoding="utf-8").read()
    if OLD_FOOTER not in src:
        print(f"SKIP (нет старого футера): {f}")
        continue
    if OLD_IMPORT not in src:
        print(f"ОШИБКА (нет строки импорта): {f}")
        sys.exit(1)
    src = src.replace(OLD_IMPORT, NEW_IMPORT, 1)
    src = src.replace(OLD_FOOTER, NEW_FOOTER, 1)
    open(f, "w", encoding="utf-8").write(src)
    changed += 1
    print(f"OK: {f}")
print(f"\nЗаменено файлов: {changed}")
