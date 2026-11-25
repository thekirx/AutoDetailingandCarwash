import { useMemo, useState } from 'react'
import { Archive, Edit3, ExternalLink, Lock, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { callFinanceOwnerOps } from '@/lib/financeOwnerClient'
import { catalogWriteError, isSalaryAccount } from '@/lib/financeBooks'
import { formatMoney } from '@/queue/queueApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NamedSelect } from '@/components/ui/named-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FinanceAccountDialog } from '@/pages/finance/FinanceAccountDialog'

const KIND_LABELS = {
  general: 'General',
  payroll: 'Payroll',
  chemicals: 'Chemicals & Supplies',
  utilities: 'Utilities & Rent',
  equipment: 'Equipment & Repairs',
  marketing: 'Marketing',
}

export function FinanceCategoriesTab({
  categories = [],
  expenses = [],
  canWrite = false,
  isSuperAdmin = false,
  onOpenAccountModal,
  onPickCategory,
  onReload,
}) {
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [busyId, setBusyId] = useState(null)
  const [localDialogOpen, setLocalDialogOpen] = useState(false)
  const [localEditingAccount, setLocalEditingAccount] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [reassignToId, setReassignToId] = useState('')
  const [deleting, setDeleting] = useState(false)

  const statsByCat = useMemo(() => {
    const map = new Map()
    for (const e of expenses) {
      if (!e.category_id) continue
      const prev = map.get(e.category_id) || { totalMinor: 0, count: 0 }
      prev.count += 1
      if (e.status === 'paid' || e.status === 'posted') {
        prev.totalMinor += Number(e.total_minor ?? e.amount_minor ?? 0)
      }
      map.set(e.category_id, prev)
    }
    return map
  }, [expenses])

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => (Number(a.code) || 999) - (Number(b.code) || 999) || String(a.name || '').localeCompare(String(b.name || '')))
  }, [categories])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sortedCategories.filter((c) => {
      const archived = Boolean(c.is_archived)
      if (statusFilter === 'active' && archived) return false
      if (statusFilter === 'archived' && !archived) return false
      if (kindFilter !== 'all' && (c.kind || 'general') !== kindFilter) return false
      if (!q) return true
      const hay = `${c.code ?? ''} ${c.name || ''} ${c.kind || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [sortedCategories, search, kindFilter, statusFilter])

  const summary = useMemo(() => {
    let activeCount = 0
    let archivedCount = 0
    let totalWindowMinor = 0
    for (const c of sortedCategories) {
      if (c.is_archived) archivedCount += 1
      else activeCount += 1
      totalWindowMinor += statsByCat.get(c.id)?.totalMinor || 0
    }
    return { total: sortedCategories.length, activeCount, archivedCount, totalWindowMinor }
  }, [sortedCategories, statsByCat])

  function handleOpenEdit(account = null) {
    if (typeof onOpenAccountModal === 'function') {
      onOpenAccountModal(account)
      return
    }
    setLocalEditingAccount(account)
    setLocalDialogOpen(true)
  }

  async function toggleArchive(c) {
    if (!canWrite) return
    if (isSalaryAccount(c)) {
      toast.error('Account 14 must stay active for payroll posting.')
      return
    }
    setBusyId(c.id)
    const nextArchived = !c.is_archived
    try {
      try {
        await callFinanceOwnerOps({
          action: 'manage-category',
          sub_action: 'archive',
          id: c.id,
          is_archived: nextArchived,
        })
      } catch (apiErr) {
        const { error } = await supabase
          .from('expense_categories')
          .update({ is_archived: nextArchived })
          .eq('id', c.id)
        if (error) throw new Error(catalogWriteError(error, 'category') || apiErr?.message)
      }
      toast.success(nextArchived ? `${c.name} archived.` : `${c.name} restored.`)
      await onReload?.()
    } catch (err) {
      toast.error(err?.message || 'Could not update category status.')
    } finally {
      setBusyId(null)
    }
  }

  function openDeleteModal(c) {
    if (isSalaryAccount(c)) {
      toast.error('Account 14 cannot be deleted because Daily Sheets and Monthly Payroll post to it.')
      return
    }
    const fallback =
      sortedCategories.find((x) => x.id !== c.id && !x.is_archived) ||
      sortedCategories.find((x) => x.id !== c.id)
    setReassignToId(fallback?.id || '')
    setDeleteTarget(c)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await callFinanceOwnerOps({
        action: 'manage-category',
        sub_action: 'delete',
        id: deleteTarget.id,
        reassign_to_id: reassignToId || null,
      })
      const moved = Number(res?.reassigned_expenses || 0)
      toast.success(
        moved > 0
          ? `Deleted "${deleteTarget.name}" and reassigned ${moved} bill(s).`
          : `Deleted "${deleteTarget.name}".`
      )
      setDeleteTarget(null)
      await onReload?.()
    } catch (err) {
      toast.error(err?.message || 'Could not delete category.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total categories</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-950">{summary.total}</div>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active accounts</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-emerald-700">{summary.activeCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Archived</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-600">{summary.archivedCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Posted spend in window</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-950">{formatMoney(summary.totalWindowMinor)}</div>
        </div>
      </div>

      <Card className="border-slate-200/90 bg-white shadow-none">
        <CardHeader className="flex flex-col gap-3 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Expense Accounts &amp; Categories (10–21+)</CardTitle>
            <CardDescription>
              Create, edit, archive, or delete expense categories used across Daily Sheets, Bills, and Profit &amp; Loss.
            </CardDescription>
          </div>
          {canWrite ? (
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-[#0e1540] text-white hover:bg-[#17205c]"
              onClick={() => handleOpenEdit(null)}
            >
              <Plus className="h-4 w-4" />
              New category
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code, category name, or group…"
                className="pl-9"
                aria-label="Search categories"
              />
            </div>
            <NamedSelect
              value={kindFilter}
              onChange={setKindFilter}
              className="w-full sm:w-52"
              options={[
                { value: 'all', label: 'All groups' },
                ...Object.entries(KIND_LABELS).map(([k, label]) => ({ value: k, label })),
              ]}
            />
            <NamedSelect
              value={statusFilter}
              onChange={setStatusFilter}
              className="w-full sm:w-40"
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'active', label: 'Active only' },
                { value: 'archived', label: 'Archived only' },
              ]}
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Code</TableHead>
                  <TableHead>Category name</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead className="text-right">Bills in window</TableHead>
                  <TableHead className="text-right">Window spend</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const stat = statsByCat.get(c.id) || { totalMinor: 0, count: 0 }
                  const isArchived = Boolean(c.is_archived)
                  const locked14 = isSalaryAccount(c)
                  return (
                    <TableRow key={c.id} className={isArchived ? 'bg-slate-50/60 text-slate-500' : ''}>
                      <TableCell className="font-mono text-xs font-semibold tabular-nums">
                        {c.code ?? '—'}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {c.name}
                        {locked14 ? (
                          <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-normal text-slate-500">
                            <Lock className="h-3 w-3" aria-hidden="true" />
                            Payroll account
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {KIND_LABELS[c.kind] || c.kind || 'General'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-slate-600">
                        {stat.count}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium tabular-nums text-slate-900">
                        {formatMoney(stat.totalMinor)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isArchived ? 'outline' : 'secondary'}>
                          {isArchived ? 'Archived' : 'Active'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {typeof onPickCategory === 'function' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-1 px-2 text-xs"
                              onClick={() => onPickCategory(c.id)}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Bills
                            </Button>
                          ) : null}
                          {canWrite ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1 px-2 text-xs"
                                onClick={() => handleOpenEdit(c)}
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                              {!locked14 ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 gap-1 px-2 text-xs text-slate-600"
                                  disabled={busyId === c.id}
                                  onClick={() => toggleArchive(c)}
                                >
                                  {isArchived ? (
                                    <>
                                      <RotateCcw className="h-3.5 w-3.5" />
                                      Restore
                                    </>
                                  ) : (
                                    <>
                                      <Archive className="h-3.5 w-3.5" />
                                      Archive
                                    </>
                                  )}
                                </Button>
                              ) : null}
                              {(isSuperAdmin || canWrite) && !locked14 ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 gap-1 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                  disabled={busyId === c.id}
                                  onClick={() => openDeleteModal(c)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </Button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!filtered.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                      No expense categories match your filter.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <FinanceAccountDialog
        open={localDialogOpen}
        onOpenChange={setLocalDialogOpen}
        account={localEditingAccount}
        onSaved={onReload}
      />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md border-slate-200/90 bg-white">
          <DialogHeader>
            <DialogTitle>Delete category “{deleteTarget?.name}”?</DialogTitle>
            <DialogDescription>
              Any bills, daily sheet expense lines, or expense report rows currently assigned to{' '}
              <span className="font-semibold text-slate-900">
                {deleteTarget?.code ? `${deleteTarget.code} · ` : ''}
                {deleteTarget?.name}
              </span>{' '}
              will be automatically reassigned to the fallback category below before deletion so Finance Books stay balanced.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="reassign-category-select">Reassign linked bills &amp; sheet lines to</Label>
              <NamedSelect
                id="reassign-category-select"
                value={reassignToId}
                onChange={setReassignToId}
                className="mt-1"
                options={sortedCategories
                  .filter((c) => c.id !== deleteTarget?.id)
                  .map((c) => ({
                    value: c.id,
                    label: `${c.code != null ? `${c.code} · ` : ''}${c.name}${c.is_archived ? ' (Archived)' : ''}`,
                  }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete & reassign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default FinanceCategoriesTab
