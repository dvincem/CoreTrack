import React from 'react';
import SearchInput from './SearchInput';

const makeStyles = (accentColor) => `
  .fh-card {
    background: var(--th-bg-card);
    border: 1px solid var(--th-border);
    border-radius: 12px;
    padding: 0.55rem 1rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.85rem 1rem;
    position: relative;
    z-index: 20;
    min-height: min-content;
    width: 100%;
    box-sizing: border-box;
    overflow: visible;
    font-size: clamp(0.8rem, 2vw, 0.92rem);
  }
  .fh-left span, .fh-left label { font-size: inherit !important; }
  .fh-left {
    display: flex;
    align-items: center;
    order: 1;
    flex-shrink: 0;
    gap: 0.5rem;
    height: clamp(2rem, 5vw, 2.3rem);
  }
  .fh-search {
    flex: 1 1 200px;
    order: 2;
    min-width: 0;
    height: clamp(2rem, 5vw, 2.3rem);
  }
  .fh-filters {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    order: 3;
    flex-shrink: 0;
    flex-wrap: nowrap;
  }
  .fh-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: clamp(0.1rem, .5vw, 0.1rem) .8rem;
    border-radius: 30px;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: clamp(0.8rem, 2vw, 0.92rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
    border: 1px solid var(--th-border-strong);
    background: transparent;
    color: var(--th-text-muted);
    transition: all 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
    box-sizing: border-box;
    height: clamp(2rem, 5vw, 2rem);
  }  .fh-btn:hover { border-color: var(--th-border-mid); color: var(--th-text-primary); }
  .fh-btn.active {
    background: color-mix(in srgb, ${accentColor} 12%, transparent);
    color: ${accentColor};
    border-color: ${accentColor};
    box-shadow: 0 0 0 3px color-mix(in srgb, ${accentColor} 33%, transparent);
  }
  .fh-btn-count { margin-left: 0.4rem; font-size: 0.75rem; opacity: 0.7; }

  /* Stacked layout — search on top row, filters wrap below */
  .fh-card.fh-stacked {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
    overflow-x: visible;
  }
  .fh-card.fh-stacked .fh-search { order: 1; width: 100%; flex: none; height: clamp(2rem, 5vw, 2.3rem); }
  .fh-card.fh-stacked .fh-left  { order: 2; width: 100%; flex-wrap: wrap; height: auto; }
  .fh-card.fh-stacked .fh-filters { order: 3; width: 100%; flex-wrap: wrap; flex-shrink: unset; }
  .fh-card.fh-stacked .fh-left > * { width: 100%; flex: 1; min-width: 0; }

  /* Two-row layout — left+search share row 1, filters wrap to row 2 */
  .fh-card.fh-two-row {
    flex-wrap: wrap;
    overflow-x: visible;
  }
  .fh-card.fh-two-row .fh-left    { order: 1; flex-shrink: 0; height: auto; align-self: center; }
  .fh-card.fh-two-row .fh-search  { order: 2; flex: 1 1 160px; min-width: 0; }
  .fh-card.fh-two-row .fh-filters { order: 3; width: 100%; flex-wrap: wrap; flex-shrink: unset; gap: 0.4rem; }

  @media (max-width: 850px) {
    .fh-card { flex-direction: column; align-items: stretch; gap: 0.5rem; padding: 0.65rem 0.85rem; overflow-x: visible; }
    .fh-search { order: 1; width: 100%; flex: none; }
    .fh-left { order: 2; width: 100%; flex-wrap: wrap; height: auto; }
    .fh-filters { order: 3; width: 100%; flex-wrap: wrap; }
    .fh-left > * { width: 100%; flex: 1; min-width: 0; }
    .fh-card.fh-two-row .fh-left { order: 2; width: 100%; }
    .fh-card.fh-two-row .fh-search { order: 1; width: 100%; flex: none; }
  }
  .fh-select, .fh-date {
    background: var(--th-bg-input);
    border: 1px solid var(--th-border-strong);
    color: var(--th-text-primary);
    padding: 0 0.5rem;
    border-radius: 8px;
    font-family: var(--font-body);
    font-size: clamp(0.8rem, 2vw, 0.92rem);
    outline: none;
    height: 100%;
    width: 100%;
    transition: border-color 0.2s;
    box-sizing: border-box;
    margin-right: .1rem;
    flex: 1 1 0%;
    min-width: 120px;
    min-height: 35px;
  }
  .fh-select:focus, .fh-date:focus { border-color: ${accentColor}; }
`;

/**
 * FilterHeader — reusable toolbar for Search, Dates, and Filter Buttons.
 *
 * Props:
 *  searchProps    {value, onChange, placeholder, suggestions, onSuggestionSelect, resultCount, resultLabel}
 *  leftComponent  node    — date picker, date range, or select dropdown
 *  filters        array   — [{ label, value, active, count }]
 *  onFilterChange fn      — called with filter.value on click
 *  accentColor    string  — CSS color/var for active state (default: var(--th-sky))
 *  stacked        bool    — column layout: search top, left middle, filters bottom
 *  twoRow         bool    — left+search share row 1, filters wrap to row 2
 */
const FilterHeader = React.memo(({
  searchProps,
  leftComponent,
  filters = [],
  onFilterChange,
  accentColor = 'var(--th-sky)',
  stacked = false,
  twoRow = false,
}) => {
  const styles = React.useMemo(() => makeStyles(accentColor), [accentColor]);

  const handleFilter = React.useCallback(
    (value) => { if (onFilterChange) onFilterChange(value); },
    [onFilterChange],
  );

  const layoutClass = stacked ? ' fh-stacked' : twoRow ? ' fh-two-row' : '';

  return (
    <>
      <style>{styles}</style>
      <div className={`fh-card${layoutClass}`}>
        {leftComponent && <div className="fh-left">{leftComponent}</div>}

        {searchProps && (
          <div className="fh-search">
            <SearchInput {...searchProps} style={{ marginBottom: 0, width: '100%', height: '100%' }} />
          </div>
        )}

        {filters.length > 0 && (
          <div className="fh-filters" role="group" aria-label="Filters">
            {filters.map((f) => (
              <button
                key={f.value}
                className={`fh-btn${f.active ? ' active' : ''}`}
                aria-pressed={f.active}
                onClick={() => handleFilter(f.value)}
              >
                {f.label}
                {f.count !== undefined && (
                  <span className="fh-btn-count" aria-label={`${f.count} items`}>{f.count}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
});

FilterHeader.displayName = 'FilterHeader';

export default FilterHeader;
