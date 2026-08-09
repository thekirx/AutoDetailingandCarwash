import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const blankPost = {
  title: '', excerpt: '', sourceUrl: '', mediaUrl: '', platform: 'external',
  ctaLabel: 'View original post', status: 'draft',
}

function fromRow(row) {
  if (!row) return blankPost
  return {
    title: row.title || '',
    excerpt: row.excerpt || '',
    sourceUrl: row.source_url || '',
    mediaUrl: row.media_url || '',
    platform: row.platform || 'external',
    ctaLabel: row.cta_label || 'View original post',
    status: row.status || 'draft',
    publishedAt: row.published_at || null,
  }
}

export default function PostEditor({ item, busy, onSave, onCancel }) {
  const [form, setForm] = useState(() => fromRow(item))
  const [file, setFile] = useState(null)

  useEffect(() => {
    setForm(fromRow(item))
    setFile(null)
  }, [item])

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{item ? 'Edit post' : 'Create post'}</CardTitle>
        <CardDescription>Build the Hakum preview and link it to the original Facebook or Instagram post.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); onSave(form, file) }}>
          <div className="grid gap-2 md:col-span-2"><Label htmlFor="post-title">Title</Label><Input id="post-title" required value={form.title} onChange={(e) => update('title', e.target.value)} /></div>
          <div className="grid gap-2 md:col-span-2"><Label htmlFor="post-excerpt">Description / excerpt</Label><Textarea id="post-excerpt" value={form.excerpt} onChange={(e) => update('excerpt', e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="post-source">Original link</Label><Input id="post-source" type="url" value={form.sourceUrl} onChange={(e) => update('sourceUrl', e.target.value)} placeholder="https://facebook.com/..." /></div>
          <div className="grid gap-2"><Label htmlFor="post-media">External media URL</Label><Input id="post-media" type="url" value={form.mediaUrl} onChange={(e) => update('mediaUrl', e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="post-upload">Upload media</Label><Input id="post-upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          <div className="grid gap-2"><Label>Platform</Label><Select value={form.platform} onValueChange={(value) => update('platform', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="external">External</SelectItem><SelectItem value="facebook">Facebook</SelectItem><SelectItem value="instagram">Instagram</SelectItem></SelectContent></Select></div>
          <div className="grid gap-2"><Label htmlFor="post-cta">CTA label</Label><Input id="post-cta" value={form.ctaLabel} onChange={(e) => update('ctaLabel', e.target.value)} /></div>
          <div className="grid gap-2"><Label>Status</Label><Select value={form.status} onValueChange={(value) => update('status', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div>
          <div className="flex flex-wrap gap-2 md:col-span-2"><Button disabled={busy}>{busy ? 'Saving…' : 'Save post'}</Button>{item ? <Button type="button" variant="outline" onClick={onCancel}>Cancel edit</Button> : null}</div>
        </form>
      </CardContent>
    </Card>
  )
}
