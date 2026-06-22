import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  Row,
  RowSelectionState
} from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable
} from '@tanstack/react-table'
import { useState } from 'react'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { getPaginationRange } from '@/utils/pagination-range'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  onRowClick?: (row: TData) => void
  pageSize?: number
  enableRowSelection?: boolean | ((row: Row<TData>) => boolean)
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  getRowId?: (row: TData) => string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
  pageSize,
  enableRowSelection,
  rowSelection,
  onRowSelectionChange,
  getRowId
}: DataTableProps<TData, TValue>) {
  const paginated = pageSize !== undefined
  const selectable = rowSelection !== undefined
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: pageSize ?? data.length
  })

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    ...(enableRowSelection !== undefined && { enableRowSelection }),
    ...(selectable && {
      onRowSelectionChange,
      state: { rowSelection }
    }),
    ...(paginated && {
      getPaginationRowModel: getPaginationRowModel(),
      onPaginationChange: setPagination,
      state: {
        pagination,
        ...(selectable && { rowSelection })
      }
    })
  })

  const pageCount = table.getPageCount()
  const currentPage = table.getState().pagination.pageIndex + 1
  const showPagination = paginated && pageCount > 1
  const pageRange = showPagination ? getPaginationRange(currentPage, pageCount) : []

  function goToPage(page: number) {
    table.setPageIndex(page - 1)
  }

  return (
    <div className="flex flex-col">
      <Table>
        <TableHeader className="bg-muted [&_tr]:border-0">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow className="hover:bg-transparent" key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                className={cn(onRowClick && 'cursor-pointer hover:bg-muted/50')}
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="h-24 text-center" colSpan={columns.length}>
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {showPagination && (
        <Pagination className="border-t px-6 py-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                aria-disabled={!table.getCanPreviousPage()}
                className={cn(!table.getCanPreviousPage() && 'pointer-events-none opacity-50')}
                href="#"
                onClick={(event) => {
                  event.preventDefault()
                  if (table.getCanPreviousPage()) {
                    table.previousPage()
                  }
                }}
              />
            </PaginationItem>
            {pageRange.map((item, index) =>
              item === 'ellipsis' ? (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    href="#"
                    isActive={item === currentPage}
                    onClick={(event) => {
                      event.preventDefault()
                      goToPage(item)
                    }}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                aria-disabled={!table.getCanNextPage()}
                className={cn(!table.getCanNextPage() && 'pointer-events-none opacity-50')}
                href="#"
                onClick={(event) => {
                  event.preventDefault()
                  if (table.getCanNextPage()) {
                    table.nextPage()
                  }
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
