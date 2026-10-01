"use client";

/**
 * Шаг 9 + ЗАДАЧА 3 (Стадия 2) + ТЗ 2026-09-23: полная страница
 * «Курсы валют» (роут /currency.php).
 *
 * РЕСТАВРАЦИЯ 2026-09-23: файл пересоздан по записям worklog после
 * отката воркспейса платформой к снапшоту 09-21 (детали — в шапке
 * src/lib/currency-banks.ts). Состояние = финал четырёх ТЗ 09-23:
 *
 *  1. «Замена источника»: агрегатор bankdep → mainfin → banktop →
 *     кэш БД (src/lib/currency-sources.ts); 4 состояния ячеек:
 *     число / «—»+тултип «Курс не опубликован» / «Ошибка»+тултип
 *     «Не удалось загрузить курс» / кэш последнего успеха.
 *  2. «Компактная таблица + банки ЮС + THB»: строки 27px, 15 банков
 *     ТЗ, THB за 1 (Приморье/Совкомбанк публикуют), table-layout:fixed.
 *  3. «ДВ банк»: 13-й банк — короткий бренд, колонки равные.
 *  4. «Доработка таблицы»: колонка банка 136px (шрифт 11.5, иконка 12
 *     через prop size, gap 3), ВСЕ 12 колонок курсов РОВНО 80px
 *     (136+80×12=1096 ≤ 1105); шапка без русских названий валют,
 *     коды 15px bold, вторая строка — знак + номинал; плашки
 *     «устарело» удалены — неактуальное значение = обычное число
 *     (свежесть — в тултипах и строке «обновлено»); «Отделения и
 *     кассы банков» = 15 банков таблицы.
 *
 * Каркас общий с самостоятельными разделами (глобальная сетка 300/
 * 1105/300, зазор 12px). Подсветка лучших — зелёная ТЗ (#E2F0D9 /
 * #2E7D32) по значению, независимо от свежести.
 */

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SETTINGS,
  isStaffRole,
  MainNav,
  Masthead,
  SiteFooter,
  useAuth,
  type SiteSettings,
} from "@/components/site/chrome";
// Шаг №4 (монолит): левая колонка — меню навигации и категорий форума
import ForumSideNav from "@/components/site/left-nav";
import HomeRight from "@/components/site/home-right";
import {
  BANK_BRANCHES,
  CUR_COLS,
  LAST_CUR_KEY,
  computeBestRates,
  convertToRub,
  fmtMoney,
  type BankRatesRow,
  type RateCell,
  type RateKey,
} from "@/lib/currency-table";
// Директива Stage 2: визуальные маркеры банков — маленькие иконки
// lucide-react слева от названия банка
import {
  Building2,
  Landmark,
  CreditCard,
  Wallet,
  PiggyBank,
  Globe,
  Sprout,
  HandCoins,
  Leaf,
  Smartphone,
  Waves,
  Mountain,
  Zap,
} from "lucide-react";

/** Ключи синей навигации → URL самостоятельных разделов / видов форума. */
const NAV_ROUTES: Record<string, string> = {
  home: "/",
  forum: "/?view=forum",
  ads: "/obyavleniya",
  podslyshano: "/podslyshano",
  wheretobuy: "/gde-kupit",
  gdedeshevle: "/gde-deshevle",
  recommend: "/rekomenduyu",
  employers: "/o-rabotodatelyah",
  gkh: "/gkh",
  help: "/help",
  dating: "/znakomstva",
};

/** Ячейка v2 из API (статус/штамп/источник для тултипов). */
type ApiCell = RateCell | null;

interface RatesData {
  source: "multi" | "cache" | "none";
  updated: string;
  sources?: Record<string, string>;
  banks: BankRatesRow[];
}

const EMPTY_RATES: RatesData = { source: "none", updated: "", banks: [] };

/** Визуальные маркеры банков: каждому из 15 банков ТЗ — маленькая
 *  аккуратная иконка lucide-react рядом с названием (неизвестный
 *  банк → Building2). */
const BANK_ICONS: Record<string, typeof Building2> = {
  АТБ: Wallet,
  "Солид Банк": Landmark,
  Сбербанк: PiggyBank,
  ВТБ: CreditCard,
  Приморье: Waves,
  Долинск: Sprout,
  Экспобанк: HandCoins,
  Газпромбанк: Landmark,
  Совкомбанк: HandCoins,
  Россельхозбанк: Sprout,
  "Альфа-Банк": Leaf,
  "МТС-Банк": Smartphone,
  "ДВ банк": Landmark,
  "Банк «Итуруп»": Mountain,
  "Т-Банк": Zap,
};

function BankIcon({ bank, size = 16 }: { bank: string; size?: number }) {
  const Icon = BANK_ICONS[bank] ?? Building2;
  return (
    <Icon
      size={size}
      strokeWidth={2}
      aria-hidden="true"
      style={{
        color: "#1E3A5F",
        verticalAlign: "middle",
        marginRight: "3px",
        flexShrink: 0,
        width: `${size}px`,
        height: `${size}px`,
      }}
    />
  );
}

/** Тултип ячейки по состоянию (ТЗ, дословные подписи; stale — с
 *  источником и штампом, число при этом рисуется обычным цветом). */
function cellTitle(cell: ApiCell, bank: string): string {
  if (!cell) return "Курс не опубликован";
  if (cell.status === "unpublished") return "Курс не опубликован";
  if (cell.status === "error") return "Не удалось загрузить курс";
  if (cell.status === "stale") {
    const parts = ["Данные устарели", bank];
    if (cell.ts) parts.push(cell.ts);
    if (cell.src) parts.push(cell.src);
    return parts.join(" · ");
  }
  return "";
}

/** Подвал страницы: домены источников серии или «кэш последнего успеха». */
const SOURCE_DOMAINS: Record<string, string> = {
  bankdep: "bankdep.ru",
  mainfin: "mainfin.ru",
  banktop: "banktop.ru",
};

export default function CurrencyScreen() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [rates, setRates] = useState<RatesData>(EMPTY_RATES);

  // Быстрый конвертер: локальное состояние полей
  const [convAmount, setConvAmount] = useState<string>("100");
  const [convCur, setConvCur] = useState<RateKey>("usd");
  const [convOp, setConvOp] = useState<"buy" | "sell">("sell");

  // Общие настройки сайта для шапки и футера (те же, что на форуме)
  useEffect(() => {
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then((r) => {
        if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings });
      })
      .catch(() => {});
  }, []);

  // Курсы касс — тот же пайплайн, что у панели главной
  useEffect(() => {
    fetch("/api/home/rates")
      .then(async (r) => (r.ok ? r.json() : EMPTY_RATES))
      .then((d: RatesData) => setRates(d))
      .catch(() => {});
  }, []);

  // Навигация из синей полосы
  const goNav = (k: string) => {
    window.location.href = NAV_ROUTES[k] ?? "/";
  };

  const hasBankRows = rates.banks.length > 0;
  const best = useMemo(() => computeBestRates(rates.banks), [rates]);

  // Мгновенный расчёт конвертации по лучшему курсу
  const convResult = useMemo(() => {
    const amt = parseFloat(convAmount.replace(",", "."));
    if (!isFinite(amt) || amt <= 0) return null;
    return convertToRub(amt, convCur, convOp, best);
  }, [convAmount, convCur, convOp, best]);

  const convBestBank = best?.[convCur]?.[convOp]?.bank ?? null;
  const convBestValue = best?.[convCur]?.[convOp]?.value ?? null;

  /** Подвал: домены источников свежайшей серии / кэш. */
  const sourcesLabel = (() => {
    const doms = new Set<string>();
    for (const b of rates.banks) {
      for (const c of [b.usd, b.eur, b.cny, b.jpy, b.krw, b.thb]) {
        if (c && c.status === "ok" && c.src && SOURCE_DOMAINS[c.src]) doms.add(SOURCE_DOMAINS[c.src]);
      }
    }
    if (doms.size > 0) return Array.from(doms).join(" · ");
    return rates.source === "cache" ? "кэш последнего успеха" : "";
  })();

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="currency" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div className="sk-topbar">
          <span className="tb-title">Курсы валют</span>
        </div>
        <div className="sk-shell">
          <div className="sk-layout sk-layout-page main-grid-container">
          <ForumSideNav />
          <div className="sk-col-main center-column">
          {/* Подробная компактная таблица курсов с маркерами банков */}
          <div className="sm-stub-home crt-back">Курсы валют</div>

          {hasBankRows ? (
            /* ТЗ 2026-09-23 «Доработка»: table-layout:fixed + colgroup —
               колонка банка 136px + ВСЕ 12 колонок курсов РОВНО по 80px
               (136+960=1096 ≤ 1105): сетка строго симметрична, имена
               банков не обрезаны («Россельхозбанк» — 116px текста
               помещается при шрифте 11.5px).
               2026-10-01 (мобайл): контейнер получает класс .cur-table-wrap
               — на ≤480px CSS переключает overflow:hidden → overflow-x:auto,
               таблица скроллится горизонтально на узких экранах. */
            <div className="cur-table-wrap" style={{ border: "1px solid #1E3A5F", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontFamily: "system-ui, sans-serif" }}>
                <colgroup>
                  <col style={{ width: "136px" }} />
                  {/* 6 валют × 2 (покупка/продажа) = 12 равных колонок по 80px */}
                  {CUR_COLS.map((c) => (
                    <Fragment key={c.key}>
                      <col style={{ width: "80px" }} />
                      <col style={{ width: "80px" }} />
                    </Fragment>
                  ))}
                </colgroup>
                <thead>
                  {/* СТРОКА 1: единая серая шапка; ТЗ 2026-09-23 «Доработка»:
                      русские названия валют убраны, английские коды
                      увеличены 12.5→15px bold; вторая строка — только знак
                      и номинал («за 1000» у JPY/KRW; THB — за 1). */}
                  <tr>
                    <th style={{ backgroundColor: "#D6E4ED", padding: "5px 8px", fontWeight: "bold", fontSize: "13px", color: "#333", borderRight: "1px solid #1E3A5F", textAlign: "center" }}>Банк</th>
                    {CUR_COLS.map((c) => (
                      <th key={c.key} colSpan={2} style={{ backgroundColor: "#D6E4ED", padding: "5px 8px", fontWeight: "bold", fontSize: "15px", color: "#333", borderRight: c.key !== LAST_CUR_KEY ? "1px solid #1E3A5F" : "1px solid #D6E4ED", textAlign: "center" }}>
                        {c.code}<br />
                        <span style={{ fontSize: "10px", fontWeight: "normal", color: "#666" }}>
                          {c.sign}{c.unit ? ` (${c.unit})` : ""}
                        </span>
                      </th>
                    ))}
                  </tr>
                  {/* СТРОКА 2: КУПИМ / ПРОДАДИМ — компактный ряд */}
                  <tr>
                    <th style={{ backgroundColor: "#D6E4ED", borderRight: "1px solid #1E3A5F", borderBottom: "1px solid #1E3A5F", padding: "3px 6px" }}></th>
                    {CUR_COLS.map((c) => (
                      <Fragment key={c.key}>
                        <th style={{ backgroundColor: "#D6E4ED", color: "#2E7D32", fontSize: "9px", fontWeight: "bold", padding: "3px 6px", textAlign: "center", borderBottom: "1px solid #1E3A5F" }}>КУПИМ</th>
                        <th style={{ backgroundColor: "#D6E4ED", color: "#C62828", fontSize: "9px", fontWeight: "bold", padding: "3px 6px", textAlign: "center", borderRight: c.key !== LAST_CUR_KEY ? "1px solid #1E3A5F" : "none", borderBottom: "1px solid #1E3A5F" }}>ПРОДАДИМ</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rates.banks.map((b) => (
                    <tr key={b.bank} style={{ borderBottom: "1px solid #CED4DA" }}>
                      {/* КОЛОНКА БАНКА — ужата по ТЗ: шрифт 11.5, иконка 12,
                          gap 3, паддинг 3px 5px; «Россельхозбанк» целиком */}
                      <td style={{ backgroundColor: "#D6E4ED", color: "#1a2433", fontWeight: 700, padding: "3px 5px", borderRight: "1px solid #1E3A5F", whiteSpace: "nowrap", overflow: "hidden" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", maxWidth: "100%", fontSize: "11.5px", lineHeight: "21px" }}>
                          <BankIcon bank={b.bank} size={12} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{b.bank}</span>
                        </span>
                      </td>
                      {CUR_COLS.map((c) => {
                        const pair = b[c.key];
                        const buyVal = pair?.buy ?? null;
                        const sellVal = pair?.sell ?? null;
                        const buyBest = buyVal != null && best[c.key]?.buy != null && buyVal === best[c.key]!.buy!.value;
                        const sellBest = sellVal != null && best[c.key]?.sell != null && sellVal === best[c.key]!.sell!.value;
                        const buyCell = pair as ApiCell;
                        const sellCell = pair as ApiCell;
                        const buyErr = pair?.status === "error";
                        const sellErr = pair?.status === "error";
                        const buyNone = !buyErr && buyVal == null;
                        const sellNone = !sellErr && sellVal == null;
                        return (
                          <Fragment key={c.key}>
                            {/* КУПИМ: число (ok и stale одинаково — плашки
                                «устарело» упразднены) / «—» / «Ошибка» */}
                            <td
                              title={buyErr ? cellTitle(sellCell, b.bank) : buyNone ? cellTitle(null, b.bank) : cellTitle(buyCell, b.bank)}
                              style={{
                                padding: "3px 4px", textAlign: "center", fontSize: "13px",
                                fontVariantNumeric: "tabular-nums",
                                backgroundColor: buyBest ? "#E2F0D9" : "#FFFFFF",
                                color: buyErr ? "#B3261E" : buyNone ? "#A0AAB0" : buyBest ? "#2E7D32" : "#1a2433",
                                fontWeight: buyVal != null ? 700 : 400,
                              }}
                            >
                              {buyErr ? "Ошибка" : fmtMoney(buyVal)}
                            </td>
                            {/* ПРОДАДИМ: то же + правая граница группы валют */}
                            <td
                              title={sellErr ? cellTitle(sellCell, b.bank) : sellNone ? cellTitle(null, b.bank) : cellTitle(sellCell, b.bank)}
                              style={{
                                padding: "3px 4px", textAlign: "center", fontSize: "13px",
                                fontVariantNumeric: "tabular-nums",
                                borderRight: c.key !== LAST_CUR_KEY ? "1px solid #1E3A5F" : "none",
                                backgroundColor: sellBest ? "#E2F0D9" : "#FFFFFF",
                                color: sellErr ? "#B3261E" : sellNone ? "#A0AAB0" : sellBest ? "#2E7D32" : "#1a2433",
                                fontWeight: sellVal != null ? 700 : 400,
                              }}
                            >
                              {sellErr ? "Ошибка" : fmtMoney(sellVal)}
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="crt-empty">Курсы обновляются…</div>
          )}

          {hasBankRows && (
            <div className="mp-w-upd">
              Наличные курсы касс · обновлено: {rates.updated}
              {sourcesLabel ? ` | ${sourcesLabel}` : ""}
            </div>
          )}

          {/* КАЛЬКУЛЯТОР-КОНВЕРТЕР: шапка-полоса var(--sm-navy) во всю
              ширину блока, белый bold по центру; THB в select (за 1 бат).
              2026-10-01 (мобайл): контейнер .cur-calc — на ≤480px CSS
              сжимает padding/margin/font-size. */}
          <div className="cur-calc" style={{ marginTop: "15px", padding: "12px", backgroundColor: "#D6E4ED", border: "1px solid #1E3A5F" }}>
            <div style={{ margin: "-12px -12px 8px", padding: "8px 12px", backgroundColor: "#1E3A5F", color: "#FFFFFF", fontWeight: "bold", fontSize: "14px", textAlign: "center" }}>Калькулятор-конвертер</div>
            <div style={{ fontSize: "11px", color: "#56657a", marginBottom: "8px" }}>
              Расчёт по лучшему курсу из таблицы выше. JPY и KRW — за 1000 единиц, THB — за 1 бат.
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "stretch" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "3px", flex: "1", minWidth: "100px" }}>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "#56657a", textTransform: "uppercase" }}>Сумма</span>
                <input type="text" inputMode="decimal" value={convAmount} onChange={(e) => setConvAmount(e.target.value)} placeholder="100" style={{ padding: "7px 10px", fontSize: "14px", fontWeight: 600, border: "1px solid #1E3A5F", outline: "none", width: "100%", boxSizing: "border-box", fontVariantNumeric: "tabular-nums", backgroundColor: "#FFFFFF", height: "34px" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "3px", flex: "1", minWidth: "120px" }}>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "#56657a", textTransform: "uppercase" }}>Валюта</span>
                <select value={convCur} onChange={(e) => setConvCur(e.target.value as RateKey)} style={{ padding: "7px 10px", fontSize: "14px", fontWeight: 600, border: "1px solid #1E3A5F", outline: "none", width: "100%", boxSizing: "border-box", backgroundColor: "#FFFFFF", height: "34px" }}>
                  {CUR_COLS.map((c) => (
                    <option key={c.key} value={c.key}>{c.code} — {c.name}{c.unit ? ` (${c.unit})` : c.key === "thb" ? " (за 1 бат)" : ""}</option>
                  ))}
                </select>
              </label>
            </div>
            {/* РАДИО-КНОПКИ */}
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button type="button" onClick={() => setConvOp("sell")} style={{ flex: 1, padding: "7px 10px", fontSize: "13px", fontWeight: "bold", cursor: "pointer", border: "1px solid #1E3A5F", backgroundColor: convOp === "sell" ? "#1E3A5F" : "#E5E7EB", color: convOp === "sell" ? "#FFFFFF" : "#56657a", transition: "all 0.15s ease" }}>Я покупаю валюту</button>
              <button type="button" onClick={() => setConvOp("buy")} style={{ flex: 1, padding: "7px 10px", fontSize: "13px", fontWeight: "bold", cursor: "pointer", border: "1px solid #1E3A5F", backgroundColor: convOp === "buy" ? "#1E3A5F" : "#E5E7EB", color: convOp === "buy" ? "#FFFFFF" : "#56657a", transition: "all 0.15s ease" }}>Я сдаю валюту</button>
            </div>
            {/* ИТОГ */}
            <div style={{ marginTop: "10px", padding: "10px 12px", backgroundColor: "#FFFFFF", border: "1px solid #CED4DA" }}>
              <b style={{ fontSize: "16px", fontWeight: "bold", color: "#2E7D32", fontVariantNumeric: "tabular-nums" }}>
                {convResult !== null && convBestBank
                  ? `Итого: ${convResult.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} руб. в ${convBestBank}`
                  : "Итого: — руб. (нет актуального курса)"}
              </b>
              {convBestValue !== null && (
                <div style={{ fontSize: "12px", color: "#56657a", marginTop: "4px" }}>
                  Лучший курс: {fmtMoney(convBestValue)} ₽{convCur === "jpy" || convCur === "krw" ? " за 1000" : ""}
                </div>
              )}
            </div>
          </div>

          {/* «Отделения и кассы банков» — единый фирменный стиль (шапка-
              полоса #1E3A5F, подложка #D6E4ED, острые углы). ТЗ 2026-09-23
              «Доработка»: состав = ВСЕ 15 банков таблицы (девятка —
              реальные адреса/телефоны ЮС; Т-Банку — честный онлайн-статус).
              2026-10-01 (мобайл): контейнер .cur-branches — на ≤480px CSS
              сжимает padding/margin, строки становятся вертикально компактнее. */}
          <div className="cur-branches" style={{ marginTop: "15px", padding: "12px", backgroundColor: "#D6E4ED", border: "1px solid #1E3A5F" }}>
            <div style={{ margin: "-12px -12px 8px", padding: "8px 12px", backgroundColor: "#1E3A5F", color: "#FFFFFF", fontWeight: "bold", fontSize: "14px", textAlign: "center" }}>Отделения и кассы банков</div>
            {BANK_BRANCHES.map((b, i) => (
              <div key={b.bank} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "5px 0", borderBottom: i < BANK_BRANCHES.length - 1 ? "1px solid #CED4DA" : "none" }}>
                {/* Слева: иконка + название банка */}
                <div style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: "118px", flexShrink: 0 }}>
                  <BankIcon bank={b.bank} size={12} />
                  <b style={{ fontSize: "12px", color: "#1a2433", whiteSpace: "nowrap" }}>{b.bank}</b>
                </div>
                {/* По центру: адрес */}
                <div style={{ fontSize: "12px", color: "#56657a", flex: "1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.addr}</div>
                {/* Справа: телефоны */}
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  {b.tels.map((t) => (
                    <a key={t.href} href={t.href} style={{ display: "inline-block", background: "#eef4fa", border: "1px solid #d3e2f0", padding: "3px 7px", fontSize: "12px", fontWeight: "bold", color: "#0a5caa", textDecoration: "none", whiteSpace: "nowrap" }}>{t.label}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          </div>
          <HomeRight />
          </div>
        </div>
        <SiteFooter settings={settings} />
      </div>
    </div>
  );
}
