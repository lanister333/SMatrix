import App from "./app-client";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const sp: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") sp[k] = v;
    else if (Array.isArray(v) && v.length > 0) sp[k] = v[0];
  }
  return <App initialSearchParams={sp} />;
}
