import { useEffect, useState } from 'react'
import { CheckSquare, Trash2, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { allowedStaffPlanAssigneePatch } from '@/queue/staffTaskLogic'
import { planProofObjectPath } from '@/lib/plannerTasks'
import { toast } from 'sonner'

function sortByPos(a, b) {
  return (a.position ?? 0) - (b.position ?? 0)
}

export default function TaskModal({
  card,
  listId: initialListId,
  lists = [],
  canEdit,
  categories = [],
  checklistTemplates = [],
  onClose,
  onSaved,
  onDeleted,
}) {
  const { user, profile } = useAuth()
  const [createdId, setCreatedId] = useState(null)
  const workingId = card?.id || createdId
  const isCreate = !workingId
  const [listId, setListId] = useState(card?.list_id || initialListId || lists[0]?.id || '')
  const [title, setTitle] = useState(card?.title || '')
  const [description, setDescription] = useState(card?.description || '')
  const [dueAt, setDueAt] = useState(card?.due_at ? String(card.due_at).slice(0, 16) : '')
  const [categoryId, setCategoryId] = useState(card?.category_id || '')
  const [items, setItems] = useState([...(card?.plan_checklist_items || [])].sort(sortByPos))
  const [assignees, setAssignees] = useState([...(card?.plan_card_assignees || [])])
  const [staffPool, setStaffPool] = useState([])
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)
  const [proofNote, setProofNote] = useState('')
  const [proofFile, setProofFile] = useState(null)
  const myAssignee = assignees.find((a) => a.staff_id === profile?.id)

  useEffect(() => {
    setListId(card?.list_id || initialListId || lists[0]?.id || '')
    setTitle(card?.title || '')
    setDescription(card?.description || '')
    setDueAt(card?.due_at ? String(card.due_at).slice(0, 16) : '')
    setCategoryId(card?.category_id || '')
    setItems([...(card?.plan_checklist_items || [])].sort(sortByPos))
    setAssignees([...(card?.plan_card_assignees || [])])
    setCreatedId(null)
  }, [card?.id, initialListId])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    supabase
      .from('staff_profiles')
      .select('id, full_name, username, role, is_active')
      .eq('is_active', true)
      .in('role', ['staff', 'team_lead', 'admin', 'assistant_super_admin', 'BossMich', 'marketing', 'video_editor'])
      .order('full_name')
      .then(({ data, error }) => {
        if (error) toast.error(error.message)
        else setStaffPool(data || [])
      })
  }, [])

  async function persistCard(id) {
    const { error } = await supabase
      .from('plan_cards')
      .update({
        title: title.trim() || 'Untitled task',
        description,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        category_id: categoryId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    return error
  }

  async function save() {
    if (!canEdit) {
      onClose()
      return
    }
    if (!title.trim()) return toast.error('Title is required')
    setSaving(true)
    if (isCreate) {
      if (!listId) {
        setSaving(false)
        return toast.error('Pick a column first')
      }
      const { data, error } = await supabase
        .from('plan_cards')
        .insert({
          list_id: listId,
          title: title.trim(),
          description,
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
          category_id: categoryId || null,
          position: 0,
          created_by: user?.id || null,
        })
        .select('id')
        .single()
      setSaving(false)
      if (error) return toast.error(error.message)
      toast.success('Task created')
      setCreatedId(data.id)
      onSaved(data)
      return
    }
    const error = await persistCard(workingId)
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Task saved')
    onSaved()
    onClose()
  }

  async function remove() {
    if (!canEdit || isCreate || !window.confirm('Delete this task?')) return
    const { error } = await supabase.from('plan_cards').delete().eq('id', workingId)
    if (error) return toast.error(error.message)
    toast.success('Task deleted')
    onDeleted?.()
    onClose()
  }

  async function toggleAssignee(staff) {
    if (!canEdit || isCreate) return toast.message('Save the task first, then assign people.')
    const existing = assignees.find((a) => a.staff_id === staff.id)
    if (existing) {
      const { error } = await supabase.from('plan_card_assignees').delete().eq('id', existing.id)
      if (error) return toast.error(error.message)
      setAssignees((prev) => prev.filter((a) => a.id !== existing.id))
      toast.success(`Unassigned ${staff.full_name}`)
      return
    }
    const { data, error } = await supabase
      .from('plan_card_assignees')
      .insert({
        card_id: workingId,
        staff_id: staff.id,
        assigned_by: user?.id || null,
        status: 'todo',
      })
      .select('id, staff_id, status, notes, proof_url, proof_note, proof_submitted_at, staff_profiles ( id, full_name, username )')
      .single()
    if (error) return toast.error(error.message)
    setAssignees((prev) => [...prev, data])
    toast.success(`Assigned ${staff.full_name}`)
    await supabase.from('user_notifications').insert({
      user_id: staff.id,
      kind: 'planner_task',
      title: 'Planner task assigned',
      body: title.trim() || 'You have a new Planner task',
      url: '/operations/my-tasks',
      tag: `plan-card:${workingId}`,
    })
  }

  async function addChecklist() {
    const t = newItem.trim()
    if (!t || !canEdit || isCreate) return
    const { data, error } = await supabase
      .from('plan_checklist_items')
      .insert({ card_id: workingId, title: t, position: items.length })
      .select('id, title, done, position')
      .single()
    if (error) return toast.error(error.message)
    setItems((prev) => [...prev, data])
    setNewItem('')
  }

  async function submitProof(toStatus) {
    if (!myAssignee) return
    let proofUrl = myAssignee.proof_url || null
    if (proofFile) {
      const path = planProofObjectPath(profile.id, workingId, proofFile.name)
      const { error: upErr } = await supabase.storage.from('plan-proofs').upload(path, proofFile, { upsert: true })
      if (upErr) return toast.error(upErr.message)
      proofUrl = path
    }
    const patch = allowedStaffPlanAssigneePatch(myAssignee, {
      status: toStatus,
      proof_url: proofUrl,
      proof_note: proofNote || myAssignee.proof_note,
    })
    if (!patch) return toast.error('That status change is not allowed')
    const { error } = await supabase.from('plan_card_assignees').update(patch).eq('id', myAssignee.id)
    if (error) return toast.error(error.message)
    toast.success(toStatus === 'for_review' ? 'Submitted for review' : 'Marked done')
    onSaved()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#020a31]/40 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-task-title"
        className="planner-modal planner-ticket max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_24px_60px_-24px_rgba(2,10,49,0.35)] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
              {isCreate ? 'New task' : canEdit ? 'Edit task' : 'Task'}
            </p>
            <input
              id="plan-task-title"
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-xl font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-80"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEdit}
              placeholder="What needs doing"
            />
          </div>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-xl border border-border" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <label className="mt-5 block text-xs font-medium text-muted-foreground">
          Description
          <textarea
            className="mt-1 min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEdit}
          />
        </label>

        {isCreate && lists.length > 0 && (
          <label className="mt-4 block text-xs font-medium text-muted-foreground">
            List
            <select
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              value={listId}
              onChange={(e) => setListId(e.target.value)}
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Category
            <select
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={!canEdit}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Deadline (optional)
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              disabled={!canEdit}
            />
          </label>
        </div>

        {!isCreate && (
          <div className="mt-5">
            <p className="text-xs font-medium text-muted-foreground">Assignees</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {assignees.map((a) => (
                <Badge key={a.id} variant="secondary">
                  {a.staff_profiles?.full_name || a.staff_id} · {a.status === 'for_review' ? 'For review' : a.status}
                </Badge>
              ))}
            </div>
            {canEdit && (
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border bg-muted/30 p-2">
                {staffPool.map((staff) => {
                  const on = assignees.some((a) => a.staff_id === staff.id)
                  return (
                    <button
                      key={staff.id}
                      type="button"
                      onClick={() => toggleAssignee(staff)}
                      className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm ${on ? 'bg-primary/15 text-primary' : 'hover:bg-muted'}`}
                    >
                      <span>{staff.full_name}</span>
                      <span className="text-[10px] uppercase tracking-wide">{on ? 'Assigned' : 'Add'}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {!isCreate && (
          <div className="mt-5">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <CheckSquare size={14} /> Checklist
            </p>
            <ul className="mt-2 space-y-2">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                  <span className={`flex-1 text-sm ${item.done ? 'line-through text-muted-foreground' : ''}`}>{item.title}</span>
                  {canEdit && (
                    <button type="button" onClick={() => supabase.from('plan_checklist_items').delete().eq('id', item.id).then(() => setItems((p) => p.filter((i) => i.id !== item.id)))} aria-label="Remove">
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {canEdit && (
              <div className="mt-2 flex gap-2">
                <input className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm" placeholder="Add checklist item" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklist())} />
                <Button type="button" size="sm" onClick={addChecklist}>Add</Button>
              </div>
            )}
            {canEdit && checklistTemplates?.length > 0 && (
              <select
                className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                defaultValue=""
                onChange={async (e) => {
                  const tmpl = checklistTemplates.find((t) => t.id === e.target.value)
                  e.target.value = ''
                  const rows = [...(tmpl?.plan_checklist_template_items || [])].sort(sortByPos)
                  if (!rows.length) return
                  const { data, error } = await supabase
                    .from('plan_checklist_items')
                    .insert(rows.map((r, i) => ({ card_id: workingId, title: r.title, position: items.length + i })))
                    .select('id, title, done, position')
                  if (error) toast.error(error.message)
                  else setItems((prev) => [...prev, ...(data || [])])
                }}
              >
                <option value="">Apply checklist template</option>
                {checklistTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
        )}

        {myAssignee && !canEdit && (
          <div className="mt-5 rounded-xl border border-dashed border-border p-3">
            <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Proof (optional)</p>
            <textarea className="mt-2 min-h-16 w-full rounded-xl border px-3 py-2 text-sm" placeholder="Note" value={proofNote} onChange={(e) => setProofNote(e.target.value)} />
            <input type="file" accept="image/*" className="mt-2 text-sm" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
            <div className="mt-3 flex flex-wrap gap-2">
              {myAssignee.status === 'todo' && (
                <Button type="button" size="sm" onClick={() => submitProof('in_progress')}>Start</Button>
              )}
              {myAssignee.status === 'in_progress' && (
                <>
                  <Button type="button" size="sm" onClick={() => submitProof('for_review')}>Submit for review</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => submitProof('done')}>Mark done</Button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {canEdit && !isCreate && (
            <Button type="button" variant="ghost" className="text-destructive" onClick={remove}>Delete</Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          {canEdit && (
            <Button type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : isCreate ? 'Create task' : 'Save changes'}</Button>
          )}
        </div>
      </div>
    </div>
  )
}
