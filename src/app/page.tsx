import App from "./app-client";

/**
 * Серверный компонент-обёртка — читает searchParams при SSR
 * и передаёт их в клиентский компонент. Это убирает вспышку
 * главной страницы при переходе на /?topic=1234:
 * сервер сразу рендерит правильный view.
 */
export default function Page({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const sp: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") sp[k] = v;
  }
  return <App initialSearchParams={sp} />;
}
