import { NextRequest, NextResponse } from "next/server";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import { restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction } from "@/lib/moderation/sanctions";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * 2026-11-08: загрузка фотографий к сообщениям форума.
 *
 * Принимает FormData с полем "file" + token в query (?token=...).
 * Сохраняет файл в public/media/uploads/YYYY/MM/<hash>.<ext>
 * Возвращает { url: "/media/uploads/YYYY/MM/<hash>.<ext>" }
 *
 * Ограничения:
 *   - Только залогиненные пользователи (token → user)
 *   - Без активных ограничений аккаунта
 *   - Типы: image/jpeg, image/png, image/webp, image/gif
 *   - Размер: макс. 5MB
 *   - Rate-limit: 20 загрузок в час с одного IP
 */

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: NextRequest) {
  try {
    // 1. Token → user
    const token = req.nextUrl.searchParams.get("token") || "";
    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json(
        { error: "Чтобы загружать фото, войдите или зарегистрируйтесь" },
        { status: 401 }
      );
    }

    // 2. Активное ограничение аккаунта
    const restriction = await getActiveRestriction(user.id);
    if (restriction) {
      return NextResponse.json(
        { error: restrictionBlockMessage(restriction), restricted: true, restriction },
        { status: 403 }
      );
    }

    // 3. Rate-limit: 20 загрузок в час с одного IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`upload:${ip}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Слишком много загрузок. Попробуйте позже." },
        { status: 429 }
      );
    }

    // 4. Извлечь файл из FormData
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Файл не найден в запросе" },
        { status: 400 }
      );
    }

    // 5. Проверить тип
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Допустимые форматы: JPEG, PNG, WebP, GIF" },
        { status: 400 }
      );
    }

    // 6. Проверить размер
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Максимальный размер файла — 5MB" },
        { status: 400 }
      );
    }

    // 7. Генерировать имя файла и путь
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const hash = crypto.randomBytes(16).toString("hex");
    const filename = `${hash}.${ext}`;
    const relPath = `/media/uploads/${year}/${month}/${filename}`;

    // 8. Сохранить файл
    // 2026-11-08: process.cwd() на проде возвращает /root (не WorkingDirectory
    // из systemd). Используем абсолютный путь через env UPLOAD_DIR или fallback
    // на /opt/smatrix/.next/standalone/public (стандартный путь на проде).
    // Также копируем в /opt/smatrix/public (для следующего билда).
    const baseDir = process.env.UPLOAD_DIR || "/opt/smatrix/.next/standalone/public";
    const yearStr = String(year);
    const uploadDir = join(baseDir, "media", "uploads", yearStr, month);
    await mkdir(uploadDir, { recursive: true });
    const absPath = join(uploadDir, filename);
    const arrayBuffer = await file.arrayBuffer();
    await writeFile(absPath, Buffer.from(arrayBuffer));

    // Также сохранить в /opt/smatrix/public (для следующего deploy через
    // cp -r public .next/standalone/ — чтобы файл пережил ребилд)
    try {
      const srcDir = "/opt/smatrix/public/media/uploads";
      const srcPath = join(srcDir, yearStr, month, filename);
      await mkdir(join(srcDir, yearStr, month), { recursive: true });
      await writeFile(srcPath, Buffer.from(arrayBuffer));
    } catch {} // не критично если не скопировалось

    return NextResponse.json({ url: relPath });
  } catch (e) {
    return handleApiError(e);
  }
}
