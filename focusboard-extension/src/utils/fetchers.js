import { toSerpQuery } from "./symbols.js";

const CG_KEY = import.meta.env.VITE_CG_KEY;
const FMP_KEY = import.meta.env.VITE_FMP_KEY;
const SERP_KEY = import.meta.env.VITE_SERP_KEY;
const PROXY_URL = import.meta.env.VITE_PROXY_URL;

const cache = new Map();
const pending = new Map();
const CACHE_TTL = 60000;

const withCache = async (key, fetcher) => {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  if (pending.has(key)) {
    return pending.get(key);
  }
  const promise = (async () => {
    const data = await fetcher();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  })();
  pending.set(key, promise);
  try {
    const result = await promise;
    return result;
  } finally {
    pending.delete(key);
  }
};

const buildUrl = (url) => {
  if (!PROXY_URL) {
    return url;
  }
  const encoded = encodeURIComponent(url);
  return `${PROXY_URL.replace(/\/$/, "")}/fetch?url=${encoded}`;
};

const fetchJson = async (url, { signal } = {}) => {
  const target = buildUrl(url);
  const response = await fetch(target, {
    signal,
    headers: PROXY_URL
      ? {
          "x-focusboard-origin": "extension",
        }
      : undefined,
  });

  if (response.status === 429) {
    const error = new Error("요청 제한에 도달했습니다.");
    error.code = 429;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`데이터를 불러오지 못했습니다. (${response.status})`);
    error.code = response.status;
    throw error;
  }

  return response.json();
};

const parseTimestamp = (value) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return Number(numeric) * 1000;
    }
    return null;
  }
  return parsed;
};

export const fetchCoinChart = (id, { signal } = {}) => {
  if (!CG_KEY) {
    const error = new Error("CoinGecko 키가 필요합니다.");
    error.code = "MISSING_CG_KEY";
    throw error;
  }

  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=1&x_cg_demo_api_key=${CG_KEY}`;
  return withCache(`coin:${id}`, async () => {
    const data = await fetchJson(url, { signal });
    if (!data?.prices) {
      throw new Error("코인 차트 데이터를 찾을 수 없습니다.");
    }
    return data.prices.map(([timestamp, price]) => ({
      time: Math.floor(timestamp / 1000),
      value: Number(price),
    }));
  });
};

export const fetchStockQuotes = async (symbols, { signal } = {}) => {
  const unique = Array.from(new Set(symbols.filter(Boolean))).sort();
  if (unique.length === 0) {
    return [];
  }
  const serpResults = await Promise.all(
    unique.map((symbol) =>
      withCache(`serp:${symbol}`, async () => {
        const query = toSerpQuery(symbol);
        if (!query) {
          throw new Error(`지원하지 않는 종목입니다: ${symbol}`);
        }
        const search = new URL("https://serpapi.com/search.json");
        search.searchParams.set("engine", "google_finance");
        search.searchParams.set("q", query);
        if (SERP_KEY) {
          search.searchParams.set("api_key", SERP_KEY);
        }
        const data = await fetchJson(search.toString(), { signal });
        if (data?.error) {
          throw new Error(data.error);
        }

        const history = Array.isArray(data?.graph)
          ? data.graph
              .map((point) => ({
                time: Math.floor(new Date(point.date).getTime() / 1000),
                value: Number(point.price),
              }))
              .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
          : [];

        const latestHistory = history.length > 0 ? history[history.length - 1] : null;
        const priceCandidates = [
          latestHistory?.value,
          data?.finance_results?.price?.price,
          data?.summary?.price,
          data?.price,
          data?.markets?.us?.find((market) => market?.stock?.startsWith(symbol))?.price,
        ];
        const price = priceCandidates.find((candidate) => Number.isFinite(Number(candidate)));
        if (!Number.isFinite(Number(price))) {
          throw new Error("주식 가격 데이터를 찾을 수 없습니다.");
        }

        const timestampCandidates = [
          latestHistory?.time,
          data?.finance_results?.price?.last_refreshed_utc,
          data?.finance_results?.price?.last_refresh_time_utc,
          data?.finance_results?.price?.updated_utc,
        ]
          .map((value) => {
            if (!value) return null;
            const date = new Date(value);
            const parsed = Math.floor(date.getTime() / 1000);
            return Number.isFinite(parsed) ? parsed : null;
          })
          .filter((value) => value !== null);

        const timestamp =
          timestampCandidates[0] ?? Math.floor(Date.now() / 1000);

        return {
          symbol,
          price: Number(price),
          time: timestamp,
          history,
        };
      })
    )
  );

  const validSerp = serpResults.filter((item) => Number.isFinite(item.price));
  if (validSerp.length === serpResults.length) {
    return serpResults;
  }

  if (!FMP_KEY) {
    const error = new Error("주식 데이터를 불러오려면 SerpApi 또는 FMP 키가 필요합니다.");
    error.code = "MISSING_STOCK_KEY";
    throw error;
  }

  const joined = unique.join(",");
  const url = `https://financialmodelingprep.com/api/v3/quote/${joined}?apikey=${FMP_KEY}`;
  return withCache(`stock:${joined}`, async () => {
    const data = await fetchJson(url, { signal });
    if (!Array.isArray(data)) {
      throw new Error("주식 데이터를 찾을 수 없습니다.");
    }
    const fallbackMap = new Map(
      data
        .filter((item) => Number.isFinite(Number(item.price)))
        .map((item) => [item.symbol, {
          symbol: item.symbol,
          price: Number(item.price),
          time: item.timestamp ? Number(item.timestamp) : Math.floor(Date.now() / 1000),
          history: [],
        }])
    );

    return unique.map((symbol) => {
      const serp = serpResults.find((item) => item.symbol === symbol && Number.isFinite(item.price));
      if (serp) {
        return serp;
      }
      const fallback = fallbackMap.get(symbol);
      if (fallback) {
        return fallback;
      }
      throw new Error(`주식 데이터를 찾을 수 없습니다. (${symbol})`);
    });
  });
};

const HISTORY_CONFIG = {
  "1D": { range: "1D" },
  "5D": { range: "5D" },
  "1Y": { range: "1Y" },
  "5Y": { range: "5Y" },
};

const sortByTime = (points) => points.slice().sort((a, b) => a.time - b.time);

const mapHistoricalPoints = (entries, valueKey = "close") =>
  entries
    .map((item) => {
      const timestamp = parseTimestamp(item.date ?? item.timestamp ?? item.time);
      const value = Number(item[valueKey] ?? item.close ?? item.price);
      if (!Number.isFinite(value) || !Number.isFinite(timestamp)) {
        return null;
      }
      return { time: Math.floor(timestamp / 1000), value };
    })
    .filter(Boolean);

export const fetchStockHistory = async (symbol, range, { signal } = {}) => {
  const normalized = symbol?.trim().toUpperCase();
  if (!normalized) {
    throw new Error("유효한 티커가 필요합니다.");
  }

  const config = HISTORY_CONFIG[range] ?? HISTORY_CONFIG["1D"];
  const query = toSerpQuery(normalized);
  if (!query) {
    throw new Error("지원하지 않는 종목입니다.");
  }

  const cacheKey = `history:${normalized}:${config.range}`;
  return withCache(cacheKey, async () => {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_finance");
    url.searchParams.set("q", query);
    url.searchParams.set("range", config.range);
    if (SERP_KEY) {
      url.searchParams.set("api_key", SERP_KEY);
    }

    const data = await fetchJson(url.toString(), { signal });
    if (data?.error) {
      throw new Error(data.error);
    }

    const graph = Array.isArray(data?.graph) ? data.graph : [];
    const points = sortByTime(mapHistoricalPoints(graph, "price"));
    const lastPoint = points.length > 0 ? points[points.length - 1] : null;

    const timestampCandidates = [
      data?.finance_results?.price?.last_refreshed_utc,
      data?.finance_results?.price?.last_refresh_time_utc,
      data?.finance_results?.price?.updated_utc,
    ]
      .map((value) => parseTimestamp(value))
      .filter((value) => Number.isFinite(value));

    const fallbackAsOf = timestampCandidates.length > 0 ? Math.floor(timestampCandidates[0] / 1000) : null;
    const asOf = lastPoint?.time ?? fallbackAsOf;

    return {
      symbol: normalized,
      points,
      meta: {
        asOf,
      },
    };
  });
};

export const searchStocks = async (query, { signal, limit = 8 } = {}) => {
  const trimmed = query?.trim();
  if (!trimmed) {
    return [];
  }

  if (!FMP_KEY) {
    const error = new Error("Financial Modeling Prep API 키가 필요합니다.");
    error.code = "MISSING_FMP_KEY";
    throw error;
  }

  const key = `search:${trimmed.toLowerCase()}:${limit}`;
  return withCache(key, async () => {
    const url = new URL("https://financialmodelingprep.com/api/v3/search-ticker");
    url.searchParams.set("query", trimmed);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("exchange", "NASDAQ,NYSE,AMEX");
    url.searchParams.set("apikey", FMP_KEY);

    const data = await fetchJson(url.toString(), { signal });
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .filter((item) => item.symbol)
      .map((item) => ({
        symbol: item.symbol.toUpperCase(),
        name: item.name || item.symbol.toUpperCase(),
        exchange: item.exchangeShortName || item.stockExchange || "",
      }));
  });
};
