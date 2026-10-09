#!/usr/bin/env python3
"""
SakhMatrix — «Театр ботов» v2: biz65.ru → Z.ai → sakhmatrix.ru
Полностью автономный. Без Telegram. Прямая публикация на сайт.
Запуск на VPS (tmux): python3 app.py
"""

import os
import time
import json
import re
import requests
from curl_cffi import requests as cf_requests
from bs4 import BeautifulSoup
from datetime import datetime

# ─── Конфиг ────────────────────────────────────────────────────────────

ZAI_API_KEY = os.environ.get("ZAI_API_KEY", "")
# Эндпоинт публикации на sakhmatrix.ru
SAKHMATRIX_API_URL = os.environ.get("SAKHMATRIX_API_URL", "http://127.0.0.1:3000/api/theatre-bots/publish")
# Токен для авторизации (простой shared secret)
SAKHMATRIX_API_TOKEN = os.environ.get("SAKHMATRIX_API_TOKEN", "")

FORUM_URL = "https://biz65.ru/forum"
PROCESSED_FILE = "processed.txt"
PARSE_INTERVAL = 600  # 10 минут

# Z.ai API
ZAI_API_URL = "https://api.z.ai/api/paas/v4/chat/completions"
ZAI_MODEL = "glm-5.3-flash"

# ─── Супер-промпт ──────────────────────────────────────────────────────

SYSTEM_PROMPT = """Ты — интеллектуальный конвейер "Театр ботов" для SakhMatrix.

ВАЖНО: SakhMatrix — НЕ официальное медиа. Мы — сарафанное радио.
Не цитируй новости дословно. Пересказывай простым языком.

Твоя задача: оценить текст темы форума и принять решение.

АЛГОРИТМ:
1. Если текст — чернуха (криминал, политика, СВО, ДТП, трагедии, оскорбления,
   спам, реклама, мошенничество) — верни SKIP.
2. Если текст полезный (быт, город, жизнь, советы, опыт) — перепиши его
   от лица ОДНОГО персонажа (выбери подходящего под тему).

ПЕРСОНАЖИ:

Димон — пацанский авто-стиль, нижний регистр, сленг, темы про Авто/Рыбалку.
Пример: "да я сам вчера на трассе был, резину менять надо, смотри не попади там в яму"

Мариша — городская девчонка с эмодзи, темы про Кафе/Покупки/Красоту.
Пример: "Девчонки, была вчера в новом кафе на Ленина ☕️ Круассаны — огонь! 🥐✨"

Архитектор — эксперт, грамотный, темы про ЖКХ/Ремонт/Строительство.
Пример: "Если трубы шумят — скорее всего, нужен компенсатор. Проверьте давление в системе."

ПРАВИЛА:
- Текст от первого лица персонажа
- 2-4 предложения
- Простым разговорным языком
- Без официалки, канцеляризмов
- Без выдуманных адресов и маршрутов

ФОРМАТ ОТВЕТА — строго JSON:
{"action": "skip", "reason": "криминал"}
или
{"action": "publish", "character": "Димон", "text": "...рерайт..."}

Только JSON, без markdown, без лишнего текста."""

# ─── Функции ───────────────────────────────────────────────────────────

def load_processed():
    if not os.path.exists(PROCESSED_FILE):
        return set()
    with open(PROCESSED_FILE, "r", encoding="utf-8") as f:
        return set(line.strip() for line in f if line.strip())


def save_processed(processed):
    with open(PROCESSED_FILE, "w", encoding="utf-8") as f:
        for topic_id in processed:
            f.write(topic_id + "\n")


def fetch_forum():
    """Загружает страницу форума через curl_cffi (обход Cloudflare)."""
    try:
        resp = cf_requests.get(FORUM_URL, impersonate="chrome120", timeout=20)
        if resp.status_code != 200:
            print(f"[!] HTTP {resp.status_code}")
            return None
        return resp.text
    except Exception as e:
        print(f"[!] Ошибка загрузки форума: {e}")
        return None


def parse_topics(html):
    """Извлекает ссылки на темы из HTML форума."""
    soup = BeautifulSoup(html, "html.parser")
    topics = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/forum/topic/" in href or "/forum/thread/" in href or re.match(r"/forum/\d+", href):
            title = a.get_text(strip=True)
            if not title or len(title) < 5:
                continue
            if href.startswith("/"):
                href = "https://biz65.ru" + href
            topic_id = href.rstrip("/").split("/")[-1]
            topics.append({"id": topic_id, "url": href, "title": title})
    return topics


def fetch_topic(url):
    """Загружает страницу темы и извлекает содержимое."""
    try:
        resp = cf_requests.get(url, impersonate="chrome120", timeout=20)
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.text, "html.parser")
        title_tag = soup.find("h1") or soup.find("title")
        title = title_tag.get_text(strip=True) if title_tag else ""
        category = ""
        breadcrumb = soup.find(class_=re.compile("breadcrumb|nav-path|crumb", re.I))
        if breadcrumb:
            category = breadcrumb.get_text(strip=True)
        body = ""
        for sel in [re.compile("post-body|message-body|post-content|entry-content|topic-body", re.I),
                     re.compile("message|post|content", re.I)]:
            msg = soup.find("div", class_=sel)
            if msg:
                body = msg.get_text(strip=True)
                break
        if not body:
            body = soup.get_text(strip=True)[:2000]
        return {"title": title, "body": body[:3000], "category": category, "url": url}
    except Exception as e:
        print(f"  [!] Ошибка: {e}")
        return None


def clean_text(text):
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"@[\w_]+", "", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text


def call_zai(topic_data):
    """Отправляет текст в Z.ai для оценки и рерайта."""
    user_prompt = f"Категория: {topic_data['category']}\nЗаголовок: {topic_data['title']}\n\nТекст:\n{topic_data['body']}\n\nОцени и верни JSON."
    headers = {"Authorization": f"Bearer {ZAI_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": ZAI_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.8,
        "max_tokens": 500,
    }
    try:
        resp = requests.post(ZAI_API_URL, headers=headers, json=payload, timeout=30)
        if resp.status_code != 200:
            print(f"  [!] Z.ai error {resp.status_code}")
            return None
        return resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
    except Exception as e:
        print(f"  [!] Z.ai: {e}")
        return None


def parse_llm_response(raw):
    if not raw:
        return None
    text = raw.strip()
    if text.startswith("```"):
        text = "\n".join(l for l in text.split("\n") if not l.strip().startswith("```")).strip()
    try:
        return json.loads(text)
    except:
        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            try:
                return json.loads(match.group())
            except:
                pass
    return None


def send_to_sakhmatrix(text, character, source_url=""):
    """
    Отправляет готовый пост на сайт sakhmatrix.ru.
    
    POST /api/theatre-bots/publish
    Content-Type: application/json
    
    {
        "token": "shared_secret",
        "character": "Димон",
        "text": "да я сам вчера на трассе был...",
        "source_url": "https://biz65.ru/forum/topic/12345"
    }
    
    Ожидаемый ответ от сервера:
    {
        "ok": true,
        "postId": "cmux...",
        "topicId": 231
    }
    """
    if not SAKHMATRIX_API_URL:
        print("  [!] Не задан SAKHMATRIX_API_URL")
        return False

    payload = {
        "token": SAKHMATRIX_API_TOKEN,
        "character": character,
        "text": text,
        "source_url": source_url,
    }

    try:
        resp = requests.post(
            SAKHMATRIX_API_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            print(f"  [✓] Опубликовано на sakhmatrix.ru: topic={data.get('topicId', '?')}")
            return True
        else:
            print(f"  [!] sakhmatrix.ru error {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"  [!] sakhmatrix.ru: {e}")
        return False


def process_topic(topic, processed):
    """Обрабатывает одну тему."""
    print(f"\n[▶] Тема: {topic['title'][:60]}...")

    topic_data = fetch_topic(topic["url"])
    if not topic_data:
        print("  [!] Не загружено")
        return

    topic_data["body"] = clean_text(topic_data["body"])
    if len(topic_data["body"]) < 30:
        print("  [✗] Короткий текст")
        processed.add(topic["id"]); save_processed(processed)
        return

    print("  [→] Z.ai...")
    llm_raw = call_zai(topic_data)
    result = parse_llm_response(llm_raw)

    if not result:
        print(f"  [!] Не распарсено: {llm_raw[:100] if llm_raw else 'пусто'}")
        processed.add(topic["id"]); save_processed(processed)
        return

    if result.get("action") == "skip":
        print(f"  [✗] SKIP: {result.get('reason', '?')}")
        processed.add(topic["id"]); save_processed(processed)
        return

    if result.get("action") == "publish":
        character = result.get("character", "ТеатрБот")
        text = result.get("text", "")
        if not text or len(text) < 10:
            print("  [!] Пустой рерайт")
            processed.add(topic["id"]); save_processed(processed)
            return

        print(f"  [✓] {character}: {text[:80]}...")

        # Отправляем на sakhmatrix.ru
        send_to_sakhmatrix(text, character, topic["url"])

        processed.add(topic["id"]); save_processed(processed)
        return

    print(f"  [?] Неизвестное действие: {result.get('action')}")
    processed.add(topic["id"]); save_processed(processed)


def main_loop():
    """Основной цикл."""
    print("=" * 60)
    print("  Театр ботов v2 — biz65.ru -> Z.ai -> sakhmatrix.ru")
    print(f"  Интервал: {PARSE_INTERVAL // 60} мин")
    print(f"  Форум: {FORUM_URL}")
    print(f"  Z.ai: {'OK' if ZAI_API_KEY else 'НЕ ЗАДАН'}")
    print(f"  sakhmatrix.ru: {SAKHMATRIX_API_URL}")
    print("=" * 60)

    if not ZAI_API_KEY:
        print("\nОШИБКА: ZAI_API_KEY не задан")
        return

    while True:
        print(f"\n{'─' * 60}")
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Прогон...")

        processed = load_processed()
        print(f"Обработано: {len(processed)}")

        html = fetch_forum()
        if not html:
            print("[!] Форум не загружен")
            time.sleep(PARSE_INTERVAL)
            continue

        topics = parse_topics(html)
        print(f"Тем: {len(topics)}")

        new_topics = [t for t in topics if t["id"] not in processed]
        print(f"Новых: {len(new_topics)}")

        for topic in new_topics:
            process_topic(topic, processed)
            time.sleep(2)

        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Sleep {PARSE_INTERVAL // 60} мин...")
        time.sleep(PARSE_INTERVAL)


if __name__ == "__main__":
    main_loop()
