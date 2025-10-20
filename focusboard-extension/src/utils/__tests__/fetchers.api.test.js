import http from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { fetchStockQuotes, fetchStockHistory, searchStocks } from "../fetchers.js";

const FMP_KEY = import.meta.env?.VITE_FMP_KEY;
const PROXY_URL = import.meta.env?.VITE_PROXY_URL;

const REQUIRED_MESSAGE =
  "테스트용 .env.test가 누락됐습니다. VITE_FMP_KEY와 VITE_PROXY_URL을 확인하세요.";

if (!FMP_KEY || !PROXY_URL) {
  throw new Error(REQUIRED_MESSAGE);
}

const makeJsonResponse = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const baseTime = new Date("2024-01-01T09:30:00Z").getTime();
const timeSeries = (count, stepMinutes = 5) =>
  Array.from({ length: count }, (_, index) => ({
    date: new Date(baseTime + index * stepMinutes * 60_000).toISOString().replace("T", " ").slice(0, 19),
    close: 100 + index,
  }));

const priceSeries = (count, stepDays = 1) =>
  Array.from({ length: count }, (_, index) => ({
    date: new Date(baseTime + index * stepDays * 24 * 60 * 60_000).toISOString().slice(0, 10),
    close: 150 + index,
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
    requests.push(`${target.host}${target.pathname}`);

    if (target.host === "financialmodelingprep.com") {
      const apiKey = target.searchParams.get("apikey");
      if (apiKey !== FMP_KEY) {
        makeJsonResponse(res, 401, { error: "Missing or invalid API key" });
        return;
      }

      if (target.pathname.startsWith("/api/v3/quote/")) {
        const tickers = target.pathname.split("/").pop().split(",");
        const data = tickers.map((symbol, index) => ({
          symbol,
          price: 100 + index,
          timestamp: Math.floor((baseTime + index * 60_000) / 1000),
        }));
        makeJsonResponse(res, 200, data);
        return;
      }

      if (target.pathname === "/api/v3/search-ticker") {
        const query = target.searchParams.get("query");
        const limit = Number(target.searchParams.get("limit") || "5");
        const candidates = [
          { symbol: "AAPL", name: "Apple Inc.", exchangeShortName: "NASDAQ" },
          { symbol: "MSFT", name: "Microsoft Corp.", exchangeShortName: "NASDAQ" },
          { symbol: "GOOGL", name: "Alphabet Inc.", exchangeShortName: "NASDAQ" },
        ];
        const filtered = candidates
          .filter((item) => item.symbol.includes(query?.toUpperCase() || ""))
          .slice(0, limit);
        makeJsonResponse(res, 200, filtered);
        return;
      }

      if (target.pathname.startsWith("/api/v3/historical-chart/5min/")) {
        makeJsonResponse(res, 200, timeSeries(10, 5));
        return;
      }

      if (target.pathname.startsWith("/api/v3/historical-chart/30min/")) {
        makeJsonResponse(res, 200, timeSeries(10, 30));
        return;
      }

      if (target.pathname.startsWith("/api/v3/historical-price-full/")) {
        makeJsonResponse(res, 200, { historical: priceSeries(30, 5) });
        return;
      }

      makeJsonResponse(res, 404, { error: "Unknown FMP path" });
      return;
    }

    if (target.host === "serpapi.com") {
      makeJsonResponse(res, 200, {
        graph: [],
        price: 0,
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

describe("FMP API 연동 로직", () => {
  test(
    "시세 조회 시 API 키를 포함한다",
    async () => {
      const symbols = ["AAPL", "MSFT"];
      const quotes = await fetchStockQuotes(symbols);
      expect(quotes).toHaveLength(symbols.length);
      quotes.forEach((quote, index) => {
        expect(quote.symbol).toBe(symbols[index]);
        expect(quote.price).toBeCloseTo(100 + index);
        expect(Number.isFinite(quote.time)).toBe(true);
      });
      expect(proxy.requests.some((path) => path.includes("/api/v3/quote/"))).toBe(true);
    },
    API_TIMEOUT
  );

  test(
    "검색 API 호출 시 키를 전달한다",
    async () => {
      const results = await searchStocks("AAPL", { limit: 2 });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].symbol).toBe("AAPL");
      expect(proxy.requests.some((path) => path.includes("/api/v3/search-ticker"))).toBe(true);
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
        expect(history.meta.provider).toBe("FMP");
        expect(history.points.length).toBeGreaterThan(1);
      }
      expect(proxy.requests.filter((path) => path.includes("historical"))).toHaveLength(3);
    },
    API_TIMEOUT
  );
});
