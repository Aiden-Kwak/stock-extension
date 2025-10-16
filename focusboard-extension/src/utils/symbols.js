export const coins = [
  { id: "bitcoin", label: "Bitcoin" },
  { id: "ethereum", label: "Ethereum" },
];

export const stocks = [
  { symbol: "AAPL", label: "Apple (AAPL)", exchange: "NASDAQ" },
  { symbol: "GOOGL", label: "Google (GOOGL)", exchange: "NASDAQ" },
];

export const defaultSelection = coins[0].id;

export const isCoin = (input) => coins.some((coin) => coin.id === input);

export const toCoinId = (input) => (isCoin(input) ? input : null);

export const getStockBySymbol = (input) => stocks.find((stock) => stock.symbol === input) || null;

export const toStockSymbol = (input) => (getStockBySymbol(input) ? input : null);

export const toSerpQuery = (input) => {
  const stock = getStockBySymbol(input);
  if (!stock) {
    return null;
  }
  return stock.exchange ? `${stock.symbol}:${stock.exchange}` : stock.symbol;
};
