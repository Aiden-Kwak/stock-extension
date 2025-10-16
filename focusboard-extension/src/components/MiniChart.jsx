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
