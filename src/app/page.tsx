import App from "./app-client";

export const dynamic = "force-dynamic";

// Next.js 16: searchParams — это Promise, нужно await
export default async function Page({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp_raw = await searchParams;
  const sp: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp_raw)) {
    if (typeof v === "string") sp[k] = v;
    else if (Array.isArray(v) && v.length > 0) sp[k] = v[0];
  }
  return <App initialSearchParams={sp} />;
}
