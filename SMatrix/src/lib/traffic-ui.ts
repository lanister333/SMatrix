/**
 * Задача 13: чистые хелперы панели «Пробки» (без sharp — безопасны для
 * клиентского бандла). Используются информером главной (home-right.tsx),
 * серверным адаптером lib/traffic.ts и тестами scripts/test-informers.ts.
 */

/** Ярлыки ТЗ (примеры пользователя: «🟢 3 балла — Дороги свободны»,
 *  «🔴 7 баллов — Город стоит»). */
export const TRAFFIC_LABELS = ["Дороги свободны", "Движение затруднено", "Город стоит"] as const;

export function levelLabel(level: number): string {
  if (level <= 3) return "Дороги свободны";
  if (level <= 6) return "Движение затруднено";
  return "Город стоит";
}

/** Цвет-эмодзи состояния: 🟢 свободно (1-3) · 🟡 затруднено (4-6) · 🔴 город стоит (7-10). */
export function trafficEmoji(level: number): string {
  return level <= 3 ? "🟢" : level <= 6 ? "🟡" : "🔴";
}

/** балл/балла/баллов — «1 балл», «3 балла», «5 баллов», «7 баллов». */
export function ballPlural(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "балл";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "балла";
  return "баллов";
}
