#!/usr/bin/env python3
"""
SakhMatrix — «Театр ботов»: конвертер новостей в диалог жителей.

Берёт новость Сахалина из test-news.json, отправляет в DeepSeek API
с системным промптом «Театр ботов», получает JSON-массив реплик
2-3 ботов, валидирует, выводит в консоль и сохраняет в test-output.json.

Запуск:
  export DEEPSEEK_API_KEY="sk-..."
  python rewriter.py
"""

import json
import os
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("Ошибка: библиотека requests не установлена.")
    print("Установите: pip install requests")
    sys.exit(1)

# ─── Константы ────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent.resolve()
INPUT_FILE = SCRIPT_DIR / "test-news.json"
OUTPUT_FILE = SCRIPT_DIR / "test-output.json"

DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"
MAX_RETRIES = 3
RETRY_DELAY = 2  # секунд между попытками

SYSTEM_PROMPT = """Ты — интеллектуальный конвейер генерации контента "Театр ботов"
для сахалинского портала взаимопомощи SAKHMATRIX.RU.

Твоя задача: взять сухую новость острова Сахалин и превратить её
в реалистичный мини-диалог местных жителей из 2-3 реплик строго
по ролям.

ЛОГИКА ДИАЛОГА:
Реплики строятся по цепочке: Реакция → Возражение/Уточнение →
Бытовая деталь со стороны разных персонажей.

ЖЕСТКОЕ ПРАВИЛО «ГЕОГРАФИЧЕСКИЙ КАПКАН»:
1. Запрещено выдумывать новые улицы, маршруты объезда, навигацию.
2. Автозамены: "Южно-Сахалинск" → "Южный", "Сахалинская область" →
   "остров", "аэропорт Хомутово" → "аэропорт".
3. Если нет чётких геопривязок — размытые фразы: "там", "на перевале",
   "в нашем районе".

ЖЁСТКИЕ ТАБУ (МГНОВЕННЫЙ БАН):
Полный запрет на политику, СВО, чиновников, криминал, ДТП, трагедии.

ПРАВИЛО РЕГИСТРА И ОПЕЧАТОК:
Если ник бота записан ПОЛНОСТЬЮ СТРОЧНЫМИ буквами (например: driver,
vovan, мамочка), текст генерируется СТРОГО В НИЖНЕМ РЕГИСТРЕ —
без единой заглавной буквы и с минимальной пунктуацией.
Допускай случайные опечатки с вероятностью 30%.

СПИСОК ПЕРСОНАЖЕЙ (выбирай 2-3 под тему новости):

Кириллица (стандартный регистр): Дизелист, Штурман, Егерь, Турист,
Ворчун, Серёга, Михалыч, Толян, Хозяйка, Дачница.
Кириллица (нижний регистр): пассажир, свояк, попутчица, мамочка,
кошатница.
Латиница (стандарт): Boss, Caesar, Churchill, Plato.
Латиница (нижний): driver, hunter, biker, newton, lincoln, napoleon,
Lady, cleopatra, eva, Fox, sandra.
Транслит (все нижний регистр): vovan, svoyak, vsedorozhnik, garazh,
sanek, tolyan, mikhalych, ribak, kabanchik, putnik, khozyayka,
blondinka, mamochka, poputchica, lenka.

ФОРМАТ ВЫХОДНЫХ ДАННЫХ:
Возвращай СТРОГО чистый JSON-массив из 2-3 объектов, без markdown,
без лишнего текста.
Шаблон:
[{"username": "ИмяБота", "text": "текст реплики"}, {"username": "ИмяБота2", "text": "Текст реплики"}]
"""

USER_PROMPT_TEMPLATE = """Новости с Сахалина:

Источник: {source}
Дата: {date}
Ссылка: {link}

Текст новости:
{text}

Преврати эту новость в мини-диалог 2-3 жителей Сахалина.
Верни СТРОГО JSON-массив, без markdown-обёртки."""


# ─── Функции ─────────────────────────────────────────────────────────

def load_news(filepath: Path) -> dict:
    """Читает новость из JSON-файла."""
    if not filepath.exists():
        print(f"❌ Файл не найден: {filepath}")
        sys.exit(1)
    with open(filepath, "r", encoding="utf-8") as f:
        news = json.load(f)
    required = ["text"]
    for key in required:
        if key not in news:
            print(f"❌ В файле отсутствует обязательное поле '{key}'")
            sys.exit(1)
    return news


def call_deepseek(api_key: str, system_prompt: str, user_prompt: str) -> str:
    """Отправляет запрос в DeepSeek API, возвращает сырой текст ответа."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.8,
        "max_tokens": 800,
        "response_format": {"type": "json_object"},
    }
    response = requests.post(
        DEEPSEEK_API_URL,
        headers=headers,
        json=payload,
        timeout=30,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"DeepSeek API error {response.status_code}: {response.text[:300]}"
        )
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return content


def parse_dialog(raw: str) -> list:
    """Парсит ответ DeepSeek в список реплик. Поддерживает:
    - Чистый JSON-массив: [{...}, {...}]
    - JSON-объект с полем dialog/replies/messages: {"dialog": [...]}
    - Markdown-обёртку: ```json [...] ```
    """
    text = raw.strip()

    # Убираем markdown-обёртку если есть
    if text.startswith("```"):
        lines = text.split("\n")
        # Убираем первую и последнюю строку (```json и ```)
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()

    # Пытаемся распарсить как JSON
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        # Если не получилось — ищем JSON-массив внутри текста
        import re
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group())
            except json.JSONDecodeError:
                return None
        else:
            return None

    # Если вернулся объект с полем-обёрткой — достаём массив
    if isinstance(parsed, dict):
        for key in ("dialog", "replies", "messages", "data", "result"):
            if key in parsed and isinstance(parsed[key], list):
                return parsed[key]
        # Если объект — один диалог, оборачиваем в массив
        if "username" in parsed and "text" in parsed:
            return [parsed]
        return None

    if isinstance(parsed, list):
        return parsed

    return None


def validate_dialog(dialog: list) -> bool:
    """Валидирует: 2-3 объекта, у каждого есть username и text."""
    if not isinstance(dialog, list):
        return False
    if len(dialog) < 2 or len(dialog) > 3:
        return False
    for entry in dialog:
        if not isinstance(entry, dict):
            return False
        if "username" not in entry or "text" not in entry:
            return False
        if not entry["username"] or not entry["text"]:
            return False
    return True


def print_dialog(dialog: list, news: dict) -> None:
    """Выводит результат в консоль — красиво, с отступами."""
    print("\n" + "=" * 60)
    print("🎭 ТЕАТР БОТОВ — РЕЗУЛЬТАТ")
    print("=" * 60)
    print(f"\n📰 Новость: {news.get('text', '')[:80]}...")
    print(f"📅 Дата:    {news.get('date', '?')}")
    print(f"🔗 Ссылка: {news.get('link', '?')}")
    print(f"📣 Источник: {news.get('source', '?')}")
    print("\n" + "-" * 60)
    for i, entry in enumerate(dialog, 1):
        username = entry["username"]
        text = entry["text"]
        print(f"\n  [{i}] {username}:")
        print(f"      {text}")
    print("\n" + "-" * 60)
    print(f"Всего реплик: {len(dialog)}")
    print("=" * 60 + "\n")


# ─── Точка входа ─────────────────────────────────────────────────────

def main():
    # 1. Проверяем API-ключ
    api_key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        print("❌ ОШИБКА: Не задана переменная окружения DEEPSEEK_API_KEY.")
        print("   Установите её перед запуском:")
        print("   export DEEPSEEK_API_KEY=\"sk-ваш-ключ-здесь\"")
        sys.exit(1)

    # 2. Читаем новость
    news = load_news(INPUT_FILE)
    print(f"✓ Новость загружена: {news.get('text', '')[:60]}...")

    # 3. Формируем промпт
    user_prompt = USER_PROMPT_TEMPLATE.format(
        source=news.get("source", ""),
        date=news.get("date", ""),
        link=news.get("link", ""),
        text=news.get("text", ""),
    )

    # 4. Отправляем в DeepSeek (с ретраями)
    dialog = None
    for attempt in range(1, MAX_RETRIES + 1):
        print(f"\n🔄 Попытка {attempt}/{MAX_RETRIES} — запрос к DeepSeek API...")
        try:
            raw_response = call_deepseek(api_key, SYSTEM_PROMPT, user_prompt)
            print(f"  ✓ Получен ответ ({len(raw_response)} символов)")

            # Парсим
            dialog = parse_dialog(raw_response)
            if dialog is None:
                print(f"  ⚠ Не удалось распарсить JSON. Сырой ответ:")
                print(f"  {raw_response[:200]}")
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY)
                continue

            # Валидируем
            if not validate_dialog(dialog):
                print(f"  ⚠ Валидация не пройдена (нужно 2-3 объекта с username и text)")
                print(f"  Получено: {len(dialog) if dialog else 0} объектов")
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY)
                dialog = None
                continue

            # Успех!
            print(f"  ✓ Валидация пройдена: {len(dialog)} реплик")
            break

        except RuntimeError as e:
            print(f"  ❌ Ошибка API: {e}")
            if attempt < MAX_RETRIES:
                print(f"  Ждём {RETRY_DELAY} сек и пробуем снова...")
                time.sleep(RETRY_DELAY)
        except Exception as e:
            print(f"  ❌ Непредвиденная ошибка: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)

    # 5. Результат
    if dialog is None or not validate_dialog(dialog):
        print("\n❌ Все попытки исчерпаны. Не удалось получить валидный диалог.")
        print("   Проверьте: API-ключ, модель, промпт, подключение к сети.")
        sys.exit(1)

    # 6. Вывод в консоль
    print_dialog(dialog, news)

    # 7. Сохранение в файл
    output = {
        "news": news,
        "dialog": dialog,
    }
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"✓ Результат сохранён в: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
