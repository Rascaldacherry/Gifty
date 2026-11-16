import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const base = (process.env.API_ORIGIN || "http://127.0.0.1:8000").replace(/\/$/, "");
  const url = `${base}/api/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  if (Number(request.headers.get("content-length") || 0) > 2 * 1024 * 1024)
    return Response.json({ detail: "Запрос слишком большой" }, { status: 413 });
  const headers = new Headers();
  for (const key of ["content-type", "cookie", "origin"]) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  try {
    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer();
    if (body && body.byteLength > 2 * 1024 * 1024)
      return Response.json({ detail: "Запрос слишком большой" }, { status: 413 });
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(55000),
      redirect: "manual",
    });
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    for (const key of ["content-type", "content-disposition", "retry-after"]) {
      const value = upstream.headers.get(key);
      if (value) responseHeaders.set(key, value);
    }
    for (const cookie of upstream.headers.getSetCookie())
      responseHeaders.append("Set-Cookie", cookie);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json(
      { detail: "Backend недоступен. Запустите FastAPI на порту 8000 и повторите попытку." },
      { status: 502 },
    );
  }
}
export const GET = proxy,
  POST = proxy,
  PUT = proxy,
  PATCH = proxy,
  DELETE = proxy;
