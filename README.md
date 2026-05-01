# edge-cache-relay

A lightweight **Vercel Edge Function** that acts as a low-latency caching
and forwarding layer for upstream REST/media API services. Designed for
teams who need globally distributed request routing without managing
infrastructure.

## Use Case

When your API origin is geographically far from end users, or sits behind
a slow network path, this edge layer:

- Forwards requests through Vercel's global PoP network
- Reduces perceived latency via Anycast routing
- Normalizes headers before reaching your origin
- Streams response bodies without buffering (ideal for large payloads or
  chunked media responses)

> This is intentionally minimal — no auth middleware, no caching logic, no
> transformation. It's a clean forwarding layer you build on top of.

---

## Architecture

```
┌──────────┐   TLS / vercel.app SNI     ┌────────────────┐    HTTP/2    ┌──────────────┐
│  Client  │ ────────────────────────►  │  Vercel Edge   │ ──────────►  │  API Origin  │
│          │   REST / chunked request   │  (V8 isolate)  │  forwarded   │  (any host)  │
└──────────┘                            └────────────────┘              └──────────────┘
```

1. Client sends a standard HTTP request to your Vercel domain.
2. The edge function strips Vercel-injected headers and forwards cleanly to your origin.
3. The response streams back with no buffering — first byte out as soon as it arrives.

---

## Setup

### Environment Variables

In **Vercel Dashboard → Settings → Environment Variables**:

| Name           | Example                          | Notes                                   |
| -------------- | -------------------------------- | --------------------------------------- |
| `API_ORIGIN`   | `https://api.yourservice.com`    | Full base URL of your upstream service. |

- Include `https://` or `http://` explicitly.
- Include non-standard ports if needed (e.g., `:8443`).
- Trailing slashes are trimmed automatically.

### Deploy

```bash
git clone <this-repo>
cd edge-cache-relay

vercel --prod
```

---

## Configuration Notes

- **Streaming:** response bodies are streamed via `ReadableStream` — no
  intermediate buffering. Works well for large file downloads or
  server-sent payloads.
- **Header normalization:** hop-by-hop and Vercel-internal headers are
  stripped before forwarding. The client's IP is preserved via
  `x-forwarded-for`.
- **Redirects:** `redirect: "manual"` — 3xx responses from upstream are
  forwarded as-is rather than followed.

---

## Limitations

- No request/response transformation beyond header normalization.
- No caching (Vercel Edge Cache is not enabled — all requests hit origin).
- No authentication layer — add your own middleware if needed.
- Edge CPU budget applies (~50 ms compute per request, not counting I/O).
- All bandwidth counts against your Vercel quota.

---

## Project Structure

```
.
├── api/index.js     # Edge function — forwards requests, streams responses
├── vercel.json      # Routes all paths to /api/index
└── README.md
```

## License

MIT