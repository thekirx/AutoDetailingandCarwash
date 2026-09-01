/** Finance Quotations — CRM customer picker + sendFinanceQuote API (Owner Revisions P5). */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { getAccessTokenFresh } from '@/lib/authToken'
import {
  buildFinanceQuotePayload,
  financeQuotePayloadErrors,
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

export default function FinanceQuotesTab({ canWrite, branches = [] }) {
  const [customers, setCustomers] = useState([])
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState({
    title: 'Quotation',
    amount: '',
    notes: '',
    branch: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const [custRes, quoteRes] = await Promise.all([
      supabase
        .from('customers')
        .select('id, full_name, first_name, last_name, email, phone')
        .eq('is_archived', false)
        .order('full_name')
        .limit(500),
      supabase
        .from('finance_quotes')
        .select('id, customer_id, amount_minor, sent_at, meta, customers(full_name, email)')
        .order('sent_at', { ascending: false })
        .limit(40),
    ])
    if (custRes.error) toast.error(custRes.error.message)
    else setCustomers(custRes.data || [])
    if (quoteRes.error) toast.error(quoteRes.error.message)
    else setQuotes(quoteRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers.slice(0, 40)
    return customers
      .filter((c) =>
        [c.full_name, c.email, c.phone, c.first_name, c.last_name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 40)
  }, [customers, query])

  const selected = useMemo(
    () => customers.find((c) => c.id === selectedId) || null,
    [customers, selectedId],
  )

  async function sendQuote(event) {
    event.preventDefault()
    if (!canWrite) return toast.error('You do not have finance write access')
    const payload = buildFinanceQuotePayload({
      customer: selected,
      title: form.title,
      amountPesos: form.amount,
      notes: form.notes,
      branch: form.branch,
    })
    const errs = financeQuotePayloadErrors(payload)
    if (errs.length) return toast.error(errs[0])

    setSending(true)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/send-finance-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Quote send failed')
      toast.success(body.preview ? 'Quote preview saved (Resend not configured)' : `Quote sent to ${body.to}`)
      setForm({ title: 'Quotation', amount: '', notes: '', branch: form.branch })
      load()
    } catch (err) {
      toast.error(err.message || 'Quote send failed')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <FinanceTabSkeleton metrics={2} />

  return (
    <div className="finance-dash flex flex-col gap-5">
      <FinanceMetricStrip label="Quotations">
        <FinanceMetricCell label="Recent sends" value={String(quotes.length)} hint="Last 40" tone="ink" />
        <FinanceMetricCell
          label="CRM customers"
          value={String(customers.length)}
          hint="Picker source"
          tone="muted"
        />
      </FinanceMetricStrip>

      {canWrite ? (
        <FinancePanel title="Send quotation" description="Pick a CRM customer with an email. Sends via Resend when configured.">
          <form onSubmit={sendQuote} className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="quote-search">Customer</Label>
              <div className="finance-toolbar-search">
                <Search aria-hidden />
                <input
                  id="quote-search"
                  type="search"
                  placeholder="Search name, email, phone"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search customers"
                />
              </div>
              <select
                className="finance-toolbar-select min-h-10 w-full"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                aria-label="Select customer"
                required
              >
                <option value="">Select customer…</option>
                {filteredCustomers.map((c) => (
                  <option key={c.id} value={c.id} disabled={!c.email}>
                    {(c.full_name || 'Customer') + (c.email ? ` · ${c.email}` : ' · no email')}
                  </option>
                ))}
              </select>
              {selected && !selected.email ? (
                <p className="text-sm text-destructive">Selected customer has no email on file.</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="quote-title">Title</Label>
              <Input
                id="quote-title"
                className="min-h-10"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="quote-amount">Amount (₱)</Label>
              <Input
                id="quote-amount"
                className="min-h-10"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="quote-branch">Branch (optional)</Label>
              <select
                id="quote-branch"
                className="finance-toolbar-select min-h-10 w-full"
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
              >
                <option value="">—</option>
                {branches.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="quote-notes">Notes</Label>
              <Textarea
                id="quote-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" className="min-h-10 cursor-pointer" disabled={sending}>
                <Send data-icon="inline-start" />
                {sending ? 'Sending…' : 'Send quotation'}
              </Button>
            </div>
          </form>
        </FinancePanel>
      ) : null}

      <FinancePanel title="Recent quotations" description="Stored after each send (or preview).">
        {!quotes.length ? (
          <FinanceEmpty title="No quotations yet" body="Send a quote to a CRM customer to build history." />
        ) : (
          <div className="finance-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sent</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="tabular-nums">{new Date(q.sent_at).toLocaleString()}</TableCell>
                    <TableCell>{q.customers?.full_name || '—'}</TableCell>
                    <TableCell>{q.meta?.to || q.customers?.email || '—'}</TableCell>
                    <TableCell className="tabular-nums">{formatMoney(q.amount_minor)}</TableCell>
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
