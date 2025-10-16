import React from "react";
import PropTypes from "prop-types";
import { isCoin } from "../utils/symbols.js";

const Header = ({ assets, selected, onSelect, theme, onToggleTheme, warnings }) => {
  return (
    <header className="header" role="banner">
      <div className="header__top">
        <div>
          <h1 className="header__title">FocusBoard</h1>
          <p className="header__subtitle">Track prices and organize your day</p>
        </div>
        <div className="header__actions" role="group" aria-label="Preferences">
          <label className="header__select">
            <span className="sr-only">Asset</span>
            <select
              value={selected}
              onChange={(event) => onSelect(event.target.value)}
              aria-label="Asset selector"
            >
              {assets.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>
      </div>
      {warnings.length > 0 && (
        <div className="banner" role="alert" aria-live="polite">
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="header__meta" aria-live="polite">
        <span className="badge">{isCoin(selected) ? "Coin" : "Stock"}</span>
      </div>
    </header>
  );
};

Header.propTypes = {
  assets: PropTypes.arrayOf(
    PropTypes.shape({
      group: PropTypes.string.isRequired,
      options: PropTypes.arrayOf(
        PropTypes.shape({
          value: PropTypes.string.isRequired,
          label: PropTypes.string.isRequired,
        })
      ).isRequired,
    })
  ).isRequired,
  selected: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
  theme: PropTypes.oneOf(["light", "dark"]).isRequired,
  onToggleTheme: PropTypes.func.isRequired,
  warnings: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default Header;
