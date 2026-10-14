/**
 * Отправка email через Resend API.
 * 2026-10-14: настроен для демо-режима (onboarding@resend.dev).
 * После подключения домена sakhmatrix.ru → сменить RESEND_FROM на noreply@sakhmatrix.ru.
 */

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "");
const FROM = process.env.RESEND_FROM || "onboarding@resend.dev";
const SELF_URL = process.env.SELF_URL || "http://81.177.49.189";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

// 2026-10-14: в бесплатном режиме Resend письма отправляются только на email владельца.
// Все письма (подтверждение, сброс пароля) приходят на suerowich@gmail.com.
const TEST_EMAIL = "suerowich@gmail.com";

export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: TEST_EMAIL,  // всегда на email владельца (бесплатный режим Resend)
      subject: `[${opts.to}] ${opts.subject}`,
      html: opts.html,
    });
    if (error) {
      console.error("[email] Resend error:", error);
      return false;
    }
    console.log("[email] Sent:", data?.id || "ok", "→", opts.to);
    return true;
  } catch (e) {
    console.error("[email] sendEmail error:", e);
    return false;
  }
}

/**
 * Отправка письма с подтверждением email при регистрации.
 */
export async function sendVerificationEmail(email: string, verifyPath: string): Promise<boolean> {
  const verifyUrl = `${SELF_URL}${verifyPath}`;
  return sendEmail({
    to: email,
    subject: "SakhMatrix — подтверждение email",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1E3A5F;">SakhMatrix</h2>
        <p>Здравствуйте!</p>
        <p>Для подтверждения email-адреса нажмите на кнопку:</p>
        <p style="margin: 20px 0;">
          <a href="${verifyUrl}" style="display: inline-block; padding: 12px 28px; background: #1E3A5F; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Подтвердить email
          </a>
        </p>
        <p style="color: #666; font-size: 13px;">Или скопируйте ссылку: ${verifyUrl}</p>
        <p style="color: #999; font-size: 12px;">Ссылка действительна 1 час. Если вы не регистрировались — проигнорируйте это письмо.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">SakhMatrix — Сахалинская матрица взаимопомощи</p>
      </div>
    `,
  });
}

/**
 * Отправка письма со ссылкой сброса пароля.
 */
export async function sendPasswordResetEmail(email: string, resetPath: string): Promise<boolean> {
  const resetUrl = `${SELF_URL}${resetPath}`;
  return sendEmail({
    to: email,
    subject: "SakhMatrix — восстановление пароля",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1E3A5F;">SakhMatrix</h2>
        <p>Здравствуйте!</p>
        <p>Для сброса пароля нажмите на кнопку:</p>
        <p style="margin: 20px 0;">
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 28px; background: #1E3A5F; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Сбросить пароль
          </a>
        </p>
        <p style="color: #666; font-size: 13px;">Или скопируйте ссылку: ${resetUrl}</p>
        <p style="color: #999; font-size: 12px;">Ссылка действительна 1 час. Если вы не запрашивали сброс пароля — проигнорируйте это письмо.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">SakhMatrix — Сахалинская матрица взаимопомощи</p>
      </div>
    `,
  });
}
