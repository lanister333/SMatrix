import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isOwnerRole, logAdminAction } from "@/lib/admin";

export const runtime = "nodejs";

/** Ключи настроек, доступные для изменения (всё остальное игнорируется). */
const EDITABLE_KEYS = [
  "siteSlogan",
  "siteSubtitle",
  "siteDescription",
  "footerNote",
  "registrationEnabled",
  "newTopicsEnabled",
  /// ПРОМТ №2: теневой режим AI — ИИ предлагает решение, но НЕ блокирует
  /// автоматически. После проверки качества админ отключает shadow mode.
  "aiShadowMode",
  /// ПРОМТ №2: включить/выключить AI-кэш по text-hash (cost protection).
  "aiCacheEnabled",
  /// 2026-11-10: «срочная бегущая строка» наверху сайта — включается
  /// вручную из админки при необходимости (аварии, экстренные оповещения).
  "urgentBannerEnabled",
  "urgentBannerText",
  /// 2026-11-11: отключаемые блоки-виджеты (по требованию админа).
  /// «Оперативные дорожные события» на /traffic.php и
  /// «Оперативная обстановка на перевалах» на /weather.php.
  "trafficEventsEnabled",
  "passesSituationEnabled",
] as const;

const DEFAULTS: Record<string, string> = {
  siteSlogan: "Спроси у города — город ответит.",
  siteSubtitle: "Сахалинская матрица взаимопомощи",
  siteDescription: "Открытый форум Сахалина,\nгде каждый становится частью живого сообщества.\nДавайте сделаем жизнь на острове лучше вместе.",
  footerNote: "",
  registrationEnabled: "1",
  newTopicsEnabled: "1",
  /// ПРОМТ №2: по умолчанию shadow mode ВКЛЮЧЁН — Админ проверяет качество,
  /// потом отключает (значение "0" = обычный режим с автоматическими действиями).
  aiShadowMode: "1",
  aiCacheEnabled: "1",
  urgentBannerEnabled: "0",
  urgentBannerText: "",
  trafficEventsEnabled: "1",
  passesSituationEnabled: "1",
};

const LABELS: Record<string, string> = {
  siteSlogan: "слоган в шапке",
  siteSubtitle: "подзаголовок в шапке",
  siteDescription: "описание проекта в шапке",
  footerNote: "подпись в подвале",
  registrationEnabled: "регистрация",
  newTopicsEnabled: "создание тем",
  aiShadowMode: "AI-теневой режим",
  aiCacheEnabled: "AI-кэш вердиктов",
  urgentBannerEnabled: "срочная строка (вкл/выкл)",
  urgentBannerText: "текст срочной строки",
  trafficEventsEnabled: "блок «Оперативные дорожные события» (/traffic)",
  passesSituationEnabled: "блок «Обстановка на перевалах» (/weather)",
};

/**
 * ШАГ 12. Настройки сайта — только Главный администратор / Владелец.
 * GET  — текущие значения.
 * POST — сохранить (регистрация и создание тем: "1" включено, "0" приостановлено).
 */
export async function GET(req: NextRequest) {
  try {
    const staff = await userByToken(req.nextUrl.searchParams.get("token"));
    if (!staff) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    if (!isOwnerRole(staff.role)) {
      return NextResponse.json({ error: "Настройки сайта доступны только Главному администратору (Владельцу)" }, { status: 403 });
    }
    const rows = await db.siteSetting.findMany();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const settings = Object.fromEntries(EDITABLE_KEYS.map((k) => [k, map[k] ?? DEFAULTS[k] ?? ""]));
    return NextResponse.json({ settings });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const staff = await userByToken(body.token);
    if (!staff) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    if (!isOwnerRole(staff.role)) {
      return NextResponse.json({ error: "Настройки сайта доступны только Главному администратору (Владельцу)" }, { status: 403 });
    }

    const incoming = (body.settings ?? {}) as Record<string, unknown>;
    const changed: string[] = [];

    for (const key of EDITABLE_KEYS) {
      if (!(key in incoming)) continue;
      let value = String(incoming[key] ?? "").slice(0, 2000);
      if (
        key === "registrationEnabled" ||
        key === "newTopicsEnabled" ||
        key === "aiShadowMode" ||
        key === "aiCacheEnabled" ||
        key === "urgentBannerEnabled" ||
        key === "trafficEventsEnabled" ||
        key === "passesSituationEnabled"
      ) {
        value = value === "0" || value === "false" ? "0" : "1";
      }
      if (key === "urgentBannerText") {
        value = value.slice(0, 500);
      }
      const current = await db.siteSetting.findUnique({ where: { key } });
      if (!current || current.value !== value) {
        await db.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
        changed.push(LABELS[key] ?? key);
      }
    }

    if (changed.length > 0) {
      await logAdminAction({
        actor: staff.nickname,
        actorRole: staff.role,
        action: "settings.save",
        targetType: "setting",
        targetLabel: "настройки сайта",
        details: `изменено: ${changed.join(", ")}`,
      });
    }

    const rows = await db.siteSetting.findMany();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const settings = Object.fromEntries(EDITABLE_KEYS.map((k) => [k, map[k] ?? DEFAULTS[k] ?? ""]));
    return NextResponse.json({
      ok: true,
      note: changed.length > 0 ? `Сохранено: ${changed.join(", ")}` : "Изменений нет",
      settings,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
