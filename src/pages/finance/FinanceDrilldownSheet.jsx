/**
 * Finance Drill-Down Sheet — Immersive General Ledger Transaction Breakdown.
 * Allows clicking on any P&L category or monthly cell to inspect every line item
 * inputted into the system (Bills, Daily Sheet lines, Payroll, POS Sales, Cash Advances)
 * with deep links and redirection to source records.
 */

import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  Download,
  LoaderCircle,
  Receipt,
  Search,
  Wallet,
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAccounting } from '@/lib/dailySheet'
import { downloadCsv } from '@/lib/financeData'
import {
  fetchExpenseCategoryLines,
  fetchIncomeCategoryLines,
} from '@/lib/financeDrilldown'

export default function FinanceDrilldownSheet({
  open,
  onOpenChange,
  target,
  profile,
  branchOptions = [],
}) {
  const navigate = useNavigate()
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')

  const categoryName = target?.category || ''
  const isIncome = target?.kind === 'income'
  const start = target?.start || ''
  const end = target?.end || ''
  const branch = target?.branch || 'all'
  const periodLabel = target?.periodLabel || (start && end ? `${start} → ${end}` : 'Active period')
  const branchLabel =
    branch === 'all'
      ? 'All branches'
      : branchOptions.find((b) => b.slug === branch)?.name || branch

  // Fetch transaction lines when target changes or sheet opens
  useEffect(() => {
    if (!open || !categoryName) return
    let active = true
    setLoading(true)
    setError('')
    setSearch('')
    setSourceFilter('all')

    const fetcher = isIncome ? fetchIncomeCategoryLines : fetchExpenseCategoryLines

    fetcher({
      categoryName,
      start,
      end,
      branch,
      profile,
    })
      .then((data) => {
        if (!active) return
        setLines(data)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setError(err.message || 'Could not load transaction lines')
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [open, categoryName, isIncome, start, end, branch, profile])

  // Filtered rows by search and source
  const filteredLines = useMemo(() => {
    let result = lines
    if (sourceFilter !== 'all') {
      result = result.filter((l) => l.sourceType === sourceFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (l) =>
          (l.title && l.title.toLowerCase().includes(q)) ||
          (l.description && l.description.toLowerCase().includes(q)) ||
          (l.vendor && l.vendor.toLowerCase().includes(q)) ||
          (l.customer && l.customer.toLowerCase().includes(q)) ||
          (l.reference && l.reference.toLowerCase().includes(q)) ||
          (l.branch && l.branch.toLowerCase().includes(q))
      )
    }
    return result
  }, [lines, sourceFilter, search])

  // Summary metrics
  const totalAmount = useMemo(
    () => filteredLines.reduce((sum, l) => sum + (l.amountMinor || 0), 0),
    [filteredLines]
  )

  const distinctSources = useMemo(() => {
    const s = new Set(lines.map((l) => l.sourceType).filter(Boolean))
    return Array.from(s)
  }, [lines])

  function handleExportCsv() {
    if (!filteredLines.length) return
    const exportData = filteredLines.map((l) => ({
      Date: l.date,
      Branch: l.branch,
      Category: categoryName,
      Description: l.title,
      Details: l.description,
      Party: l.vendor || l.customer || '',
      Reference: l.reference,
      Source: l.sourceLabel,
      PaymentMethod: l.paidFrom,
      Amount: (l.amountMinor / 100).toFixed(2),
      Status: l.status,
    }))
    const columns = [
      { key: 'Date', label: 'Date' },
      { key: 'Branch', label: 'Branch' },
      { key: 'Category', label: 'Category' },
      { key: 'Description', label: 'Description' },
      { key: 'Details', label: 'Details' },
      { key: 'Party', label: 'Party / Payee / Customer' },
      { key: 'Reference', label: 'Reference' },
      { key: 'Source', label: 'Source' },
      { key: 'PaymentMethod', label: 'Payment Method' },
      { key: 'Amount', label: 'Amount (PHP)' },
      { key: 'Status', label: 'Status' },
    ]
    downloadCsv(exportData, columns, `breakdown_${categoryName.replace(/\s+/g, '_')}_${periodLabel.replace(/\s+/g, '_')}.csv`)
  }

  function handleNavigate(url) {
    if (!url) return
    onOpenChange(false)
    navigate(url)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-4xl p-0 flex flex-col bg-card text-card-foreground shadow-2xl"
      >
        {/* Sticky Sheet Header */}
        <SheetHeader className="p-5 border-b border-border bg-muted/20 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={isIncome ? 'default' : 'secondary'} className="uppercase font-bold tracking-wider text-[10px]">
                {isIncome ? 'Trading Income' : 'Operating Expense'}
              </Badge>
              {target?.code ? (
                <Badge variant="outline" className="font-mono text-xs">
                  Account {target.code}
                </Badge>
              ) : null}
              <Badge variant="outline" className="text-xs">
                {periodLabel}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {branchLabel}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-9 gap-1.5 cursor-pointer text-xs"
                onClick={handleExportCsv}
                disabled={!filteredLines.length}
              >
                <Download size={14} />
                Export CSV
              </Button>
            </div>
          </div>
          <SheetTitle className="text-xl font-bold tracking-tight text-foreground mt-2">
            {categoryName}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Complete transaction breakdown showing each line inputted into the system. Click any row or action to inspect the underlying source record.
          </SheetDescription>
        </SheetHeader>

        {/* Metric Summary Strip */}
        <div className="grid grid-cols-3 gap-2 px-5 py-3 border-b border-border bg-muted/10 shrink-0">
          <div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Total Amount</span>
            <span className={`text-lg font-bold tabular-nums ${totalAmount < 0 ? 'text-destructive' : 'text-foreground'}`}>
              {formatAccounting(totalAmount)}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Transactions</span>
            <span className="text-lg font-bold tabular-nums text-foreground">
              {filteredLines.length}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Average Line</span>
            <span className="text-lg font-bold tabular-nums text-foreground">
              {filteredLines.length ? formatAccounting(Math.round(totalAmount / filteredLines.length)) : '—'}
            </span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-3 bg-card shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              type="search"
              placeholder="Search title, party, note, or reference…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 min-h-10 text-xs w-full"
            />
          </div>
          {distinctSources.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={sourceFilter === 'all' ? 'default' : 'outline'}
                className="min-h-8 text-xs cursor-pointer"
                onClick={() => setSourceFilter('all')}
              >
                All Sources
              </Button>
              {distinctSources.map((src) => (
                <Button
                  key={src}
                  type="button"
                  size="sm"
                  variant={sourceFilter === src ? 'default' : 'outline'}
                  className="min-h-8 text-xs cursor-pointer capitalize"
                  onClick={() => setSourceFilter(src)}
                >
                  {src.replace('_', ' ')}
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Scrollable Transaction Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <LoaderCircle className="animate-spin size-8 text-primary" />
              <p className="text-sm">Loading each transaction line from the general ledger…</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-destructive">{error}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 text-xs"
                onClick={() => onOpenChange(false)}
              >
                Dismiss
              </Button>
            </div>
          ) : filteredLines.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Receipt className="size-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium">No transaction lines found for this selection.</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? 'Try clearing your search query.' : 'There are no posted entries in this date window.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-24">Date</TableHead>
                    <TableHead className="w-20">Branch</TableHead>
                    <TableHead className="min-w-[180px]">Item / Description</TableHead>
                    <TableHead className="w-28">Source</TableHead>
                    <TableHead className="w-20">Method</TableHead>
                    <TableHead className="text-right w-28">Amount</TableHead>
                    <TableHead className="text-right w-24">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLines.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                        {row.date}
                      </TableCell>
                      <TableCell className="capitalize font-medium">
                        {row.branch}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-foreground leading-snug">{row.title}</div>
                        {row.description ? (
                          <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 break-words">
                            {row.description}
                          </div>
                        ) : null}
                        {row.vendor || row.customer ? (
                          <div className="text-[10px] text-primary/80 font-medium mt-0.5">
                            {row.vendor ? `From: ${row.vendor}` : `Customer: ${row.customer}`}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.badgeVariant || 'outline'} className="text-[10px] whitespace-nowrap">
                          {row.sourceLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="uppercase text-[10px] font-mono font-medium text-muted-foreground">
                        {row.paidFrom || '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-bold text-foreground whitespace-nowrap">
                        {formatAccounting(row.amountMinor)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {row.targetUrl ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-[11px] gap-1 cursor-pointer text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => handleNavigate(row.targetUrl)}
                            title={`Redirect to ${row.actionLabel || 'source'}`}
                          >
                            <span>{row.actionLabel || 'Open'}</span>
                            <ArrowUpRight size={13} />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground/40 text-[10px]">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Footer with Quick Redirection */}
        <div className="p-4 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="text-muted-foreground">
            Showing <strong className="text-foreground">{filteredLines.length}</strong> of{' '}
            <strong className="text-foreground">{lines.length}</strong> lines
          </div>
          <div className="flex items-center gap-2">
            {!isIncome ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-9 text-xs cursor-pointer gap-1.5"
                onClick={() => handleNavigate(`/operations/finance?tab=purchases`)}
              >
                <Receipt size={14} />
                Open All Bills
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 text-xs cursor-pointer gap-1.5"
              onClick={() => handleNavigate(`/operations/finance?tab=sheets`)}
            >
              <Wallet size={14} />
              Open Daily Sheets
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="min-h-9 text-xs cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
