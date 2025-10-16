import React, { useEffect, useMemo, useState } from "react";
import useChromeStorage from "./hooks/useChromeStorage.js";
import Header from "./components/Header.jsx";
import ChartSection from "./components/ChartSection.jsx";
import TodoList from "./components/TodoList.jsx";
import MemoSection from "./components/MemoSection.jsx";
import { coins, defaultSelection, stocks } from "./utils/symbols.js";

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
  const [selected, setSelected] = useChromeStorage("focusboard-selected", defaultSelection);
  const [theme, setTheme] = useState(getInitialTheme);
  const warnings = useMemo(() => {
    const messages = [];
    const hasCoinKey = Boolean(import.meta.env.VITE_CG_KEY);

    if (!hasCoinKey) {
      messages.push("CoinGecko 데모 키가 필요합니다.");
    }

    return messages;
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", themeClassList[theme]);
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem("focusboard-theme", theme);
    }
  }, [theme]);

  const assets = useMemo(
    () => [
      { group: "Coins", options: coins.map((c) => ({ value: c.id, label: c.label })) },
      {
        group: "Stocks",
        options: stocks.map((s) => ({ value: s.symbol, label: s.label })),
      },
    ],
    []
  );

  return (
    <div className="app">
      <Header
        assets={assets}
        selected={selected}
        onSelect={setSelected}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
        warnings={warnings}
      />
      <main className="layout">
        <section className="chart-card" aria-label="Price chart">
          <ChartSection selected={selected} />
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
