import React, { useMemo } from "react";
import PropTypes from "prop-types";

const MiniChart = ({ symbol, points, isLoading, hasError, trend, statusMessage }) => {
  const geometry = useMemo(() => {
    if (!points || points.length < 2) {
      return null;
    }

    const times = points.map((point) => point.time);
    const values = points.map((point) => point.value);

    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    const timeRange = maxTime - minTime || 1;
    const valueRange = maxValue - minValue || 1;

    const margins = { top: 12, right: 12, bottom: 26, left: 42 };
    const width = 160;
    const height = 110;
    const innerWidth = width - margins.left - margins.right;
    const innerHeight = height - margins.top - margins.bottom;

    const projectX = (time) => margins.left + ((time - minTime) / timeRange) * innerWidth;
    const projectY = (value) =>
      margins.top + innerHeight - ((value - minValue) / valueRange) * innerHeight;

    const strokeSegments = points.map((point, index) => {
      const x = projectX(point.time);
      const y = projectY(point.value);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    });

    const baseY = margins.top + innerHeight;
    const firstX = projectX(points[0].time);
    const lastX = projectX(points[points.length - 1].time);

    const strokePath = strokeSegments.join(" ");
    const areaPath = `${strokePath} L${lastX.toFixed(2)} ${baseY.toFixed(2)} L${firstX.toFixed(2)} ${baseY.toFixed(
      2
    )} Z`;

    return {
      width,
      height,
      margins,
      strokePath,
      areaPath,
      baseY,
      minValue,
      maxValue,
      minTime,
      maxTime,
    };
  }, [points]);

  const chartClass = useMemo(() => {
    if (trend > 0) return "mini-chart__stroke--up";
    if (trend < 0) return "mini-chart__stroke--down";
    return "mini-chart__stroke--flat";
  }, [trend]);

  const valueFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  const timeFormatter = useMemo(() => {
    if (!geometry) {
      return null;
    }
    const span = geometry.maxTime - geometry.minTime;
    if (span <= 48 * 60 * 60) {
      return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" });
    }
    if (span <= 400 * 24 * 60 * 60) {
      return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit" });
    }
    return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit" });
  }, [geometry]);

  if (isLoading) {
    return (
      <div className="mini-chart mini-chart--loading" aria-label={`${symbol} 차트 로딩 중`}>
        <div className="mini-chart__skeleton" />
      </div>
    );
  }

  if (hasError || !geometry) {
    return (
      <div className="mini-chart mini-chart--empty" aria-live="polite">
        <span>{statusMessage || "차트 데이터를 찾을 수 없습니다."}</span>
      </div>
    );
  }

  const { width, height, margins, strokePath, areaPath, baseY, minValue, maxValue, minTime, maxTime } =
    geometry;

  const minLabel = valueFormatter.format(minValue);
  const maxLabel = valueFormatter.format(maxValue);
  const startLabel = timeFormatter?.format(new Date(minTime * 1000)) ?? "";
  const endLabel = timeFormatter?.format(new Date(maxTime * 1000)) ?? "";

  return (
    <figure className="mini-chart" aria-label={`${symbol} 차트`}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id={`chart-gradient-${symbol}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={trend >= 0 ? "var(--chart-up)" : "var(--chart-down)"} stopOpacity="0.32" />
            <stop offset="100%" stopColor={trend >= 0 ? "var(--chart-up)" : "var(--chart-down)"} stopOpacity="0" />
          </linearGradient>
        </defs>

        <line
          className="mini-chart__axis"
          x1={margins.left}
          y1={margins.top}
          x2={margins.left}
          y2={baseY}
        />
        <line
          className="mini-chart__axis"
          x1={margins.left}
          y1={baseY}
          x2={width - margins.right}
          y2={baseY}
        />

        <text
          className="mini-chart__label"
          x={margins.left - 6}
          y={margins.top + 8}
          textAnchor="end"
        >
          {maxLabel}
        </text>
        <text
          className="mini-chart__label"
          x={margins.left - 6}
          y={baseY}
          dominantBaseline="hanging"
          textAnchor="end"
        >
          {minLabel}
        </text>

        <text
          className="mini-chart__label"
          x={margins.left}
          y={height - 6}
          textAnchor="start"
        >
          {startLabel}
        </text>
        <text
          className="mini-chart__label"
          x={width - margins.right}
          y={height - 6}
          textAnchor="end"
        >
          {endLabel}
        </text>

        <path className={chartClass} d={strokePath} fill="none" vectorEffect="non-scaling-stroke" />
        <path d={areaPath} fill={`url(#chart-gradient-${symbol})`} opacity="0.4" />
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
