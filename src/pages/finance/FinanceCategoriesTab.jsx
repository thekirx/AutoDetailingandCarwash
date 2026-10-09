/** Finance Categories: the expense accounts bills, expense reports and POS sheets post to. Add, edit, archive, delete. */
import { useMemo, useState } from 'react'
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { ACCOUNT_KINDS, catalogWriteError, isSalaryAccount } from '@/lib/financeBooks'
import { toast } from 'sonner'
import { FinanceEmpty, FinanceMetricCell, FinanceMetricStrip, FinancePanel } from './FinanceChrome'
import FinanceAccountDialog from './FinanceAccountDialog'

const kindLabel = (kind) => ACCOUNT_KINDS.find((k) => k.value === (kind || 'general'))?.label || kind

export default function FinanceCategoriesTab({ categories, canWrite, onReload }) {
  const [dialog, setDialog] = useState(null)

  const rows = useMemo(
    () =>
      [...(categories || [])].sort(
        (a, b) => Number(a.is_archived) - Number(b.is_archived) || (Number(a.code) || 999) - (Number(b.code) || 999) || a.name.localeCompare(b.name),
      ),
    [categories],
  )
  const metrics = useMemo(() => {
    const active = rows.filter((c) => !c.is_archived)
    return { active: active.length, archived: rows.length - active.length, approval: active.filter((c) => c.is_chemical).length }
  }, [rows])

  async function setArchived(c, is_archived) {
    const { error } = await supabase.from('expense_categories').update({ is_archived }).eq('id', c.id)
    if (error) return toast.error(catalogWriteError(error, 'category'))
    toast.success(is_archived ? `${c.name} archived. It stays on old bills but leaves the pickers.` : `${c.name} is back in the pickers.`)
    onReload?.()
  }

  async function remove(c) {
    if (!window.confirm(`Delete "${c.name}"? This can't be undone.`)) return
    const { error } = await supabase.from('expense_categories').delete().eq('id', c.id)
    if (error) {
      return toast.error(catalogWriteError(error, 'category'), error.code === '23503' ? { action: { label: 'Archive', onClick: () => setArchived(c, true) } } : undefined)
    }
    toast.success('Category deleted')
    onReload?.()
  }

  const actions = (c) => {
    if (!canWrite) return null
    const locked = isSalaryAccount(c)
    return (
      <div className="flex flex-wrap justify-end gap-1">
        <Button size="sm" variant="ghost" className="min-h-9 cursor-pointer" onClick={() => setDialog({ row: c })} aria-label={`Edit ${c.name}`}>
          <Pencil data-icon="inline-start" />
          Edit
        </Button>
        {locked ? null : (
          <>
            <Button size="sm" variant="ghost" className="min-h-9 cursor-pointer" onClick={() => setArchived(c, !c.is_archived)} aria-label={`${c.is_archived ? 'Restore' : 'Archive'} ${c.name}`}>
              {c.is_archived ? <ArchiveRestore data-icon="inline-start" /> : <Archive data-icon="inline-start" />}
              {c.is_archived ? 'Restore' : 'Archive'}
            </Button>
            <Button size="sm" variant="ghost" className="min-h-9 cursor-pointer text-destructive hover:text-destructive" onClick={() => remove(c)} aria-label={`Delete ${c.name}`}>
              <Trash2 />
            </Button>
          </>
        )}
      </div>
    )
  }

  const badges = (c) => (
    <>
      {c.is_chemical ? <Badge variant="outline">Needs approval</Badge> : null}
      {isSalaryAccount(c) ? <Badge variant="outline">Shift-close payroll</Badge> : null}
      {c.is_archived ? <Badge variant="secondary">Archived</Badge> : null}
    </>
  )

  return (
    <div className="finance-dash flex flex-col gap-5">
      <FinanceMetricStrip label="Category totals">
        <FinanceMetricCell label="Active" value={String(metrics.active)} hint="On bills and POS sheets" tone="ink" />
        <FinanceMetricCell label="Need approval" value={String(metrics.approval)} hint="Wait before paying" tone="muted" />
        <FinanceMetricCell label="Archived" value={String(metrics.archived)} hint="Kept on old bills" tone="muted" />
      </FinanceMetricStrip>

      <FinanceAccountDialog open={Boolean(dialog)} onOpenChange={(open) => { if (!open) setDialog(null) }} editing={dialog?.row || null} onSaved={() => onReload?.()} />

      <FinancePanel
        title="Categories"
        description="The accounts bills, expense reports and POS sheets post to. Kind sets the P&L group. Archive a category that is already on bills; delete one that never was."
        actions={canWrite ? (
          <Button type="button" className="min-h-11 cursor-pointer" onClick={() => setDialog({ row: null })}>
            <Plus data-icon="inline-start" />
            Add category
          </Button>
        ) : null}
      >
        {!rows.length ? (
          <FinanceEmpty
            title="No categories yet"
            body={canWrite ? 'Use Add category so bills can be classified.' : 'Ask someone with Finance write access to add categories.'}
            action={canWrite ? { label: 'Add category', onClick: () => setDialog({ row: null }) } : null}
          />
        ) : (
          <>
            <div className="finance-mobile-list">
              {rows.map((c) => (
                <article key={`m-${c.id}`} className={`finance-mobile-card ${c.is_archived ? 'opacity-60' : ''}`}>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="finance-mobile-title">
                      {c.code ? <span className="tabular-nums text-muted-foreground">{c.code} · </span> : null}
                      {c.name}
                    </p>
                    <p className="finance-mobile-sub flex flex-wrap gap-1">
                      <Badge variant="secondary">{kindLabel(c.kind)}</Badge>
                      {badges(c)}
                    </p>
                  </div>
                  {actions(c)}
                </article>
              ))}
            </div>
            <div className="finance-table-wrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Status</TableHead>
                    {canWrite ? <TableHead className="text-right">Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.id} className={c.is_archived ? 'text-muted-foreground' : undefined}>
                      <TableCell className="tabular-nums">{c.code || '—'}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{kindLabel(c.kind)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">{badges(c)}{!c.is_chemical && !c.is_archived && !isSalaryAccount(c) ? 'Active' : null}</div>
                      </TableCell>
                      {canWrite ? <TableCell>{actions(c)}</TableCell> : null}
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
