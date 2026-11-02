/**
 * ТЗ 2026-09-22 Flat 2.0 (реставрация 2026-09-23): СМС-верификация
 * публикации на народных досках («Знакомства», «Объявления»).
 *
 * Шлюз СМС в сборке нет — ДЕМО-РЕЖИМ (задокументированная импровизация
 * ТЗ): код генерируется, хранится в памяти процесса (TTL 10 минут) и
 * возвращается клиенту полем devCode; форма показывает его с пометкой
 * о демо-режиме. При подключении реального шлюза заменить sendCode —
 * контракт verify не меняется.
 */

interface SmsEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

const g = globalThis as unknown as { __smsCodes?: Map<string, SmsEntry> };
const store: Map<string, SmsEntry> = (g.__smsCodes ??= new Map());

const CODE_TTL_MS = 10 * 60 * 1000; // код живёт 10 минут
const MAX_ATTEMPTS = 5; // защита от перебора

/** Нормализация номера: только цифры, 11 знаков (7XXXXXXXXXX). */
export function normalizePhone(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) return `7${digits.slice(1)}`;
  return digits;
}

/** Выпуск кода: генерирует 4 цифры, пишет в память, возвращает код.
 *  Повторный запрос на тот же номер перезаписывает код. */
export function issueSmsCode(phone: string): { phone: string; code: string } {
  const norm = normalizePhone(phone);
  const code = String(Math.floor(1000 + Math.random() * 9000));
  store.set(norm, { code, expiresAt: Date.now() + CODE_TTL_MS, attempts: 0 });
  return { phone: norm, code };
}

/** Проверка кода: номер+код совпадают, не истёк, не израсходованы
 *  попытки. Каждая неверная попытка съедает одну из пяти. */
export function verifySmsCode(phone: string, code: string): { ok: boolean; error?: string } {
  const norm = normalizePhone(phone);
  const entry = store.get(norm);
  if (!entry) return { ok: false, error: "Код не запрашивался — запросите код подтверждения." };
  if (Date.now() > entry.expiresAt) {
    store.delete(norm);
    return { ok: false, error: "Код истёк — запросите новый." };
  }
  if (String(code ?? "").trim() !== entry.code) {
    entry.attempts += 1;
    if (entry.attempts >= MAX_ATTEMPTS) {
      store.delete(norm);
      return { ok: false, error: "Слишком много неверных попыток — запросите новый код." };
    }
    return { ok: false, error: "Код указан неверно — проверьте СМС и попробуйте ещё раз." };
  }
  store.delete(norm); // код одноразовый
  return { ok: true };
}
