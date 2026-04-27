import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/config';

function stableKey(obj) {
  if (!obj) return '';
  return Object.keys(obj).sort().map(k => `${k}=${obj[k] ?? ''}`).join('&');
}

/**
 * Generic paginated list fetcher for the tirshop API contract:
 *   GET <url>?page&perPage&q[&extra] → { data, meta:{totalPages,totalCount}, stats }
 * Falls back to plain-array responses (legacy endpoints) as a single page.
 */
export default function usePaginatedResource({
  url,
  perPage = 20,
  initialSearch = '',
  extraParams = {},
  debounceMs = 300,
  enabled = true,
  deps = [],
} = {}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const extraKey = stableKey(extraParams);
  const depsKey = deps.map(String).join('|');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), debounceMs);
    return () => clearTimeout(t);
  }, [search, debounceMs]);

  useEffect(() => { setPage(1); }, [debouncedSearch, extraKey, depsKey]);

  const ticketRef = useRef(0);

  const run = useCallback(async () => {
    if (!enabled || !url) return;
    const ticket = ++ticketRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
      if (debouncedSearch) params.set('q', debouncedSearch);
      for (const [k, v] of Object.entries(extraParams || {})) {
        if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
      }
      const full = `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
      const res = await apiFetch(full);
      if (ticket !== ticketRef.current) return;
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      const json = await res.json();
      if (ticket !== ticketRef.current) return;
      if (Array.isArray(json)) {
        setData(json);
        setTotal(json.length);
        setTotalPages(1);
        setStats(null);
      } else {
        setData(Array.isArray(json?.data) ? json.data : []);
        setTotal(json?.meta?.totalCount ?? json?.meta?.total ?? 0);
        setTotalPages(json?.meta?.totalPages ?? 1);
        setStats(json?.stats ?? null);
      }
    } catch (e) {
      if (ticket === ticketRef.current) setError(e);
    } finally {
      if (ticket === ticketRef.current) setLoading(false);
    }
  }, [url, page, perPage, debouncedSearch, extraKey, enabled]);

  useEffect(() => { run(); }, [run, depsKey]);

  return {
    data, page, setPage, perPage,
    total, totalPages, stats,
    search, setSearch,
    loading, error,
    refetch: run,
  };
}
