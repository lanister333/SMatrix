/**
 * SakhMatrix — парсер biz65.ru через Puppeteer (запускается НА VPS)
 * 
 * Запуск: node scraper.js
 * 
 * Что делает:
 * 1. Запускает headless Chrome на VPS (IP Франкфурта)
 * 2. Заходит на biz65.ru/forum — Cloudflare видит реальный браузер
 * 3. Ждёт выполнения JS-челленджа Cloudflare (5-10 сек)
 * 4. Парсит темы форума (заголовок, текст, категория)
 * 5. Отправляет в Z.ai для рерайта
 * 6. Публикует в Telegram-канал
 * 
 * Установка на VPS:
 *   apt update && apt install -y nodejs npm
 *   npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
 *   npx puppeteer browsers install chrome
 *   node scraper.js
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const https = require('https');

puppeteer.use(StealthPlugin());

// ─── Конфиг ────────────────────────────────────────────────────────────

const ZAI_API_KEY = process.env.ZAI_API_KEY || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8683682264:AAHtL2blRhXPCFvoNDOIEDhzDql5SIXT92w';
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '';
const FORUM_URL = 'https://biz65.ru/forum';
const PROCESSED_FILE = 'processed.txt';
const PARSE_INTERVAL = 10 * 60 * 1000; // 10 минут

const ZAI_API_URL = 'https://api.z.ai/api/paas/v4/chat/completions';
const ZAI_MODEL = 'glm-5.3-flash';

const SYSTEM_PROMPT = `Ты — интеллектуальный конвейер "Театр ботов" для SakhMatrix.

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

Только JSON, без markdown, без лишнего текста.`;

// ─── Функции ───────────────────────────────────────────────────────────

function loadProcessed() {
  try { return new Set(fs.readFileSync(PROCESSED_FILE, 'utf-8').split('\n').filter(Boolean)); }
  catch { return new Set(); }
}

function saveProcessed(set) {
  fs.writeFileSync(PROCESSED_FILE, Array.from(set).join('\n'), 'utf-8');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithCloudflare(url) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    
    console.log(`  Загружаю ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Ждём Cloudflare челлендж (до 20 сек)
    for (let i = 0; i < 20; i++) {
      const title = await page.title();
      if (!title.includes('Подождите') && !title.includes('Just a moment')) break;
      console.log(`  Жду Cloudflare... (${i * 2}с)`);
      await sleep(2000);
    }
    
    const finalTitle = await page.title();
    if (finalTitle.includes('Подождите') || finalTitle.includes('Just a moment')) {
      console.log('  [!] Cloudflare не пропустил');
      return null;
    }
    
    console.log(`  [✓] Обход сработал! Title: ${finalTitle}`);
    return await page.content();
  } catch (e) {
    console.error(`  [!] Ошибка: ${e.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

async function parseTopics(html) {
  // Парсим HTML через Puppeteer (на странице уже)
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html);
  
  const topics = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.href;
      if (href.includes('/forum/topic/') || href.includes('/forum/thread/') || /\/forum\/\d+/.test(href)) {
        const title = a.textContent.trim();
        if (title.length > 5) {
          const id = href.rstrip('/').split('/').pop();
          results.push({ id, url: href, title });
        }
      }
    });
    return results;
  });
  
  await browser.close();
  return topics;
}

async function fetchTopicContent(url) {
  const html = await fetchWithCloudflare(url);
  if (!html) return null;
  
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html);
  
  const data = await page.evaluate(() => {
    const h1 = document.querySelector('h1') || document.querySelector('title');
    const title = h1 ? h1.textContent.trim() : '';
    
    let category = '';
    const breadcrumb = document.querySelector('[class*="breadcrumb"], [class*="crumb"], [class*="nav-path"]');
    if (breadcrumb) category = breadcrumb.textContent.trim();
    
    let body = '';
    const selectors = ['.post-body', '.message-body', '.post-content', '.topic-body', '.entry-content'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) { body = el.textContent.trim(); break; }
    }
    if (!body) body = document.body.textContent.trim().slice(0, 2000);
    
    return { title, body: body.slice(0, 3000), category };
  });
  
  await browser.close();
  return data;
}

async function callZai(topicData) {
  const userPrompt = `Категория: ${topicData.category}\nЗаголовок: ${topicData.title}\n\nТекст темы:\n${topicData.body}\n\nОцени и верни JSON.`;
  
  return new Promise((resolve) => {
    const data = JSON.stringify({
      model: ZAI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 500,
    });
    
    const req = https.request(ZAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ZAI_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 30000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json.choices?.[0]?.message?.content || '');
        } catch { resolve(''); }
      });
    });
    req.on('error', () => resolve(''));
    req.write(data);
    req.end();
  });
}

function parseLlmResponse(raw) {
  if (!raw) return null;
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.split('\n').filter(l => !l.trim().startsWith('```')).join('\n').trim();
  }
  try { return JSON.parse(text); }
  catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    return null;
  }
}

async function sendToTelegram(text, character) {
  if (!TELEGRAM_CHANNEL_ID) { console.log('  [!] Не задан TELEGRAM_CHANNEL_ID'); return false; }
  
  const message = `${text}\n\n— ${character}`;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const data = JSON.stringify({
    chat_id: TELEGRAM_CHANNEL_ID,
    text: message,
    disable_web_page_preview: true,
  });
  
  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 10000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`  [✓] Опубликовано: ${character}`);
          resolve(true);
        } else {
          console.log(`  [!] Telegram error: ${res.statusCode}`);
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.write(data);
    req.end();
  });
}

async function processTopic(topic, processed) {
  console.log(`\n[▶] ${topic.title.slice(0, 60)}...`);
  
  const data = await fetchTopicContent(topic.url);
  if (!data) { console.log('  [!] Не загружено'); processed.add(topic.id); saveProcessed(processed); return; }
  
  if (data.body.length < 30) {
    console.log('  [✗] Короткий текст');
    processed.add(topic.id); saveProcessed(processed); return;
  }
  
  console.log('  [→] Z.ai...');
  const llmRaw = await callZai(data);
  const result = parseLlmResponse(llmRaw);
  
  if (!result) { console.log(`  [!] Не распарсено: ${llmRaw?.slice(0, 100)}`); processed.add(topic.id); saveProcessed(processed); return; }
  
  if (result.action === 'skip') {
    console.log(`  [✗] SKIP: ${result.reason}`);
  } else if (result.action === 'publish') {
    console.log(`  [✓] ${result.character}: ${result.text?.slice(0, 60)}...`);
    await sendToTelegram(result.text, result.character);
  }
  
  processed.add(topic.id);
  saveProcessed(processed);
}

async function main() {
  console.log('='.repeat(60));
  console.log('  Театр ботов v2 — biz65.ru → Z.ai → Telegram');
  console.log(`  VPS IP: 94.249.192.221 (Франкфурт)`);
  console.log(`  Z.ai: ${ZAI_API_KEY ? 'OK' : 'НЕ ЗАДАН'}`);
  console.log(`  Telegram: ${TELEGRAM_CHANNEL_ID ? 'OK' : 'НЕ ЗАДАН'}`);
  console.log('='.repeat(60));
  
  if (!ZAI_API_KEY) { console.log('\nОШИБКА: ZAI_API_KEY не задан'); return; }
  
  while (true) {
    console.log(`\n${'─'.repeat(60)}\n[${new Date().toLocaleTimeString('ru-RU')}] Прогон...`);
    
    const processed = loadProcessed();
    console.log(`Обработано: ${processed.size}`);
    
    const html = await fetchWithCloudflare(FORUM_URL);
    if (!html) { console.log('[!] Форум не загружен'); await sleep(PARSE_INTERVAL); continue; }
    
    const topics = await parseTopics(html);
    console.log(`Тем: ${topics.length}`);
    
    const newTopics = topics.filter(t => !processed.has(t.id));
    console.log(`Новых: ${newTopics.length}`);
    
    for (const topic of newTopics) {
      await processTopic(topic, processed);
      await sleep(3000);
    }
    
    console.log(`\nSleep ${PARSE_INTERVAL / 60000} мин...`);
    await sleep(PARSE_INTERVAL);
  }
}

main().catch(console.error);
