import React from 'react'

export const API_URL = '/api'

export const currency = (n) =>
  `₱${Number(n || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

/** Compact currency: ₱1.2M, ₱350.5K, or full ₱ for < 1 000 */
export const compactCurrency = (n) => {
  const v = Number(n || 0)
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}₱${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000)     return `${sign}₱${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)         return `${sign}₱${(abs / 1_000).toFixed(1)}K`
  return currency(v)
}

/**
 * Authenticated fetch — automatically injects the stored JWT token.
 * If the server returns 401, clears the token and reloads so the
 * login page is shown again.
 */
export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('th-token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }
  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    localStorage.removeItem('th-token')
    localStorage.removeItem('th-user')
    window.location.reload()
  }
  return res
}

/**
 * SkeletonRows — animated placeholder rows for table loading states.
 * @param {number} rows - number of skeleton rows (default 6)
 * @param {number} cols - number of columns (default 5)
 * @param {string[]} widths - optional array of width classes per col (w20/w30/w40/w60/w80/w100)
 */
export function SkeletonRows({ rows = 6, cols = 5, widths }) {
  const wList = widths || Array(cols).fill('w60')
  return Array.from({ length: rows }).map((_, r) =>
    React.createElement('tr', { key: r, className: 'th-skel-row' },
      wList.map((w, c) =>
        React.createElement('td', { key: c },
          React.createElement('div', { className: `th-skel-cell ${w}` })
        )
      )
    )
  )
}
