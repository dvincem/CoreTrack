import { useRef } from 'react';

const STORAGE_KEY = 'th-search-prefill';

/**
 * useSearchPrefill(pageId)
 *
 * Reads the global-search prefill stored in sessionStorage by GlobalSearch when
 * the user clicks a result. Returns { q, id, action } if the prefill matches
 * this page; returns an empty object otherwise.
 *
 * The payload is consumed (cleared) immediately on the first read so that
 * navigating away and back does not re-trigger it.
 *
 * The `consumed` ref prevents a double-fire in React StrictMode's double-invoke
 * of effects.
 */
export function useSearchPrefill(pageId) {
  const consumed = useRef(false);

  if (consumed.current) return {};

  let prefill = null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      prefill = JSON.parse(raw);
      if (prefill?.page !== pageId) prefill = null;
    }
  } catch (_) { /* ignore */ }

  if (prefill) {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
    consumed.current = true;
    return {
      q:      prefill.q      ?? '',
      id:     prefill.id     ?? null,
      action: prefill.action ?? null,
    };
  }

  return {};
}
