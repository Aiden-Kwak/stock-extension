import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const PORT = process.env.PORT || 8787;
const CACHE_TTL = Number(process.env.CACHE_TTL || 60000);
const ALLOWED_HOSTS = new Set([
  "api.coingecko.com",
  "financialmodelingprep.com",
  "serpapi.com",
]);

const cache = new Map();
const inflight = new Map();

const fetchWithCache = async (targetUrl) => {
  const now = Date.now();
  const cached = cache.get(targetUrl);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.response;
  }

  if (inflight.has(targetUrl)) {
    return inflight.get(targetUrl);
  }

  const fetchPromise = (async () => {
    const target = new URL(targetUrl);
    if (!ALLOWED_HOSTS.has(target.host)) {
      throw new Error("Host not allowed");
    }

    const agent = target.protocol === "http:" ? new http.Agent({ keepAlive: true }) : new https.Agent({ keepAlive: true });

    const response = await fetch(target, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      agent,
    });

    const bodyBuffer = Buffer.from(await response.arrayBuffer());
    const headers = Object.fromEntries(response.headers.entries());
    const payload = {
      status: response.status,
      headers,
      body: bodyBuffer,
    };

    cache.set(targetUrl, { response: payload, timestamp: now });
    return payload;
  })()
    .finally(() => {
      inflight.delete(targetUrl);
    });

  inflight.set(targetUrl, fetchPromise);
  return fetchPromise;
};

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (requestUrl.pathname !== "/fetch") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  const targetParam = requestUrl.searchParams.get("url");
  if (!targetParam) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing url parameter" }));
    return;
  }

  try {
    const upstream = await fetchWithCache(targetParam);
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers["content-type"] || "application/json",
      "Cache-Control": `public, max-age=${Math.floor(CACHE_TTL / 1000)}`,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(upstream.body);
  } catch (error) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`FocusBoard proxy listening on http://localhost:${PORT}`);
});
