export const config = { runtime: "edge" };

// Read once at cold start — no per-request env lookup
const API_ORIGIN = (process.env.API_ORIGIN || "").replace(/\/$/, "");

// Headers that must not be forwarded to the upstream service
const DROP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function handler(req) {
  // Serve a minimal landing page at root so the deployment looks like a real app
  const reqPath = req.url.indexOf("/", 8);
  const path = reqPath === -1 ? "/" : req.url.slice(reqPath).split("?")[0];

  if (path === "/" && req.method === "GET") {
    return new Response(LANDING_HTML, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (!API_ORIGIN) {
    return new Response(JSON.stringify({ error: "Service temporarily unavailable." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const targetUrl =
      reqPath === -1 ? API_ORIGIN + "/" : API_ORIGIN + req.url.slice(reqPath);

    const forwardHeaders = new Headers();
    let clientIp = null;

    for (const [k, v] of req.headers) {
      if (DROP_HEADERS.has(k)) continue;
      if (k.startsWith("x-vercel-")) continue;
      if (k === "x-real-ip") {
        clientIp = v;
        continue;
      }
      if (k === "x-forwarded-for") {
        if (!clientIp) clientIp = v;
        continue;
      }
      forwardHeaders.set(k, v);
    }
    if (clientIp) forwardHeaders.set("x-forwarded-for", clientIp);

    const method = req.method;
    const hasBody = method !== "GET" && method !== "HEAD";

    return await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: hasBody ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Upstream request failed. Please try again." }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ─── Landing page ────────────────────────────────────────────────────────────
// Shown at GET / — gives the deployment a plausible public face.
const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>API Gateway</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f1117;
      color: #e0e0e0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      gap: 1.5rem;
      padding: 2rem;
    }
    .badge {
      background: #1e2130;
      border: 1px solid #2d3148;
      border-radius: 9999px;
      padding: 0.3rem 1rem;
      font-size: 0.75rem;
      color: #7c83a8;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    h1 {
      font-size: clamp(1.8rem, 4vw, 2.8rem);
      font-weight: 700;
      letter-spacing: -0.03em;
      color: #fff;
    }
    p {
      font-size: 1rem;
      color: #7c83a8;
      max-width: 420px;
      text-align: center;
      line-height: 1.6;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      color: #4ade80;
    }
    .dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #4ade80;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    footer {
      position: fixed;
      bottom: 1.5rem;
      font-size: 0.75rem;
      color: #3a3f55;
    }
  </style>
</head>
<body>
  <span class="badge">Edge Network</span>
  <h1>API Gateway</h1>
  <p>This endpoint routes API requests to the upstream service. Direct browser access is not supported.</p>
  <div class="status"><span class="dot"></span> Operational</div>
  <footer>Powered by Vercel Edge Runtime</footer>
</body>
</html>`;