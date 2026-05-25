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
     filterValue    (string)   — optional: current value of left dropdown filter
     onFilterChange (fn)       — optional: change callback for left dropdown filter
     filterOptions  (array)    — optional: array of option strings or {value, label} objects
     filterPlaceholder (string)— optional: placeholder option text (e.g. "All")
   ============================================================ */

const styles = `
.si-wrap {
  position: relative;
  z-index: 20;
  width: 100%;
}

.si-inner {
  position: relative;
  display: flex;
  align-items: stretch;
  height: 100%;
  width: 100%;
  gap: 0.5rem;
}

.si-filter-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.si-filter-input {
  height: 100%;
  width: 170px;
  background: var(--th-bg-input);
  border: 1px solid var(--th-border-strong);
  color: var(--th-text-primary);
  border-radius: clamp(5px, 1vw, 8px);
  padding: 0 clamp(1.8rem, 2.5vw, 2.2rem) 0 clamp(0.75rem, 1.5vw, 1rem);
  font-family: var(--font-body, 'Inter', system-ui, sans-serif);
  font-size: clamp(0.8rem, 2vw, 0.92rem);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.si-filter-input:focus {
  border-color: var(--th-emerald);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.si-filter-caret {
  position: absolute;
  right: clamp(0.6rem, 1vw, 0.8rem);
  color: var(--th-text-dim);
  pointer-events: none;
  display: flex;
  align-items: center;
}

.si-filter-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 100%;
  min-width: 200px;
  background: var(--th-bg-input);
  border: 1px solid var(--th-border-strong);
  border-radius: 8px;
  overflow-y: auto;
  max-height: 250px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  z-index: 30;
}

.si-filter-dropdown-item {
  display: block;
  width: 100%;
  padding: 0.6rem 1rem;
  cursor: pointer;
  border: none;
  border-bottom: 1px solid var(--th-border-mid);
  background: none;
  color: var(--th-text-body);
  text-align: left;
  font-size: 0.92rem;
  transition: background 0.12s;
}

.si-filter-dropdown-item:last-child {
  border-bottom: none;
}

.si-filter-dropdown-item:hover {
  background: var(--th-border-mid);
}

.si-filter-dropdown-item.placeholder {
  color: var(--th-text-dim);
}

.si-filter-dropdown-empty {
  padding: 0.6rem 1rem;
  color: var(--th-text-dim);
  font-size: 0.85rem;
  text-align: center;
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
  border-color: var(--th-emerald);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
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

/* .si-result removed */

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
  .si-wrap {
    margin-bottom: .5rem;
  }
}

@media (max-width: 640px) {
  .si-inner {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  .si-filter-wrap {
    width: 100%;
  }
  .si-filter-input {
    width: 100%;
    height: 38px;
    padding: 0 clamp(1.8rem, 2.5vw, 2.2rem) 0 clamp(0.75rem, 1.5vw, 1rem);
  }
  .si-icon {
    left: 8px;
  }
  .si-icon svg {
    width: 13px;
    height: 13px;
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

function BrandSearchableSelect({ value, onChange, options, placeholder }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    setTyped(value || "");
  }, [value]);

  React.useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setTyped(value || "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const filteredOptions = React.useMemo(() => {
    const q = typed.toLowerCase().trim();
    if (!q) return options;
    return options.filter(opt => {
      const val = typeof opt === 'string' ? opt : opt.value;
      return val.toLowerCase().includes(q);
    });
  }, [typed, options]);

  function handleSelect(val) {
    onChange(val);
    setTyped(val);
    setIsOpen(false);
  }

  function handleInputChange(e) {
    const v = e.target.value;
    setTyped(v);
    setIsOpen(true);
    if (v === "") {
      onChange("");
    }
  }

  return (
    <div className="si-filter-wrap" ref={containerRef}>
      <input
        className="si-filter-input"
        type="text"
        placeholder={placeholder || "Search brand..."}
        value={typed}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
      />
      <span className="si-filter-caret">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 1L5 5L9 1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {isOpen && (
        <div className="si-filter-dropdown">
          {placeholder && (
            <button
              className="si-filter-dropdown-item placeholder"
              onMouseDown={() => handleSelect("")}
              style={{ fontWeight: value === "" ? "bold" : "normal" }}
            >
              {placeholder}
            </button>
          )}
          {filteredOptions.map((opt, i) => {
            const val = typeof opt === 'string' ? opt : opt.value;
            const lbl = typeof opt === 'string' ? opt : opt.label;
            return (
              <button
                key={val + "_" + i}
                className="si-filter-dropdown-item"
                onMouseDown={() => handleSelect(val)}
                style={{ fontWeight: value === val ? "bold" : "normal" }}
              >
                {lbl}
              </button>
            );
          })}
          {filteredOptions.length === 0 && (
            <div className="si-filter-dropdown-empty">No matching brands</div>
          )}
        </div>
      )}
    </div>
  );
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
  filterValue,
  onFilterChange,
  filterOptions,
  filterPlaceholder,
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

  return (
    <div className={`si-wrap${className ? " " + className : ""}`} style={style}>
      <div className="si-inner">
        {filterOptions && onFilterChange && (
          <BrandSearchableSelect
            value={filterValue}
            onChange={onFilterChange}
            options={filterOptions}
            placeholder={filterPlaceholder}
          />
        )}
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'stretch' }}>
          <span className="si-icon" style={{ zIndex: 1, top: '50%', transform: 'translateY(-50%)' }}>
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
            <button className="si-clear" onClick={handleClear} tabIndex={-1} style={{ zIndex: 1, top: '50%', transform: 'translateY(-50%)' }}>×</button>
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
      </div>
    </div>
  );
}
