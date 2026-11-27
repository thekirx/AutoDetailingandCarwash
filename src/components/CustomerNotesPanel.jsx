/** Last-N guest notes + add form for queue / CRM. Shows author · date (C14). */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { validateCustomerNote, isRegularGuest } from '@/lib/customerNotes'
import { attachNoteAuthors, formatNoteAuthorDate } from '@/lib/customerNoteDisplay'
import { normalizePlate } from '@/lib/customerAuth'
import { toast } from 'sonner'

export default function CustomerNotesPanel({
  customerId = null,
  plate = '',
  vehicleId = null,
  branch = '',
  limit = 8,
  canWrite = true,
}) {
  const [notes, setNotes] = useState([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const plateNorm = plate ? normalizePlate(plate) : null
    if (!customerId && !plateNorm) {
      setNotes([])
      return
    }
    let q = supabase
      .from('customer_notes')
      .select('id, body, note_type, plate_normalized, created_at, created_by, customer_id, branch_slug')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (customerId && plateNorm) {
      q = q.or(`customer_id.eq.${customerId},plate_normalized.eq.${plateNorm}`)
    } else if (customerId) {
      q = q.eq('customer_id', customerId)
    } else {
      q = q.eq('plate_normalized', plateNorm)
    }
    const { data, error: err } = await q
    if (err) {
      toast.error(err.message)
      return
    }
    const rows = data || []
    const ids = [...new Set(rows.map((n) => n.created_by).filter(Boolean))]
    let nameRows = []
    if (ids.length) {
      const { data: names } = await supabase.rpc('staff_display_names', { p_ids: ids })
      nameRows = names || []
    }
    setNotes(attachNoteAuthors(rows, nameRows))
  }, [customerId, plate, limit])

  useEffect(() => {
    load()
  }, [load])

  async function addNote(e) {
    e?.preventDefault?.()
    const check = validateCustomerNote({ body, noteType: 'general', plate })
    if (!check.ok) {
      setError(check.errors.body || 'Invalid note')
      return
    }
    if (!customerId && !check.plate_normalized) {
      setError('Link a customer or plate first')
      return
    }
    setBusy(true)
    setError('')
    const user = (await supabase.auth.getUser()).data?.user
    let noteBranch = branch || null
    if (!noteBranch && user?.id) {
      const { data: sp } = await supabase
        .from('staff_profiles')
        .select('branch_slug')
        .eq('id', user.id)
        .maybeSingle()
      if (sp?.branch_slug) noteBranch = sp.branch_slug
    }

    const { error: err } = await supabase.from('customer_notes').insert({
      customer_id: customerId || null,
      vehicle_id: vehicleId || null,
      plate_normalized: check.plate_normalized,
      note_type: check.note_type,
      body: check.body,
      branch_slug: noteBranch,
      created_by: user?.id || null,
    })
    setBusy(false)
    if (err) toast.error(err.message)
    else {
      toast.success('Guest note saved')
      setBody('')
      load()
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">Notes</p>
        {isRegularGuest(notes) ? <Badge variant="secondary">Regular</Badge> : null}
      </div>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{canWrite ? 'No notes yet.' : 'No notes yet.'}</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1">{n.body}</p>
                {n.branch_slug || n.author_branch ? (
                  <Badge variant="outline" className="h-4 shrink-0 py-0 font-mono text-[10px] uppercase">
                    {n.branch_slug || n.author_branch}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground" data-testid="note-author-date">
                {formatNoteAuthorDate({
                  authorName: n.author_name,
                  authorRole: n.author_role,
                  authorBranch: n.author_branch,
                  branch: n.branch_slug,
                  createdAt: n.created_at,
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
      {canWrite ? (
        <form onSubmit={addNote} className="space-y-2 border-t border-border pt-3">
          <Label htmlFor="guest-note-body">Add note</Label>
          <Textarea
            id="guest-note-body"
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a note about this customer or vehicle…"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11" disabled={busy}>
              {busy ? 'Saving…' : 'Save note'}
            </Button>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </form>
      ) : null}
    </div>
  )
}
