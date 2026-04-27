import React from 'react';
import DataTable from './DataTable';
import usePaginatedResource from '../hooks/usePaginatedResource';

/**
 * PaginatedDataTable — A "Smart" wrapper around DataTable that handles 
 * its own data fetching, pagination, and search state.
 */
export default function PaginatedDataTable({
  // usePaginatedResource props
  url,
  perPage = 20,
  initialSearch = '',
  extraParams = {},
  deps = [],

  // Search state (Parent can control this)
  search,

  // Standard DataTable props
  columns,
  rowKey = 'id',
  onRowClick,
  selectedKey,
  getRowClassName,
  getRowStyle,
  emptyTitle,
  emptyMessage,
  emptyIcon,
  skeletonRows,
  skeletonWidths,
  minWidth,
  mobileLayout,
  className,
  style,

  // Allow passing a ref to the hook state if needed
  hookRef,

  ...props
}) {
  // We use initialSearch if search prop is not provided
  const paginated = usePaginatedResource({
    url,
    perPage,
    initialSearch: search !== undefined ? search : initialSearch,
    extraParams,
    deps,
  });

  // Expose hook state to parent
  React.useEffect(() => {
    if (hookRef) {
      hookRef.current = paginated;
    }
  }, [paginated, hookRef]);

  // Sync external search prop -> internal hook state
  // This is the primary way search is controlled in pages like ProductsPage.
  React.useEffect(() => {
    if (search !== undefined && search !== paginated.search) {
      paginated.setSearch(search);
    }
  }, [search, paginated.search]);

  return (
    <DataTable
      {...props}
      columns={columns}
      rows={paginated.data}
      loading={paginated.loading}
      currentPage={paginated.page}
      totalPages={paginated.totalPages}
      onPageChange={paginated.setPage}
      rowKey={rowKey}
      onRowClick={onRowClick}
      selectedKey={selectedKey}
      getRowClassName={getRowClassName}
      getRowStyle={getRowStyle}
      emptyTitle={emptyTitle}
      emptyMessage={emptyMessage}
      emptyIcon={emptyIcon}
      skeletonRows={skeletonRows}
      skeletonWidths={skeletonWidths}
      minWidth={minWidth}
      mobileLayout={mobileLayout}
      className={className}
      style={style}
    />
  );
}
