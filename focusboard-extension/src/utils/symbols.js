export const defaultStocks = [
  { symbol: "AAPL", name: "Apple", exchange: "NASDAQ" },
  { symbol: "MSFT", name: "Microsoft", exchange: "NASDAQ" },
  { symbol: "GOOGL", name: "Alphabet", exchange: "NASDAQ" },
  { symbol: "AMZN", name: "Amazon", exchange: "NASDAQ" },
  { symbol: "TSLA", name: "Tesla", exchange: "NASDAQ" },
  { symbol: "NVDA", name: "NVIDIA", exchange: "NASDAQ" },
];

export const defaultSelection = defaultStocks;

export const toSerpQuery = (input) => {
  const normalized = input?.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const stock = defaultStocks.find((item) => item.symbol === normalized);
  if (!stock) {
    return normalized;
  }

  return stock.exchange ? `${stock.symbol}:${stock.exchange}` : stock.symbol;
};
