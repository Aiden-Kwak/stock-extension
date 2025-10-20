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

const fetchSerpQuote = (symbol, { signal } = {}) =>
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

    const timestamp = timestampCandidates[0] ?? Math.floor(Date.now() / 1000);

    return {
      symbol,
      price: Number(price),
      time: timestamp,
      history,
    };
  });

const fetchSerpQuotes = async (symbols, { signal } = {}) => {
  if (symbols.length === 0) {
    return [];
  }
  const results = await Promise.all(
    symbols.map((symbol) =>
      fetchSerpQuote(symbol, { signal }).catch((error) => {
        console.warn(`SerpApi quote fetch failed for ${symbol}`, error);
        return null;
      })
    )
  );
  return results.filter(Boolean);
};

const fetchFmpQuoteMap = async (symbols, { signal } = {}) => {
  if (!FMP_KEY || symbols.length === 0) {
    return null;
  }
  const joined = symbols.join(",");
  return withCache(`fmp:quote:${joined}`, async () => {
    const url = new URL(`https://financialmodelingprep.com/api/v3/quote/${joined}`);
    url.searchParams.set("apikey", FMP_KEY);
    const data = await fetchJson(url.toString(), { signal });
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const entries = data
      .map((item) => {
        const sym = item.symbol?.trim().toUpperCase();
        const price = Number(item.price);
        if (!sym || !Number.isFinite(price)) {
          return null;
        }
        const timestamp = parseTimestamp(item.timestamp ?? item.date ?? item.updatedAt);
        return [
          sym,
          {
            symbol: sym,
            price,
            time: Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : Math.floor(Date.now() / 1000),
            history: [],
          },
        ];
      })
      .filter(Boolean);

    return entries.length > 0 ? Object.fromEntries(entries) : null;
  });
};

export const fetchStockQuotes = async (symbols, { signal } = {}) => {
  const unique = Array.from(new Set(symbols.filter(Boolean)))
    .map((symbol) => symbol.trim().toUpperCase());
  if (unique.length === 0) {
    return [];
  }

  const resultsMap = new Map();
  let missing = unique.slice();

  if (FMP_KEY) {
    try {
      const fmpMap = await fetchFmpQuoteMap(unique, { signal });
      if (fmpMap) {
        missing = missing.filter((symbol) => {
          const record = fmpMap[symbol];
          if (record) {
            resultsMap.set(symbol, record);
            return false;
          }
          return true;
        });
      }
    } catch (error) {
      console.warn("FMP quote fetch failed, falling back to SerpApi", error);
    }
  }

  if (missing.length > 0) {
    if (!SERP_KEY && !FMP_KEY) {
      const err = new Error("주식 데이터를 불러오려면 SerpApi 또는 FMP 키가 필요합니다.");
      err.code = "MISSING_STOCK_KEY";
      throw err;
    }
    const serpRecords = await fetchSerpQuotes(missing, { signal });
    serpRecords.forEach((record) => {
      resultsMap.set(record.symbol, record);
    });
    missing = missing.filter((symbol) => !resultsMap.has(symbol));
  }

  if (missing.length > 0) {
    throw new Error(`주식 데이터를 찾을 수 없습니다. (${missing.join(", ")})`);
  }

  return unique.map((symbol) => resultsMap.get(symbol));
};

const SERP_HISTORY_CONFIG = {
  "1D": { range: "1D" },
  "5D": { range: "5D" },
  "1Y": { range: "1Y" },
  "5Y": { range: "5Y" },
};

const FMP_HISTORY_CONFIG = {
  "1D": { type: "intraday", interval: "5min", limit: 78 },
  "5D": { type: "intraday", interval: "30min", limit: 65 },
  "1Y": { type: "daily", timeseries: 252 },
  "5Y": { type: "daily", timeseries: 1260 },
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

const fetchSerpHistory = async (symbol, config, { signal } = {}) => {
  const query = toSerpQuery(symbol);
  if (!query) {
    throw new Error("지원하지 않는 종목입니다.");
  }

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
    symbol,
    points,
    meta: {
      provider: "SERP",
      asOf,
    },
  };
};

const fetchFmpHistory = async (symbol, range, { signal } = {}) => {
  const settings = FMP_HISTORY_CONFIG[range] ?? FMP_HISTORY_CONFIG["1D"];
  if (!settings) {
    return null;
  }

  if (settings.type === "intraday") {
    const url = new URL(
      `https://financialmodelingprep.com/api/v3/historical-chart/${settings.interval}/${symbol}`
    );
    if (settings.limit) {
      url.searchParams.set("limit", String(settings.limit));
    }
    url.searchParams.set("apikey", FMP_KEY);

    const data = await fetchJson(url.toString(), { signal });
    if (!Array.isArray(data) || data.length < 2) {
      return null;
    }

    const points = sortByTime(mapHistoricalPoints(data, "close"));
    if (points.length < 2) {
      return null;
    }

    return {
      symbol,
      points,
      meta: {
        provider: "FMP",
        asOf: points[points.length - 1]?.time ?? null,
      },
    };
  }

  const url = new URL(`https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}`);
  if (settings.timeseries) {
    url.searchParams.set("timeseries", String(settings.timeseries));
  }
  url.searchParams.set("apikey", FMP_KEY);

  const data = await fetchJson(url.toString(), { signal });
  const entries = Array.isArray(data?.historical) ? data.historical : [];
  if (entries.length < 2) {
    return null;
  }

  const points = sortByTime(mapHistoricalPoints(entries, "close"));
  if (points.length < 2) {
    return null;
  }

  return {
    symbol,
    points,
    meta: {
      provider: "FMP",
      asOf: points[points.length - 1]?.time ?? null,
    },
  };
};

export const fetchStockHistory = async (symbol, range, { signal } = {}) => {
  const normalized = symbol?.trim().toUpperCase();
  if (!normalized) {
    throw new Error("유효한 티커가 필요합니다.");
  }

  const config = SERP_HISTORY_CONFIG[range] ?? SERP_HISTORY_CONFIG["1D"];
  const cacheNamespace = FMP_KEY ? "fmp" : "serp";
  const cacheKey = `history:${cacheNamespace}:${normalized}:${config.range}`;

  return withCache(cacheKey, async () => {
    if (FMP_KEY) {
      try {
        const fmpResult = await fetchFmpHistory(normalized, range, { signal });
        if (fmpResult) {
          return fmpResult;
        }
      } catch (error) {
        console.warn(`FMP history fetch failed for ${normalized}`, error);
      }
    }

    return fetchSerpHistory(normalized, config, { signal });
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
