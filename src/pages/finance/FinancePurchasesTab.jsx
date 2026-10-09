/** Finance Bills — Xero-style New bill (header + lines), status flow, account filter (URL `acct`), CSV. */
import { useMemo, useState } from 'react'
import { Download, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import FinanceBillForm from './FinanceBillForm'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { formatMoney } from '@/queue/queueApi'
import { downloadCsv, formatFinanceWindow } from '@/lib/financeData'
import {
  FinanceEmpty,
  FinanceMetricCell,
  FinanceMetricStrip,
  FinancePanel,
  FinanceTabSkeleton,
} from './FinanceChrome'

const STATUS_FLOW = ['draft', 'pending_approval', 'approved', 'pending_payment', 'paid', 'posted']
const STATUS_LABEL = {
  draft: 'Draft',
  pending_approval: 'Awaiting approval',
  approved: 'Approved',
  pending_payment: 'Awaiting payment',
  paid: 'Paid',
  posted: 'Posted',
}
const STATUS_BADGE = {
  draft: 'secondary',
  pending_approval: 'outline',
  approved: 'secondary',
  pending_payment: 'outline',
  paid: 'default',
  posted: 'default',
}

export default function FinancePurchasesTab({
  expenses,
  categories,
  vendors = [],
  branches,
  writableBranches,
  canWrite,
  range,
  loading,
  onReload,
  onCatalogAdd,
  accountFilter = '',
  onAccountFilter,
}) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const vendorName = (id) => vendors.find((v) => v.id === id)?.name || ''

  const filtered = useMemo(() => {
    let rows = [...(expenses || [])]
    if (statusFilter !== 'all') rows = rows.filter((r) => r.status === statusFilter)
    if (accountFilter) rows = rows.filter((r) => r.category_id === accountFilter)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      rows = rows.filter((r) =>
        [r.title, r.description, r.bill_reference].some((v) => String(v || '').toLowerCase().includes(q)),
      )
    }
    return rows
  }, [expenses, statusFilter, accountFilter, query])

  const metrics = useMemo(() => {
    const all = expenses || []
    const total = filtered.reduce((s, r) => s + Number(r.total_minor || 0), 0)
    const draft = all.filter((r) => r.status === 'draft').length
    const awaiting = all.filter((r) => r.status === 'pending_approval' || r.status === 'pending_payment').length
    const booked = all.filter((r) => r.status === 'paid' || r.status === 'posted')
    const bookedMinor = booked.reduce((s, r) => s + Number(r.total_minor || 0), 0)
    return { total, draft, awaiting, bookedCount: booked.length, bookedMinor }
  }, [expenses, filtered])

  const exportColumns = useMemo(
    () => [
      { key: 'title', label: 'Item' },
      { key: 'vendor_id', label: 'From', value: (row) => vendors.find((v) => v.id === row.vendor_id)?.name || '' },
      { key: 'bill_reference', label: 'Reference', value: (row) => row.bill_reference || '' },
      { key: 'due_date', label: 'Due date', value: (row) => row.due_date || '' },
      {
        key: 'branch',
        label: 'Branch',
        value: (row) => branches.find((b) => b.slug === row.branch)?.name || row.branch || '—',
      },
      {
        key: 'category_id',
        label: 'Account',
        value: (row) => categories.find((c) => c.id === row.category_id)?.name || 'Uncategorized',
      },
      { key: 'total_minor', label: 'Amount', value: (row) => formatMoney(row.total_minor) },
      { key: 'status', label: 'Status', value: (row) => STATUS_LABEL[row.status] || row.status },
      { key: 'created_at', label: 'Date', value: (row) => new Date(row.created_at).toLocaleDateString('en-PH') },
    ],
    [branches, categories, vendors],
  )

  const windowLabel = formatFinanceWindow(range.start, range.end)
  const subtitle = `${windowLabel} · ${filtered.length} bill${filtered.length === 1 ? '' : 's'}`
  const fileBase = `hakum-purchases-${range.start}-to-${range.end}`

  function openCreate() {
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(row) {
    setEditing(row)
    setShowForm(true)
  }

  async function transition(row, status) {
    if (!canWrite) return
    const { error } = await supabase.rpc('transition_expense', {
      p_expense_id: row.id,
      p_new_status: status,
      p_notes: null,
    })
    if (error) toast.error(error.message)
    else {
      toast.success(`Marked ${STATUS_LABEL[status] || status}`)
      onReload?.()
    }
  }

  async function remove(row) {
    if (!canWrite) return
    if (!window.confirm(`Delete "${row.title}"? This cannot be undone.`)) return
    const { error } = await supabase.from('expenses').delete().eq('id', row.id)
    if (error) toast.error(error.message)
    else {
      toast.success('Expense deleted')
      onReload?.()
    }
  }

  if (loading) return <FinanceTabSkeleton metrics={4} />

  return (
    <div className="finance-dash flex flex-col gap-5">
      <FinanceMetricStrip label="Bills totals">
        <FinanceMetricCell label="Filtered total" value={formatMoney(metrics.total)} hint={subtitle} tone="ink" />
        <FinanceMetricCell label="Drafts" value={String(metrics.draft)} hint="In window" tone="muted" />
        <FinanceMetricCell label="Awaiting action" value={String(metrics.awaiting)} hint="Approval or payment" tone="muted" />
        <FinanceMetricCell
          label="Paid + posted"
          value={formatMoney(metrics.bookedMinor)}
          hint={`${metrics.bookedCount} bills hit P&L`}
          tone="up"
        />
      </FinanceMetricStrip>

      <div className="finance-toolbar">
        <div className="finance-toolbar-search">
          <Search aria-hidden />
          <input
            type="search"
            placeholder="Search item, description or reference"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search bills"
          />
        </div>
        <div className="finance-toolbar-actions">
          <select
            className="finance-toolbar-select min-h-10"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {STATUS_FLOW.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            className="finance-toolbar-select min-h-10"
            value={accountFilter}
            onChange={(e) => onAccountFilter?.(e.target.value)}
            aria-label="Filter by account"
          >
            <option value="">All accounts</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ? `${c.code} · ` : ''}
                {c.name}
              </option>
            ))}
          </select>
          {canWrite ? (
            <Button type="button" className="min-h-10 cursor-pointer" onClick={openCreate}>
              <Plus data-icon="inline-start" />
              New bill
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="min-h-10 cursor-pointer"
            onClick={() => downloadCsv(filtered, exportColumns, `${fileBase}.csv`)}
          >
            <Download data-icon="inline-start" />
            CSV
          </Button>
        </div>
      </div>

      {showForm && canWrite ? (
        <FinancePanel title={editing ? 'Edit bill line' : 'New bill'} description="Who it's from, when it's due, and one line per item.">
          <FinanceBillForm
            key={editing?.id || 'new'}
            editing={editing}
            categories={categories}
            vendors={vendors}
            writableBranches={writableBranches}
            onCatalogAdd={onCatalogAdd}
            onCancel={() => setShowForm(false)}
            onSaved={() => {
              setShowForm(false)
              onReload?.()
            }}
          />
        </FinancePanel>
      ) : null}

      <FinancePanel title="Bills" description={subtitle}>
        {filtered.length === 0 ? (
          <FinanceEmpty
            title="No bills match these filters"
            body={canWrite ? 'Record a bill with New bill, or widen status / search.' : 'Widen status or search, or ask someone with write access to post spend.'}
            action={canWrite ? { label: 'New bill', onClick: openCreate } : null}
          />
        ) : (
          <>
            <div className="finance-mobile-list">
              {filtered.map((row) => (
                <article key={`m-${row.id}`} className="finance-mobile-card">
                  <div>
                    <p className="finance-mobile-title">{row.title}</p>
                    <p className="finance-mobile-sub">
                      {[vendorName(row.vendor_id), row.bill_reference, branches.find((b) => b.slug === row.branch)?.name || row.branch, categories.find((c) => c.id === row.category_id)?.name || 'Uncategorized']
                        .filter(Boolean)
                        .join(' · ')}
                      {row.due_date ? ` · due ${row.due_date}` : ''}
                    </p>
                  </div>
                  <div className="finance-mobile-amount">
                    <span className="tabular-nums">{formatMoney(row.total_minor)}</span>
                    <Badge variant={STATUS_BADGE[row.status] || 'secondary'}>
                      {STATUS_LABEL[row.status] || row.status}
                    </Badge>
                  </div>
                  {row.daily_sheet_line_id ? (
                    <p className="text-xs text-muted-foreground">From a daily sheet · change it on the sheet</p>
                  ) : canWrite ? (
                    <div className="finance-mobile-actions">
                      <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openEdit(row)}>
                        <Pencil data-icon="inline-start" />
                        Edit
                      </Button>
                      {nextStatus(row.status) ? (
                        <Button size="sm" className="cursor-pointer" onClick={() => transition(row, nextStatus(row.status))}>
                          {STATUS_LABEL[nextStatus(row.status)]}
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => remove(row)}>
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            <div className="finance-table-wrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="tabular-nums">{row.created_at ? getLocalCalendarDate(row.created_at) : '—'}</TableCell>
                      <TableCell>{vendorName(row.vendor_id) || '—'}</TableCell>
                      <TableCell>{row.bill_reference || '—'}</TableCell>
                      <TableCell className="font-medium">{row.title}</TableCell>
                      <TableCell>{categories.find((c) => c.id === row.category_id)?.name || 'Uncategorized'}</TableCell>
                      <TableCell>{branches.find((b) => b.slug === row.branch)?.name || row.branch}</TableCell>
                      <TableCell className="tabular-nums">{row.due_date || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(row.total_minor)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[row.status] || 'secondary'}>
                          {STATUS_LABEL[row.status] || row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {row.daily_sheet_line_id ? (
                            <span className="text-xs text-muted-foreground">Daily sheet</span>
                          ) : null}
                          {canWrite && !row.daily_sheet_line_id ? (
                            <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openEdit(row)}>
                              <Pencil data-icon="inline-start" />
                              Edit
                            </Button>
                          ) : null}
                          {canWrite && !row.daily_sheet_line_id && nextStatus(row.status) ? (
                            <Button size="sm" className="cursor-pointer" onClick={() => transition(row, nextStatus(row.status))}>
                              {STATUS_LABEL[nextStatus(row.status)]}
                            </Button>
                          ) : null}
                          {canWrite && !row.daily_sheet_line_id ? (
                            <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => remove(row)}>
                              <Trash2 data-icon="inline-start" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </FinancePanel>
    </div>
  )
}

function nextStatus(status) {
  const i = STATUS_FLOW.indexOf(status)
  if (i < 0 || i >= STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[i + 1]
}
