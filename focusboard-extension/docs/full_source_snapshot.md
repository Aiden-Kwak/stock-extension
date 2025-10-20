# Focusboard Extension Source Snapshot

> Generated snapshot of key source files for quick reference.

## `src/main.jsx`

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## `src/App.jsx`

```jsx
import React, { useEffect, useMemo, useState } from "react";
import useChromeStorage from "./hooks/useChromeStorage.js";
import Header from "./components/Header.jsx";
import ChartSection from "./components/ChartSection.jsx";
import TodoList from "./components/TodoList.jsx";
import MemoSection from "./components/MemoSection.jsx";
import { defaultSelection } from "./utils/symbols.js";
import { searchStocks } from "./utils/fetchers.js";

const themeClassList = {
  light: "light",
  dark: "dark",
};

const getInitialTheme = () => {
  if (typeof window === "undefined") {
    return "light";
  }
  const stored = window.localStorage.getItem("focusboard-theme");
  return stored === "dark" ? "dark" : "light";
};

const App = () => {
  const [storedSelection, setStoredSelection] = useChromeStorage(
    "focusboard-stock-selection",
    defaultSelection
  );
  const [theme, setTheme] = useState(getInitialTheme);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searchState, setSearchState] = useState({ status: "idle", message: "" });
  const [helper, setHelper] = useState({ status: "idle", message: "" });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", themeClassList[theme]);
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem("focusboard-theme", theme);
    }
  }, [theme]);

  const sanitizeSelection = useMemo(() => {
    const normalize = (value) => {
      if (!value) return null;
      if (typeof value === "string") {
        const symbol = value.trim().toUpperCase();
        if (!symbol) return null;
        return { symbol, name: symbol };
      }
      if (typeof value === "object") {
        const symbol = value.symbol?.trim().toUpperCase();
        if (!symbol) return null;
        return {
          symbol,
          name: value.name?.trim() || symbol,
          exchange: value.exchange?.trim() || value.exchangeShortName?.trim() || "",
        };
      }
      return null;
    };

    const seen = new Set();
    return (input) => {
      if (!Array.isArray(input)) {
        return [];
      }
      seen.clear();
      const cleaned = [];
      for (const item of input) {
        const normalized = normalize(item);
        if (!normalized) continue;
        if (seen.has(normalized.symbol)) continue;
        seen.add(normalized.symbol);
        cleaned.push(normalized);
        if (cleaned.length === 6) {
          break;
        }
      }
      return cleaned;
    };
  }, []);

  const selection = useMemo(() => {
    const cleaned = sanitizeSelection(storedSelection);
    return cleaned.length > 0 ? cleaned : sanitizeSelection(defaultSelection);
  }, [storedSelection, sanitizeSelection]);

  const selectionFull = selection.length >= 6;

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setSearchState({ status: "idle", message: "" });
      return undefined;
    }

    let isMounted = true;
    const controller = new AbortController();
    const handle = setTimeout(() => {
      setSearchState({ status: "loading", message: "" });
      searchStocks(query.trim(), { signal: controller.signal, limit: 8 })
        .then((results) => {
          if (!isMounted) return;
          setSuggestions(results);
          setSearchState({ status: "success", message: "" });
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return;
          }
          console.warn("Failed to search stocks", error);
          if (!isMounted) return;
          setSuggestions([]);
          setSearchState({
            status: "error",
            message: error.message || "검색에 실패했습니다.",
          });
        });
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(handle);
      controller.abort();
    };
  }, [query]);

  const updateSelection = (updater) => {
    setStoredSelection((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const normalized = sanitizeSelection(next);
      return normalized;
    });
  };

  const handleAddStock = (stock) => {
    if (!stock?.symbol) {
      return { status: "error", message: "유효한 종목을 선택하세요." };
    }

    const symbol = stock.symbol.trim().toUpperCase();
    if (!symbol) {
      return { status: "error", message: "티커를 확인해주세요." };
    }

    let outcome = { status: "error", message: "종목을 추가하지 못했습니다." };

    updateSelection((prev) => {
      const cleaned = sanitizeSelection(prev);
      if (cleaned.some((item) => item.symbol === symbol)) {
        outcome = { status: "error", message: `${symbol} 종목은 이미 추가되어 있습니다.` };
        return cleaned;
      }

      if (cleaned.length >= 6) {
        outcome = { status: "error", message: "최대 6개까지 선택할 수 있습니다." };
        return cleaned;
      }

      const entry = {
        symbol,
        name: stock.name?.trim() || symbol,
        exchange: stock.exchange?.trim() || stock.exchangeShortName?.trim() || "",
      };

      outcome = { status: "success", message: `${symbol} 종목을 추가했습니다.` };
      return [...cleaned, entry];
    });

    return outcome;
  };

  const handleRemoveStock = (symbol) => {
    updateSelection((prev) => {
      const cleaned = sanitizeSelection(prev);
      return cleaned.filter((item) => item.symbol !== symbol);
    });
    setHelper({ status: "idle", message: "" });
  };

  const handleSelectSuggestion = (stock) => {
    const result = handleAddStock(stock);
    setHelper(result);
    if (result.status === "success") {
      setQuery("");
    }
  };

  const handleSubmitQuery = () => {
    if (!query.trim()) {
      return;
    }
    const trimmed = query.trim();
    const match = suggestions.find(
      (item) => item.symbol.trim().toUpperCase() === trimmed.toUpperCase()
    );
    const result = handleAddStock(
      match || {
        symbol: trimmed.toUpperCase(),
        name: trimmed.toUpperCase(),
      }
    );
    setHelper(result);
    if (result.status === "success") {
      setQuery("");
    }
  };

  return (
    <div className="app">
      <Header
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
        query={query}
        onQueryChange={setQuery}
        suggestions={suggestions}
        onSelectSuggestion={handleSelectSuggestion}
        onSubmitQuery={handleSubmitQuery}
        selected={selection}
        onRemoveStock={handleRemoveStock}
        isSearching={searchState.status === "loading"}
        searchError={searchState.status === "error" ? searchState.message : ""}
        helper={helper}
        isSelectionFull={selectionFull}
      />
      <main className="layout">
        <section className="stock-panel" aria-label="선택한 종목 차트">
          <ChartSection selected={selection} onRemove={handleRemoveStock} />
        </section>
        <section className="stack">
          <div className="card" aria-labelledby="todo-heading">
            <TodoList />
          </div>
          <div className="card" aria-labelledby="memo-heading">
            <MemoSection />
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
```

## `src/App.css`

```css
:root {
  --bg: #f1f5f9;
  --text: #0f172a;
  --text-muted: #475569;
  --card-bg: #ffffff;
  --border: #e2e8f0;
  --accent: #2563eb;
  --grid: rgba(148, 163, 184, 0.25);
  --shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
  --chart-up: #16a34a;
  --chart-down: #dc2626;
  --chip-bg: rgba(37, 99, 235, 0.12);
  --chip-border: rgba(37, 99, 235, 0.25);
  --info: #2563eb;
  --success: #16a34a;
  --error: #dc2626;
}

html[data-theme="dark"] {
  --bg: #0f172a;
  --text: #e2e8f0;
  --text-muted: #94a3b8;
  --card-bg: #111c30;
  --border: #1e293b;
  --accent: #60a5fa;
  --grid: rgba(148, 163, 184, 0.15);
  --shadow: 0 20px 40px rgba(2, 6, 23, 0.45);
  --chart-up: #4ade80;
  --chart-down: #f87171;
  --chip-bg: rgba(96, 165, 250, 0.12);
  --chip-border: rgba(96, 165, 250, 0.35);
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--text);
}

body {
  display: flex;
}

#root {
  flex: 1;
  display: flex;
  min-height: 100vh;
}

.app {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px clamp(16px, 4vw, 48px);
  gap: 24px;
}

.header {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header__top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.header__title {
  margin: 0;
  font-size: clamp(24px, 3vw, 32px);
}

.header__subtitle {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 14px;
}

.stock-search {
  display: flex;
  gap: 12px;
  align-items: center;
  background: var(--card-bg);
  padding: 12px 16px;
  border-radius: 16px;
  box-shadow: var(--shadow);
}

.stock-search__field {
  flex: 1;
  display: flex;
}

.stock-search__field input {
  flex: 1;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font-size: 14px;
}

.stock-search__field input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.stock-search__submit {
  padding: 10px 20px;
  border-radius: 12px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.stock-search__submit:disabled {
  background: rgba(148, 163, 184, 0.4);
  cursor: not-allowed;
}

.stock-search__submit:not(:disabled):hover,
.stock-search__submit:not(:disabled):focus-visible {
  transform: translateY(-1px);
}

.stock-search__meta {
  min-height: 20px;
}

.stock-search__helper {
  margin: 0;
  font-size: 13px;
}

.stock-search__helper--success {
  color: var(--success);
}

.stock-search__helper--error {
  color: var(--error);
}

.stock-search__helper--info {
  color: var(--info);
}

.stock-search__results {
  background: var(--card-bg);
  border-radius: 16px;
  box-shadow: var(--shadow);
  padding: 12px 0;
  max-height: 260px;
  overflow-y: auto;
}

.stock-search__results ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.stock-search__option {
  width: 100%;
  padding: 10px 20px;
  display: grid;
  grid-template-columns: 80px 1fr auto;
  gap: 12px;
  background: transparent;
  border: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.stock-search__option:hover,
.stock-search__option:focus-visible {
  background: rgba(37, 99, 235, 0.08);
  outline: none;
}

.stock-search__option-symbol {
  font-weight: 600;
}

.stock-search__option-name {
  color: var(--text-muted);
}

.stock-search__option-exchange {
  font-size: 12px;
  color: var(--text-muted);
  text-align: right;
}

.stock-search__status {
  margin: 0;
  padding: 8px 20px;
  font-size: 13px;
  color: var(--text-muted);
}

.stock-search__status--error {
  color: var(--error);
}

.selected-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.chip {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--chip-bg);
  border: 1px solid var(--chip-border);
}

.chip__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chip__symbol {
  font-weight: 600;
}

.chip__name {
  font-size: 12px;
  color: var(--text-muted);
}

.chip__remove {
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.chip__remove:hover,
.chip__remove:focus-visible {
  color: var(--error);
  outline: none;
}

.theme-toggle {
  border: none;
  background: var(--card-bg);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: transform 0.2s ease;
}

.theme-toggle:hover,
.theme-toggle:focus-visible {
  transform: scale(1.05);
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.layout {
  display: grid;
  gap: 24px;
  flex: 1;
  grid-template-columns: minmax(0, 1fr);
}

.stock-panel {
  background: var(--card-bg);
  border-radius: 20px;
  padding: 24px;
  box-shadow: var(--shadow);
}

.stock-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(1, minmax(0, 1fr));
}

.stock-card {
  background: rgba(148, 163, 184, 0.08);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid transparent;
}

.stock-card--up {
  border-color: rgba(22, 163, 74, 0.2);
}

.stock-card--down {
  border-color: rgba(220, 38, 38, 0.2);
}

.stock-card--empty {
  justify-content: center;
  align-items: center;
  text-align: center;
  color: var(--text-muted);
  border: 1px dashed var(--border);
}

.stock-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.stock-card__symbol {
  margin: 0;
  font-weight: 700;
  font-size: 18px;
}

.stock-card__name {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-muted);
}

.stock-card__exchange {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.stock-card__remove {
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}

.stock-card__remove:hover,
.stock-card__remove:focus-visible {
  color: var(--error);
  outline: none;
}

.stock-card__price {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.stock-card__last {
  font-size: 20px;
  font-weight: 700;
}

.stock-card__change {
  font-size: 13px;
  font-weight: 600;
}

.stock-card__change.is-up {
  color: var(--chart-up);
}

.stock-card__change.is-down {
  color: var(--chart-down);
}

.stock-card__placeholder {
  font-size: 13px;
  color: var(--text-muted);
}

.mini-chart {
  width: 100%;
  aspect-ratio: 3 / 2;
  background: rgba(148, 163, 184, 0.12);
  border-radius: 12px;
  position: relative;
  overflow: hidden;
}

.mini-chart svg {
  width: 100%;
  height: 100%;
}

.mini-chart__stroke--up {
  stroke: var(--chart-up);
  stroke-width: 2.5;
}

.mini-chart__stroke--down {
  stroke: var(--chart-down);
  stroke-width: 2.5;
}

.mini-chart__stroke--flat {
  stroke: var(--accent);
  stroke-width: 2.5;
}

.mini-chart--loading {
  display: grid;
  place-items: center;
}

.mini-chart__skeleton {
  width: 90%;
  height: 60%;
  border-radius: 12px;
  background: linear-gradient(90deg, rgba(148, 163, 184, 0.2), rgba(148, 163, 184, 0.4), rgba(148, 163, 184, 0.2));
  background-size: 200px 100%;
  animation: shimmer 1.4s infinite;
}

.mini-chart--empty {
  display: grid;
  place-items: center;
  padding: 12px;
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
}

.stock-card__footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.timeframe-tabs {
  display: inline-flex;
  gap: 8px;
}

.timeframe-tabs__button {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
}

.timeframe-tabs__button.is-active,
.timeframe-tabs__button:focus-visible {
  border-color: var(--accent);
  color: var(--accent);
  outline: none;
  background: rgba(37, 99, 235, 0.12);
}

.stock-card__timestamp {
  font-size: 11px;
  color: var(--text-muted);
}

.stock-card__error {
  margin: 0;
  font-size: 12px;
  color: var(--error);
}

@keyframes shimmer {
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: 200px 0;
  }
}

.stack {
  display: grid;
  gap: 24px;
}

.card {
  background: var(--card-bg);
  border-radius: 20px;
  padding: 24px;
  box-shadow: var(--shadow);
}

.todo {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.todo__header {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.todo__header h2 {
  margin: 0;
}

.todo__form {
  display: flex;
  gap: 8px;
  align-items: center;
}

.todo__form input {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--text);
  min-width: 220px;
}

.todo__form .primary {
  padding: 10px 16px;
  border-radius: 10px;
  border: none;
  background: var(--accent);
  color: white;
  cursor: pointer;
}

.todo__filters {
  display: inline-flex;
  gap: 8px;
}

.todo__filters button {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.todo__filters button.active,
.todo__filters button:focus-visible {
  border-color: var(--accent);
  color: var(--accent);
  outline: none;
}

.todo__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.todo__list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid transparent;
  background: rgba(148, 163, 184, 0.12);
}

.todo__list li.done span {
  text-decoration: line-through;
  color: var(--text-muted);
}

.todo__list li .danger {
  border: none;
  background: transparent;
  color: #ef4444;
  cursor: pointer;
}

.todo__list li label {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.todo__list li input[type="checkbox"] {
  width: 18px;
  height: 18px;
}

.todo__list .empty {
  text-align: center;
  padding: 32px;
  color: var(--text-muted);
}

.memo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.memo__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.memo__header h2 {
  margin: 0;
}

.memo__counter {
  font-size: 12px;
  color: var(--text-muted);
}

.memo__counter.warn {
  color: var(--accent);
}

.memo textarea {
  resize: vertical;
  min-height: 160px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--text);
  font-size: 14px;
  line-height: 1.5;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (min-width: 1024px) {
  .layout {
    grid-template-columns: 2fr 1fr;
  }

  .stack {
    grid-auto-rows: minmax(0, 1fr);
  }

  .stock-panel {
    min-height: 420px;
  }
}

@media (max-width: 768px) {
  .header__top {
    flex-direction: column;
    align-items: flex-start;
  }

  .stock-search {
    flex-direction: column;
    align-items: stretch;
  }

  .stock-search__submit {
    width: 100%;
  }

  .todo__form {
    width: 100%;
  }

  .todo__form input {
    flex: 1;
    min-width: 0;
  }

  .todo__form .primary {
    flex-shrink: 0;
  }
}
@media (min-width: 768px) {
  .stock-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .stock-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
```

## `src/components/ChartSection.jsx`

```jsx
import React from "react";
import PropTypes from "prop-types";
import StockCard from "./StockCard.jsx";

const MAX_SLOTS = 6;

const ChartSection = ({ selected, onRemove }) => {
  const slots = selected.slice(0, MAX_SLOTS);
  const placeholders = Math.max(0, MAX_SLOTS - slots.length);

  return (
    <div className="stock-grid">
      {slots.map((stock) => (
        <StockCard
          key={stock.symbol}
          symbol={stock.symbol}
          name={stock.name}
          exchange={stock.exchange}
          onRemove={onRemove}
        />
      ))}
      {Array.from({ length: placeholders }).map((_, index) => (
        <div key={`placeholder-${index}`} className="stock-card stock-card--empty">
          <p>종목을 추가하면 간단한 차트를 바로 확인할 수 있습니다.</p>
        </div>
      ))}
    </div>
  );
};

ChartSection.propTypes = {
  selected: PropTypes.arrayOf(
    PropTypes.shape({
      symbol: PropTypes.string.isRequired,
      name: PropTypes.string,
      exchange: PropTypes.string,
    })
  ).isRequired,
  onRemove: PropTypes.func.isRequired,
};

export default ChartSection;
```

## `src/components/Header.jsx`

```jsx
import React from "react";
import PropTypes from "prop-types";

const Header = ({
  theme,
  onToggleTheme,
  query,
  onQueryChange,
  onSubmitQuery,
  suggestions,
  onSelectSuggestion,
  selected,
  onRemoveStock,
  isSearching,
  searchError,
  helper,
  isSelectionFull,
}) => {
  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmitQuery();
  };

  return (
    <header className="header" role="banner">
      <div className="header__top">
        <div>
          <h1 className="header__title">FocusBoard</h1>
          <p className="header__subtitle">관심 종목 6개를 빠르게 살펴보세요</p>
        </div>
        <button
          type="button"
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
        >
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </div>

      <form className="stock-search" onSubmit={handleSubmit} role="search">
        <label className="stock-search__field">
          <span className="sr-only">종목 검색</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="종목명 또는 티커 검색"
            aria-label="종목 검색"
            autoComplete="off"
          />
        </label>
        <button type="submit" className="stock-search__submit" disabled={!query.trim()}>
          추가
        </button>
      </form>

      <div className="stock-search__meta" aria-live="polite">
        {helper?.message ? (
          <p className={`stock-search__helper stock-search__helper--${helper.status}`}>
            {helper.message}
          </p>
        ) : (
          isSelectionFull && (
            <p className="stock-search__helper stock-search__helper--info">
              최대 6개까지 선택할 수 있습니다.
            </p>
          )
        )}
      </div>

      {query && (
        <div className="stock-search__results" role="listbox" aria-label="종목 검색 결과">
          {isSearching && <p className="stock-search__status">검색 중...</p>}
          {!isSearching && searchError && (
            <p className="stock-search__status stock-search__status--error">{searchError}</p>
          )}
          {!isSearching && !searchError && suggestions.length === 0 && (
            <p className="stock-search__status">검색 결과가 없습니다.</p>
          )}
          <ul>
            {suggestions.map((item) => (
              <li key={`${item.symbol}-${item.exchange || "unknown"}`}>
                <button
                  type="button"
                  onClick={() => onSelectSuggestion(item)}
                  className="stock-search__option"
                  role="option"
                >
                  <span className="stock-search__option-symbol">{item.symbol}</span>
                  <span className="stock-search__option-name">{item.name}</span>
                  {item.exchange && (
                    <span className="stock-search__option-exchange">{item.exchange}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="selected-list" aria-live="polite">
        {selected.map((item) => (
          <div key={item.symbol} className="chip">
            <div className="chip__info">
              <span className="chip__symbol">{item.symbol}</span>
              <span className="chip__name">{item.name}</span>
            </div>
            <button
              type="button"
              className="chip__remove"
              onClick={() => onRemoveStock(item.symbol)}
              aria-label={`${item.symbol} 종목 제거`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </header>
  );
};

Header.propTypes = {
  theme: PropTypes.oneOf(["light", "dark"]).isRequired,
  onToggleTheme: PropTypes.func.isRequired,
  query: PropTypes.string.isRequired,
  onQueryChange: PropTypes.func.isRequired,
  onSubmitQuery: PropTypes.func.isRequired,
  suggestions: PropTypes.arrayOf(
    PropTypes.shape({
      symbol: PropTypes.string.isRequired,
      name: PropTypes.string,
      exchange: PropTypes.string,
    })
  ).isRequired,
  onSelectSuggestion: PropTypes.func.isRequired,
  selected: PropTypes.arrayOf(
    PropTypes.shape({
      symbol: PropTypes.string.isRequired,
      name: PropTypes.string,
      exchange: PropTypes.string,
    })
  ).isRequired,
  onRemoveStock: PropTypes.func.isRequired,
  isSearching: PropTypes.bool.isRequired,
  searchError: PropTypes.string.isRequired,
  helper: PropTypes.shape({
    status: PropTypes.string,
    message: PropTypes.string,
  }),
  isSelectionFull: PropTypes.bool.isRequired,
};

Header.defaultProps = {
  helper: { status: "idle", message: "" },
};

export default Header;
```

## `src/components/MemoSection.jsx`

```jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { debounce } from "../utils/timers.js";

const STORAGE_KEY = "focusboard-memo";
const MAX_LENGTH = 5000;

const loadMemo = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ?? "";
  } catch (error) {
    console.warn("Failed to load memo", error);
    return "";
  }
};

const saveMemo = (value) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch (error) {
    console.warn("Failed to save memo", error);
  }
};

const MemoSection = () => {
  const [memo, setMemo] = useState(() => loadMemo());
  const debouncedRef = useRef();

  useEffect(() => {
    debouncedRef.current = debounce(saveMemo, 500);
    return () => {
      debouncedRef.current?.flush?.();
    };
  }, []);

  useEffect(() => {
    if (!debouncedRef.current) return;
    debouncedRef.current(memo);
  }, [memo]);

  const remaining = useMemo(() => MAX_LENGTH - memo.length, [memo]);

  return (
    <div className="memo">
      <div className="memo__header">
        <h2 id="memo-heading">Memo</h2>
        <span className={`memo__counter ${remaining <= 50 ? "warn" : ""}`} aria-live="polite">
          남은 글자 {remaining < 0 ? 0 : remaining}
        </span>
      </div>
      <label className="sr-only" htmlFor="memo-field">
        메모 입력
      </label>
      <textarea
        id="memo-field"
        value={memo}
        onChange={(event) => setMemo(event.target.value.slice(0, MAX_LENGTH))}
        maxLength={MAX_LENGTH}
        placeholder="생각나는 아이디어를 적어보세요"
        rows={8}
      />
    </div>
  );
};

export default MemoSection;
```

## `src/components/MiniChart.jsx`

```jsx
import React, { useMemo } from "react";
import PropTypes from "prop-types";

const MiniChart = ({ symbol, points, isLoading, hasError, trend, statusMessage }) => {
  const pathData = useMemo(() => {
    if (!points || points.length < 2) {
      return null;
    }

    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = 100 / (points.length - 1);

    const path = points
      .map((point, index) => {
        const x = index * step;
        const normalized = (point.value - min) / range;
        const y = 100 - normalized * 100;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

    return { path, min, max };
  }, [points]);

  const chartClass = useMemo(() => {
    if (trend > 0) return "mini-chart__stroke--up";
    if (trend < 0) return "mini-chart__stroke--down";
    return "mini-chart__stroke--flat";
  }, [trend]);

  if (isLoading) {
    return (
      <div className="mini-chart mini-chart--loading" aria-label={`${symbol} 차트 로딩 중`}>
        <div className="mini-chart__skeleton" />
      </div>
    );
  }

  if (hasError || !pathData) {
    return (
      <div className="mini-chart mini-chart--empty" aria-live="polite">
        <span>{statusMessage || "차트 데이터를 찾을 수 없습니다."}</span>
      </div>
    );
  }

  return (
    <figure className="mini-chart" aria-label={`${symbol} 차트`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id={`chart-gradient-${symbol}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={trend >= 0 ? "var(--chart-up)" : "var(--chart-down)"} stopOpacity="0.3" />
            <stop offset="100%" stopColor={trend >= 0 ? "var(--chart-up)" : "var(--chart-down)"} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className={chartClass} d={pathData.path} fill="none" vectorEffect="non-scaling-stroke" />
        <path
          d={`${pathData.path} L100 100 L0 100 Z`}
          fill={`url(#chart-gradient-${symbol})`}
          opacity="0.4"
        />
      </svg>
      <figcaption className="sr-only">
        {symbol} 차트 범위 {points.length}개 데이터 포인트
      </figcaption>
    </figure>
  );
};

MiniChart.propTypes = {
  symbol: PropTypes.string.isRequired,
  points: PropTypes.arrayOf(
    PropTypes.shape({
      time: PropTypes.number.isRequired,
      value: PropTypes.number.isRequired,
    })
  ).isRequired,
  isLoading: PropTypes.bool,
  hasError: PropTypes.bool,
  trend: PropTypes.number,
  statusMessage: PropTypes.string,
};

MiniChart.defaultProps = {
  isLoading: false,
  hasError: false,
  trend: 0,
  statusMessage: "",
};

export default MiniChart;
```

## `src/components/StockCard.jsx`

```jsx
import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import MiniChart from "./MiniChart.jsx";
import useStockHistory from "../hooks/useStockHistory.js";

const TIMEFRAMES = [
  { id: "1D", label: "1일" },
  { id: "5D", label: "5일" },
  { id: "1Y", label: "1년" },
  { id: "5Y", label: "5년" },
];

const StockCard = ({ symbol, name, exchange, onRemove }) => {
  const [range, setRange] = useState("1D");
  const { status, data, error } = useStockHistory(symbol, range);

  const metrics = useMemo(() => {
    if (!data?.points || data.points.length === 0) {
      return null;
    }
    const first = data.points[0];
    const last = data.points[data.points.length - 1];
    if (!first || !last) {
      return null;
    }
    const change = last.value - first.value;
    const percent = first.value !== 0 ? (change / first.value) * 100 : 0;
    const asOf = data.meta?.asOf ? new Date(data.meta.asOf * 1000) : null;
    return {
      last: last.value,
      change,
      percent,
      asOf,
    };
  }, [data]);

  const priceFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  const percentFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  const handleSelectRange = (nextRange) => {
    setRange(nextRange);
  };

  const trend = metrics?.change ?? 0;
  const statusMessage = useMemo(() => {
    if (status === "loading") return "차트를 불러오는 중";
    if (status === "error") return error?.message || "데이터를 불러올 수 없습니다.";
    if (status === "success" && (!data?.points || data.points.length < 2)) {
      return "충분한 데이터가 없습니다.";
    }
    return "";
  }, [status, error, data]);

  return (
    <article className={`stock-card${trend >= 0 ? " stock-card--up" : " stock-card--down"}`}>
      <header className="stock-card__header">
        <div>
          <p className="stock-card__symbol">{symbol}</p>
          <p className="stock-card__name">{name || symbol}</p>
          {exchange && <p className="stock-card__exchange">{exchange}</p>}
        </div>
        <button
          type="button"
          className="stock-card__remove"
          onClick={() => onRemove(symbol)}
          aria-label={`${symbol} 종목 제거`}
        >
          ×
        </button>
      </header>
      <div className="stock-card__price" aria-live="polite">
        {metrics ? (
          <>
            <span className="stock-card__last">${priceFormatter.format(metrics.last)}</span>
            <span
              className={`stock-card__change ${trend >= 0 ? "is-up" : "is-down"}`}
              aria-label="변동률"
            >
              {trend >= 0 ? "+" : ""}
              {priceFormatter.format(metrics.change)} ({trend >= 0 ? "+" : ""}
              {percentFormatter.format(metrics.percent)}%)
            </span>
          </>
        ) : (
          <span className="stock-card__placeholder">
            {status === "loading" ? "가격을 불러오는 중" : "가격 정보를 찾을 수 없습니다."}
          </span>
        )}
      </div>
      <MiniChart
        symbol={symbol}
        points={data?.points || []}
        isLoading={status === "loading"}
        hasError={status === "error"}
        trend={trend}
        statusMessage={statusMessage}
      />
      <footer className="stock-card__footer">
        <div className="timeframe-tabs" role="tablist" aria-label={`${symbol} 차트 범위 선택`}>
          {TIMEFRAMES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              className={`timeframe-tabs__button${range === option.id ? " is-active" : ""}`}
              aria-selected={range === option.id}
              onClick={() => handleSelectRange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {metrics?.asOf && (
          <time className="stock-card__timestamp" dateTime={metrics.asOf.toISOString()}>
            업데이트: {metrics.asOf.toLocaleString()}
          </time>
        )}
        {status === "error" && (
          <p className="stock-card__error" role="alert">
            {statusMessage}
          </p>
        )}
      </footer>
    </article>
  );
};

StockCard.propTypes = {
  symbol: PropTypes.string.isRequired,
  name: PropTypes.string,
  exchange: PropTypes.string,
  onRemove: PropTypes.func.isRequired,
};

StockCard.defaultProps = {
  name: "",
  exchange: "",
};

export default StockCard;
```

## `src/components/TodoList.jsx`

```jsx
import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "focusboard-todos";

const loadTodos = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to parse todos, resetting", error);
    window.localStorage.removeItem(STORAGE_KEY);
    return [];
  }
};

const saveTodos = (todos) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch (error) {
    console.warn("Failed to save todos", error);
  }
};

const FILTERS = {
  all: { label: "All", predicate: () => true },
  active: { label: "Active", predicate: (todo) => !todo.done },
  done: { label: "Done", predicate: (todo) => todo.done },
};

const TodoList = () => {
  const [todos, setTodos] = useState(() => loadTodos());
  const [filter, setFilter] = useState("all");
  const [input, setInput] = useState("");

  useEffect(() => {
    saveTodos(todos);
  }, [todos]);

  const filteredTodos = useMemo(() => todos.filter(FILTERS[filter].predicate), [todos, filter]);

  const addTodo = (text) => {
    if (!text.trim()) return;
    setTodos((prev) => [
      ...prev,
      {
        id: (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)),
        text: text.trim(),
        done: false,
      },
    ]);
    setInput("");
  };

  const toggleTodo = (id) => {
    setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)));
  };

  const removeTodo = (id) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTodo(input);
    }
    if (event.key === "Escape") {
      setInput("");
    }
  };

  return (
    <div className="todo">
      <div className="todo__header">
        <h2 id="todo-heading">To-do List</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            addTodo(input);
          }}
          className="todo__form"
        >
          <label className="sr-only" htmlFor="todo-input">
            새 작업 추가
          </label>
          <input
            id="todo-input"
            type="text"
            placeholder="할 일을 입력하고 Enter"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="submit" className="primary">
            추가
          </button>
        </form>
      </div>
      <div className="todo__filters" role="tablist" aria-label="Todo filters">
        {Object.entries(FILTERS).map(([key, filterDef]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={filter === key ? "active" : ""}
            onClick={() => setFilter(key)}
          >
            {filterDef.label}
          </button>
        ))}
      </div>
      <ul className="todo__list">
        {filteredTodos.length === 0 && (
          <li className="empty" aria-live="polite">
            {todos.length === 0 ? "할 일을 추가해 보세요." : "조건에 맞는 작업이 없습니다."}
          </li>
        )}
        {filteredTodos.map((todo) => (
          <li key={todo.id} className={todo.done ? "done" : ""}>
            <label>
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => toggleTodo(todo.id)}
                aria-label={`${todo.text} 완료 여부`}
              />
              <span>{todo.text}</span>
            </label>
            <button
              type="button"
              className="danger"
              onClick={() => removeTodo(todo.id)}
              aria-label={`${todo.text} 삭제`}
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TodoList;
```

## `src/hooks/useStockHistory.js`

```js
import { useEffect, useState } from "react";
import { fetchStockHistory } from "../utils/fetchers.js";

const initialState = {
  status: "idle",
  data: null,
  error: null,
};

const useStockHistory = (symbol, range) => {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    if (!symbol) {
      setState(initialState);
      return undefined;
    }

    let isMounted = true;
    const controller = new AbortController();

    setState({ status: "loading", data: null, error: null });
    fetchStockHistory(symbol, range, { signal: controller.signal })
      .then((data) => {
        if (!isMounted) return;
        setState({ status: "success", data, error: null });
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        if (!isMounted) return;
        setState({ status: "error", data: null, error });
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [symbol, range]);

  return state;
};

export default useStockHistory;
```

## `src/utils/fetchers.js`

```js
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
```

## `src/utils/symbols.js`

```js
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
```

## `src/utils/timers.js`

```js
export const createBackoff = ({ base = 5000, max = 300000 } = {}) => {
  let delay = base;
  return {
    next() {
      const current = delay;
      delay = Math.min(delay * 2, max);
      return current;
    },
    reset() {
      delay = base;
    },
  };
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const nowInSeconds = () => Math.floor(Date.now() / 1000);

export const debounce = (fn, wait) => {
  let timer;
  let lastArgs = [];
  const debounced = (...args) => {
    lastArgs = args;
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...lastArgs);
    }, wait);
  };
  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      fn(...lastArgs);
    }
  };
  return debounced;
};
```

