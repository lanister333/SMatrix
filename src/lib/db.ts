import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Fallback для деплоя платформы: снапшот может не включать .env (DATABASE_URL),
// тогда PrismaClient падал на health-check ("Environment variable not found").
// Реальный process.env.DATABASE_URL всегда приоритетен; фолбэк — стандартный
// абсолютный путь проекта этого окружения.
const databaseUrl = process.env.DATABASE_URL ?? 'file:/home/z/my-project/db/custom.db'

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrl,
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db