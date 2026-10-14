import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAuthToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

/**
 * Восстановление пароля — двухшаговый flow с проверкой секретного вопроса.
 *
 * Шаг 1: POST {email} → вернуть {secretQuestion: "..."} (без токена!)
 *   Пользователь видит свой секретный вопрос и должен ввести ответ.
 *
 * Шаг 2: POST {email, secretAnswer} → проверить ответ:
 *   - Если верно → вернуть {resetPath: "/?reset=..."} (токен для смены пароля)
 *   - Если неверно → 400 "Неверный ответ на секретный вопрос"
 *
 * 2026-10-14: добавлена проверка секретного вопроса (раньше токен выдавался
 * сразу по email — небезопасно, любой знающий email мог сбросить пароль).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const secretAnswer = String(body.secretAnswer ?? "").trim().toLowerCase();

    const user = await db.user
      .findUnique({ where: { email } })
      .catch(() => null);

    if (!user) {
      return NextResponse.json({ error: "Пользователь с таким email не найден" }, { status: 404 });
    }

    // Шаг 1: если secretAnswer не передан — вернуть секретный вопрос
    if (!secretAnswer) {
      return NextResponse.json({
        ok: true,
        step: "question",
        secretQuestion: user.secretQuestion || "Секретный вопрос не задан",
        hint: user.secretQuestion ? "Введите ответ на ваш секретный вопрос" : "Обратитесь к администратору",
      });
    }

    // Шаг 2: проверить секретный ответ
    if (!user.secretAnswer) {
      return NextResponse.json({ error: "Секретный вопрос не задан. Обратитесь к администратору." }, { status: 400 });
    }
    if (user.secretAnswer.toLowerCase() !== secretAnswer) {
      return NextResponse.json({ error: "Неверный ответ на секретный вопрос" }, { status: 400 });
    }

    // Ответ верный — создаём токен для сброса пароля
    const token = await createAuthToken(user.id, "reset");
    // Демо-режим без почтового шлюза: ссылка возвращается напрямую (кроме сотрудников).
    return NextResponse.json({
      ok: true,
      step: "reset",
      resetPath:
        user.role === "owner" || user.role === "admin" || user.role === "moderator"
          ? "ok"
          : `/?reset=${encodeURIComponent(token)}`,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
