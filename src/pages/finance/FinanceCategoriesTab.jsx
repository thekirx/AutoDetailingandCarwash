/** Finance Categories — expense category CRUD with dashboard chrome. */
import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  FinanceEmpty,
  FinanceMetricCell,
  FinanceMetricStrip,
  FinancePanel,
} from './FinanceChrome'

const KIND_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'payroll', label: 'Payroll / salary' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'chemicals', label: 'Chemicals' },
  { value: 'equipment', label: 'Equipment' },
]

export default function FinanceCategoriesTab({ categories, canWrite, onReload }) {
  const [form, setForm] = useState({ name: '', kind: 'general', is_chemical: false })

  const metrics = useMemo(() => {
    const list = categories || []
    const pre = list.filter((c) => c.is_chemical).length
    const kinds = new Set(list.map((c) => c.kind || 'general')).size
    return { total: list.length, pre, kinds }
  }, [categories])

  async function save(event) {
    event.preventDefault()
    if (!canWrite) return toast.error('You do not have finance write access')
    const name = form.name.trim()
    if (!name) return
    const { error } = await supabase.from('expense_categories').insert({
      name,
      kind: form.kind,
      is_chemical: Boolean(form.is_chemical) || form.kind === 'chemicals',
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Category added')
      setForm({ name: '', kind: 'general', is_chemical: false })
      onReload?.()
    }
  }

  async function remove(id) {
    if (!canWrite || !window.confirm('Delete this category? Existing bills keep their category.')) return
    const { error } = await supabase.from('expense_categories').delete().eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success('Category deleted')
      onReload?.()
    }
  }

  return (
    <div className="finance-dash flex flex-col gap-5">
      <FinanceMetricStrip label="Category totals">
        <FinanceMetricCell label="Categories" value={String(metrics.total)} hint="Active list" tone="ink" />
        <FinanceMetricCell label="Kinds in use" value={String(metrics.kinds)} hint="P&L grouping" tone="muted" />
        <FinanceMetricCell label="Pre-approval" value={String(metrics.pre)} hint="Chemical / flagged" tone="muted" />
      </FinanceMetricStrip>

      {canWrite ? (
        <FinancePanel title="Add category" description="Kinds drive P&L grouping. Chemicals route to pre-approval.">
          <form onSubmit={save} className="grid gap-3 md:grid-cols-[1fr_180px_auto_auto]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                required
                className="min-h-10"
                placeholder="e.g. Coffee and supplies"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-kind">Kind</Label>
              <select
                id="cat-kind"
                className="finance-toolbar-select min-h-10 w-full"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              >
                {KIND_OPTIONS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2 pb-2">
              <label className="flex min-h-10 items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.is_chemical}
                  onChange={(e) => setForm({ ...form, is_chemical: e.target.checked })}
                />
                Pre-approval
              </label>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="min-h-10 cursor-pointer">
                <Plus data-icon="inline-start" />
                Add
              </Button>
            </div>
          </form>
        </FinancePanel>
      ) : null}

      <FinancePanel
        title="Categories"
        description={`${metrics.total} categor${metrics.total === 1 ? 'y' : 'ies'} · kinds drive P&L grouping`}
      >
        {!categories.length ? (
          <FinanceEmpty
            title="No categories yet"
            body={canWrite ? 'Add a category above so bills can be classified.' : 'Ask someone with write access to add categories.'}
          />
        ) : (
          <>
            <div className="finance-mobile-list">
              {categories.map((c) => (
                <article key={`m-${c.id}`} className="finance-mobile-card">
                  <div>
                    <p className="finance-mobile-title">{c.name}</p>
                    <p className="finance-mobile-sub">
                      <Badge variant="secondary">
                        {KIND_OPTIONS.find((k) => k.value === (c.kind || 'general'))?.label || c.kind || 'general'}
                      </Badge>
                      {c.is_chemical ? <Badge variant="outline">Pre-approval</Badge> : null}
                    </p>
                  </div>
                  {canWrite ? (
                    <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => remove(c.id)}>
                      <Trash2 data-icon="inline-start" />
                    </Button>
                  ) : null}
                </article>
              ))}
            </div>
            <div className="finance-table-wrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Pre-approval</TableHead>
                    {canWrite ? <TableHead /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {KIND_OPTIONS.find((k) => k.value === (c.kind || 'general'))?.label || c.kind || 'general'}
                        </Badge>
                      </TableCell>
                      <TableCell>{c.is_chemical ? <Badge variant="outline">Yes</Badge> : '—'}</TableCell>
                      {canWrite ? (
                        <TableCell>
                          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => remove(c.id)}>
                            Delete
                          </Button>
                        </TableCell>
                      ) : null}
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
