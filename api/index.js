export const config = { runtime: "edge" };

const BACKEND_URL = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

const EXCLUDED_HEADERS = new Set([
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

export default async function routeHandler(request) {
  if (!BACKEND_URL) {
    return new Response("System Error: Route origin is undefined", { status: 500 });
  }

  try {
    const urlPathIdx = request.url.indexOf("/", 8);
    const finalEndpoint =
      urlPathIdx === -1 ? BACKEND_URL + "/" : BACKEND_URL + request.url.slice(urlPathIdx);

    const modifiedHeaders = new Headers();
    let userIpAddress = null;
    
    for (const [key, val] of request.headers) {
      if (EXCLUDED_HEADERS.has(key)) continue;
      if (key.startsWith("x-vercel-")) continue;
      
      if (key === "x-real-ip") {
        userIpAddress = val;
        continue;
      }
      if (key === "x-forwarded-for") {
        if (!userIpAddress) userIpAddress = val;
        continue;
      }
      modifiedHeaders.set(key, val);
    }
    
    if (userIpAddress) {
      modifiedHeaders.set("x-forwarded-for", userIpAddress);
    }

    const reqMethod = request.method;
    const containsBody = reqMethod !== "GET" && reqMethod !== "HEAD";

    return await fetch(finalEndpoint, {
      method: reqMethod,
      headers: modifiedHeaders,
      body: containsBody ? request.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch (e) {
    return new Response("Service Unavailable: Connection Interrupted", { status: 502 });
  }
}
