/**
 * СТАДИЯ 2 (Шаги 6-7): фоновые парсеры Сахалинских информеров.
 * Next.js вызывает register() при старте сервера. Node-модули (fs/path)
 * запрещены в Edge-рантайме, поэтому вся логика живёт в
 * instrumentation-node.ts и подключается только под nodejs.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startInformers } = await import("./instrumentation-node");
    await startInformers();
  }
}
