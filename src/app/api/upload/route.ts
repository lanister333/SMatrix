/**
 * /api/upload — загрузка изображений для сообщений форума и спецразделов.
 *
 * POST /api/upload?token=<session_token>
 * Body: multipart/form-data, поле "file" — изображение (jpg/png/webp/gif)
 *
 * Лимиты (2026-11-03):
 *   - Только для авторизованных пользователей (token обязателен)
 *   - Размер файла: до 5 МБ
 *   - Типы: image/jpeg, image/png, image/webp, image/gif
 *   - Авто-resize до 1920px по длинной стороне (через sharp)
 *   - Сохранение в /public/media/uploads/<yyyy>/<mm>/<random>.<ext>
 *   - Возвращает { url: "/media/uploads/...", alt: "" }
 *
 * Создан 2026-11-03.
 */

import { NextRequest, NextResponse } from "next/server";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 МБ
const MAX_DIMENSION = 1920; // px по длинной стороне
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: NextRequest) {
  try {
    // 1. Авторизация — только зарегистрированные могут загружать фото
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? undefined;
    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json(
        { error: "Только зарегистрированные пользователи могут загружать фото. Войдите в аккаунт." },
        { status: 401 }
      );
    }

    // 2. Парсим multipart
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Ожидается multipart/form-data" }, { status: 400 });
    }
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Файл не передан (поле file)" }, { status: 400 });
    }

    // 3. Проверяем тип
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Тип файла не поддерживается: ${file.type}. Разрешены: jpg, png, webp, gif.` },
        { status: 400 }
      );
    }

    // 4. Проверяем размер
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Файл слишком большой: ${(file.size / 1024 / 1024).toFixed(1)} МБ. Максимум 5 МБ.` },
        { status: 400 }
      );
    }

    // 5. Читаем буфер
    const buffer = Buffer.from(await file.arrayBuffer());

    // 6. Resize через sharp (до 1920px по длинной стороне, сохраняя пропорции)
    // GIF не резайзится (sharp не поддерживает анимированный gif хорошо) — сохраняем как есть
    let processedBuffer: Buffer;
    if (file.type === "image/gif") {
      processedBuffer = buffer;
    } else {
      const image = sharp(buffer, { failOn: "none" });
      const meta = await image.metadata();
      const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
      if (longest > MAX_DIMENSION) {
        processedBuffer = await image
          .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
          .toFormat(meta.format ?? "jpeg", { quality: 85 })
          .toBuffer();
      } else {
        // Если меньше 1920 — конвертируем в тот же формат с quality 85 (сжимаем)
        processedBuffer = await image
          .toFormat(meta.format ?? "jpeg", { quality: 85 })
          .toBuffer();
      }
    }

    // 7. Сохраняем в /public/media/uploads/<yyyy>/<mm>/<random>.<ext>
    const now = new Date();
    const yyyy = now.getFullYear().toString();
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const relDir = path.join("media", "uploads", yyyy, mm);
    const absDir = path.join(process.cwd(), "public", relDir);
    await fs.mkdir(absDir, { recursive: true });

    const ext = EXT_BY_TYPE[file.type] ?? "jpg";
    const rand = crypto.randomBytes(8).toString("hex");
    const filename = `${rand}.${ext}`;
    const relPath = path.join(relDir, filename);
    const absPath = path.join(process.cwd(), "public", relPath);

    await fs.writeFile(absPath, processedBuffer);

    // 8. Возвращаем URL (относительный, чтобы работал и на http и на https)
    const fileUrl = "/" + relPath.split(path.sep).join("/");
    const alt = file.name.replace(/\.[^.]+$/, "").slice(0, 50) || "фото";

    return NextResponse.json({ ok: true, url: fileUrl, alt, size: processedBuffer.length });
  } catch (e) {
    return handleApiError(e);
  }
}

// GET — заглушка для проверки доступности
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/upload",
    method: "POST",
    limits: { maxSize: "5MB", types: ["jpg", "png", "webp", "gif"], maxDimension: "1920px" },
  });
}
