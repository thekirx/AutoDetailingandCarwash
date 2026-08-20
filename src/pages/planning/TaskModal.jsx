import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckSquare, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getAccessTokenFresh } from '@/lib/authToken'
import { supabase } from '@/lib/supabase'
import { allowedStaffPlanAssigneePatch } from '@/queue/staffTaskLogic'
import { hasPlannerProof, planProofObjectPath, toggleStaffId } from '@/lib/plannerTasks'
import { defaultPlanListId, nextPlanCardPosition, plannerListOptions } from '@/lib/plannerBoard'
import { datetimeLocalToIso, isoToDatetimeLocalValue } from '@/lib/localCalendarDate'
import { toast } from 'sonner'

function sortByPos(a, b) {
  return (a.position ?? 0) - (b.position ?? 0)
}

const ASSIGNEE_SELECT = 'id, staff_id, status, notes, proof_url, proof_note, proof_submitted_at, staff_profiles ( id, full_name, username )'

async function pingPlannerAssignees(cardId, userIds, title) {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  if (!cardId || !ids.length) return
  try {
    const token = await getAccessTokenFresh()
    await fetch('/api/notify-planner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ card_id: cardId, user_ids: ids, title }),
    })
  } catch {
    // ponytail: assign already persisted; inbox/push is best-effort
  }
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
  const titleRef = useRef(null)
  const workingId = card?.id || null
  const isCreate = !workingId
  const [listId, setListId] = useState(() => defaultPlanListId(lists, card?.list_id || initialListId))
  const [title, setTitle] = useState(card?.title || '')
  const [titleError, setTitleError] = useState('')
  const [description, setDescription] = useState(card?.description || '')
  const [dueAt, setDueAt] = useState(card?.due_at ? isoToDatetimeLocalValue(card.due_at) : '')
  const [categoryId, setCategoryId] = useState(card?.category_id || '')
  const [proofRequired, setProofRequired] = useState(Boolean(card?.proof_required))
  const [items, setItems] = useState([...(card?.plan_checklist_items || [])].sort(sortByPos))
  const [assignees, setAssignees] = useState([...(card?.plan_card_assignees || [])])
  const [pickedIds, setPickedIds] = useState(() => (card?.plan_card_assignees || []).map((a) => a.staff_id).filter(Boolean))
  const [staffPool, setStaffPool] = useState([])
  const [peopleQ, setPeopleQ] = useState('')
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)
  const [proofNote, setProofNote] = useState('')
  const [proofFile, setProofFile] = useState(null)
  const myAssignee = assignees.find((a) => a.staff_id === profile?.id)
  const assignedIds = isCreate ? pickedIds : assignees.map((a) => a.staff_id)
  const assignedMe = Boolean(profile?.id && assignedIds.includes(profile.id))
  const visibleStaff = useMemo(() => {
    const q = peopleQ.trim().toLowerCase()
    if (!q) return staffPool
    return staffPool.filter((s) => `${s.full_name || ''} ${s.username || ''}`.toLowerCase().includes(q))
  }, [staffPool, peopleQ])
  const listOptions = useMemo(() => plannerListOptions(lists, card), [lists, card])

  useEffect(() => {
    setListId(defaultPlanListId(lists, card?.list_id || initialListId))
    setTitle(card?.title || '')
    setTitleError('')
    setDescription(card?.description || '')
    setDueAt(card?.due_at ? isoToDatetimeLocalValue(card.due_at) : '')
    setCategoryId(card?.category_id || '')
    setProofRequired(Boolean(card?.proof_required))
    setItems([...(card?.plan_checklist_items || [])].sort(sortByPos))
    setAssignees([...(card?.plan_card_assignees || [])])
    setPickedIds((card?.plan_card_assignees || []).map((a) => a.staff_id).filter(Boolean))
  }, [card?.id, initialListId])

  useEffect(() => {
    setListId((prev) => prev || defaultPlanListId(lists, initialListId))
  }, [lists, initialListId])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    titleRef.current?.focus()
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    if (!canEdit) return
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
  }, [canEdit])

  async function persistCard(id) {
    const moving = Boolean(listId && listId !== card?.list_id)
    const { error } = await supabase
      .from('plan_cards')
      .update({
        list_id: listId || card?.list_id,
        title: title.trim() || 'Untitled task',
        description,
        due_at: datetimeLocalToIso(dueAt),
        category_id: categoryId || null,
        proof_required: proofRequired,
        ...(moving ? { position: nextPlanCardPosition(lists, listId) } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    return error
  }

  function finish(okMessage) {
    toast.success(okMessage)
    onSaved?.()
    onClose()
  }

  async function save() {
    if (!canEdit) {
      onClose()
      return
    }
    if (!title.trim()) {
      setTitleError('Title is required')
      titleRef.current?.focus()
      return
    }
    setTitleError('')
    setSaving(true)
    if (isCreate) {
      if (!listId) {
        setSaving(false)
        return toast.error('This board has no list to put the task in.')
      }
      const { data, error } = await supabase
        .from('plan_cards')
        .insert({
          list_id: listId,
          title: title.trim(),
          description,
          due_at: datetimeLocalToIso(dueAt),
          category_id: categoryId || null,
          proof_required: proofRequired,
          position: nextPlanCardPosition(lists, listId),
          created_by: user?.id || null,
        })
        .select('id')
        .single()
      if (error) {
        setSaving(false)
        return toast.error(error.message)
      }
      let assigned = []
      if (pickedIds.length) {
        const { data: rows, error: aErr } = await supabase
          .from('plan_card_assignees')
          .insert(pickedIds.map((staff_id) => ({
            card_id: data.id,
            staff_id,
            assigned_by: user?.id || null,
            status: 'todo',
          })))
          .select(ASSIGNEE_SELECT)
        if (aErr) toast.error(aErr.message)
        else assigned = rows || []
      }
      const checklist = items.map((row) => String(row.title || '').trim()).filter(Boolean)
      if (checklist.length) {
        const { error: cErr } = await supabase.from('plan_checklist_items').insert(
          checklist.map((itemTitle, i) => ({ card_id: data.id, title: itemTitle, position: i })),
        )
        if (cErr) toast.error(cErr.message)
      }
      setSaving(false)
      toast.success('Task created')
      onSaved?.(data)
      onClose()
      void pingPlannerAssignees(data.id, assigned.map((row) => row.staff_id), title.trim())
      return
    }
    const error = await persistCard(workingId)
    setSaving(false)
    if (error) return toast.error(error.message)
    finish('Task saved')
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
    if (!canEdit || !staff?.id) return
    if (isCreate) {
      setPickedIds((prev) => toggleStaffId(prev, staff.id))
      return
    }
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
      .select(ASSIGNEE_SELECT)
      .single()
    if (error) return toast.error(error.message)
    setAssignees((prev) => [...prev, data])
    toast.success(`Assigned ${staff.full_name}`)
    void pingPlannerAssignees(workingId, [staff.id], title.trim())
  }

  function assignToMe() {
    if (!profile?.id) return toast.error('Sign in to assign yourself')
    const me = staffPool.find((s) => s.id === profile.id) || { id: profile.id, full_name: profile.full_name || 'Me' }
    toggleAssignee(me)
  }

  async function addChecklist() {
    const t = newItem.trim()
    if (!t || !canEdit) return
    if (isCreate) {
      setItems((prev) => [...prev, { id: `draft-${prev.length}-${t}`, title: t, done: false, position: prev.length, _draft: true }])
      setNewItem('')
      return
    }
    const { data, error } = await supabase
      .from('plan_checklist_items')
      .insert({ card_id: workingId, title: t, position: items.length })
      .select('id, title, done, position')
      .single()
    if (error) return toast.error(error.message)
    setItems((prev) => [...prev, data])
    setNewItem('')
  }

  async function dropChecklist(item) {
    if (!canEdit) return
    if (item._draft || isCreate) {
      setItems((prev) => prev.filter((row) => row.id !== item.id))
      return
    }
    const { error } = await supabase.from('plan_checklist_items').delete().eq('id', item.id)
    if (error) return toast.error(error.message)
    setItems((prev) => prev.filter((row) => row.id !== item.id))
  }

  async function toggleChecklist(item) {
    const nextDone = !item.done
    if (item._draft || isCreate) {
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, done: nextDone } : row)))
      return
    }
    const { error } = await supabase.from('plan_checklist_items').update({ done: nextDone }).eq('id', item.id)
    if (error) return toast.error(error.message)
    setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, done: nextDone } : row)))
  }

  async function applyTemplate(templateId) {
    const tmpl = checklistTemplates.find((t) => t.id === templateId)
    const rows = [...(tmpl?.plan_checklist_template_items || [])].sort(sortByPos)
    if (!rows.length) return
    if (isCreate) {
      setItems((prev) => [
        ...prev,
        ...rows.map((r, i) => ({ id: `draft-tmpl-${templateId}-${i}`, title: r.title, done: false, position: prev.length + i, _draft: true })),
      ])
      return
    }
    const { data, error } = await supabase
      .from('plan_checklist_items')
      .insert(rows.map((r, i) => ({ card_id: workingId, title: r.title, position: items.length + i })))
      .select('id, title, done, position')
    if (error) toast.error(error.message)
    else setItems((prev) => [...prev, ...(data || [])])
  }

  async function submitProof(toStatus) {
    if (!myAssignee) return
    if ((toStatus === 'for_review' || toStatus === 'done') && proofRequired && !hasPlannerProof(myAssignee.proof_url, proofFile)) {
      return toast.error('Photo proof is required for this task')
    }
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
    }, { proofRequired })
    if (!patch) return toast.error(proofRequired && (toStatus === 'for_review' || toStatus === 'done') ? 'Photo proof is required for this task' : 'That status change is not allowed')
    const { error } = await supabase.from('plan_card_assignees').update(patch).eq('id', myAssignee.id)
    if (error) return toast.error(error.message)
    finish(toStatus === 'for_review' ? 'Submitted for review' : 'Marked done')
  }

  return (
    <div
      className="planner-task-scrim"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-task-title"
        className="planner-task-sheet planner-ticket"
      >
        <div className="planner-task-handle" aria-hidden />
        <div className="planner-task-head">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
              {isCreate ? 'New task' : canEdit ? 'Edit task' : 'Task'}
            </p>
            <input
              ref={titleRef}
              id="plan-task-title"
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-xl font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-80"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (titleError) setTitleError('')
              }}
              disabled={!canEdit}
              placeholder="What needs doing"
              aria-invalid={Boolean(titleError)}
              aria-describedby={titleError ? 'plan-task-title-error' : undefined}
            />
            {titleError ? <p id="plan-task-title-error" className="mt-1 text-sm text-destructive">{titleError}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-xl border border-border" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="planner-task-body">
          <label className="block text-xs font-medium text-muted-foreground">
            Description
            <textarea
              className="mt-1 min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEdit}
            />
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-muted-foreground">
              List
              <select
                className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                disabled={!canEdit || !listOptions.length}
              >
                {!listOptions.length ? <option value="">This board has no list</option> : null}
                {listOptions.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Category
              <select
                className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
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
          </div>

          <label className="mt-4 block text-xs font-medium text-muted-foreground">
            Deadline (optional)
            <input
              type="datetime-local"
              className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              disabled={!canEdit}
            />
          </label>

          <label className="mt-4 flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={proofRequired}
              onChange={(e) => setProofRequired(e.target.checked)}
              disabled={!canEdit}
            />
            Photo submission required
          </label>

          <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Assignees</p>
              {canEdit && profile?.id && (
                <Button type="button" size="sm" className="min-h-11" variant={assignedMe ? 'secondary' : 'outline'} onClick={assignToMe}>
                  Assign to me
                </Button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {assignedIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nobody assigned yet.</p>
              ) : isCreate
                ? pickedIds.map((id) => {
                    const staff = staffPool.find((s) => s.id === id)
                    return <Badge key={id} variant="secondary">{staff?.full_name || (id === profile?.id ? 'Me' : id)}</Badge>
                  })
                : assignees.map((a) => (
                    <Badge key={a.id} variant="secondary">
                      {a.staff_profiles?.full_name || a.staff_id} · {a.status === 'for_review' ? 'For review' : a.status}
                    </Badge>
                  ))}
            </div>
            {canEdit && (
              <div className="mt-2 rounded-xl border border-border bg-muted/30 p-2">
                <label className="relative block">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <input
                    className="min-h-11 w-full rounded-lg border border-transparent bg-background pr-3 pl-9 text-sm"
                    placeholder="Find a person"
                    value={peopleQ}
                    onChange={(e) => setPeopleQ(e.target.value)}
                    aria-label="Find a person"
                  />
                </label>
                <div className="mt-1 max-h-40 space-y-1 overflow-y-auto overscroll-contain">
                  {visibleStaff.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No matching people.</p>
                  ) : visibleStaff.map((staff) => {
                    const on = assignedIds.includes(staff.id)
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
              </div>
            )}
          </div>

          <div className="mt-5">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <CheckSquare size={14} /> Checklist
            </p>
            <ul className="mt-2 space-y-2">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-1.5">
                  <button
                    type="button"
                    className="grid size-11 shrink-0 place-items-center"
                    onClick={() => (canEdit || myAssignee) && toggleChecklist(item)}
                    disabled={!canEdit && !myAssignee}
                    aria-pressed={Boolean(item.done)}
                    aria-label={item.done ? 'Mark checklist item not done' : 'Mark checklist item done'}
                  >
                    <span className={`inline-block size-4 rounded border ${item.done ? 'border-primary bg-primary' : 'border-input'}`} />
                  </button>
                  <span className={`min-w-0 flex-1 text-sm ${item.done ? 'text-muted-foreground line-through' : ''}`}>{item.title}</span>
                  {canEdit && (
                    <button type="button" className="grid size-11 place-items-center" onClick={() => dropChecklist(item)} aria-label="Remove checklist item">
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {canEdit && (
              <div className="mt-2 flex gap-2">
                <input className="min-h-11 min-w-0 flex-1 rounded-xl border px-3 text-sm" placeholder="Add checklist item" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklist())} />
                <Button type="button" size="sm" className="min-h-11" onClick={addChecklist}>Add</Button>
              </div>
            )}
            {canEdit && checklistTemplates?.length > 0 && (
              <select
                className="mt-2 min-h-11 w-full rounded-xl border px-3 text-sm"
                defaultValue=""
                onChange={(e) => {
                  const id = e.target.value
                  e.target.value = ''
                  if (id) applyTemplate(id)
                }}
              >
                <option value="">Apply checklist template</option>
                {checklistTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>

          {myAssignee && (
            <div className="mt-5 rounded-xl border border-dashed border-border p-3">
              <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                {proofRequired ? 'Proof (required)' : 'Proof (optional)'}
              </p>
              <textarea className="mt-2 min-h-16 w-full rounded-xl border px-3 py-2 text-sm" placeholder="Note" value={proofNote} onChange={(e) => setProofNote(e.target.value)} />
              <input type="file" accept="image/*" className="mt-2 min-h-11 w-full text-sm" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
              <div className="mt-3 flex flex-wrap gap-2">
                {myAssignee.status === 'todo' && (
                  <Button type="button" size="sm" className="min-h-11" onClick={() => submitProof('in_progress')}>Start</Button>
                )}
                {myAssignee.status === 'in_progress' && (
                  <>
                    <Button type="button" size="sm" className="min-h-11" onClick={() => submitProof('for_review')}>Submit for review</Button>
                    {!proofRequired && (
                      <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => submitProof('done')}>Mark done</Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="planner-task-foot">
          {canEdit && !isCreate && (
            <Button type="button" variant="ghost" className="min-h-11 text-destructive" onClick={remove}>Delete</Button>
          )}
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose} disabled={saving}>Close</Button>
          {canEdit && (
            <Button type="button" className="min-h-11" onClick={save} disabled={saving}>{saving ? 'Saving…' : isCreate ? 'Create task' : 'Save changes'}</Button>
          )}
        </div>
      </div>
    </div>
  )
}
