import ZAI from 'z-ai-web-dev-sdk';
try {
  const zai = await ZAI.create();
  const r = await zai.functions.invoke('web_reader', { url: 'https://autokochka.ru/forum/thread/1910375' });
  console.log('TITLE:', (r.title || '').slice(0, 120));
  const h = r.html || r.content || '';
  console.log('LEN:', h.length);
  console.log(h.slice(0, 1500));
} catch (e) { console.log('ERR:', e.message); }
