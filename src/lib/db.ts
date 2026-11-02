import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * 2026-11-02: умный fallback для DATABASE_URL.
 *
 * Раньше был один хардкод-путь '/home/z/my-project/smatrix/db/custom.db',
 * который на проде часто не существует → Prisma падает с
 * "Unable to open the database file" (Error code 14).
 *
 * Теперь пробуем по очереди несколько путей:
 *   1. process.env.DATABASE_URL (если есть в .env)
 *   2. /home/z/my-project/SMatrix/db/custom.db         (sandbox)
 *   3. /home/z/my-project/smatrix/db/custom.db          (старый fallback)
 *   4. /opt/smatrix/db/custom.db                        (прод-деплой вариант 1)
 *   5. /opt/SMatrix/db/custom.db                        (прод-деплой вариант 2)
 *   6. /root/SMatrix/db/custom.db                       (прод-деплой вариант 3)
 *   7. /home/z/SMatrix/db/custom.db                     (прод-деплой вариант 4)
 *   8. ./db/custom.db — относительно CWD процесса       (последняя попытка)
 *
 * Берём первый существующий файл; если ни один не найден — возвращаем
 * process.env.DATABASE_URL или дефолт, чтобы Prisma упала с понятной ошибкой.
 */
function resolveDatabaseUrl(): string {
  const env = process.env.DATABASE_URL
  if (env) {
    // Если в env указан file: путь — проверим, существует ли файл.
    const match = env.match(/^file:(.+)$/)
    if (match) {
      const p = match[1]
      if (fs.existsSync(p)) return env
      console.warn(`[db] DATABASE_URL указывает на несуществующий файл: ${p}`)
    } else {
      // Н file: схема — отдаём как есть (например, postgres://...)
      return env
    }
  }

  const candidates = [
    '/home/z/my-project/SMatrix/db/custom.db',
    '/home/z/my-project/smatrix/db/custom.db',
    '/opt/smatrix/db/custom.db',
    '/opt/SMatrix/db/custom.db',
    '/root/SMatrix/db/custom.db',
    '/home/z/SMatrix/db/custom.db',
    path.join(process.cwd(), 'db/custom.db'),
  ]

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        console.log(`[db] using: ${p}`)
        return `file:${p}`
      }
    } catch {
      /* ignore fs errors */
    }
  }

  console.error('[db] БД не найдена ни по одному из путей. Проверьте .env или восстановите БД из снапшота.')
  // Возвращаем дефолт — Prisma упадёт с понятной ошибкой, но без IO-error.
  return env ?? 'file:/home/z/my-project/SMatrix/db/custom.db'
}

const databaseUrl = resolveDatabaseUrl()

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrl,
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
