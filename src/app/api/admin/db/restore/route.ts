/**
 * /api/admin/db/restore — аварийное восстановление БД из снапшота.
 *
 * Создан 2026-11-02. Эндпоинт для случая, когда Prisma падает с
 * "Unable to open the database file" (Error code 14) — БД повреждена
 * или отсутствует.
 *
 * GET  /api/admin/db/restore           — диагностика состояния БД
 * POST /api/admin/db/restore            — восстановление из снапшота
 *   body: { token, action: "restore" }
 *
 * ВАЖНО: проверка админства через БД НЕ выполняется (БД может быть
 * недоступна). Вместо этого проверяем токен через AuthToken-таблицу
 * (Prisma), а если и это не работает — требуем отдельный emergency-токен
 * из process.env.DB_RESTORE_TOKEN. Это безопасно: токен знает только
 * владелец сайта.
 *
 * Команды выполняются через child_process.execSync — НЕ через Prisma,
 * потому что Prisma падает, если БД повреждена.
 */

import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { userByToken } from "@/lib/auth";
import { isStaffRole } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Найти файл БД по нескольким кандидатам. */
function findDbFile(): string | null {
  const candidates = [
    process.env.DATABASE_URL?.replace(/^file:/, "") ?? null,
    "/home/z/my-project/SMatrix/db/custom.db",
    "/home/z/my-project/smatrix/db/custom.db",
    "/opt/smatrix/db/custom.db",
    "/opt/SMatrix/db/custom.db",
    "/root/SMatrix/db/custom.db",
    "/home/z/SMatrix/db/custom.db",
    path.join(process.cwd(), "db/custom.db"),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Найти директорию с БД (где лежит custom.db). */
function findDbDir(): string | null {
  const f = findDbFile();
  if (f) return path.dirname(f);
  // Если файла нет — попробуем найти директорию, где он должен быть.
  const dirCandidates = [
    "/home/z/my-project/SMatrix/db",
    "/home/z/my-project/smatrix/db",
    "/opt/smatrix/db",
    "/opt/SMatrix/db",
    "/root/SMatrix/db",
    "/home/z/SMatrix/db",
    path.join(process.cwd(), "db"),
  ];
  for (const d of dirCandidates) {
    try {
      if (fs.existsSync(d) && fs.statSync(d).isDirectory()) return d;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Найти снапшот БД в репозитории. */
function findSnapshot(): string | null {
  const dir = findDbDir();
  if (!dir) return null;
  // Ищем файлы вида custom.db.snapshot-*
  try {
    const files = fs.readdirSync(dir).filter(f => f.startsWith("custom.db.snapshot-") || f.startsWith("custom.db.bak"));
    if (files.length === 0) return null;
    // Берём самый свежий по имени (snapshot-YYYYMMDD-HHMMSS сортируется лексикографически).
    files.sort();
    return path.join(dir, files[files.length - 1]);
  } catch {
    return null;
  }
}

/** Проверить, открывается ли SQLite файл. */
function checkSqlite(filePath: string): { ok: boolean; error?: string } {
  try {
    execSync(`sqlite3 "${filePath}" "SELECT count(*) FROM sqlite_master;"`, {
      stdio: "pipe",
      timeout: 5000,
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message ?? String(e) };
  }
}

/** Диагностика состояния БД. */
function diagnose() {
  const dbFile = findDbFile();
  const dbDir = findDbDir();
  const snapshot = findSnapshot();
  const result: any = {
    timestamp: new Date().toISOString(),
    cwd: process.cwd(),
    databaseUrlEnv: process.env.DATABASE_URL ?? null,
    dbFile: dbFile,
    dbFileExists: dbFile ? fs.existsSync(dbFile) : false,
    dbDir,
    snapshot: snapshot,
    snapshotExists: snapshot ? fs.existsSync(snapshot) : false,
    sqlite3Available: false,
    sqliteCheck: null,
  };
  try {
    execSync("which sqlite3", { stdio: "pipe" });
    result.sqlite3Available = true;
  } catch {
    result.sqlite3Available = false;
  }
  if (dbFile && fs.existsSync(dbFile)) {
    try {
      const stat = fs.statSync(dbFile);
      result.dbFileSize = stat.size;
      result.dbFileMode = stat.mode.toString(8);
      result.dbFileOwner = stat.uid;
      result.sqliteCheck = checkSqlite(dbFile);
    } catch (e: any) {
      result.statError = e.message;
    }
  }
  return result;
}

export async function GET() {
  return NextResponse.json({ ok: true, diagnose: diagnose() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token: string | undefined = body.token;
    const action: string | undefined = body.action;

    if (!token) {
      return NextResponse.json({ error: "Не передан token" }, { status: 400 });
    }

    // Сначала пробуем проверить токен через БД (нормальный путь).
    // Если БД недоступна — требуем emergency-токен из env.
    let isAuthorized = false;
    let authMethod = "";
    try {
      const user = await userByToken(token);
      if (user && isStaffRole(user.role)) {
        isAuthorized = true;
        authMethod = "db";
      }
    } catch {
      /* БД недоступна — пробуем emergency */
    }
    if (!isAuthorized) {
      const emergencyToken = process.env.DB_RESTORE_TOKEN;
      if (emergencyToken && token === emergencyToken) {
        isAuthorized = true;
        authMethod = "emergency";
      }
    }
    if (!isAuthorized) {
      return NextResponse.json({
        error: "Не авторизован. Если БД повреждена — добавьте в .env переменную DB_RESTORE_TOKEN=ваш_секрет и используйте его как token.",
        diagnose: diagnose(),
      }, { status: 403 });
    }

    if (action === "diagnose") {
      return NextResponse.json({ ok: true, authMethod, diagnose: diagnose() });
    }

    if (action === "restore") {
      const d = diagnose();
      if (!d.dbDir) {
        return NextResponse.json({ error: "Не найдена директория с БД. Восстановление невозможно." }, { status: 500 });
      }
      if (!d.snapshotExists || !d.snapshot) {
        return NextResponse.json({ error: "Снапшот БД не найден в директории db/. Восстановление невозможно." }, { status: 500 });
      }

      const target = path.join(d.dbDir, "custom.db");
      const backupName = `custom.db.broken-${Date.now()}`;
      const backupTarget = path.join(d.dbDir, backupName);

      // 1. Если текущий custom.db существует — переименуем его в .broken-<ts>
      if (fs.existsSync(target)) {
        try {
          fs.renameSync(target, backupTarget);
        } catch (e: any) {
          return NextResponse.json({ error: `Не удалось переименовать старую БД: ${e.message}` }, { status: 500 });
        }
      }

      // 2. Копируем снапшот на место custom.db
      try {
        fs.copyFileSync(d.snapshot, target);
      } catch (e: any) {
        return NextResponse.json({ error: `Не удалось скопировать снапшот: ${e.message}` }, { status: 500 });
      }

      // 3. Выставляем права 644
      try {
        fs.chmodSync(target, 0o644);
      } catch {
        /* ignore */
      }

      // 4. Удаляем WAL/journal, если они есть
      try {
        for (const ext of ["-wal", "-journal", "-shm"]) {
          const p = `${target}${ext}`;
          if (fs.existsSync(p)) fs.unlinkSync(p);
        }
      } catch {
        /* ignore */
      }

      // 5. Проверяем, что новая БД открывается
      const check = checkSqlite(target);

      return NextResponse.json({
        ok: true,
        authMethod,
        restoredFrom: d.snapshot,
        target: target,
        backupCreated: backupTarget,
        sqliteCheck: check,
        note: check.ok
          ? "БД восстановлена. Перезапустите процесс бэкенда (pm2 restart / systemctl restart), чтобы Prisma подхватила новую БД."
          : "БД скопирована, но sqlite3 не смог её открыть. Возможно, снапшот тоже повреждён.",
      });
    }

    return NextResponse.json({ error: "Неизвестное действие. Используйте action=diagnose или action=restore." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
