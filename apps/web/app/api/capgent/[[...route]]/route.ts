import app from "../../../../../api/src/index";

// The Capgent API (Hono) runs inside this Next.js server, so the whole stack is local.
// Node runtime is required for the embedded local database.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREFIX = "/api/capgent";

function handler(req: Request) {
  const url = new URL(req.url);
  if (url.pathname.startsWith(PREFIX)) url.pathname = url.pathname.slice(PREFIX.length) || "/";
  const forwarded = new Request(url, req);
  return app.fetch(forwarded, process.env as any);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
export const OPTIONS = handler;
