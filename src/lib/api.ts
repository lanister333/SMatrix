import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";

export function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export function handleApiError(e: unknown) {
  if (e instanceof AuthError) return jsonError(e.message, e.status);
  const message = e instanceof Error ? e.message : "Внутренняя ошибка";
  console.error("[api]", message);
  return jsonError(message, 500);
}

/** Ограничение частоты записи в памяти (простая защита от флуда запросов). */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count++;
  return b.count <= limit;
}
