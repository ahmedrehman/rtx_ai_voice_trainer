import type { Env } from "./bindings";
import { clearCostLedger, getCostLedger, listProviders, runCorrection } from "./app";
import { json, methodNotAllowed, notFound } from "./responses";

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const basePath = normalizeBasePath(env.APP_BASE_PATH);
  const pathname = stripBasePath(url.pathname, basePath);

  try {
    if (pathname === "/api/providers") {
      if (request.method !== "GET") return methodNotAllowed();
      return json(await listProviders());
    }

    if (pathname === "/api/costs") {
      if (request.method === "GET") return json(await getCostLedger(env));
      if (request.method === "DELETE") return json(await clearCostLedger(env));
      return methodNotAllowed();
    }

    if (pathname === "/api/correct") {
      if (request.method !== "POST") return methodNotAllowed();
      return json(await runCorrection(await request.json(), env));
    }

    if (pathname.startsWith("/api/")) {
      return notFound();
    }

    return env.ASSETS.fetch(rewriteRequestPath(request, pathname));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return json({ error: message }, 500);
  }
}

function normalizeBasePath(basePath = "/apps/aitutor/") {
  if (!basePath || basePath === "/") return "/";
  const withLeadingSlash = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function stripBasePath(pathname: string, basePath: string) {
  if (basePath === "/") return pathname;
  const baseWithoutTrailingSlash = basePath.slice(0, -1);
  if (pathname === baseWithoutTrailingSlash) return "/";
  if (!pathname.startsWith(basePath)) return pathname;
  return `/${pathname.slice(basePath.length)}`;
}

function rewriteRequestPath(request: Request, pathname: string) {
  const url = new URL(request.url);
  if (url.pathname === pathname) return request;
  url.pathname = pathname;
  return new Request(url.toString(), request);
}
