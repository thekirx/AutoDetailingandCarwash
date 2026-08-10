import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Megaphone } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canSendBroadcast } from '@/auth/permissions'
import { getAccessTokenFresh } from '@/lib/authToken'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Super Admin / ASA / Marketing — send a custom push or SMS to all customers.
 */
export default function BroadcastPage() {
  const { profile } = useAuth()
  const [branches, setBranches] = useState([])
  const [history, setHistory] = useState([])
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({
    kind: 'promo',
    channel: 'push',
    title: '',
    body: '',
    url: '/account',
    target_audience: 'all',
    branch_slug: '',
  })

  useEffect(() => {
    supabase.from('branches').select('slug, name').order('name').then(({ data }) => setBranches(data || []))
    loadHistory()
  }, [])

  async function loadHistory() {
    const { data } = await supabase
      .from('notification_broadcasts')
      .select('id, kind, channel, title, body, target_audience, branch_slug, sent_count, failed_count, sent_at')
      .order('sent_at', { ascending: false })
      .limit(20)
    setHistory(data || [])
  }

  if (!canSendBroadcast(profile)) return <Navigate to="/operations/access-denied" replace />

  async function send(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Title and message are required.')
      return
    }
    setSending(true)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/notification-broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          kind: form.kind,
          channel: form.channel,
          title: form.title.trim(),
          body: form.body.trim(),
          url: form.url || '/account',
          target_audience: form.target_audience,
          branch_slug: form.target_audience === 'branch' ? form.branch_slug : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Broadcast failed')
        return
      }
      toast.success(`Sent ${data.sent} · failed ${data.failed}`)
      setForm({ ...form, title: '', body: '' })
      loadHistory()
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="flex flex-col gap-6 pb-8">
      <header className="border-b border-border pb-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Settings</p>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <Megaphone className="size-6" aria-hidden /> Broadcast push
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a custom push or SMS to all customers — promos, we-missed-you, deals.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Compose broadcast</CardTitle>
          <CardDescription>Customers with push subscriptions or a phone on file will receive this.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={send} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bc-kind">Kind</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger id="bc-kind" className="cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="promo">Promo</SelectItem>
                    <SelectItem value="we_missed">We missed you</SelectItem>
                    <SelectItem value="reminder">Reminder</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bc-channel">Channel</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                  <SelectTrigger id="bc-channel" className="cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="push">Push</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="both">Push + SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bc-audience">Audience</Label>
                <Select value={form.target_audience} onValueChange={(v) => setForm({ ...form, target_audience: v })}>
                  <SelectTrigger id="bc-audience" className="cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All customers</SelectItem>
                    <SelectItem value="detailing">Detailing customers</SelectItem>
                    <SelectItem value="wash">Wash customers</SelectItem>
                    <SelectItem value="branch">One branch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.target_audience === 'branch' ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bc-branch">Branch</Label>
                  <Select value={form.branch_slug} onValueChange={(v) => setForm({ ...form, branch_slug: v })}>
                    <SelectTrigger id="bc-branch" className="cursor-pointer"><SelectValue placeholder="Pick branch" /></SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bc-title">Title</Label>
              <Input id="bc-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bc-body">Message</Label>
              <Textarea id="bc-body" required rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={480} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bc-url">Tap URL</Label>
              <Input id="bc-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <Button type="submit" disabled={sending} className="w-fit">
              {sending ? 'Sending…' : 'Send broadcast'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent broadcasts</CardTitle>
          <CardDescription>Last 20 sends.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No broadcasts yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((h) => (
                <li key={h.id} className="py-3">
                  <p className="text-sm font-semibold">{h.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.kind} · {h.channel} · {h.target_audience}
                    {h.branch_slug ? ` · ${h.branch_slug}` : ''} · sent {h.sent_count} · failed {h.failed_count}
                  </p>
                  {h.body ? <p className="mt-1 text-sm text-muted-foreground">{h.body}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
