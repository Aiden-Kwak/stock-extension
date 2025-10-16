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
