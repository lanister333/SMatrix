<?php
/**
 * ТЗ 2026-09-23 «Замена источника курсов»: PHP-крон больше НЕ парсит
 * сам — прежний kovalut-парсер удалён вместе с
 * src/lib/currency-parser.ts. Крон = триггер встроенного
 * многоисточникового агрегатора (bankdep.ru → mainfin.ru → banktop.ru →
 * кэш CurrencyRate): POST /api/currency/parse.
 *
 * Запуск раз в 30 минут (темп обновления основного источника):
 *   */30 * * * * php /путь/к/my-project/scripts/cron-currency.php >> /путь/к/my-project/currency-cron.log 2>&1
 *
 * Неудача считается мягкой (строка в лог) — сайт показывает
 * предыдущую серию / кэш последнего успеха.
 */

$base = getenv('SAKHMATRIX_BASE') ?: 'http://127.0.0.1:3000';
$ch = curl_init($base . '/api/currency/parse');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => '{}',
  CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 120,
]);
$body = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);
echo '[' . date('d.m.Y H:i:s') . "] currency cron: HTTP {$code} " . ($err ? "curl: {$err} " : '') . substr((string)$body, 0, 300) . PHP_EOL;
if ($code >= 400) exit(1);
