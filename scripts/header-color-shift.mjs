/**
 * Раунд 2026-09-22 «цветокоррекция шапки и логотипа»:
 *  1) шапка (Masthead, chrome.tsx) — «немного светлее»: три стопа бирюзового
 *     градиента поднимаются по светлоте ~на 4-5 пунктов (прошлый раунд
 *     «шапку сделай светлее» поднимал на 8-9; «немного» — вдвое меньше),
 *     тон и насыщенность сохраняются;
 *  2) логотип, вторая половина «Matrix» (.sm-masthead-matrix, globals.css)
 *     — «синий чуть ярче»: светлота +5 пунктов, насыщенность +3 (vivid),
 *     тон сохранён. Только селектор логотипа — общий синий ссылок #0a5caa
 *     не трогается.
 * Скрипт печатает старые/новые HEX и HSL для документации в коде.
 */
function hexToHsl(hex) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r, g, b] = hp >= 0 && hp < 1 ? [c, x, 0]
    : hp >= 1 && hp < 2 ? [x, c, 0]
    : hp >= 2 && hp < 3 ? [0, c, x]
    : hp >= 3 && hp < 4 ? [0, x, c]
    : hp >= 4 && hp < 5 ? [x, 0, c]
    : [c, 0, x];
  const m = l - c / 2;
  const to = (v) => Math.round((v + m) * 255)
    .toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}
const shift = (hex, dL, dS) => {
  const { h, s, l } = hexToHsl(hex);
  const ns = Math.min(100, s + (dS || 0));
  const nl = Math.min(100, l + dL);
  const out = hslToHex(h, ns, nl);
  const a = hexToHsl(hex), b = hexToHsl(out);
  console.log(
    `${hex} (H${a.h.toFixed(1)} S${a.s.toFixed(1)} L${a.l.toFixed(1)})` +
    ` -> ${out} (H${b.h.toFixed(1)} S${b.s.toFixed(1)} L${b.l.toFixed(1)})` +
    `  [dL=${dL} dS=${dS || 0}]`
  );
  return out;
};
console.log("— Шапка: «немного светлее» (dL≈+4..5, тон/насыщенность сохранены):");
const t1 = shift("#14b09d", 4.6);
const t2 = shift("#0d8476", 4.6);
const t3 = shift("#085951", 4.9);
console.log(`Градиент: linear-gradient(150deg,${t1} 0%,${t2} 46%,${t3} 100%)`);
console.log("— Логотип «Matrix»: «синий чуть ярче» (dL=+5, dS=+3):");
shift("#0a5caa", 5, 3);
