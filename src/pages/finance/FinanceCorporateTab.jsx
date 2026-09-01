/** Finance Corporate — HQ filter roll-up + manual corporate_balances (Owner Revisions P5). */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import {
  CORPORATE_BRANCH_SLUG,
  canManageFinanceVendors,
  rollupCorporatePeriod,
} from '@/lib/financeCorporate'
import { formatMoney } from '@/queue/queueApi'
import { toast } from 'sonner'
import {
  FinanceEmpty,
  FinanceMetricCell,
  FinanceMetricStrip,
  FinancePanel,
  FinanceTabSkeleton,
} from './FinanceChrome'

export default function FinanceCorporateTab({ profile, range }) {
  const canManage = canManageFinanceVendors(profile)
  const [closes, setCloses] = useState([])
  const [hqExpenses, setHqExpenses] = useState([])
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ period: '', period_date: '', amount: '', note: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const startIso = `${range.start}T00:00:00+08:00`
    const endIso = `${range.end}T23:59:59.999+08:00`
    const [closeRes, expRes, balRes] = await Promise.all([
      supabase
        .from('shift_close_reports')
        .select('id, branch, business_date, status, submitted, pos_baseline')
        .in('status', ['accepted', 'locked'])
        .gte('business_date', range.start)
        .lte('business_date', range.end)
        .order('business_date', { ascending: false })
        .limit(500),
      supabase
        .from('expenses')
        .select('id, branch, status, total_minor, title, created_at')
        .eq('branch', CORPORATE_BRANCH_SLUG)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('corporate_balances')
        .select('id, period, period_date, amount_minor, note, created_at')
        .order('period_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(40),
    ])
    if (closeRes.error) toast.error(closeRes.error.message)
    else setCloses(closeRes.data || [])
    if (expRes.error) toast.error(expRes.error.message)
    else setHqExpenses(expRes.data || [])
    if (balRes.error) toast.error(balRes.error.message)
    else setBalances(balRes.data || [])
    setLoading(false)
  }, [range.start, range.end])

  useEffect(() => {
    load()
  }, [load])

  const rollup = useMemo(
    () => rollupCorporatePeriod({ closes, hqExpenses }),
    [closes, hqExpenses],
  )

  async function saveBalance(event) {
    event.preventDefault()
    if (!canManage) return toast.error('Only Super Admin / ASA finance write can set corporate balance')
    const period = form.period.trim()
    const pesos = Number(String(form.amount).replace(/,/g, '').trim())
    if (!period) return toast.error('Period label is required')
    if (!Number.isFinite(pesos)) return toast.error('Enter a valid amount')
    const amount_minor = Math.round(pesos * 100)
    const { error } = await supabase.from('corporate_balances').insert({
      period,
      period_date: form.period_date || null,
      amount_minor,
      note: form.note.trim() || null,
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Corporate balance saved')
      setForm({ period: '', period_date: '', amount: '', note: '' })
      load()
    }
  }

  if (loading) return <FinanceTabSkeleton metrics={4} />

  return (
    <div className="finance-dash flex flex-col gap-5">
      <FinanceMetricStrip label="Corporate EOM roll-up">
        <FinanceMetricCell
          label="Accepted closes"
          value={String(rollup.closeCount)}
          hint="Branch remittances"
          tone="ink"
        />
        <FinanceMetricCell
          label="Close sales"
          value={formatMoney(rollup.closeSalesMinor)}
          hint="Accepted / locked"
          tone="up"
        />
        <FinanceMetricCell
          label="HQ expenses"
          value={formatMoney(rollup.hqExpenseMinor)}
          hint={`Branch ${CORPORATE_BRANCH_SLUG}`}
          tone="muted"
        />
        <FinanceMetricCell
          label="Roll-up net"
          value={formatMoney(rollup.rollupNetMinor)}
          hint="Closes − HQ bills (manual balance separate)"
          tone={rollup.rollupNetMinor >= 0 ? 'up' : 'down'}
        />
      </FinanceMetricStrip>

      <FinancePanel
        title="Corporate account"
        description="General expenses post to HQ (hq). Money left is owner-entered — not invented from POS drawers."
      >
        <p className="text-sm text-muted-foreground">
          Use the branch filter <strong>Corporate (HQ)</strong> on Sales / Bills / P&amp;L for HQ-scoped books.
          This tab shows network EOM remittance roll-up for the selected date window.
        </p>
      </FinancePanel>

      {canManage ? (
        <FinancePanel title="Record corporate balance" description="Manual cash/bank snapshot for the business.">
          <form onSubmit={saveBalance} className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="corp-period">Period</Label>
              <Input
                id="corp-period"
                required
                className="min-h-10"
                placeholder="e.g. 2026-08 or Aug 2026 EOM"
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="corp-date">Period date (optional)</Label>
              <Input
                id="corp-date"
                type="date"
                className="min-h-10"
                value={form.period_date}
                onChange={(e) => setForm({ ...form, period_date: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="corp-amount">Amount (₱)</Label>
              <Input
                id="corp-amount"
                required
                className="min-h-10"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="corp-note">Note</Label>
              <Textarea
                id="corp-note"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" className="min-h-10 cursor-pointer">
                <Plus data-icon="inline-start" />
                Save balance
              </Button>
            </div>
          </form>
        </FinancePanel>
      ) : null}

      <FinancePanel title="Corporate balances" description="Owner-entered money left for the business.">
        {!balances.length ? (
          <FinanceEmpty
            title="No corporate balances yet"
            body={canManage ? 'Record an EOM cash/bank snapshot above.' : 'Only Super Admin / ASA can enter balances.'}
          />
        ) : (
          <div className="finance-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.period}</TableCell>
                    <TableCell className="tabular-nums">{row.period_date || '—'}</TableCell>
                    <TableCell className="tabular-nums">{formatMoney(row.amount_minor)}</TableCell>
                    <TableCell className="max-w-xs truncate">{row.note || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </FinancePanel>
    </div>
  )
}
