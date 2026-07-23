import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessMarketing } from '@/auth/permissions'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

const TYPES = ['promo', 'reminder', 'loyalty', 'birthday', 'booking_confirm', 'booking_remind']

export default function SmsPage() {
  const { profile } = useAuth()
  const [templates, setTemplates] = useState([])
  const [events, setEvents] = useState([])
  const [form, setForm] = useState({ name: '', template_type: 'promo', body: '' })
  const [send, setSend] = useState({ phone: '', body: '', template_type: 'promo' })

  const load = useCallback(async () => {
    const [t, e] = await Promise.all([
      supabase.from('sms_templates').select('*').order('created_at', { ascending: false }),
      supabase.from('sms_events').select('*').order('created_at', { ascending: false }).limit(30),
    ])
    setTemplates(t.data || [])
    setEvents(e.data || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!canAccessMarketing(profile)) return <Navigate to="/operations/access-denied" replace />

  async function saveTemplate(event) {
    event.preventDefault()
    const { error } = await supabase.from('sms_templates').insert({
      name: form.name.trim(),
      template_type: form.template_type,
      body: form.body.trim(),
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Template saved')
      setForm({ name: '', template_type: 'promo', body: '' })
      load()
    }
  }

  async function queueSms(event) {
    event.preventDefault()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) {
      toast.error('Sign in required')
      return
    }
    const res = await fetch('/api/busybee', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ phone: send.phone.trim(), message: send.body.trim() }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.ok) {
      toast.error(body.providerResponse || body.error || 'BusyBee send failed')
    } else {
      toast.success('SMS sent via BusyBee')
    }
    // Audit row
    await supabase.from('sms_events').insert({
      phone: send.phone.trim(),
      message: send.body.trim(),
      event_type: send.template_type,
      status: body.ok ? 'sent' : 'failed',
      provider: 'busybee',
      provider_response: body.providerResponse || null,
      sent_at: body.ok ? new Date().toISOString() : null,
    })
    setSend({ phone: '', body: '', template_type: 'promo' })
    load()
  }

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Marketing</p>
        <h1 className="text-3xl font-semibold tracking-tight">SMS campaigns</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>New template</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={saveTemplate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
                <Select value={form.template_type} onValueChange={(v) => setForm({ ...form, template_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2"><Label>Body</Label><Textarea required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
              <Button type="submit">Save template</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Send / queue SMS</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={queueSms} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2"><Label>Phone</Label><Input required value={send.phone} onChange={(e) => setSend({ ...send, phone: e.target.value })} /></div>
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
                <Select value={send.template_type} onValueChange={(v) => setSend({ ...send, template_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2"><Label>Message</Label><Textarea required value={send.body} onChange={(e) => setSend({ ...send, body: e.target.value })} /></div>
              <Button type="submit">Queue SMS</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Templates</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Body</TableHead></TableRow></TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}><TableCell>{t.name}</TableCell><TableCell>{t.template_type}</TableCell><TableCell className="max-w-md truncate">{t.body}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent SMS events</CardTitle></CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-lg bg-muted/40 p-4 text-xs">{JSON.stringify(events, null, 2)}</pre>
        </CardContent>
      </Card>
    </section>
  )
}
