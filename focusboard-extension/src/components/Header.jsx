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
