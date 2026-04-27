import React from "react";

const styles = `
.pg-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  flex-shrink: 0;
}
.pg-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 0.4rem;
  border-radius: 6px;
  border: 1px solid var(--th-border-strong);
  background: var(--th-bg-input);
  color: var(--th-text-muted);
  font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.14s;
  line-height: 1;
}
.pg-btn:hover:not(:disabled):not(.active) {
  background: var(--th-border-mid);
  color: var(--th-text-primary);
  border-color: var(--th-border-strong);
}
.pg-btn.active {
  background: var(--th-orange);
  border-color: var(--th-orange);
  color: #fff;
  font-weight: 700;
  cursor: default;
}
.pg-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.pg-ellipsis {
  color: var(--th-text-faint);
  font-size: 0.85rem;
  padding: 0 0.2rem;
  user-select: none;
}

@media (max-width: 640px) {
  .pg-wrap {
    gap: 0.18rem;
    padding: 0.5rem 0.6rem;
  }
  .pg-btn {
    min-width: 26px;
    height: 26px;
    font-size: 0.75rem;
    border-radius: 5px;
    padding: 0 0.3rem;
  }
  .pg-ellipsis {
    font-size: 0.75rem;
    padding: 0 0.1rem;
  }
}

@media (max-width: 480px) {
  .pg-wrap {
    gap: 0.14rem;
    padding: 0.4rem 0.5rem;
  }
  .pg-btn {
    min-width: 24px;
    height: 24px;
    font-size: 0.7rem;
    border-radius: 4px;
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

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  React.useEffect(() => { injectStyles(); }, []);

  if (totalPages <= 1) return null;

  // Always show 3 pages centered on current page
  function pageNums() {
    const count = Math.min(3, totalPages);
    let start = currentPage - 1;
    if (start < 1) start = 1;
    if (start + count - 1 > totalPages) start = totalPages - count + 1;
    return Array.from({ length: count }, (_, i) => start + i);
  }

  return (
    <div className="pg-wrap">
      <button className="pg-btn" disabled={currentPage === 1} onClick={() => onPageChange(1)} title="First">«</button>
      <button className="pg-btn" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} title="Previous">‹</button>
      {pageNums().map((p, i) =>
        p === "…"
          ? <span key={`e${i}`} className="pg-ellipsis">…</span>
          : <button key={p} className={`pg-btn${p === currentPage ? " active" : ""}`} onClick={() => onPageChange(p)}>{p}</button>
      )}
      <button className="pg-btn" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} title="Next">›</button>
      <button className="pg-btn" disabled={currentPage === totalPages} onClick={() => onPageChange(totalPages)} title="Last">»</button>
    </div>
  );
}
