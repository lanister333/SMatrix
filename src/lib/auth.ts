import crypto from "crypto";
import { db } from "@/lib/db";

/** Хэш пароля: scrypt, формат «salt:hash» (совместимо с scripts/seed.js). */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const test = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(test, "hex"));
  } catch {
    return false;
  }
}

export function newToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export interface SafeUser {
  id: string;
  nickname: string;
  email: string;
  gender: string;
  role: string;
  emailVerified: boolean;
  /** ШАГ 19: подтверждённый представитель организации (устанавливает только админ). */
  orgRep: boolean;
  /** ШАГ 19: название организации представителя. */
  orgName: string;
  token?: string;
}

export function toSafeUser(u: {
  id: string;
  nickname: string;
  email: string;
  gender: string;
  role: string;
  emailVerified: boolean;
  orgRep?: boolean;
  orgName?: string;
}): SafeUser {
  return {
    id: u.id,
    nickname: u.nickname,
    email: u.email,
    gender: u.gender,
    role: u.role,
    emailVerified: u.emailVerified,
    orgRep: !!u.orgRep,
    orgName: u.orgName ?? "",
  };
}

/** Найти пользователя по токену сессии. */
export async function userByToken(token?: string | null): Promise<SafeUser | null> {
  if (!token || token.length < 8) return null;
  const session = await db.session.findUnique({ where: { token }, include: { user: true } });
  if (!session) return null;
  return toSafeUser(session.user);
}

export async function requireUser(token?: string | null): Promise<SafeUser> {
  const u = await userByToken(token);
  if (!u) throw new AuthError("Требуется вход на форум");
  return u;
}

export async function requireAdmin(token?: string | null): Promise<SafeUser> {
  const u = await requireUser(token);
  if (u.role !== "admin") throw new AuthError("Доступно только администратору", 403);
  return u;
}

export async function createSession(userId: string): Promise<string> {
  const token = newToken();
  await db.session.create({ data: { token, userId } });
  return token;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Текстовая CAPTCHA — нужно написать N-ное слово из списка.
 * 2026-10-14: заменена простая арифметика (легко брутилась скриптом) на
 * текстовый вопрос: "Напишите третье слово: небо солнце море дождь".
 * Ответ проверяется case-insensitive с trim().
 */
const CAPTCHA_WORDS = [
  "небо", "солнце", "море", "дождь", "снег", "ветер", "облако", "звезда",
  "сахалин", "южный", "корсаков", "холмск", "остров", "сопки", "туман",
  "корабль", "маяк", "прибой", "волна", "берег", "рыбак", "сеть",
  "зима", "лето", "весна", "осень", "утро", "вечер", "ночь", "день",
  "дом", "улица", "дорога", "мост", "парк", "сад", "лес", "поле",
];

const CAPTCHA_ORDINALS = ["первое", "второе", "третье", "четвёртое", "пятое", "шестое"];

export async function createCaptcha(): Promise<{ id: string; question: string }> {
  // Выбираем 4-6 случайных слов (без повторов)
  const count = 4 + Math.floor(Math.random() * 3); // 4..6
  const shuffled = [...CAPTCHA_WORDS].sort(() => Math.random() - 0.5);
  const words = shuffled.slice(0, count);
  // Выбираем случайный индекс (0..count-1)
  const idx = Math.floor(Math.random() * count);
  const ordinal = CAPTCHA_ORDINALS[idx];
  const question = `Напишите ${ordinal} слово: ${words.join(" ")}`;
  const answer = words[idx];
  const row = await db.captcha.create({
    data: { answer: answer.toLowerCase(), expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
  return { id: row.id, question };
}

export async function checkCaptcha(id: string, answer: string): Promise<boolean> {
  if (!id || !answer.trim()) return false;
  const row = await db.captcha.findUnique({ where: { id } }).catch(() => null);
  if (!row) return false;
  await db.captcha.delete({ where: { id } }).catch(() => {});
  if (row.expiresAt.getTime() < Date.now()) return false;
  // 2026-10-14: case-insensitive сравнение (toLowerCase + trim)
  return row.answer.toLowerCase() === answer.trim().toLowerCase();
}

/** Токены email-подтверждения / сброса пароля (демо-режим без почтового шлюза). */
export async function createAuthToken(userId: string, purpose: "verify" | "reset"): Promise<string> {
  const token = newToken();
  await db.authToken.create({
    data: { token, userId, purpose, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  return token;
}

export async function consumeAuthToken(
  token: string,
  purpose: "verify" | "reset"
): Promise<{ userId: string } | null> {
  if (!token) return null;
  const row = await db.authToken.findUnique({ where: { token } }).catch(() => null);
  if (!row || row.purpose !== purpose || row.expiresAt.getTime() < Date.now()) return null;
  await db.authToken.delete({ where: { token } }).catch(() => {});
  return { userId: row.userId };
}
