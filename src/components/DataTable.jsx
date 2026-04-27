import React, { useState, useMemo } from 'react'
import { SkeletonRows } from '../lib/config'
import Pagination from './Pagination'

/**
 * DataTable — shared table component for TireHub pages.
 * Supports automatic sorting and pagination UI.
 */
export function DataTable({
  columns = [],
  rows = [],
  rowKey = 'id',
  onRowClick,
  selectedKey,
  getRowClassName,
  getRowStyle,
  emptyTitle = 'No Data Found',
  emptyMessage = 'No records match your current filters.',
  emptyIcon,
  loading = false,
  skeletonRows = 6,
  skeletonWidths,
  minWidth = 700,
  mobileLayout = 'scroll', // 'scroll' | 'cards'
  currentPage,
  totalPages,
  onPageChange,
  className = '',
  style,
  onSort, // Optional callback for external sorting
  initialSort = null, // { key: 'name', direction: 'asc' }
}) {
  const [sortConfig, setSortConfig] = useState(initialSort)

  const handleSort = (key, sortable) => {
    if (sortable === false) return

    let direction = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }

    const newConfig = { key, direction }
    setSortConfig(newConfig)
    if (onSort) onSort(newConfig)
  }

  const sortedRows = useMemo(() => {
    if (onSort || !sortConfig) return rows

    return [...rows].sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]

      if (aVal === bVal) return 0
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      // Handle numbers
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
      }

      // Handle strings
      const aString = String(aVal).toLowerCase()
      const bString = String(bVal).toLowerCase()
      if (aString < bString) return sortConfig.direction === 'asc' ? -1 : 1
      if (aString > bString) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [rows, sortConfig, onSort])

  const defaultEmptyIcon = (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="th-tbl-empty-icon"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )

  const wrapClass = [
    'th-tbl-wrap',
    mobileLayout === 'cards' ? 'cards' : 'scroll-mode',
    onRowClick ? 'th-tbl-clickable' : '',
    className,
  ].filter(Boolean).join(' ')

  const SortIcon = ({ colKey }) => {
    const isActive = sortConfig?.key === colKey
    const direction = sortConfig?.direction

    return (
      <div className="th-tbl-sort-icon">
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          style={{ 
            marginBottom: '-2px', 
            color: isActive && direction === 'asc' ? 'var(--th-orange)' : 'inherit',
            opacity: isActive && direction === 'asc' ? 1 : 0.4
          }}
        >
          <path d="M18 15l-6-6-6 6" />
        </svg>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          style={{ 
            marginTop: '-2px', 
            color: isActive && direction === 'desc' ? 'var(--th-orange)' : 'inherit',
            opacity: isActive && direction === 'desc' ? 1 : 0.4
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    )
  }

  return (
    <div className={wrapClass} style={style}>
      <div className="th-tbl-scroll">
        <table className="th-tbl" style={{ minWidth: mobileLayout === 'cards' ? undefined : minWidth }}>
          <thead>
            <tr>
              {columns.map((col) => {
                const isSortable = col.sortable !== false
                const isActive = sortConfig?.key === col.key
                return (
                  <th
                    key={col.key}
                    className={[
                      col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : '',
                      isSortable ? 'sortable' : '',
                      isActive ? 'active-sort' : '',
                    ].filter(Boolean).join(' ')}
                    style={col.width ? { width: col.width } : undefined}
                    onClick={() => handleSort(col.key, isSortable)}
                  >
                    <div className="th-tbl-sort-content">
                      {col.label}
                      {isSortable && <SortIcon colKey={col.key} />}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows
                rows={skeletonRows}
                cols={columns.length}
                widths={skeletonWidths}
              />
            ) : sortedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="th-tbl-empty">
                    {emptyIcon ?? defaultEmptyIcon}
                    <span className="th-tbl-empty-title">{emptyTitle}</span>
                    {emptyMessage}
                  </div>
                </td>
              </tr>
            ) : (
              sortedRows.map((row, idx) => {
                const key = row[rowKey] ?? idx
                const isSelected = selectedKey !== undefined && row[rowKey] === selectedKey
                const extraClass = getRowClassName ? getRowClassName(row) : ''
                const extraStyle = getRowStyle ? getRowStyle(row) : undefined
                return (
                  <tr
                    key={key}
                    className={`${isSelected ? 'selected' : ''} ${extraClass}`.trim()}
                    style={extraStyle}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        data-label={col.label}
                        className={col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : ''}
                      >
                        {col.render ? col.render(row, idx) : row[col.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {currentPage !== undefined && totalPages !== undefined && onPageChange && (
        <div
          style={{
            position: 'sticky',
            left: 0,
            borderTop: '1px solid var(--th-border)',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  )
}

export default DataTable
