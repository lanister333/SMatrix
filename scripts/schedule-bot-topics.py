#!/usr/bin/env python3
"""
SakhMatrix — «Театр ботов»: планировщик массовой обработки тем.
Обходит все topic-*.txt из sources/, для каждой:
  1. Загружает тему через POST /api/theatre-bots/process-topic (selector + Z.ai + queue).
  2. Сразу одобряет весь батч через POST /api/theatre-bots/queue (action=approve-batch),
     но с кастомным scheduledAt — равномерно распределённым по 9:00-01:00 MSK.
Боты публикуются через publishApprovedQueueItem по cron'у, когда scheduledAt <= NOW.
"""
import os, json, re, time, datetime, urllib.request, urllib.error, random
import paramiko

VPS_HOST = "81.177.49.189"
VPS_USER = "root"
VPS_PASS = "a43uPRF9"
API_TOKEN = "sakhmatrix-theatre-2026"
# Use external nginx port 80 (proxies to internal :3001)
API_BASE = "http://127.0.0.1:3001"

SOURCES_DIR = "/opt/smatrix/scripts/bot-theatre-sources"

# MSK timezone offset = +3 from UTC. We schedule from 9:00 to 25:00 MSK (= 06:00-22:00 UTC next day)
# Actually for simplicity, we'll use UTC and convert to MSK for display only.
# Window: 16 hours, 36 topics → ~27 min between topics on average, with jitter ±15 min

def extract_topic_text(filepath):
    """Извлекает 'Текст:' блок из topic-*.txt файла."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    m = re.search(r'Текст:\s*\n(.*?)\n\nТематика:', content, re.DOTALL)
    if m:
        return m.group(1).strip()
    # Fallback: take lines after "Текст:" until "Подходит" or "Тематика"
    m = re.search(r'Текст:\s*\n(.+?)(?:\n\n(?:Тематика|Подходит|ВАЖНО))', content, re.DOTALL)
    if m:
        return m.group(1).strip()
    return None

def guess_title(topic_text, filename):
    """Простой генератор заголовка из первых слов темы."""
    # Take first sentence, max 70 chars
    first = topic_text.split('\n')[0].split('.')[0].split('?')[0].split('!')[0]
    first = re.sub(r'\s+', ' ', first).strip()
    if len(first) > 70:
        first = first[:67].rstrip() + '…'
    return first or filename

def guess_rubric_id(topic_text):
    """Угадывает rubricId по содержанию темы."""
    text_lower = topic_text.lower()
    # Medicine → Стоматология (71) or Спорт и здоровье (75)
    if any(kw in text_lower for kw in ['стоматолог', 'имплант', 'зуб', 'протез']):
        return 71  # Стоматология
    if any(kw in text_lower for kw in ['врач', 'больниц', 'медиц', 'окулист', 'эндокринолог', 'гинеколог', 'психолог', 'юрист']):
        return 75  # Спорт и здоровье (включает медицину)
    # Repairs → Строительство/ремонт (102)
    if any(kw in text_lower for kw in ['электрик', 'ремонт', 'мастер', 'проводк', 'смеситель', 'розетк']):
        return 102  # Строительство, ремонт и обустройство
    # Prices / goods → Цены (120) or Услуги (119)
    if any(kw in text_lower for kw in ['цен', 'стоимост', 'сколько', 'купить', 'где купить']):
        return 120  # Цены
    if any(kw in text_lower for kw in ['услуг', 'специалист', 'подскажите где']):
        return 119  # Услуги и специалисты
    # Animals → нет отдельной, в Услуги (119)
    if any(kw in text_lower for kw in ['собак', 'кот', 'животн', 'щенок']):
        return 119
    # Default → Подслушано (130) — универсальная
    return 130

def post_json(url, payload):
    """POST JSON to VPS API, return parsed response."""
    data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = resp.read().decode('utf-8')
            return json.loads(body), resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        try:
            return json.loads(body), e.code
        except:
            return {"error": body[:500]}, e.code
    except Exception as e:
        return {"error": str(e)}, 500

def main():
    # Collect all topic files
    files = sorted([f for f in os.listdir(SOURCES_DIR) if f.startswith('topic-') and f.endswith('.txt')])
    print(f"Found {len(files)} topic files")

    # Schedule: 9:00 to 25:00 (next day) MSK = 16 hours window
    # Now is "now"; we'll schedule starting from next 9:00 MSK
    # Easier: just space them evenly over 16 hours starting NOW (admin can adjust)
    # 16 hours = 57600 seconds. 36 topics → 1600 sec between, but with jitter.
    # Actually better: random delays summing to 16h.
    
    # Total window = 16 hours, average delay between topics = window/topics
    avg_delay = 16 * 3600 / len(files)  # ~1600 sec ≈ 27 min
    # Generate random schedule: start time = NOW + 5 min, then each topic at +avg_delay±jitter
    
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(VPS_HOST, 22, VPS_USER, VPS_PASS, timeout=15)
    
    # Get VPS current time
    stdin, stdout, stderr = c.exec_command("date -u +%s", timeout=10)
    vps_time_str = stdout.read().decode().strip()
    vps_now = int(vps_time_str)
    print(f"VPS UTC time: {datetime.datetime.utcfromtimestamp(vps_now).isoformat()}")
    
    # MSK = UTC + 3 hours. We want first topic at 9:00 MSK = 6:00 UTC.
    # If current MSK time is before 9:00 → start at 9:00 today.
    # If after 9:00 → start now + 5 min.
    vps_msk_hour = (vps_now // 3600 + 3) % 24
    vps_msk_minute = (vps_now // 60) % 60
    print(f"VPS MSK time: {vps_msk_hour:02d}:{vps_msk_minute:02d}")
    
    # If before 9:00 MSK → wait until 9:00 today
    if vps_msk_hour < 9 or (vps_msk_hour == 9 and vps_msk_minute < 0):
        # Start at 9:00 today MSK = 6:00 UTC
        next_9_msk = ((vps_now // 86400) * 86400) + (6 * 3600)
        if next_9_msk < vps_now:
            next_9_msk += 86400
        first_topic_at = next_9_msk
    else:
        # Start now + 5 min
        first_topic_at = vps_now + 300
    
    # If first_topic_at + 16h > 01:00 MSK next day (= 22:00 UTC next day) — extend window
    last_topic_at_max = first_topic_at + 16 * 3600
    print(f"First topic at: {datetime.datetime.utcfromtimestamp(first_topic_at).isoformat()} UTC")
    print(f"Window ends: {datetime.datetime.utcfromtimestamp(last_topic_at_max).isoformat()} UTC")
    
    # Distribute topics evenly with ±25% jitter
    n = len(files)
    times = []
    for i in range(n):
        base = first_topic_at + i * avg_delay
        jitter = random.uniform(-avg_delay * 0.25, avg_delay * 0.25)
        t = base + jitter
        times.append(int(t))
    
    # Sort times
    times.sort()
    
    print(f"\n=== Schedule preview (first 5) ===")
    for i, t in enumerate(times[:5]):
        msk_time = datetime.datetime.utcfromtimestamp(t + 3*3600).strftime('%Y-%m-%d %H:%M MSK')
        print(f"  Topic {i+1}: {msk_time}")
    
    # Process each topic
    c.close()  # close paramiko (we use HTTP for API calls)
    
    success = 0
    failed = []
    for i, fname in enumerate(files):
        fpath = os.path.join(SOURCES_DIR, fname)
        topic_text = extract_topic_text(fpath)
        if not topic_text:
            print(f"\n[{i+1}/{n}] {fname}: NO TEXT — skip")
            failed.append((fname, "no text"))
            continue
        
        title = guess_title(topic_text, fname)
        rubric_id = guess_rubric_id(topic_text)
        scheduled_at = times[i]
        scheduled_at_iso = datetime.datetime.utcfromtimestamp(scheduled_at).isoformat() + 'Z'
        
        print(f"\n[{i+1}/{n}] {fname}")
        print(f"  Title: {title[:60]}")
        print(f"  Rubric ID: {rubric_id}")
        print(f"  Scheduled: {datetime.datetime.utcfromtimestamp(scheduled_at + 3*3600).strftime('%H:%M MSK')}")
        print(f"  Topic text: {topic_text[:80]}...")
        
        # Step 1: process topic → creates BotQueue items in 'pending' status
        payload = {
            "token": API_TOKEN,
            "text": topic_text,
            "rubricId": rubric_id,
            "topicTitle": title,
        }
        result, status = post_json(f"{API_BASE}/api/theatre-bots/process-topic", payload)
        if status != 200 or not result.get("ok"):
            err = result.get("error", "unknown")
            print(f"  ❌ process-topic failed: {err[:200]}")
            failed.append((fname, f"process: {err[:100]}"))
            continue
        
        batch_id = result.get("batchId")
        queued = result.get("queuedCount", 0)
        selected_bots = result.get("selectedBots", [])
        print(f"  ✓ Batch: {batch_id[:12]}... | bots: {len(selected_bots)} | queued: {queued}")
        
        if queued == 0:
            print(f"  ⚠️ No items queued — skip scheduling")
            failed.append((fname, "no items"))
            continue
        
        # Step 2: approve the whole batch with custom scheduledAt cascade
        # We want all replies of this batch to be published at the SAME scheduledAt
        # (so they appear in the topic together)
        approve_payload = {
            "token": API_TOKEN,
            "action": "approve-batch-custom",
            "batchId": batch_id,
            "scheduledAt": scheduled_at_iso,
        }
        result2, status2 = post_json(f"{API_BASE}/api/theatre-bots/queue", approve_payload)
        if status2 != 200 or not result2.get("ok"):
            # Fallback: approve-batch (random cascade) — that's also fine
            print(f"  ⚠️ approve-batch-custom failed, trying default cascade")
            result2, status2 = post_json(f"{API_BASE}/api/theatre-bots/queue", {
                "token": API_TOKEN,
                "action": "approve-batch",
                "batchId": batch_id,
            })
            if status2 == 200 and result2.get("ok"):
                print(f"  ✓ Approved (random cascade)")
                success += 1
            else:
                err = result2.get("error", "unknown")
                print(f"  ❌ approve-batch also failed: {err[:200]}")
                failed.append((fname, f"approve: {err[:100]}"))
        else:
            approved = result2.get("approved", 0)
            print(f"  ✓ Approved: {approved} items, all at {datetime.datetime.utcfromtimestamp(scheduled_at + 3*3600).strftime('%H:%M MSK')}")
            success += 1
        
        # Small delay to not overwhelm Z.ai API
        time.sleep(2)
    
    print(f"\n=== SUMMARY ===")
    print(f"Success: {success}/{n}")
    if failed:
        print(f"Failed ({len(failed)}):")
        for fname, err in failed:
            print(f"  - {fname}: {err}")

if __name__ == "__main__":
    main()
