import { config } from "dotenv";

config();

const { defaultStocks } = await import("../src/utils/symbols.js");
const { fetchStockQuotes, fetchStockHistory, searchStocks } = await import("../src/utils/fetchers.js");

const required = ["VITE_SERP_KEY"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`환경 변수 누락: ${missing.join(", ")}`);
  process.exitCode = 1;
  process.exit();
}

const symbols = defaultStocks.map((item) => item.symbol);

const logSection = (title) => {
  console.log(`\n=== ${title} ===`);
};

(async () => {
  logSection("시세 확인");
  const quotes = await fetchStockQuotes(symbols);
  quotes.forEach((quote) => {
    console.log(`${quote.symbol}: $${quote.price.toFixed(2)} @ ${new Date(quote.time * 1000).toISOString()}`);
  });

  logSection("검색 확인");
  const search = await searchStocks("NASDAQ", { limit: 6 });
  search.forEach((item) => {
    console.log(`${item.symbol} - ${item.name} (${item.exchange || "?"})`);
  });

  logSection("히스토리 확인");
  const ranges = ["1D", "5D", "1Y"];
  for (const symbol of symbols) {
    for (const range of ranges) {
      const history = await fetchStockHistory(symbol, range);
      console.log(`${symbol} ${range}: ${history.points.length} points, provider=${history.meta.provider}`);
    }
  }
})().catch((error) => {
  console.error("체크 실패:", error);
  process.exitCode = 1;
});
