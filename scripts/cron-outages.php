<?php
/**
 * СТАДИЯ 2 (Шаг 7) → ЗАДАЧА №4: авто-агрегатор коммунальных отключений
 * (PHP, cron) — зеркальный близнец JS-парсера src/lib/outages-parser.ts.
 *
 * Собирает оперативные аварийные и плановые сводки с официальных
 * источников ТРЁХ ведомств:
 *
 *   1. Сахалинэнерго (ФРС) — sakh-frs.ru: карточки .oItem с пометкой
 *      «(Плановое)/(Аварийное)», адресами и ТОЧНЫМ временем публикации
 *      («Время публикации 16.09.2026 11:52»);
 *   2. СКК — skk65.ru: WordPress REST /wp-json/wp/v2/posts (date_gmt,
 *      заголовок с периодом, адреса в content);
 *   3. Городской Водоканал — sakhalin.rosvodokanal.ru (РВК-Сахалин):
 *      пресс-центр /pressroom/news/, сводки об ограничениях — статьями;
 *      без браузерных заголовков сайт отвечает 403 — шлём полный набор.
 *
 * Результат атомарно пишется в db/outages.json — тот же файл, что и
 * встроенный планировщик SakhMatrix (src/instrumentation-node.ts).
 * Запуск РАЗ В 30 МИНУТ (Шаг №7):
 *
 *   */30 * * * * php /путь/к/my-project/scripts/cron-outages.php >> /путь/к/my-project/outages-cron.log 2>&1
 *
 * Формат строки на Главной (Задача №4, ТЗ):
 *   [Иконка/Название ведомства] [Краткий адрес/Район] — [Время публикации]
 * поэтому каждая запись несёт short (краткий адрес), kind (вид услуги)
 * и publishedAt (ISO, UTC; Сахалин = UTC+11, летнего времени нет).
 * Источник считается неудачным тихо (пишется в errors) — сайт при этом
 * показывает предыдущие данные.
 */

declare(strict_types=1);

$ROOT = dirname(__DIR__);
$OUT  = $ROOT . '/db/outages.json';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Полные браузерные заголовки: РВК без Accept-Language отдаёт 403. */
const BROWSER_HEADERS = [
    'User-Agent: ' . UA,
    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language: ru-RU,ru;q=0.9',
];

/** Смещение Сахалина от UTC (Asia/Sakhalin, летнего времени нет). */
const SAKHALIN_OFFSET = 11 * 3600;

/** Заголовок-сводка об отключении (PR-заметки о «водоснабжении» отсеяны). */
function isOutageTitle(string $t): bool
{
    return (bool) preg_match('/отключ|ограничен|авари|прекращен|ремонт|негативн|внимание|промывк|опрессовк/iu', $t);
}

function httpGet(string $url, int $timeout = 12): string
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 3,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_CONNECTTIMEOUT => $timeout,
        CURLOPT_HTTPHEADER     => BROWSER_HEADERS,
        CURLOPT_ACCEPT_ENCODING => '',
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($code < 200 || $code >= 300 || !is_string($body) || $body === '') {
        throw new RuntimeException("HTTP $code");
    }
    return $body;
}

function stripTags(string $html): string
{
    $s = preg_replace(['#<script[\s\S]*?</script>#iu', '#<style[\s\S]*?</style>#iu', '#<[^>]+>#u'], [' ', ' ', ' '], $html) ?? '';
    $s = str_replace(['&nbsp;', '&quot;', '&amp;', '&#39;'], [' ', '"', '&', "'"], $s);
    return trim((string) preg_replace('#\s+#u', ' ', $s));
}

/** «16.09.2026», «11:52» — сахалинское локальное время → ISO (UTC). */
function sakhalinIso(string $dateStr, string $timeStr = '00:00'): string
{
    $d = array_map('intval', explode('.', $dateStr));
    $t = array_map('intval', explode(':', $timeStr));
    if (count($d) !== 3 || $d[0] === 0 || $d[1] === 0) return '';
    $utc = gmmktime($t[0] ?? 0, $t[1] ?? 0, 0, $d[1], $d[0], $d[2]) - SAKHALIN_OFFSET;
    return $utc > 0 ? gmdate('c', $utc) : '';
}

/** Краткий адрес строки ТЗ: пункт (кроме г. Южно-Сахалинск) + улица, ≤ 60. */
function composeShort(string $place, string $firstAddr, string $fallback): string
{
    $parts = [];
    $p = trim((string) preg_replace('/:+$/u', '', $place));
    if ($p !== '' && !preg_match('/^(?:г\.\s*)?Южно-Сахалинск$/iu', $p)) $parts[] = $p;
    $a = trim((string) preg_replace(['/[:;]+$/u', '/\.+$/u'], '', $firstAddr));
    if ($a !== '') $parts[] = $a;
    $short = implode(', ', $parts);
    if ($short === '') $short = $fallback;
    return mb_strlen($short) > 60 ? mb_substr($short, 0, 59) . '…' : $short;
}

/** Адресные строки списка (без «г. Южно-Сахалинск:» и «СОЦ объекты»). */
function pickAddressLines(array $lines, string $place, int $cap = 20): array
{
    $out = [];
    foreach ($lines as $raw) {
        $line = trim((string) preg_replace('#\s+#u', ' ', $raw));
        $line = (string) preg_replace('/^[-–—•*]\s*/u', '', $line);
        $len = mb_strlen($line);
        if ($len < 5 || $len > 200) continue;
        if (preg_match('/^(?:г\.\s*)?Южно-Сахалинск\s*:?\s*$/iu', $line)) continue;
        if ($line === $place) continue;
        if (preg_match('/^(СОЦ|соц)\s/u', $line)) continue;
        if (preg_match('/(ул\.|улиц[аы]|пер\.|переулок|проспект|пр-кт|пр-т|кв-л|квартал|мкр\.?|микрорайон|пос\.|поселок|посёлок|с\.|село|шоссе|наб\.|б-р|снт\.?)/iu', $line)
            && preg_match('/\d/u', $line) && !in_array($line, $out, true)) {
            $out[] = $line;
        }
        if (count($out) >= $cap) break;
    }
    return $out;
}

/* ==================== ИСТОЧНИК 1. Сахалинэнерго (ФРС) ==================== */

function frsType(string $capt): string
{
    if (preg_match('/аварийн/iu', $capt)) return 'emergency';
    if (preg_match('/планов/iu', $capt)) return 'planned';
    return 'unspecified';
}

function collectFrs(string $nowIso): array
{
    try {
        $html = httpGet('https://sakh-frs.ru/');
    } catch (Throwable $e) {
        return ['items' => [], 'error' => $e->getMessage()];
    }
    $items = [];
    $chunks = preg_split("#<div class=['\"]oItem['\"][^>]*>#iu", $html) ?: [];
    foreach (array_slice($chunks, 1) as $chunk) {
        if (count($items) >= 10) break;
        if (!preg_match("#<div class=['\"]oiText['\"]>([\s\S]*?)<div class=['\"]oiDate['\"]#iu", $chunk, $tm)) continue;
        $textHtml = $tm[1];
        $capt = stripTags(preg_match("#<div class=['\"]oiCapt['\"]>([\s\S]*?)</div>#iu", $chunk, $cm) ? $cm[1] : '');
        $title = stripTags(preg_match('#<b>([\s\S]*?)</b>#iu', $textHtml, $bm) ? $bm[1] : '') ?: $capt;
        if ($title === '') continue;
        $pubChunk = stripTags(preg_match("#<div class=['\"]oiDate['\"]>([\s\S]*?)</div>#iu", $chunk, $pm) ? $pm[1] : '');
        $publishedAt = $nowIso;
        if (preg_match('/(\d{1,2}\.\d{1,2}\.\d{4})\s+(\d{1,2}:\d{2})/u', $pubChunk, $p2)) {
            $publishedAt = sakhalinIso($p2[1], $p2[2]) ?: $nowIso;
        }
        $body = (string) preg_replace(
            ["#<div class=['\"]oiSep['\"]></div>#iu", '#</?(b|div|p|br)[^>]*>#iu'],
            ["\n", "\n"],
            $textHtml
        );
        $lines = [];
        foreach (preg_split('#\n+#u', $body) ?: [] as $l) {
            $l = trim((string) preg_replace('#\s+#u', ' ', $l));
            if ($l !== '') $lines[] = $l;
        }
        $place = '';
        foreach ($lines as $l) {
            if (preg_match('/:$/u', $l) && mb_strlen($l) <= 80) { $place = rtrim($l, ':'); break; }
        }
        $addresses = pickAddressLines($lines, $place);
        $when = '';
        if (preg_match('/с\s+\d{1,2}[:.]\d{2}\s*[-–—]?\s*(?:до)?\s*\d{1,2}[:.]\d{2}/iu', $title, $wm)) $when = $wm[0];
        $items[] = [
            'source'      => 'Сахалинэнерго',
            'title'       => $title,
            'url'         => 'https://sakh-frs.ru/',
            'addresses'   => $addresses,
            'short'       => composeShort($place, $addresses[0] ?? '', $title),
            'when'        => $when,
            'kind'        => 'electro',
            'type'        => frsType($capt),
            'publishedAt' => $publishedAt,
            'fetchedAt'   => $nowIso,
        ];
    }
    return ['items' => $items];
}

/* ==================== ИСТОЧНИК 2. СКК (skk65.ru, WP REST) ==================== */

/** Терпеливый JSON: ридер может вернуть обрезанный ответ — спасаем
 *  цельные объекты балансировкой фигурных скобок. */
function skkJsonPosts(string $raw): array
{
    $text = trim($raw);
    $s = mb_strpos($text, '[');
    $e = mb_strrpos($text, ']');
    if ($s !== false && $e !== false && $e > $s) $text = mb_substr($text, $s, $e - $s + 1);
    $arr = json_decode($text, true);
    if (is_array($arr)) return $arr;
    $objs = [];
    $i = 0; $n = strlen($text);
    while ($i < $n) {
        while ($i < $n && $text[$i] !== '{') $i++;
        if ($i >= $n) break;
        $depth = 0; $j = $i; $instr = false; $esc = false;
        while ($j < $n) {
            $c = $text[$j];
            if ($instr) {
                if ($esc) $esc = false;
                elseif ($c === '\\') $esc = true;
                elseif ($c === '"') $instr = false;
            } elseif ($c === '"') $instr = true;
            elseif ($c === '{') $depth++;
            elseif ($c === '}') { $depth--; if ($depth === 0) { $j++; break; } }
            $j++;
        }
        $obj = json_decode(substr($text, $i, $j - $i), true);
        if (!is_array($obj)) break;
        $objs[] = $obj;
        $i = $j;
    }
    return $objs;
}

function collectSkk(string $nowIso): array
{
    try {
        $raw = httpGet('https://skk65.ru/wp-json/wp/v2/posts?per_page=12');
    } catch (Throwable $e) {
        return ['items' => [], 'error' => $e->getMessage()];
    }
    $okCats = [
        'category-goryachaya-voda', 'category-holodnaya-voda',
        'category-otoplenie', 'category-remontnye-raboty',
    ];
    $items = [];
    foreach (skkJsonPosts($raw) as $post) {
        if (count($items) >= 6) break;
        $title = stripTags((string) ($post['title']['rendered'] ?? ''));
        if ($title === '') continue;
        $inCat = false;
        foreach (($post['class_list'] ?? []) as $c) {
            if (in_array($c, $okCats, true)) { $inCat = true; break; }
        }
        if (!$inCat && !isOutageTitle($title)) continue;
        $lines = [];
        foreach (preg_split('#\n+#u', (string) preg_replace('#</p>#iu', "\n", (string) ($post['content']['rendered'] ?? ''))) ?: [] as $l) {
            $l = stripTags($l);
            if ($l !== '') $lines[] = $l;
        }
        $addresses = [];
        foreach ($lines as $l) {
            $l = (string) preg_replace('/^[-–—•*]\s*/u', '', $l);
            $len = mb_strlen($l);
            if ($len < 5 || $len > 200) continue;
            if (preg_match('/(ул\.|улиц[аы]|пер\.|переулок|проспект|пр-кт|пр-т|кв-л|квартал|мкр\.?|микрорайон|пос\.|поселок|посёлок|с\.|село|шоссе|наб\.|б-р)/iu', $l)
                && preg_match('/\d/u', $l)) $addresses[] = $l;
            if (count($addresses) >= 20) break;
        }
        $dg = (string) ($post['date_gmt'] ?? '');
        $publishedAt = $nowIso;
        if (preg_match('#^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$#', $dg)) $publishedAt = $dg . 'Z';
        $when = '';
        if (preg_match('/с\s+\d{1,2}[:.]\d{2}\s*[-–—]?\s*(?:до)?\s*\d{1,2}[:.]\d{2}/iu', $title, $wm)) $when = $wm[0];
        $items[] = [
            'source'      => 'СКК',
            'title'       => $title,
            'url'         => (string) ($post['link'] ?? 'https://skk65.ru/'),
            'addresses'   => $addresses,
            'short'       => composeShort('', $addresses[0] ?? '', $title),
            'when'        => $when,
            'kind'        => 'hot',
            'type'        => preg_match('/авари/iu', $title) ? 'emergency' : 'planned',
            'publishedAt' => $publishedAt,
            'fetchedAt'   => $nowIso,
        ];
    }
    return ['items' => $items];
}

/* ==================== ИСТОЧНИК 3. Водоканал (РВК-Сахалин) ==================== */

function collectVodokanal(string $nowIso): array
{
    try {
        $listHtml = httpGet('https://sakhalin.rosvodokanal.ru/pressroom/news/');
    } catch (Throwable $e) {
        return ['items' => [], 'error' => $e->getMessage()];
    }
    $titles = []; $dates = []; $hrefs = [];
    if (preg_match_all('#class="news-item__title">([^<]+)</p>#iu', $listHtml, $m1)) $titles = $m1[1];
    if (preg_match_all('#class="news-item__meta">([^<]+)</p>#iu', $listHtml, $m2)) $dates = $m2[1];
    if (preg_match_all('#href=["\'](/pressroom/news/\d+/)["\']#iu', $listHtml, $m3)) $hrefs = $m3[1];
    $n = min(count($titles), count($dates), count($hrefs), 3);
    $items = []; $seen = [];
    for ($i = 0; $i < $n; $i++) {
        $title = stripTags($titles[$i]);
        if (!isOutageTitle($title) || isset($seen[$hrefs[$i]])) continue;
        $seen[$hrefs[$i]] = true;
        $url = 'https://sakhalin.rosvodokanal.ru' . $hrefs[$i];
        $addresses = []; $when = ''; $artDate = '';
        try {
            $art = httpGet($url);
            $start = mb_strpos($art, 'news-detail');
            $end = mb_strpos($art, 'К списку новостей', $start);
            $frag = $start !== false
                ? mb_substr($art, $start, ($end !== false && $end > $start ? $end : mb_strlen($art)) - $start)
                : $art;
            foreach (preg_split('#(</p>|<br\s*/?>)#iu', $frag) ?: [] as $l) {
                $l = stripTags($l);
                $len = mb_strlen($l);
                if ($len < 5 || $len > 200) continue;
                if (preg_match('/(ул\.|улиц[аы]|пер\.|переулок|проспект|пр-кт|пр-т|кв-л|квартал|мкр\.?|микрорайон|пос\.|поселок|посёлок|с\.|село|шоссе|наб\.|б-р)/iu', $l)
                    && preg_match('/\d/u', $l) && !in_array($l, $addresses, true)) $addresses[] = $l;
                if (count($addresses) >= 20) break;
            }
            $text = stripTags($frag);
            if (preg_match('/\d{1,2}\.\d{1,2}\.\d{4}/u', $text, $dm)) $artDate = $dm[0];
            if (preg_match('/с\s+\d{1,2}[:.]\d{2}\s*[-–—]?\s*(?:до)?\s*\d{1,2}[:.]\d{2}/iu', $text, $wm)) $when = $wm[0];
        } catch (Throwable $e) {
            // статья не открылась — карточка всё равно информативна
        }
        $items[] = [
            'source'      => 'Водоканал',
            'title'       => $title,
            'url'         => $url,
            'addresses'   => $addresses,
            'short'       => composeShort('', $addresses[0] ?? '', $title),
            'when'        => $when,
            'kind'        => 'cold',
            'type'        => preg_match('/авари|негативн/iu', $title) ? 'emergency' : 'planned',
            'publishedAt' => sakhalinIso($dates[$i] ?: $artDate) ?: $nowIso,
            'fetchedAt'   => $nowIso,
        ];
    }
    return ['items' => $items];
}

/* ==================== СБОРКА ==================== */

$nowIso = gmdate('c');
$res = [
    ['Сахалинэнерго', collectFrs($nowIso)],
    ['СКК', collectSkk($nowIso)],
    ['Водоканал', collectVodokanal($nowIso)],
];
$items = []; $errors = []; $seen = [];
foreach ($res as [$name, $r]) {
    foreach (($r['items'] ?? []) as $it) {
        $key = $it['source'] . '|' . mb_substr($it['title'], 0, 80);
        if (isset($seen[$key])) continue;
        $seen[$key] = true;
        $items[] = $it;
    }
    if (!empty($r['error'])) $errors[] = ['source' => $name, 'error' => $r['error']];
}
// сортировка по времени публикации (свежие — вверху), не более 30 записей
usort($items, static function ($a, $b) {
    $ta = @strtotime($a['publishedAt'] ?: $a['fetchedAt']);
    $tb = @strtotime($b['publishedAt'] ?: $b['fetchedAt']);
    return $tb <=> $ta;
});
$items = array_slice($items, 0, 30);

$payload = json_encode(
    ['updated' => $nowIso, 'items' => $items, 'errors' => $errors],
    JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
);

if ($payload !== false) {
    if (!is_dir(dirname($OUT))) mkdir(dirname($OUT), 0775, true);
    $tmp = $OUT . '.tmp';
    file_put_contents($tmp, $payload);
    rename($tmp, $OUT); // атомарная подмена
    fwrite(STDERR, '[' . gmdate('c') . '] outages: ' . count($items) . " items, errors: " . count($errors) . "\n");
    exit(0);
}
fwrite(STDERR, '[' . gmdate('c') . "] outages: json encode failed\n");
exit(1);
