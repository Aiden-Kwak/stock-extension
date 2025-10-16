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
