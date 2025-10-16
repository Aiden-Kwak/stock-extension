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
