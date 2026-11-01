# SakhMatrix — Стадия 2: ГОТОВЫЙ КОД (Задача 1 + Задача 2)

Готовые цельные блоки для копипаста. Всё проверено приёмкой (тесты 158/158,
прогоны RUN1-RUN3 чистые, коммит 7f650d1). Мобайл ≤480 не затронут.

---

## СТАДИЯ 2, ЗАДАЧА 1 — сетка ПК-версии (борьба с перерастянутым центром)

### 1.1 `src/app/page.tsx` — обёртка трёх колонок Главной (строка ~773)

Класс строго условный: только Главная получает flex-сетку, форумный вид
той же страницы хранит прежнюю grid-сетку.

```tsx
<div className={`sk-layout${isHome ? " main-grid-container" : ""}`}>
```

### 1.2 `src/app/globals.css` — контейнер и фиксация колонок
(базовая зона, после правил .sk-layout / .sk-col-*)

```css
/* width:100% — обязательный спутник max-width+margin:auto в контексте
   flex-элемента .sk-shell: без него авто-поля отключают stretch и контейнер
   раздувается до min-content самой длинной темы (nowrap), обрезая правую
   колонку на ноутбуках 1024-1279px; с ним ширина = min(доступное, 1260) */
.sk-layout.main-grid-container{width:100%;justify-content:space-between;max-width:1260px;margin:0 auto;gap:12px;display:flex}
.main-grid-container .sk-col-left{flex:0 0 240px}
.main-grid-container .sk-col-main{flex:1;min-width:450px}
.main-grid-container .mp-right{flex:0 0 300px}
```

### 1.3 `src/app/globals.css` — мобильная откатка
(внутрь СУЩЕСТВУЮЩЕГО блока `@media (max-width:900px)`)

```css
  .sk-layout.main-grid-container{display:block;margin:0}
  .main-grid-container .sk-col-main{min-width:0}
```

### 1.4 `src/app/globals.css` — строки таблиц «Подслушано» и «Последние темы»
(базовая зона, правила .mp-trow / .mp-ttext / .mp-tauthor / .mp-tdate)

```css
.mp-trow{border-bottom:1px solid #dfe6ee;justify-content:space-between;align-items:center;padding:5px 9px;display:flex}
.mp-trow:last-child{border-bottom:0}
.mp-trow:hover{background:#f5f9fd}
.mp-ttext{color:#0a5caa;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:14px;font-weight:600;text-decoration:underline;flex:1;padding-right:15px}
.mp-ttext:hover{color:#c40000}
.mp-tauthor{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 0 140px;text-align:left;font-size:12.5px}
.mp-tdate{color:#56657a;white-space:nowrap;flex:0 0 110px;text-align:right;font-size:12px}
```

Тема: flex:1 + nowrap/hidden/ellipsis + padding-right:15px (длинные названия
уходят в троеточие, вёрстку не ломают). Автор: 140px, влево.
Дата: 110px, вправо. Мобильные клампы ≤640 (дата скрыта, автор 96px)
работают поверх flex-basis без изменений.

---

## СТАДИЯ 2, ЗАДАЧА 2 — эстетика: Шапка и Подвал

### 2.1 `src/app/globals.css` — логотип по центру бирюзовой плашки + белый блок лозунга
(сразу после правила `.sm-masthead-low{font-size:.74em}`)

```css
/* ЗАДАЧА 2 (эстетика): логотип SakhMatrix — симметричные вертикальные
   отступы padding-top/padding-bottom 6px/6px, чтобы встать по центру
   бирюзовой плашки (замена асимметричного md:mt-6px; медиа ≥768px —
   мобайл ≤767px не затронут). Правый блок лозунга (.sm-mh-side:
   «Сахалинская матрица взаимопомощи» + описание) — принудительно белый. */
@media (min-width:768px){.header-logo{padding-top:6px;padding-bottom:6px}}
.sm-mh-side{color:#FFFFFF !important}
```

### 2.2 `src/components/site/chrome.tsx` — разметка логотипа
(строка-ссылка логотипа в Masthead; прежний `md:mt-[6px]` убран)

```tsx
<a href="/" className="header-logo block" aria-label="SakhMatrix — на главную">
  <h1 className="sm-masthead-title text-[42px] min-[420px]:text-[50px] min-[560px]:text-[56px] md:text-[64px] xl:text-[86px]" itemProp="name">
    <span className="sm-masthead-sakh">
      S<span className="sm-masthead-low">akh</span>
    </span>
    <span className="sm-masthead-matrix">
      M<span className="sm-masthead-low">atrix</span>
    </span>
  </h1>
</a>
```

### 2.3 `src/app/globals.css` — футер сервисных страниц (.sk-footer)
(weather.php, currency.php, disconnections.php, traffic.php, объявления и др.)

```css
/* ЗАДАЧА 2 (эстетика): футер покрашен в цвет синих плашек меню #004A8F,
   текст внутри — белый, ссылки — мягкий голубой #A9CBEF */
.sk-footer{color:#FFFFFF;background-color:#004A8F !important;border-top:2px solid var(--sm-navy);flex-wrap:wrap;flex-shrink:0;justify-content:space-between;gap:10px;margin-top:12px;padding:8px 12px;font-size:12.5px;display:flex}
.sk-footer a{color:#A9CBEF}
```

### 2.4 `src/app/globals.css` — футер Главной/форума (.mp-footer — блок целиком)

```css
/* ---- Футер по макету: ссылки, сведения, дисклеймер, версия ----
   ЗАДАЧА 2 (эстетика): футер покрашен в цвет синих плашек меню #004A8F,
   текст внутри — белый, ссылки — мягкий голубой #A9CBEF (ховер — белый
   вместо красного: тёмно-красный #c40000 не читается на синем фоне) */
.mp-footer{color:#FFFFFF;background-color:#004A8F !important;border-top:1px solid #4a688c;flex-shrink:0;margin-top:12px;padding:8px 12px 9px;font-size:12.5px}
.mp-footer a{color:#A9CBEF;cursor:pointer;text-decoration:underline}
.mp-footer a:hover{color:#FFFFFF}
.mp-footer-links{border-bottom:1px solid #e1e7ee;flex-wrap:wrap;gap:4px 14px;padding-bottom:6px;margin-bottom:7px;display:flex}
.mp-footer-info{flex-wrap:wrap;justify-content:space-between;gap:6px 24px;display:flex}
.mp-footer-left{min-width:220px}
.mp-footer-disc{color:#FFFFFF;margin-top:2px;font-size:12px;line-height:1.45}
.mp-footer-right{color:#FFFFFF;text-align:right;line-height:1.5}
```

---

## Контроль качества

- Чекер `scripts/test-informers.ts`: **158/158**
- Приёмка `scripts/task2-aesthetic-verify.sh` (Задача 2) и
  `scripts/stage2-grid-verify.sh` (Задача 1): прогоны RUN1-RUN3 чистые,
  1280 / 1366 (16:9) / 400, прокруток-X нет, консоль чиста
- Замеры на 1280: контейнер 1260px (левая 240 / центр 696 / правая 300,
  gap 12); футеры rgb(0, 74, 143) = #004A8F; ссылки rgb(169, 203, 239) = #A9CBEF;
  блок лозунга и логотип: паддинги 6px/6px computed
- Мобайл 400: шапка 35px (≤60 заморозка), паддингов у логотипа нет,
  футер #004A8F + белый текст
- Скриншоты: `download/screens/t2-*RUN{1,2,3}.png`, `download/screens/s2g-*RUN{1..4}.png`
