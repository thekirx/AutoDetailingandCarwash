import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const blankEvent = {
  title: '', description: '', branch: '', startsAt: '', endsAt: '', status: 'draft',
  locationText: '', sourceUrl: '', registrationUrl: '', mediaUrl: '', platform: 'external',
  ctaLabel: 'Event details',
}

function localInput(value) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function fromRow(row) {
  if (!row) return blankEvent
  return {
    title: row.title || '', description: row.description || '', branch: row.branch || '',
    startsAt: localInput(row.starts_at), endsAt: localInput(row.ends_at), status: row.status || (row.is_published ? 'published' : 'draft'),
    locationText: row.location_text || '', sourceUrl: row.source_url || '', registrationUrl: row.registration_url || '',
    mediaUrl: row.banner_url || '', platform: row.platform || 'external', ctaLabel: row.cta_label || 'Event details',
  }
}

export default function EventEditor({ item, busy, onSave, onCancel }) {
  const [form, setForm] = useState(() => fromRow(item))
  const [file, setFile] = useState(null)
  useEffect(() => { setForm(fromRow(item)); setFile(null) }, [item])
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <Card>
      <CardHeader><CardTitle>{item ? 'Edit event' : 'Create event'}</CardTitle><CardDescription>Extend the existing Events and Meets system with public preview media and links.</CardDescription></CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); onSave(form, file) }}>
          <div className="grid gap-2 md:col-span-2"><Label htmlFor="event-title">Title</Label><Input id="event-title" required value={form.title} onChange={(e) => update('title', e.target.value)} /></div>
          <div className="grid gap-2 md:col-span-2"><Label htmlFor="event-description">Description</Label><Textarea id="event-description" value={form.description} onChange={(e) => update('description', e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="event-start">Starts</Label><Input id="event-start" type="datetime-local" required value={form.startsAt} onChange={(e) => update('startsAt', e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="event-end">Ends</Label><Input id="event-end" type="datetime-local" value={form.endsAt} onChange={(e) => update('endsAt', e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="event-branch">Branch</Label><Input id="event-branch" value={form.branch} onChange={(e) => update('branch', e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="event-location">Location</Label><Input id="event-location" value={form.locationText} onChange={(e) => update('locationText', e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="event-source">Original social link</Label><Input id="event-source" type="url" value={form.sourceUrl} onChange={(e) => update('sourceUrl', e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="event-register">Registration link</Label><Input id="event-register" type="url" value={form.registrationUrl} onChange={(e) => update('registrationUrl', e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="event-media">External media URL</Label><Input id="event-media" type="url" value={form.mediaUrl} onChange={(e) => update('mediaUrl', e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="event-upload">Upload media</Label><Input id="event-upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          <div className="grid gap-2"><Label>Platform</Label><Select value={form.platform} onValueChange={(value) => update('platform', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="external">External</SelectItem><SelectItem value="facebook">Facebook</SelectItem><SelectItem value="instagram">Instagram</SelectItem></SelectContent></Select></div>
          <div className="grid gap-2"><Label htmlFor="event-cta">CTA label</Label><Input id="event-cta" value={form.ctaLabel} onChange={(e) => update('ctaLabel', e.target.value)} /></div>
          <div className="grid gap-2"><Label>Status</Label><Select value={form.status} onValueChange={(value) => update('status', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div>
          <div className="flex flex-wrap gap-2 md:col-span-2"><Button disabled={busy}>{busy ? 'Saving…' : 'Save event'}</Button>{item ? <Button type="button" variant="outline" onClick={onCancel}>Cancel edit</Button> : null}</div>
        </form>
      </CardContent>
    </Card>
  )
}
