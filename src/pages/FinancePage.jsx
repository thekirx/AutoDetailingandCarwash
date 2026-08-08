import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessFinance, canSeeAllBranches, canWriteFinance, getBranchScopeList } from '@/auth/permissions'
import { getAccessTokenFresh } from '@/lib/authToken'
import { listBranches } from '@/lib/adminApi'
import { supabase } from '@/lib/supabase'
import { getDashboardDateRange, filterBranchesForProfile, pickDefaultBranchSlug } from '@/queue/queueLogic'
import { formatMoney } from '@/queue/queueApi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

const TABS = ['cashflow', 'expenses', 'categories', 'salary', 'marketing', 'reports']
const KIND_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'payroll', label: 'Payroll / salary' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'chemicals', label: 'Chemicals' },
  { value: 'equipment', label: 'Equipment' },
]

function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

function scopeExpenses(query, profile, branchFilter) {
  const list = getBranchScopeList(profile)
  if (list === null) {
    if (branchFilter && branchFilter !== 'all') return query.eq('branch', branchFilter)
    return query
  }
  if (branchFilter && branchFilter !== 'all' && list.includes(branchFilter)) return query.eq('branch', branchFilter)
  if (list.length === 1) return query.eq('branch', list[0])
  if (list.length > 1) return query.in('branch', list)
  return query.eq('branch', '__none__')
}

function scopeSales(query, profile, branchFilter) {
  return scopeExpenses(query, profile, branchFilter)
}

export default function FinancePage() {
  const { profile } = useAuth()
  const canWrite = canWriteFinance(profile)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'cashflow'

  const [categories, setCategories] = useState([])
  const [expenses, setExpenses] = useState([])
  const [salesRows, setSalesRows] = useState([])
  const [branches, setBranches] = useState([])
  const [branchFilter, setBranchFilter] = useState(canSeeAllBranches(profile) ? 'all' : (getBranchScopeList(profile)?.[0] || 'all'))
  const [datePreset, setDatePreset] = useState('today')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [form, setForm] = useState({
    title: '',
    description: '',
    quantity: '1',
    unit_cost: '',
    branch: '',
    category_id: '',
  })
  const [catForm, setCatForm] = useState({ name: '', kind: 'general', is_chemical: false })
  const [quote, setQuote] = useState({ to: '', subject: 'Hakum quotation', title: '', amount: '', notes: '', branch: '' })
  const [saving, setSaving] = useState(false)

  const range = useMemo(() => {
    if (datePreset === 'today') {
      const d = todayISO()
      return { start: d, end: d }
    }
    const r = getDashboardDateRange(datePreset, customStart, customEnd)
    return {
      start: r.start.toLocaleDateString('en-CA'),
      end: r.end.toLocaleDateString('en-CA'),
    }
  }, [datePreset, customStart, customEnd])

  const load = useCallback(async () => {
    try {
      let salesQ = supabase
        .from('daily_sales_summary')
        .select('*')
        .gte('sale_date', range.start)
        .lte('sale_date', range.end)
        .order('sale_date', { ascending: false })
      salesQ = scopeSales(salesQ, profile, branchFilter)

      const rangeStartIso = `${range.start}T00:00:00+08:00`
      const rangeEndIso = `${range.end}T23:59:59.999+08:00`
      let expQ = supabase
        .from('expenses')
        .select('id, title, description, total_minor, branch, status, category_id, created_at, quantity, unit_cost_minor')
        .gte('created_at', rangeStartIso)
        .lte('created_at', rangeEndIso)
        .order('created_at', { ascending: false })
        .limit(200)
      expQ = scopeExpenses(expQ, profile, branchFilter)

      const [cats, rows, sales, branchRows] = await Promise.all([
        supabase.from('expense_categories').select('id, name, is_chemical, kind').order('name'),
        expQ,
        salesQ,
        listBranches(),
      ])
      if (cats.error) throw cats.error
      if (rows.error) throw rows.error
      if (sales.error) throw sales.error
      setCategories(cats.data || [])
      setExpenses(rows.data || [])
      setSalesRows(sales.data || [])
      setBranches(branchRows || [])
      const defaultBranch = pickDefaultBranchSlug(profile, branchRows)
      setForm((f) => ({
        ...f,
        category_id: f.category_id || cats.data?.[0]?.id || '',
        branch: f.branch || defaultBranch,
      }))
      setQuote((q) => ({ ...q, branch: q.branch || defaultBranch }))
    } catch (err) {
      toast.error(err.message || 'Unable to load finance data')
    }
  }, [profile, branchFilter, range.start, range.end])

  useEffect(() => {
    load()
  }, [load])

  const cashflowTotals = useMemo(() => {
    return salesRows.reduce(
      (acc, row) => {
        acc.sales += Number(row.total_sales_minor || 0)
        acc.paid += Number(row.paid_count || 0)
        acc.tx += Number(row.transaction_count || 0)
        acc.cash += Number(row.cash_sales_minor || 0)
        acc.online += Number(row.online_sales_minor || 0)
        return acc
      },
      { sales: 0, paid: 0, tx: 0, cash: 0, online: 0 },
    )
  }, [salesRows])

  const expenseTotalMinor = useMemo(
    () => expenses.reduce((sum, e) => sum + Number(e.total_minor || 0), 0),
    [expenses],
  )

  const writableBranches = useMemo(() => filterBranchesForProfile(branches, profile), [branches, profile])

  if (!canAccessFinance(profile)) return <Navigate to="/operations/access-denied" replace />

  const branchOptions = canSeeAllBranches(profile)
    ? [{ slug: 'all', name: 'All branches' }, ...branches]
    : (getBranchScopeList(profile) || []).map((slug) => ({ slug, name: branches.find((b) => b.slug === slug)?.name || slug }))

  const expensesByKind = (kind) =>
    expenses.filter((e) => {
      const cat = categories.find((c) => c.id === e.category_id)
      return (cat?.kind || 'general') === kind
    })

  const generalExpenses = expenses.filter((e) => {
    const kind = categories.find((c) => c.id === e.category_id)?.kind || 'general'
    return kind !== 'payroll' && kind !== 'marketing'
  })

  async function createExpense(event, kindHint) {
    event.preventDefault()
    if (!canWrite) return toast.error('You do not have finance write access')
    setSaving(true)
    const qty = Number(form.quantity)
    const unitPesos = Number(String(form.unit_cost).replace(/,/g, '').trim())
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitPesos) || unitPesos < 0) {
      setSaving(false)
      return toast.error('Enter a valid quantity and unit cost')
    }
    const unit = Math.round(unitPesos * 100)
    const total = Math.round(qty * unit)
    if (!Number.isFinite(total) || !form.branch) {
      setSaving(false)
      return toast.error('Branch and amount are required')
    }
    if (!writableBranches.some((b) => b.slug === form.branch) && getBranchScopeList(profile) !== null) {
      setSaving(false)
      return toast.error('You can only file expenses for your assigned branches')
    }
    let categoryId = form.category_id
    if (kindHint) {
      const match = categories.find((c) => c.kind === kindHint)
      if (match) categoryId = match.id
    }
    const cat = categories.find((c) => c.id === categoryId)
    const needsApproval = cat?.is_chemical || total > 500000
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        quantity: qty,
        unit_cost_minor: unit,
        total_minor: total,
        branch: form.branch,
        category_id: categoryId,
        status: needsApproval ? 'pending_approval' : 'draft',
        created_by: profile.id,
      })
      .select('id')
      .single()
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    if (needsApproval) {
      await supabase.rpc('transition_expense', { p_expense_id: data.id, p_new_status: 'pending_approval', p_notes: 'Auto-routed for approval' })
    }
    toast.success(needsApproval ? 'Expense submitted for approval' : 'Expense saved as draft')
    setForm((f) => ({ ...f, title: '', description: '', unit_cost: '', quantity: '1' }))
    load()
  }

  async function transition(id, status) {
    if (!canWrite) return toast.error('You do not have finance write access')
    const { error } = await supabase.rpc('transition_expense', { p_expense_id: id, p_new_status: status, p_notes: null })
    if (error) toast.error(error.message)
    else {
      toast.success(`Marked ${status}`)
      load()
    }
  }

  async function saveCategory(event) {
    event.preventDefault()
    if (!canWrite) return toast.error('You do not have finance write access')
    const name = catForm.name.trim()
    if (!name) return
    const { error } = await supabase.from('expense_categories').insert({
      name,
      kind: catForm.kind,
      is_chemical: Boolean(catForm.is_chemical) || catForm.kind === 'chemicals',
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Category added')
      setCatForm({ name: '', kind: 'general', is_chemical: false })
      load()
    }
  }

  async function removeCategory(id) {
    if (!canWrite) return
    if (!window.confirm('Delete this category?')) return
    const { error } = await supabase.from('expense_categories').delete().eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success('Category deleted')
      load()
    }
  }

  async function sendQuote(event) {
    event.preventDefault()
    if (!canWrite) return toast.error('You do not have finance write access')
    setSaving(true)
    try {
      const token = await getAccessTokenFresh()
      const amount = quote.amount.trim()
      const amountLabel = amount
        ? formatMoney(Math.round(Number(String(amount).replace(/,/g, '')) * 100))
        : ''
      const res = await fetch('/api/send-finance-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          to: quote.to,
          subject: quote.subject,
          title: quote.title || 'Quotation',
          amount_label: amountLabel,
          notes: quote.notes,
          branch: quote.branch,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Send failed')
      toast.success(body.preview ? 'Preview only (set RESEND_API_KEY to send)' : `Quote sent to ${quote.to}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  function setTab(next) {
    setSearchParams(next === 'cashflow' ? {} : { tab: next }, { replace: true })
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Finance</p>
          <h1 className="text-3xl font-semibold tracking-tight">Cashflow & expenses</h1>
          <p className="mt-2 text-sm text-muted-foreground">POS sales feed cashflow automatically. Expenses stay manual.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {(canSeeAllBranches(profile) || branchOptions.length > 1) && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="min-h-11 w-44"><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>
                {branchOptions.map((b) => <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="min-h-11 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="3mo">3 months</SelectItem>
              <SelectItem value="6mo">6 months</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {datePreset === 'custom' && (
            <>
              <Input type="date" className="min-h-11 w-40" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <Input type="date" className="min-h-11 w-40" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="cashflow">Cashflow</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="salary">Salary / Incentives</TabsTrigger>
          <TabsTrigger value="marketing">Marketing cost</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="cashflow" className="mt-6 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Stat label="Sales" value={formatMoney(cashflowTotals.sales)} />
            <Stat label="Paid tickets" value={cashflowTotals.paid} />
            <Stat label="Transactions" value={cashflowTotals.tx} />
            <Stat label="Cash" value={formatMoney(cashflowTotals.cash)} />
            <Stat label="Online" value={formatMoney(cashflowTotals.online)} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Daily sales (from POS)</CardTitle>
              <CardDescription>{range.start} → {range.end}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Cash</TableHead>
                    <TableHead>Online</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesRows.map((row) => (
                    <TableRow key={`${row.branch}-${row.sale_date}`}>
                      <TableCell>{row.sale_date}</TableCell>
                      <TableCell className="capitalize">{row.branch}</TableCell>
                      <TableCell>{formatMoney(row.total_sales_minor)}</TableCell>
                      <TableCell>{row.paid_count}</TableCell>
                      <TableCell>{formatMoney(row.cash_sales_minor)}</TableCell>
                      <TableCell>{formatMoney(row.online_sales_minor)}</TableCell>
                    </TableRow>
                  ))}
                  {!salesRows.length && (
                    <TableRow><TableCell colSpan={6} className="text-muted-foreground">No POS sales in this range.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="mt-6 flex flex-col gap-6">
          {canWrite ? <ExpenseForm form={form} setForm={setForm} branches={writableBranches} categories={categories.filter((c) => !['payroll', 'marketing'].includes(c.kind))} saving={saving} onSubmit={(e) => createExpense(e)} /> : <p className="text-sm text-muted-foreground">View-only — ask Super Admin for finance write access.</p>}
          <ExpenseTable rows={generalExpenses} canWrite={canWrite} onTransition={transition} />
          {canWrite && <QuoteCard quote={quote} setQuote={setQuote} branches={writableBranches} saving={saving} onSubmit={sendQuote} />}
        </TabsContent>

        <TabsContent value="categories" className="mt-6 flex flex-col gap-6">
          {canWrite && (
            <Card>
              <CardHeader><CardTitle>Add category</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={saveCategory} className="grid gap-3 md:grid-cols-[1fr_180px_auto_auto]">
                  <Input required placeholder="Category name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
                  <Select value={catForm.kind} onValueChange={(kind) => setCatForm({ ...catForm, kind })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {KIND_OPTIONS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={catForm.is_chemical} onChange={(e) => setCatForm({ ...catForm, is_chemical: e.target.checked })} /> Pre-approval</label>
                  <Button type="submit">Add</Button>
                </form>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>Categories</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Pre-approval</TableHead>
                    {canWrite && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell><Badge variant="secondary">{c.kind || 'general'}</Badge></TableCell>
                      <TableCell>{c.is_chemical ? 'Yes' : '—'}</TableCell>
                      {canWrite && (
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => removeCategory(c.id)}>Delete</Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salary" className="mt-6 flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">Payroll / incentive expenses (category kind = payroll).</p>
          {canWrite ? <ExpenseForm form={form} setForm={setForm} branches={writableBranches} categories={categories.filter((c) => c.kind === 'payroll')} saving={saving} onSubmit={(e) => createExpense(e, 'payroll')} submitLabel="Save salary / incentive" /> : null}
          <ExpenseTable rows={expensesByKind('payroll')} canWrite={canWrite} onTransition={transition} />
        </TabsContent>

        <TabsContent value="marketing" className="mt-6 flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">Marketing spend (category kind = marketing).</p>
          {canWrite ? <ExpenseForm form={form} setForm={setForm} branches={writableBranches} categories={categories.filter((c) => c.kind === 'marketing')} saving={saving} onSubmit={(e) => createExpense(e, 'marketing')} submitLabel="Save marketing cost" /> : null}
          <ExpenseTable rows={expensesByKind('marketing')} canWrite={canWrite} onTransition={transition} />
        </TabsContent>

        <TabsContent value="reports" className="mt-6 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Sales (range)" value={formatMoney(cashflowTotals.sales)} />
            <Stat label="Expenses (loaded)" value={formatMoney(expenseTotalMinor)} />
            <Stat label="Net (sales − expenses)" value={formatMoney(cashflowTotals.sales - expenseTotalMinor)} />
            <Stat label="Avg ticket (proxy)" value={formatMoney(cashflowTotals.paid ? Math.round(cashflowTotals.sales / cashflowTotals.paid) : 0)} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Trend by day</CardTitle>
              <CardDescription>POS daily_sales_summary for the selected filters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(
                salesRows.reduce((acc, row) => {
                  acc[row.sale_date] = (acc[row.sale_date] || 0) + Number(row.total_sales_minor || 0)
                  return acc
                }, {}),
              )
                .sort(([a], [b]) => (a < b ? 1 : -1))
                .slice(0, 14)
                .map(([day, total]) => (
                  <div key={day} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <span>{day}</span>
                    <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
                  </div>
                ))}
              {!salesRows.length && <p className="text-sm text-muted-foreground">No sales in range.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  )
}

function Stat({ label, value }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
        <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

function ExpenseForm({ form, setForm, branches, categories, saving, onSubmit, submitLabel = 'Save expense' }) {
  return (
    <Card>
      <CardHeader><CardTitle>New expense</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="title">Expense title</Label>
            <Input id="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Quantity</Label>
            <Input type="number" min="0.01" step="0.01" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Unit cost (₱)</Label>
            <Input required value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Branch</Label>
            <Select value={form.branch} onValueChange={(v) => setForm({ ...form, branch: v })}>
              <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>
                {branches.map((b) => <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Category</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.is_chemical ? ' (pre-approval)' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={saving || !categories.length} className="md:col-span-2">{saving ? 'Saving…' : submitLabel}</Button>
        </form>
      </CardContent>
    </Card>
  )
}

function ExpenseTable({ rows, canWrite, onTransition }) {
  return (
    <Card>
      <CardHeader><CardTitle>Expense queue</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.title}</TableCell>
                <TableCell className="capitalize">{row.branch}</TableCell>
                <TableCell>{formatMoney(row.total_minor)}</TableCell>
                <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                <TableCell className="flex flex-wrap gap-2">
                  {canWrite && row.status === 'pending_approval' && <Button size="sm" onClick={() => onTransition(row.id, 'approved')}>Approve</Button>}
                  {canWrite && row.status === 'approved' && <Button size="sm" variant="secondary" onClick={() => onTransition(row.id, 'pending_payment')}>To payment</Button>}
                  {canWrite && row.status === 'pending_payment' && <Button size="sm" onClick={() => onTransition(row.id, 'paid')}>Mark paid</Button>}
                  {canWrite && row.status === 'paid' && <Button size="sm" variant="outline" onClick={() => onTransition(row.id, 'posted')}>Post</Button>}
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow><TableCell colSpan={5} className="text-muted-foreground">No expenses in this view.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function QuoteCard({ quote, setQuote, branches, saving, onSubmit }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Email quotation</CardTitle>
        <CardDescription>Resend HTML quote — not full Xero sync.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>To email</Label>
            <Input type="email" required value={quote.to} onChange={(e) => setQuote({ ...quote, to: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Subject</Label>
            <Input required value={quote.subject} onChange={(e) => setQuote({ ...quote, subject: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Title</Label>
            <Input value={quote.title} onChange={(e) => setQuote({ ...quote, title: e.target.value })} placeholder="Detailing package" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Amount (₱)</Label>
            <Input value={quote.amount} onChange={(e) => setQuote({ ...quote, amount: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label>Branch</Label>
            <Select value={quote.branch} onValueChange={(branch) => setQuote({ ...quote, branch })}>
              <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>
                {branches.map((b) => <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label>Notes</Label>
            <Textarea value={quote.notes} onChange={(e) => setQuote({ ...quote, notes: e.target.value })} />
          </div>
          <Button type="submit" disabled={saving} className="md:col-span-2">{saving ? 'Sending…' : 'Send quotation'}</Button>
        </form>
      </CardContent>
    </Card>
  )
}
