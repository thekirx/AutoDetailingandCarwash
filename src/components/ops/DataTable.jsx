import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import OpsEmptyState from '@/components/ops/OpsEmptyState'
import { cn } from '@/lib/utils'

/**
 * Thin DataTable over shadcn Table: search, sort, sticky header, mobile card fallback.
 * columns: [{ id, header, accessorKey?, cell?(row), sortable?, className?, hideOnMobile? }]
 */
export default function DataTable({
  columns = [],
  data = [],
  searchKeys,
  searchPlaceholder = 'Search…',
  emptyTitle = 'No rows',
  emptyDescription,
  className,
  getRowId,
}) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState({ id: null, dir: 'asc' })

  const filtered = useMemo(() => {
    let rows = Array.isArray(data) ? data : []
    const query = q.trim().toLowerCase()
    if (query) {
      const keys = searchKeys || columns.map((c) => c.accessorKey).filter(Boolean)
      rows = rows.filter((row) =>
        keys.some((k) => String(row?.[k] ?? '').toLowerCase().includes(query)),
      )
    }
    if (sort.id) {
      const col = columns.find((c) => c.id === sort.id)
      const key = col?.accessorKey || sort.id
      rows = [...rows].sort((a, b) => {
        const av = a?.[key]
        const bv = b?.[key]
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        if (typeof av === 'number' && typeof bv === 'number') {
          return sort.dir === 'asc' ? av - bv : bv - av
        }
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }
    return rows
  }, [data, q, sort, columns, searchKeys])

  function toggleSort(id) {
    setSort((prev) => {
      if (prev.id !== id) return { id, dir: 'asc' }
      if (prev.dir === 'asc') return { id, dir: 'desc' }
      return { id: null, dir: 'asc' }
    })
  }

  function cellValue(col, row) {
    if (typeof col.cell === 'function') return col.cell(row)
    if (col.accessorKey) return row?.[col.accessorKey]
    return null
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {searchKeys !== false ? (
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          className="min-h-11 max-w-sm"
          aria-label={searchPlaceholder}
        />
      ) : null}

      {/* Mobile cards */}
      <div className="grid gap-2 md:hidden">
        {filtered.length === 0 ? (
          <OpsEmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          filtered.map((row, i) => (
            <div
              key={getRowId?.(row) ?? row.id ?? i}
              className="rounded-[var(--shape-card)] border border-border bg-card p-3"
            >
              <dl className="grid gap-2">
                {columns
                  .filter((c) => !c.hideOnMobile)
                  .map((col) => (
                    <div key={col.id} className="flex items-start justify-between gap-3 text-sm">
                      <dt className="text-muted-foreground">{col.header}</dt>
                      <dd className={cn('text-right font-medium', col.className)}>{cellValue(col, row)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-[var(--shape-card)] border border-border">
        <Table>
          <TableHeader className="sticky top-0 z-[1] bg-card">
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.id} className={col.className}>
                  {col.sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-semibold hover:text-foreground"
                      onClick={() => toggleSort(col.id)}
                    >
                      {col.header}
                      {sort.id === col.id ? (
                        sort.dir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <OpsEmptyState title={emptyTitle} description={emptyDescription} />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row, i) => (
                <TableRow key={getRowId?.(row) ?? row.id ?? i}>
                  {columns.map((col) => (
                    <TableCell key={col.id} className={col.className}>
                      {cellValue(col, row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
