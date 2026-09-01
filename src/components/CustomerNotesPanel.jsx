/** Last-N guest notes + add form for queue / CRM. */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { validateCustomerNote, CUSTOMER_NOTE_TYPES, isRegularGuest } from '@/lib/customerNotes'
import { normalizePlate } from '@/lib/customerAuth'
import { toast } from 'sonner'

export default function CustomerNotesPanel({
  customerId = null,
  plate = '',
  vehicleId = null,
  limit = 8,
  canWrite = true,
}) {
  const [notes, setNotes] = useState([])
  const [body, setBody] = useState('')
  const [noteType, setNoteType] = useState('general')
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
      .select('id, body, note_type, plate_normalized, created_at, customer_id')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (customerId) q = q.eq('customer_id', customerId)
    else q = q.eq('plate_normalized', plateNorm)
    const { data, error: err } = await q
    if (err) toast.error(err.message)
    else setNotes(data || [])
  }, [customerId, plate, limit])

  useEffect(() => {
    load()
  }, [load])

  async function addNote(e) {
    e?.preventDefault?.()
    const check = validateCustomerNote({ body, noteType, plate })
    if (!check.ok) {
      setError(check.errors.body || check.errors.note_type || 'Invalid note')
      return
    }
    if (!customerId && !check.plate_normalized) {
      setError('Link a customer or plate first')
      return
    }
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('customer_notes').insert({
      customer_id: customerId || null,
      vehicle_id: vehicleId || null,
      plate_normalized: check.plate_normalized,
      note_type: check.note_type,
      body: check.body,
      created_by: (await supabase.auth.getUser()).data?.user?.id || null,
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
        <p className="text-sm font-medium">Guest notes</p>
        {isRegularGuest(notes) ? <Badge variant="secondary">Regular</Badge> : null}
      </div>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet — add likes, dislikes, or preferences.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{n.note_type}</p>
              <p>{n.body}</p>
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
            placeholder="Prefers soft towels, allergic to citrus, etc."
          />
          <div className="flex flex-wrap gap-2">
            <select
              className="min-h-11 rounded-md border border-input bg-background px-3 text-sm"
              value={noteType}
              onChange={(e) => setNoteType(e.target.value)}
            >
              {CUSTOMER_NOTE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
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
