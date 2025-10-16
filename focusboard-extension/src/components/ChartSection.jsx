import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { createChart, ColorType } from "lightweight-charts";
import { fetchCoinChart, fetchStockQuotes } from "../utils/fetchers.js";
import { createBackoff, nowInSeconds } from "../utils/timers.js";
import { isCoin } from "../utils/symbols.js";

const REFRESH_INTERVAL = 600000;
const SPARKLINE_LIMIT = 180;
const SPARKLINE_WINDOW = 60 * 60; // 1 hour

const ChartSection = ({ selected }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const abortRef = useRef(null);
  const refreshRef = useRef(null);
  const sparklineRef = useRef([]);
  const loadRef = useRef(() => {});
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [lastUpdated, setLastUpdated] = useState(null);

  const hasCoinKey = Boolean(import.meta.env.VITE_CG_KEY);
  const hasBlockingWarning = useMemo(() => {
    if (isCoin(selected)) {
      return !hasCoinKey;
    }
    return false;
  }, [selected, hasCoinKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const styles = getComputedStyle(document.documentElement);
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: styles.getPropertyValue("--card-bg").trim() },
        textColor: styles.getPropertyValue("--text-muted").trim() || "#94a3b8",
      },
      grid: {
        horzLines: { color: styles.getPropertyValue("--grid").trim() || "#1f2937" },
        vertLines: { color: styles.getPropertyValue("--grid").trim() || "#1f2937" },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        visible: true,
        borderColor: styles.getPropertyValue("--border").trim() || "#1f2937",
      },
      timeScale: {
        borderColor: styles.getPropertyValue("--border").trim() || "#1f2937",
        timeVisible: true,
        secondsVisible: true,
      },
    });

    const lineSeries = chart.addLineSeries({
      color: styles.getPropertyValue("--accent").trim() || "#3b82f6",
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = lineSeries;

    const applyTheme = () => {
      const themeStyles = getComputedStyle(document.documentElement);
      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: themeStyles.getPropertyValue("--card-bg").trim() },
          textColor: themeStyles.getPropertyValue("--text-muted").trim() || "#94a3b8",
        },
        grid: {
          horzLines: { color: themeStyles.getPropertyValue("--grid").trim() || "#1f2937" },
          vertLines: { color: themeStyles.getPropertyValue("--grid").trim() || "#1f2937" },
        },
        rightPriceScale: { borderColor: themeStyles.getPropertyValue("--border").trim() || "#1f2937" },
        timeScale: { borderColor: themeStyles.getPropertyValue("--border").trim() || "#1f2937" },
      });
      lineSeries.applyOptions({ color: themeStyles.getPropertyValue("--accent").trim() || "#3b82f6" });
    };

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    });
    resizeObserver.observe(container);

    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    applyTheme();

    chart.applyOptions({
      width: container.clientWidth,
      height: container.clientHeight,
    });

    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) {
      return undefined;
    }
    const backoff = createBackoff();
    sparklineRef.current = [];
    seriesRef.current.setData([]);

    const schedule = (delay) => {
      if (refreshRef.current) {
        clearTimeout(refreshRef.current);
      }
      refreshRef.current = setTimeout(() => {
        loadRef.current();
      }, delay);
    };

    loadRef.current = async () => {
      if (hasBlockingWarning) {
        setStatus({ state: "error", message: "필수 API 키가 없어 차트를 불러올 수 없습니다." });
        return;
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus({ state: "loading", message: "데이터를 불러오는 중..." });

      try {
        if (isCoin(selected)) {
          const data = await fetchCoinChart(selected, { signal: controller.signal });
          seriesRef.current.setData(data);
          setStatus({ state: "success", message: "" });
          setLastUpdated(new Date());
          backoff.reset();
        } else {
          const quotes = await fetchStockQuotes([selected], { signal: controller.signal });
          const quote = quotes.find((item) => item.symbol === selected);
          if (!quote) {
            throw new Error("주식 데이터를 불러올 수 없습니다.");
          }
          const now = nowInSeconds();
          if (Array.isArray(quote.history) && quote.history.length > 0) {
            const trimmed = quote.history
              .filter((point) => now - point.time <= SPARKLINE_WINDOW)
              .slice(-SPARKLINE_LIMIT);
            sparklineRef.current = trimmed.length > 0 ? trimmed : [{ time: quote.time || now, value: quote.price }];
          } else {
            const filtered = sparklineRef.current.filter((point) => now - point.time <= SPARKLINE_WINDOW);
            const point = { time: quote.time || now, value: quote.price };
            filtered.push(point);
            sparklineRef.current = filtered.slice(-SPARKLINE_LIMIT);
          }
          seriesRef.current.setData(sparklineRef.current);
          setStatus({
            state: "success",
            message: sparklineRef.current.length < 2 ? "실시간 스냅샷 제공 중" : "",
          });
          setLastUpdated(new Date());
          backoff.reset();
        }
        schedule(REFRESH_INTERVAL);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        const delay = backoff.next();
        setStatus({ state: "error", message: error.message || "데이터를 불러오지 못했습니다." });
        schedule(delay);
      }
    };

    loadRef.current();

    return () => {
      if (refreshRef.current) {
        clearTimeout(refreshRef.current);
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [selected, hasBlockingWarning]);

  return (
    <div className="chart">
      <div ref={containerRef} className="chart__canvas" role="img" aria-label="Price chart" />
      <footer className="chart__footer" aria-live="polite">
        {status.state === "loading" && <span>데이터를 불러오는 중...</span>}
        {status.state === "error" && (
          <span>
            {status.message}
            <button type="button" className="retry" onClick={() => loadRef.current()}>
              다시 시도
            </button>
          </span>
        )}
        {status.state === "success" && status.message && <span>{status.message}</span>}
        {lastUpdated && <span className="timestamp">업데이트: {lastUpdated.toLocaleTimeString()}</span>}
      </footer>
    </div>
  );
};

ChartSection.propTypes = {
  selected: PropTypes.string.isRequired,
};

export default ChartSection;
