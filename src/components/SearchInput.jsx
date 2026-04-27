import React from "react";

/* ============================================================
   SearchInput — reusable search box matching the Inventory
   page style. Edit this one file to update all search pages.

   Props:
     value          (string)   — controlled input value
     onChange       (fn)       — called with new string value
     placeholder    (string)   — input placeholder text
     suggestions    (array)    — [{ text, type, icon }] optional
     onSuggestionSelect (fn)   — called with suggestion.text on click
     resultCount    (number)   — optional: matched count for "X of Y"
     totalCount     (number)   — optional: total count for "X of Y"
     resultLabel    (string)   — optional: label e.g. "items" (default "results")
     style          (object)   — optional extra style on root wrapper
     className      (string)   — optional extra class on root wrapper
   ============================================================ */

const styles = `
.si-wrap {
  position: relative;
  z-index: 20;
  margin-bottom: 0.75rem;
}

.si-inner {
  position: relative;
  display: flex;
  align-items: center;
  height: 100%;
}

.si-icon {
  position: absolute;
  left: 10px;
  color: var(--th-text-dim);
  pointer-events: none;
  display: flex;
  align-items: center;
}

.si-input {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: clamp(0.35rem, 1.2vw, 0.55rem) clamp(1.8rem, 3vw, 2.4rem);
  padding-left: clamp(1.8rem, 3vw, 2.4rem);
  background: var(--th-bg-input);
  border: 1px solid var(--th-border-strong);
  color: var(--th-text-primary);
  border-radius: clamp(5px, 1vw, 8px);
  font-family: var(--font-body, 'Inter', system-ui, sans-serif);
  font-size: clamp(0.8rem, 2vw, 0.92rem);
  outline: none;
  transition: border-color 0.15s;
}

.si-input:focus {
  border-color: var(--th-orange);
}

.si-clear {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: var(--th-text-dim);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  transition: color 0.15s;
  padding: 0 0.15rem;
}

.si-clear:hover {
  color: var(--th-rose);
}

.si-result {
  font-size: 0.78rem;
  color: var(--th-text-dim);
  margin-top: 0.45rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.si-result b {
  color: var(--th-text-muted);
}

.si-suggestions {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--th-bg-input);
  border: 1px solid var(--th-border-strong);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  z-index: 30;
}

.si-sug-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid var(--th-border-mid);
  font-size: 0.92rem;
  width: 100%;
  text-align: left;
  background: none;
  border-left: none;
  border-right: none;
  color: var(--th-text-body);
  transition: background 0.12s;
}

.si-sug-item:last-child {
  border-bottom: none;
}

.si-sug-item:hover {
  background: var(--th-border-mid);
}

.si-sug-type {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--th-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

@media (min-width: 641px) {
  .si-wrap {
    margin-bottom: .5rem;
  }
  .si-result {
    font-size: 0.8rem;
    margin-top: 0.5rem;
  }
}

@media (max-width: 640px) {
  .si-wrap {
    margin-bottom: 0.55rem;
  }
  .si-icon {
    left: 8px;
  }
  .si-icon svg {
    width: 13px;
    height: 13px;
  }
  .si-result {
    font-size: 0.72rem;
    margin-top: 0.3rem;
  }
}
`;

let injected = false;
function injectStyles() {
  if (injected) return;
  injected = true;
  const el = document.createElement("style");
  el.textContent = styles;
  document.head.appendChild(el);
}

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  suggestions = [],
  onSuggestionSelect,
  resultCount,
  totalCount,
  resultLabel = "results",
  style,
  className,
}) {
  React.useEffect(() => { injectStyles(); }, []);

  const [showSug, setShowSug] = React.useState(false);

  function handleFocus() {
    if (value && suggestions.length > 0) setShowSug(true);
  }

  function handleBlur() {
    setTimeout(() => setShowSug(false), 180);
  }

  function handleChange(e) {
    onChange(e.target.value);
    setShowSug(true);
  }

  function handleClear() {
    onChange("");
    setShowSug(false);
  }

  function handleSugClick(sug) {
    onChange(sug.text);
    setShowSug(false);
    if (onSuggestionSelect) onSuggestionSelect(sug);
  }

  const showSuggestions = showSug && suggestions.length > 0;
  const showResult = typeof resultCount === "number" && typeof totalCount === "number" && value;

  return (
    <div className={`si-wrap${className ? " " + className : ""}`} style={style}>
      <div className="si-inner">
        <span className="si-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          className="si-input"
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoComplete="off"
        />
        {value && (
          <button className="si-clear" onClick={handleClear} tabIndex={-1}>×</button>
        )}
        {showSuggestions && (
          <div className="si-suggestions">
            {suggestions.map((s, i) => (
              <button
                key={i}
                className="si-sug-item"
                onMouseDown={() => handleSugClick(s)}
              >
                {s.icon && <span>{s.icon}</span>}
                <span style={{ fontWeight: 600 }}>{s.text}</span>
                {s.type && <span className="si-sug-type">{s.type}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {showResult && (
        <div className="si-result">
          <b>{resultCount}</b> of <b>{totalCount}</b> {resultLabel} matched
        </div>
      )}
    </div>
  );
}
