import http from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { fetchStockQuotes, fetchStockHistory, searchStocks } from "../fetchers.js";

const SERP_KEY = import.meta.env?.VITE_SERP_KEY;
const PROXY_URL = import.meta.env?.VITE_PROXY_URL;

const REQUIRED_MESSAGE =
  "테스트용 .env.test가 누락됐습니다. VITE_SERP_KEY와 VITE_PROXY_URL을 확인하세요.";

if (!SERP_KEY || !PROXY_URL) {
  throw new Error(REQUIRED_MESSAGE);
}

const makeJsonResponse = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const baseTime = new Date("2024-01-01T09:30:00Z").getTime();
const timeSeries = (count, stepMinutes = 5) =>
  Array.from({ length: count }, (_, index) => ({
    date: new Date(baseTime + index * stepMinutes * 60_000).toISOString(),
    price: 100 + index,
  }));

const priceSeries = (count, stepDays = 1) =>
  Array.from({ length: count }, (_, index) => ({
    date: new Date(baseTime + index * stepDays * 24 * 60 * 60_000).toISOString(),
    price: 150 + index,
  }));

const startMockProxy = () => {
  const proxyAddress = new URL(PROXY_URL);
  const requests = [];

  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, PROXY_URL);
    if (requestUrl.pathname !== "/fetch") {
      makeJsonResponse(res, 404, { error: "Not found" });
      return;
    }

    const targetParam = requestUrl.searchParams.get("url");
    if (!targetParam) {
      makeJsonResponse(res, 400, { error: "Missing url" });
      return;
    }

    const target = new URL(targetParam);
    requests.push(target.toString());

    if (target.host === "serpapi.com") {
      const apiKey = target.searchParams.get("api_key");
      if (apiKey !== SERP_KEY) {
        makeJsonResponse(res, 401, { error: "Missing or invalid API key" });
        return;
      }

      if (target.searchParams.get("engine") !== "google_finance") {
        makeJsonResponse(res, 400, { error: "Unsupported engine" });
        return;
      }

      const range = target.searchParams.get("range");
      const query = target.searchParams.get("q") || "";
      const baseSymbol = query.split(":")[0]?.toUpperCase();

      if (range) {
        makeJsonResponse(res, 200, {
          graph: range === "1D" || range === "5D" ? timeSeries(10) : priceSeries(10),
          finance_results: {
            price: {
              last_refreshed_utc: new Date(baseTime + 60_000).toISOString(),
            },
          },
          summary: {
            stock: query,
            title: `${baseSymbol} Corp.`,
            exchange: "NASDAQ",
          },
        });
        return;
      }

      if (query.includes(":")) {
        const offset = baseSymbol === "MSFT" ? 2 : 0;
        makeJsonResponse(res, 200, {
          summary: {
            stock: query,
            title: `${baseSymbol} Inc.`,
            exchange: "NASDAQ",
            price: 150 + offset,
          },
          finance_results: {
            price: {
              price: 150 + offset,
              last_refreshed_utc: new Date(baseTime + 60_000).toISOString(),
            },
          },
          graph: timeSeries(5).map((point) => ({
            date: point.date,
            price: point.price + offset,
          })),
        });
        return;
      }

      makeJsonResponse(res, 200, {
        summary: {
          stock: "AAPL:NASDAQ",
          title: "Apple Inc.",
          exchange: "NASDAQ",
          price: 150,
        },
        markets: {
          us: [
            { stock: "AAPL:NASDAQ", name: "Apple Inc." },
            { stock: "MSFT:NASDAQ", name: "Microsoft Corp." },
          ],
        },
        discover_more: [
          {
            title: "People also search for",
            items: [
              { stock: "GOOGL:NASDAQ", name: "Alphabet Inc." },
              { stock: "NVDA:NASDAQ", name: "NVIDIA Corp." },
            ],
          },
        ],
      });
      return;
    }

    makeJsonResponse(res, 404, { error: "Unhandled host" });
  });

  return {
    requests,
    listen: () =>
      new Promise((resolve) => {
        server.listen(Number(proxyAddress.port), proxyAddress.hostname, resolve);
      }),
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
};

const proxy = startMockProxy();

beforeAll(async () => {
  await proxy.listen();
});

beforeEach(() => {
  proxy.requests.length = 0;
});

afterAll(async () => {
  await proxy.close();
});

const API_TIMEOUT = 5000;

describe("SerpApi 연동 로직", () => {
  test(
    "시세 조회 시 API 키를 포함한다",
    async () => {
      const symbols = ["AAPL", "MSFT"];
      const quotes = await fetchStockQuotes(symbols);
      expect(quotes).toHaveLength(symbols.length);
      quotes.forEach((quote) => {
        expect(symbols.includes(quote.symbol)).toBe(true);
        expect(quote.price).toBeGreaterThan(0);
        expect(Number.isFinite(quote.time)).toBe(true);
      });
      expect(proxy.requests.some((url) => url.includes("serpapi.com/search.json"))).toBe(true);
      expect(proxy.requests.every((url) => url.includes(`api_key=${SERP_KEY}`))).toBe(true);
    },
    API_TIMEOUT
  );

  test(
    "검색 API 호출 시 키를 전달한다",
    async () => {
      const results = await searchStocks("AAPL", { limit: 2 });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].symbol).toBe("AAPL");
      expect(proxy.requests.some((url) => url.includes("serpapi.com/search.json"))).toBe(true);
      expect(proxy.requests.every((url) => url.includes(`api_key=${SERP_KEY}`))).toBe(true);
    },
    API_TIMEOUT
  );

  test(
    "범위별 히스토리를 모두 가져온다",
    async () => {
      const ranges = ["1D", "5D", "1Y"];
      for (const range of ranges) {
        const history = await fetchStockHistory("AAPL", range);
        expect(history.symbol).toBe("AAPL");
        expect(history.meta.provider).toBe("SERP");
        expect(history.points.length).toBeGreaterThan(1);
      }
      expect(proxy.requests.filter((url) => url.includes("range="))).toHaveLength(ranges.length);
      expect(proxy.requests.every((url) => url.includes(`api_key=${SERP_KEY}`))).toBe(true);
    },
    API_TIMEOUT
  );
});
