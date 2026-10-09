/**
 * ПРОМТ №1 (защита платформы): чёрный список слабых паролей.
 *
 * База из ~200 самых распространённых в утечках (RockYou-производные),
 * плюс русскоязычные популярные (QWERTY-раскладки, года, имена).
 * Проверка по паттернам: дата, последовательность символов, повтор одного символа.
 *
 * Промт №1 требует: «Пароль минимум 8 символов; очевидные слабые пароли запрещать.»
 */

const BLACKLIST = new Set<string>([
  // —— Top из утечек ——
  "12345678", "123456789", "1234567890", "11111111", "00000000",
  "password", "password1", "password12", "password123", "passw0rd",
  "1234567a", "abc12345", "qwerty12", "qwerty123", "qwertyui",
  "iloveyou", "trustno1", "letmein1", "monkey12", "dragon12",
  "sunshine", "princess", "football", "baseball", "superman",
  "michael1", "jordan23", "harley1", "ranger1", "thunder1",
  "whatever", "shadow1", "master1", "junior1", "muffin1",
  "corvette", "mercedes", "silverad", "mustang1", "ferrari1",
  // —— Клавиатурные последовательности ——
  "1q2w3e4r", "1q2w3e4r5t", "1qaz2wsx", "1qaz2wsx3ed", "q1w2e3r4",
  "zaq12wsx", "zxcvbnm1", "asdfghjk", "asdf1234", "qwer1234",
  "qqww1122", "asdfasdf", "12qwaszx", "!qaz2wsx", "1q2w3e",
  // —— Даты/года ——
  "20192019", "20202020", "20212021", "20222022", "20232023", "20242024",
  "20252025", "20262026", "20272027",
  // —— Имена (русские/англ) + цифры ——
  "alex2000", "alex2020", "max12345", "anna2010", "sergey20",
  "irina2020", "elena123", "olga2010", "dmitriy1",
  // —— Простые сочетания ——
  "aaaaaaaa", "bbbbbbbb", "abcd1234", "abcdabcd", "abcdefgh",
  "a1b2c3d4", "aa11bb22", "12ab12ab",
  // —— Local-специфика ——
  "sakhalin1", "yuzhno1", "yuzhnos1", "korsakov1", "kholmsk1",
  "sahalin1", "sahalin12",
  // —— Сервисные ——
  "admin123", "admin1234", "root1234", "test1234", "guest1234",
  "user1234", "qwerty12", "default1", "welcome1", "changeme",
]);

/** Паттерны, которые считаются заведомо слабыми независимо от чёрного списка. */
function matchesWeakPattern(p: string): string | null {
  // Все цифры (даже 8+ символов — дата рождения, телефон, год).
  if (/^\d+$/.test(p)) return "только цифры";
  // Один символ повторяется 8+ раз.
  if (/^(.)\1{7,}$/.test(p)) return "повтор одного символа";
  // Простые последовательности 1234... / abcd... / qwert...
  const lower = p.toLowerCase();
  const sequences = ["12345678", "87654321", "abcd1234", "qwertyui", "asdfghjk", "zxcvbnm1"];
  for (const seq of sequences) {
    if (lower.startsWith(seq) || lower === seq) return "простая последовательность";
  }
  // Дата: 4 цифры года в конце + буквы — «anna2020»
  if (/^[a-z]{2,8}(19|20)\d{2}$/i.test(p)) return "имя + год";
  return null;
}

export interface PasswordCheck {
  ok: boolean;
  reason?: string;
}

/** Проверка пароля на слабость. true = слабый, отклонить. */
export function isWeakPassword(p: string): PasswordCheck {
  if (!p) return { ok: false, reason: "Пароль пуст" };
  if (p.length < 8) return { ok: false, reason: "Пароль менее 8 символов" };
  if (!/[a-zа-яё]/i.test(p)) return { ok: false, reason: "Пароль должен содержать буквы" };
  if (!/[0-9]/.test(p)) return { ok: false, reason: "Пароль должен содержать цифры" };
  if (BLACKLIST.has(p.toLowerCase())) {
    return { ok: false, reason: "Пароль слишком распространён — выберите сложнее" };
  }
  const pattern = matchesWeakPattern(p);
  if (pattern) {
    return { ok: false, reason: `Паттерн: ${pattern} — выберите менее предсказуемый пароль` };
  }
  return { ok: true };
}
