/** Finance Bills — Xero-style New bill (header + lines), status flow, account filter (URL `acct`), Categories CRUD trigger, Owner Daily-Sheet Bill override, CSV. */
import { useMemo, useState } from 'react'
import { Download, ExternalLink, Pencil, Plus, Search, Settings2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NamedSelect } from '@/components/ui/named-select'
import ConfirmDialog from '@/components/ops/ConfirmDialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { activeAccounts } from '@/lib/financeBooks'
import { callFinanceOwnerOps } from '@/lib/financeOwnerClient'
import FinanceBillForm from './FinanceBillForm'
import { FinanceCategoriesTab } from './FinanceCategoriesTab'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { formatMoney } from '@/queue/queueApi'
import { downloadCsv, formatFinanceWindow } from '@/lib/financeData'
import { writeAudit } from '@/lib/audit'
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
  isSuperAdmin = false,
  range,
  loading,
  onReload,
  onCatalogAdd,
  accountFilter = '',
  onAccountFilter,
  onOpenSheet,
}) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showCategoriesModal, setShowCategoriesModal] = useState(false)
  const [sheetBillModal, setSheetBillModal] = useState(null)
  const [sheetBillForm, setSheetBillForm] = useState({
    title: '',
    category_id: '',
    amount_php: '',
    paid_from: 'cash',
    bill_reference: '',
  })
  const [sheetBillBusy, setSheetBillBusy] = useState(false)
  const [confirmState, setConfirmState] = useState(null) // { kind: 'sheet_bill' | 'expense', row }
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
    const forApproval = all.filter((r) => r.status === 'pending_approval')
    const awaitingPay = all.filter((r) => r.status === 'pending_payment')
    const awaitingPayMinor = awaitingPay.reduce((s, r) => s + Number(r.total_minor || 0), 0)
    const booked = all.filter((r) => r.status === 'paid' || r.status === 'posted')
    const bookedMinor = booked.reduce((s, r) => s + Number(r.total_minor || 0), 0)
    return { total, draft, forApproval: forApproval.length, awaitingPayMinor, awaitingPayCount: awaitingPay.length, bookedCount: booked.length, bookedMinor }
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

  async function openDailySheetForBill(row) {
    if (!row?.daily_sheet_line_id) return
    try {
      let sheetId = null
      try {
        const res = await callFinanceOwnerOps({
          action: 'override-sheet-bill',
          sub_action: 'lookup-sheet',
          expense_id: row.id,
        })
        sheetId = res?.sheet_id || null
      } catch {
        const { data } = await supabase
          .from('daily_sheet_lines')
          .select('sheet_id')
          .eq('id', row.daily_sheet_line_id)
          .maybeSingle()
        sheetId = data?.sheet_id || null
      }
      if (!sheetId) {
        toast.error('Could not locate the source daily sheet for this bill.')
        return
      }
      onOpenSheet?.(sheetId)
    } catch (err) {
      toast.error(err?.message || 'Could not open daily sheet.')
    }
  }

  function openSheetBillOverride(row) {
    setSheetBillModal(row)
    setSheetBillForm({
      title: row.title || '',
      category_id: row.category_id || '',
      amount_php: ((Number(row.total_minor ?? row.amount_minor ?? 0) || 0) / 100).toFixed(2),
      paid_from: row.paid_from === 'gcash' ? 'gcash' : 'cash',
      bill_reference: row.bill_reference || '',
    })
  }

  async function saveSheetBillOverride(e) {
    e?.preventDefault?.()
    if (!sheetBillModal) return
    const amountNum = Number.parseFloat(String(sheetBillForm.amount_php || '0'))
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      toast.error('Enter a valid amount in PHP.')
      return
    }
    setSheetBillBusy(true)
    try {
      await callFinanceOwnerOps({
        action: 'override-sheet-bill',
        sub_action: 'update',
        expense_id: sheetBillModal.id,
        title: sheetBillForm.title.trim() || 'Expense',
        category_id: sheetBillForm.category_id || null,
        amount_minor: Math.round(amountNum * 100),
        paid_from: sheetBillForm.paid_from === 'gcash' ? 'gcash' : 'cash',
        bill_reference: sheetBillForm.bill_reference.trim() || null,
      })
      toast.success('Daily-sheet bill updated and synced with Daily Sheet & Finance P&L.')
      setSheetBillModal(null)
      await onReload?.()
    } catch (err) {
      toast.error(err?.message || 'Could not override daily-sheet bill.')
    } finally {
      setSheetBillBusy(false)
    }
  }

  async function performDeleteSheetBillOverride(row) {
    if (!row) return
    setSheetBillBusy(true)
    try {
      await callFinanceOwnerOps({
        action: 'override-sheet-bill',
        sub_action: 'delete',
        expense_id: row.id,
      })
      toast.success('Daily-sheet bill removed and sheet totals recalculated.')
      setSheetBillModal(null)
      await onReload?.()
    } catch (err) {
      toast.error(err?.message || 'Could not delete daily-sheet bill.')
    } finally {
      setSheetBillBusy(false)
      setConfirmState(null)
    }
  }

  function deleteSheetBillOverride(row) {
    if (!row) return
    setConfirmState({ kind: 'sheet_bill', row })
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

  async function performRemoveExpense(row) {
    if (!row || !canWrite) return
    setSheetBillBusy(true)
    try {
      // Scoped in the query as well as the guard above: a JS-only check is not a
      // control, because a direct PostgREST call skips this component entirely.
      const { data, error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', row.id)
        .is('daily_sheet_line_id', null)
        .select('id')
      if (error) toast.error(error.message)
      else if (!data || data.length === 0) {
        toast.error('This bill was posted by an approved daily sheet. Reopen that sheet to change it.')
      } else {
        await writeAudit({
          action: 'finance.expense.delete',
          entityType: 'expense',
          entityId: row.id,
          summary: `Deleted expense "${row.title}"`,
          meta: { amount_minor: row.amount_minor ?? null, branch: row.branch ?? null },
        })
        toast.success('Expense deleted')
        onReload?.()
      }
    } finally {
      setSheetBillBusy(false)
      setConfirmState(null)
    }
  }

  async function remove(row) {
    if (!canWrite) return
    // An expense with a daily_sheet_line_id is one an approved Daily Sheet is
    // computed from. Deleting it leaves the sheet reading "approved" with
    // figures that no longer exist in the books. The sanctioned way back is
    // Super Admin reopening the sheet, which voids and re-approves properly.
    if (row.daily_sheet_line_id) {
      if (isSuperAdmin) {
        deleteSheetBillOverride(row)
        return
      }
      toast.error('This bill was posted by an approved daily sheet. Reopen that sheet to change it.')
      return
    }
    setConfirmState({ kind: 'expense', row })
  }

  if (loading) return <FinanceTabSkeleton metrics={4} />

  return (
    <div className="finance-dash flex flex-col gap-5">
      <FinanceMetricStrip label="Bills totals">
        <FinanceMetricCell label="Filtered total" value={formatMoney(metrics.total)} hint={subtitle} tone="ink" />
        <FinanceMetricCell label="Drafts" value={String(metrics.draft)} hint="In window" tone="muted" />
        <FinanceMetricCell label="For approval" value={String(metrics.forApproval)} hint="Waiting for the owner" tone="muted" />
        <FinanceMetricCell label="Awaiting payment" value={formatMoney(metrics.awaitingPayMinor)} hint={`${metrics.awaitingPayCount} bills`} tone="muted" />
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
                {c.is_archived ? ' (Archived)' : ''}
              </option>
            ))}
          </select>
          {canWrite ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-10 cursor-pointer gap-1.5"
              onClick={() => setShowCategoriesModal(true)}
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              Manage categories
            </Button>
          ) : null}
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
                    <div className="finance-mobile-actions flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">From a daily sheet · change it on the sheet</span>
                      <Button size="sm" variant="outline" className="cursor-pointer gap-1" onClick={() => openDailySheetForBill(row)}>
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open sheet
                      </Button>
                      {isSuperAdmin ? (
                        <Button size="sm" variant="ghost" className="cursor-pointer gap-1" onClick={() => openSheetBillOverride(row)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Edit / Override
                        </Button>
                      ) : null}
                    </div>
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
                        <div className="flex flex-wrap items-center gap-1.5">
                          {row.daily_sheet_line_id ? (
                            <>
                              <span className="text-xs text-muted-foreground">Daily sheet</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 cursor-pointer gap-1 px-2 text-xs"
                                onClick={() => openDailySheetForBill(row)}
                              >
                                <ExternalLink className="h-3 w-3" />
                                Sheet
                              </Button>
                              {isSuperAdmin ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 cursor-pointer gap-1 px-2 text-xs"
                                  onClick={() => openSheetBillOverride(row)}
                                >
                                  <Pencil className="h-3 w-3" />
                                  Override
                                </Button>
                              ) : null}
                            </>
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

      <Dialog open={showCategoriesModal} onOpenChange={setShowCategoriesModal}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-slate-200/90 bg-white">
          <DialogHeader>
            <DialogTitle>Manage Expense Categories (CRUD)</DialogTitle>
            <DialogDescription>
              Create, edit, archive, or delete expense accounts (10–21+) directly from Bills. Changes sync immediately across Bills, Daily Sheets, and Profit &amp; Loss.
            </DialogDescription>
          </DialogHeader>
          <FinanceCategoriesTab
            categories={categories}
            expenses={expenses}
            canWrite={canWrite}
            isSuperAdmin={isSuperAdmin}
            onReload={onReload}
            onPickCategory={(catId) => {
              onAccountFilter?.(catId)
              setShowCategoriesModal(false)
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(sheetBillModal)} onOpenChange={(open) => !open && setSheetBillModal(null)}>
        <DialogContent className="max-w-md border-slate-200/90 bg-white">
          <DialogHeader>
            <DialogTitle>Override Daily-Sheet Bill</DialogTitle>
            <DialogDescription>
              Directly edit or delete this Daily-Sheet-originated bill. Saving updates both the Finance Bill and its source Daily Sheet line &amp; totals automatically.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveSheetBillOverride} className="space-y-3 py-1">
            <div>
              <Label htmlFor="sb-title">Item description</Label>
              <Input
                id="sb-title"
                value={sheetBillForm.title}
                onChange={(e) => setSheetBillForm((f) => ({ ...f, title: e.target.value }))}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="sb-category">Expense account / category</Label>
              <NamedSelect
                id="sb-category"
                value={sheetBillForm.category_id}
                onChange={(category_id) => setSheetBillForm((f) => ({ ...f, category_id }))}
                className="mt-1"
                emptyLabel="Uncategorized"
                options={activeAccounts(categories, [sheetBillForm.category_id]).map((c) => ({
                  value: c.id,
                  label: `${c.code != null ? `${c.code} · ` : ''}${c.name}${c.is_archived ? ' (Archived)' : ''}`,
                }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sb-amount">Amount (PHP)</Label>
                <Input
                  id="sb-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={sheetBillForm.amount_php}
                  onChange={(e) => setSheetBillForm((f) => ({ ...f, amount_php: e.target.value }))}
                  className="mt-1 tabular-nums"
                  required
                />
              </div>
              <div>
                <Label htmlFor="sb-paid-from">Paid from</Label>
                <NamedSelect
                  id="sb-paid-from"
                  value={sheetBillForm.paid_from}
                  onChange={(paid_from) => setSheetBillForm((f) => ({ ...f, paid_from }))}
                  className="mt-1"
                  options={[
                    { value: 'cash', label: 'Cash' },
                    { value: 'gcash', label: 'GCash' },
                  ]}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="sb-ref">Reference (optional)</Label>
              <Input
                id="sb-ref"
                value={sheetBillForm.bill_reference}
                onChange={(e) => setSheetBillForm((f) => ({ ...f, bill_reference: e.target.value }))}
                className="mt-1"
              />
            </div>
            <DialogFooter className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                disabled={sheetBillBusy}
                onClick={() => deleteSheetBillOverride(sheetBillModal)}
              >
                Delete bill &amp; sheet line
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setSheetBillModal(null)} disabled={sheetBillBusy}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-[#0e1540] text-white hover:bg-[#17205c]" disabled={sheetBillBusy}>
                  {sheetBillBusy ? 'Syncing…' : 'Save & sync sheet'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmState)}
        onOpenChange={(open) => {
          if (!open && !sheetBillBusy) setConfirmState(null)
        }}
        title={confirmState?.kind === 'sheet_bill' ? 'Delete daily-sheet bill?' : 'Delete expense bill?'}
        description={
          confirmState?.kind === 'sheet_bill'
            ? `Delete "${confirmState?.row?.title || 'this bill'}" from both Finance Bills and its Daily Sheet? Sheet totals will recalculate.`
            : `Delete "${confirmState?.row?.title || 'this bill'}"? This cannot be undone.`
        }
        confirmLabel={sheetBillBusy ? 'Deleting…' : 'Delete'}
        pending={sheetBillBusy}
        onConfirm={() => {
          if (!confirmState?.row) return
          if (confirmState.kind === 'sheet_bill') performDeleteSheetBillOverride(confirmState.row)
          else performRemoveExpense(confirmState.row)
        }}
      />
    </div>
  )
}

function nextStatus(status) {
  const i = STATUS_FLOW.indexOf(status)
  if (i < 0 || i >= STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[i + 1]
}
