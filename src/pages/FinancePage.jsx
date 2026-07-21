import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessFinance } from '@/auth/permissions'
import { listBranches } from '@/lib/adminApi'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

export default function FinancePage() {
  const { profile } = useAuth()
  const [categories, setCategories] = useState([])
  const [expenses, setExpenses] = useState([])
  const [branchSummary, setBranchSummary] = useState([])
  const [branches, setBranches] = useState([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    quantity: '1',
    unit_cost: '',
    branch: '',
    category_id: '',
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const [cats, rows, sales, branchRows] = await Promise.all([
      supabase.from('expense_categories').select('id, name, is_chemical').order('name'),
      supabase.from('expenses').select('id, title, total_minor, branch, status, category_id, created_at').order('created_at', { ascending: false }).limit(40),
      supabase.from('daily_sales_summary').select('*').eq('sale_date', today),
      listBranches(),
    ])
    setCategories(cats.data || [])
    setExpenses(rows.data || [])
    setBranchSummary(sales.data || [])
    setBranches(branchRows || [])
    setForm((f) => ({
      ...f,
      category_id: f.category_id || cats.data?.[0]?.id || '',
      branch: f.branch || branchRows?.[0]?.slug || profile?.branch_slug || '',
    }))
  }, [profile?.branch_slug])

  useEffect(() => {
    load()
  }, [load])

  if (!canAccessFinance(profile)) return <Navigate to="/operations/access-denied" replace />

  async function createExpense(event) {
    event.preventDefault()
    setSaving(true)
    const qty = Number(form.quantity)
    const unit = Math.round(Number(String(form.unit_cost).replace(/,/g, '')) * 100)
    const total = Math.round(qty * unit)
    const cat = categories.find((c) => c.id === form.category_id)
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
        category_id: form.category_id,
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
    const { error } = await supabase.rpc('transition_expense', { p_expense_id: id, p_new_status: status, p_notes: null })
    if (error) toast.error(error.message)
    else {
      toast.success(`Marked ${status}`)
      load()
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Finance</p>
        <h1 className="text-3xl font-semibold tracking-tight">Daily sales & expenses</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {branchSummary.map((row) => (
          <Card key={row.branch}>
            <CardHeader>
              <CardTitle className="capitalize">{row.branch} today</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <Metric label="Total sales" value={formatMoney(row.total_sales_minor)} />
              <Metric label="Paid" value={row.paid_count} />
              <Metric label="Pending" value={row.pending_count} />
              <Metric label="Cash" value={formatMoney(row.cash_sales_minor)} />
              <Metric label="Online" value={formatMoney(row.online_sales_minor)} />
              <Metric label="Transactions" value={row.transaction_count} />
            </CardContent>
          </Card>
        ))}
        {!branchSummary.length && (
          <Card><CardContent className="pt-6 text-sm text-muted-foreground">No sales recorded today yet.</CardContent></Card>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>New expense</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={createExpense} className="grid gap-4 md:grid-cols-2">
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
            <Button type="submit" disabled={saving} className="md:col-span-2">{saving ? 'Saving…' : 'Save expense'}</Button>
          </form>
        </CardContent>
      </Card>

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
              {expenses.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.title}</TableCell>
                  <TableCell className="capitalize">{row.branch}</TableCell>
                  <TableCell>{formatMoney(row.total_minor)}</TableCell>
                  <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                  <TableCell className="flex flex-wrap gap-2">
                    {row.status === 'pending_approval' && <Button size="sm" onClick={() => transition(row.id, 'approved')}>Approve</Button>}
                    {row.status === 'approved' && <Button size="sm" variant="secondary" onClick={() => transition(row.id, 'pending_payment')}>To payment</Button>}
                    {row.status === 'pending_payment' && <Button size="sm" onClick={() => transition(row.id, 'paid')}>Mark paid</Button>}
                    {row.status === 'paid' && <Button size="sm" variant="outline" onClick={() => transition(row.id, 'posted')}>Post</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  )
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  )
}
