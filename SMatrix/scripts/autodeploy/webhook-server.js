#!/usr/bin/env node
/**
 * Webhook-сервер для auto-deploy SMatrix.
 *
 * Слушает 0.0.0.0:9000, при POST /webhook:
 *   1. Проверяет X-Hub-Signature-256 (HMAC SHA256 с секретом из /etc/smatrix-webhook-secret)
 *   2. Проверяет, что X-GitHub-Event = push и ref = refs/heads/main
 *   3. В фоне запускает scripts/autodeploy/deploy.sh
 *   4. Сразу возвращает 200 OK (GitHub не ждёт завершения deploя)
 *
 * Логи: journalctl -u smatrix-webhook -f
 */
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');

const PORT = 9000;
const SECRET_FILE = '/etc/smatrix-webhook-secret';
const DEPLOY_SCRIPT = '/opt/smatrix/scripts/autodeploy/deploy.sh';

let SECRET;
try {
  SECRET = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
  if (!SECRET) throw new Error('empty secret');
} catch (e) {
  console.error(`FATAL: не могу прочитать секрет из ${SECRET_FILE}: ${e.message}`);
  console.error(`Создайте файл через: sudo bash /opt/smatrix/scripts/autodeploy/setup.sh`);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    // Проверка подписи X-Hub-Signature-256
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
      console.warn('[webhook] REJECTED: нет X-Hub-Signature-256');
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('Unauthorized: missing signature');
      return;
    }

    const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      console.warn('[webhook] REJECTED: неверная подпись');
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('Unauthorized: bad signature');
      return;
    }

    // Проверка event и ref
    const event = req.headers['x-github-event'];
    let payload;
    try { payload = JSON.parse(body); } catch (e) {
      console.warn('[webhook] REJECTED: не JSON');
      res.writeHead(400); res.end('Bad JSON'); return;
    }

    if (event !== 'push') {
      console.log(`[webhook] ignored event: ${event}`);
      res.writeHead(200); res.end('OK (ignored event)'); return;
    }

    const ref = payload.ref;
    if (ref !== 'refs/heads/main') {
      console.log(`[webhook] ignored ref: ${ref}`);
      res.writeHead(200); res.end('OK (ignored ref)'); return;
    }

    const pushedAt = payload.head_commit?.timestamp || new Date().toISOString();
    const commitSha = payload.after?.slice(0, 7) || 'unknown';
    const pusher = payload.pusher?.name || 'unknown';
    console.log(`[webhook] ACCEPTED push: ${commitSha} by ${pusher} at ${pushedAt}`);

    // Запускаем deploy.sh в фоне
    const deploy = spawn('bash', [DEPLOY_SCRIPT], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, SMATRIX_DEPLOY_TRIGGER: `webhook-${commitSha}` }
    });
    deploy.unref();

    // Сразу возвращаем 200 (GitHub не ждёт deploй)
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      message: `deploy started for commit ${commitSha}`,
      triggeredAt: new Date().toISOString()
    }));
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[smatrix-webhook] listening on 0.0.0.0:${PORT}`);
  console.log(`[smatrix-webhook] POST /webhook -> runs ${DEPLOY_SCRIPT}`);
});

server.on('error', (err) => {
  console.error(`[smatrix-webhook] server error: ${err.message}`);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('[smatrix-webhook] SIGTERM, closing server');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('[smatrix-webhook] SIGINT, closing server');
  server.close(() => process.exit(0));
});
