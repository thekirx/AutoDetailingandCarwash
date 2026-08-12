import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import { format, getDay, parse, startOfWeek } from 'date-fns'
import { enUS } from 'date-fns/locale'
import {
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Columns3,
  FileText,
  LoaderCircle,
  Plus,
  Settings2,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useAuth } from '@/auth/AuthProvider'
import { canEditPlanning, canViewPlanning } from '@/auth/permissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NamedSelect } from '@/components/ui/named-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import { createCoalescedReload } from '@/lib/coalesceReload'
import { pickPlannerBoard, PLANNER_TABS, plannerTabFromSearch, visiblePlannerBoards } from '@/lib/plannerBoard'
import {
  PlanningEventsPanel,
  PlanningFormsPanel,
  PlanningSettingsPanel,
} from '@/pages/planning/PlanningPart6Panels'
import { toast } from 'sonner'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
})

const FALLBACK_LABELS = [
  { name: 'Marketing', color: '#f97316' },
  { name: 'Ops', color: '#38bdf8' },
  { name: 'Legal', color: '#4ade80' },
  { name: 'Design', color: '#a78bfa' },
  { name: 'Production', color: '#fb7185' },
]

const BOARD_SELECT = `
  id, name,
  plan_lists (
    id, title, position,
    plan_cards (
      id, title, description, due_at, position, labels,
      plan_checklist_items ( id, title, done, position ),
      plan_card_assignees ( id, staff_id, status, notes, proof_url, proof_note, proof_submitted_at, staff_profiles ( id, full_name, username ) )
    )
  )
`

function sortByPos(a, b) {
  return (a.position ?? 0) - (b.position ?? 0)
}

function checklistStats(card) {
  const items = card.plan_checklist_items || []
  const done = items.filter((i) => i.done).length
  return { done, total: items.length }
}

const TAB_ICONS = {
  tasks: Columns3,
  calendar: CalendarDays,
  forms: FileText,
  events: ClipboardList,
  setup: Settings2,
}

function assigneeNames(card) {
  return (card.plan_card_assignees || [])
    .map((a) => a.staff_profiles?.full_name || a.staff_profiles?.username)
    .filter(Boolean)
}

function CardModal({ card, canEdit, labelPresets, checklistTemplates, onClose, onSaved, onDeleted }) {
  const { user } = useAuth()
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description || '')
  const [dueAt, setDueAt] = useState(card.due_at ? card.due_at.slice(0, 16) : '')
  const [labels, setLabels] = useState(Array.isArray(card.labels) ? card.labels : [])
  const [items, setItems] = useState([...(card.plan_checklist_items || [])].sort(sortByPos))
  const [assignees, setAssignees] = useState([...(card.plan_card_assignees || [])])
  const [staffPool, setStaffPool] = useState([])
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)
  const presets = labelPresets?.length ? labelPresets : FALLBACK_LABELS

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

  const toggleLabel = (preset) => {
    setLabels((prev) => {
      const has = prev.some((l) => l.name === preset.name)
      return has ? prev.filter((l) => l.name !== preset.name) : [...prev, preset]
    })
  }

  const toggleAssignee = async (staff) => {
    if (!canEdit) return
    const existing = assignees.find((a) => a.staff_id === staff.id)
    if (existing) {
      const { error } = await supabase.from('plan_card_assignees').delete().eq('id', existing.id)
      if (error) {
        toast.error(error.message)
        return
      }
      setAssignees((prev) => prev.filter((a) => a.id !== existing.id))
      toast.success(`Unassigned ${staff.full_name}`)
      return
    }
    const { data, error } = await supabase
      .from('plan_card_assignees')
      .insert({
        card_id: card.id,
        staff_id: staff.id,
        assigned_by: user?.id || null,
        status: 'todo',
      })
      .select('id, staff_id, status, notes, proof_url, proof_note, proof_submitted_at, staff_profiles ( id, full_name, username )')
      .single()
    if (error) {
      toast.error(error.message)
      return
    }
    setAssignees((prev) => [...prev, data])
    toast.success(`Assigned ${staff.full_name}`)
    const { error: notifyErr } = await supabase.from('user_notifications').insert({
      user_id: staff.id,
      kind: 'planner_task',
      title: 'Planner task assigned',
      body: card.title || 'You have a new Planner task',
      url: '/operations/my-tasks',
      tag: `plan-card:${card.id}`,
    })
    if (notifyErr) console.warn('planner notify', notifyErr.message)
  }

  const save = async () => {
    if (!canEdit) return onClose()
    setSaving(true)
    const { error } = await supabase
      .from('plan_cards')
      .update({
        title: title.trim() || card.title,
        description,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        labels,
        updated_at: new Date().toISOString(),
      })
      .eq('id', card.id)
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Card saved')
    onSaved()
    onClose()
  }

  const remove = async () => {
    if (!canEdit || !window.confirm('Delete this card?')) return
    const { error } = await supabase.from('plan_cards').delete().eq('id', card.id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Card deleted')
    onDeleted()
    onClose()
  }

  const addChecklist = async () => {
    const t = newItem.trim()
    if (!t || !canEdit) return
    const { data, error } = await supabase
      .from('plan_checklist_items')
      .insert({ card_id: card.id, title: t, position: items.length })
      .select('id, title, done, position')
      .single()
    if (error) {
      toast.error(error.message)
      return
    }
    setItems((prev) => [...prev, data])
    setNewItem('')
  }

  const toggleCheck = async (item) => {
    if (!canEdit) return
    const next = !item.done
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: next } : i)))
    const { error } = await supabase.from('plan_checklist_items').update({ done: next }).eq('id', item.id)
    if (error) {
      toast.error(error.message)
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: item.done } : i)))
    }
  }

  const removeCheck = async (item) => {
    if (!canEdit) return
    const { error } = await supabase.from('plan_checklist_items').delete().eq('id', item.id)
    if (error) {
      toast.error(error.message)
      return
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id))
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-card-title"
        className="max-h-[90svh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
              {canEdit ? 'Edit card' : 'View card'}
            </p>
            {canEdit ? (
              <input
                id="plan-card-title"
                className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-xl font-semibold text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            ) : (
              <h2 id="plan-card-title" className="mt-2 text-2xl font-semibold text-foreground">
                {card.title}
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>

        <label className="mt-5 block text-xs font-medium text-muted-foreground">
          Description
          <textarea
            className="mt-1 min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-70"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEdit}
          />
        </label>

        <label className="mt-4 block text-xs font-medium text-muted-foreground">
          Due date
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-70"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            disabled={!canEdit}
          />
        </label>

        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">Labels</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {presets.map((preset) => {
              const on = labels.some((l) => l.name === preset.name)
              return (
                <button
                  key={preset.name}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => toggleLabel({ name: preset.name, color: preset.color })}
                  className="rounded-full px-3 py-1 text-xs font-semibold text-slate-950 transition disabled:cursor-default"
                  style={{
                    backgroundColor: preset.color,
                    opacity: on ? 1 : 0.4,
                    outline: on ? '2px solid var(--foreground)' : 'none',
                    outlineOffset: 2,
                  }}
                >
                  {preset.name}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-medium text-muted-foreground">Assignees</p>
          {assignees.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {assignees.map((a) => (
                <Badge key={a.id} variant="secondary" className="gap-1">
                  {a.staff_profiles?.full_name || a.staff_id}
                  {a.staff_profiles?.username ? ` · @${a.staff_profiles.username}` : ''}
                  <span className="opacity-70">· {a.status === 'for_review' ? 'For review' : a.status}</span>
                  {a.proof_url && <a href={a.proof_url} target="_blank" rel="noreferrer" className="ml-1 underline text-xs text-blue-400" onClick={e => e.stopPropagation()}>proof</a>}
                </Badge>
              ))}
            </div>
          )}
          {canEdit && (
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border bg-muted/30 p-2">
              {staffPool.length ? staffPool.map((staff) => {
                const on = assignees.some((a) => a.staff_id === staff.id)
                return (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => toggleAssignee(staff)}
                    className={`flex w-full min-h-10 items-center justify-between rounded-lg px-3 text-left text-sm ${on ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-muted'}`}
                  >
                    <span>{staff.full_name}{staff.username ? ` · @${staff.username}` : ''}</span>
                    <span className="text-xs uppercase tracking-wide opacity-70">{on ? 'Assigned' : 'Add'}</span>
                  </button>
                )
              }) : <p className="px-2 py-3 text-xs text-muted-foreground">No staff profiles found.</p>}
            </div>
          )}
        </div>

        <div className="mt-5">
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CheckSquare size={14} /> Checklist
          </p>
          <ul className="mt-2 space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                <input
                  type="checkbox"
                  checked={!!item.done}
                  disabled={!canEdit}
                  onChange={() => toggleCheck(item)}
                  className="size-4 accent-primary"
                />
                <span className={`flex-1 text-sm ${item.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {item.title}
                </span>
                {canEdit && (
                  <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => removeCheck(item)} aria-label="Remove item">
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                  placeholder="Add checklist item"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklist())}
                />
                <Button type="button" size="sm" onClick={addChecklist}>
                  Add
                </Button>
              </div>
              {checklistTemplates?.length > 0 && (
                <select
                  className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
                  defaultValue=""
                  onChange={async (e) => {
                    const tid = e.target.value
                    e.target.value = ''
                    if (!tid) return
                    const tmpl = checklistTemplates.find((t) => t.id === tid)
                    const rows = [...(tmpl?.plan_checklist_template_items || [])].sort(sortByPos)
                    if (!rows.length) return
                    const { data, error } = await supabase
                      .from('plan_checklist_items')
                      .insert(rows.map((r, i) => ({ card_id: card.id, title: r.title, position: items.length + i })))
                      .select('id, title, done, position')
                    if (error) toast.error(error.message)
                    else {
                      setItems((prev) => [...prev, ...(data || [])])
                      toast.success(`Applied “${tmpl.name}”`)
                    }
                  }}
                >
                  <option value="">Apply checklist template…</option>
                  {checklistTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
          {canEdit && (
            <>
              <Button type="button" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button type="button" variant="outline" className="text-destructive" onClick={remove}>
                Delete
              </Button>
            </>
          )}
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function PlanningBoardPage() {
  const { profile } = useAuth()
  const canEdit = canEditPlanning(profile)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = plannerTabFromSearch(searchParams.get('tab'))
  const [board, setBoard] = useState(null)
  const [boards, setBoards] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCard, setActiveCard] = useState(null)
  const [dragCardId, setDragCardId] = useState(null)
  const [newListTitle, setNewListTitle] = useState('')
  const [addingCardFor, setAddingCardFor] = useState(null)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [labelPresets, setLabelPresets] = useState(FALLBACK_LABELS)
  const [checklistTemplates, setChecklistTemplates] = useState([])
  const [calSources, setCalSources] = useState({ planning: true, forms: true, events: true, bookings: true })
  const [calExtra, setCalExtra] = useState({ formSubs: [], meetEvents: [], bookings: [] })

  const load = useCallback(async () => {
    const { data: boardRows, error: boardsErr } = await supabase
      .from('plan_boards')
      .select('id, name, created_at')
      .order('created_at', { ascending: true })
    if (boardsErr) {
      toast.error(boardsErr.message)
      setBoard(null)
      setBoards([])
      setLoading(false)
      return
    }
    const visibleBoards = visiblePlannerBoards(boardRows)
    setBoards(visibleBoards)
    const wanted = pickPlannerBoard(visibleBoards, searchParams.get('board'))
    if (!wanted) {
      setBoard(null)
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('plan_boards')
      .select(BOARD_SELECT)
      .eq('id', wanted.id)
      .maybeSingle()
    if (error) {
      toast.error(error.message)
      setBoard(null)
    } else {
      setBoard(data)
    }
    setLoading(false)
  }, [searchParams])

  const loadCatalogs = useCallback(async () => {
    const [lab, tmpl] = await Promise.all([
      supabase.from('plan_label_presets').select('id, name, color, position').order('position'),
      supabase
        .from('plan_checklist_templates')
        .select('id, name, plan_checklist_template_items ( id, title, position )')
        .order('position'),
    ])
    if (!lab.error && lab.data?.length) setLabelPresets(lab.data)
    if (!tmpl.error) setChecklistTemplates(tmpl.data || [])
  }, [])

  useEffect(() => {
    load()
    loadCatalogs()
  }, [load, loadCatalogs])

  useEffect(() => {
    const scheduleReload = createCoalescedReload(() => load(), 500)
    const channel = supabase
      .channel('planning-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_cards' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_lists' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_checklist_items' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_card_assignees' }, scheduleReload)
      .subscribe()
    return () => {
      scheduleReload.cancel()
      supabase.removeChannel(channel)
    }
  }, [load])

  const lists = useMemo(() => [...(board?.plan_lists || [])].sort(sortByPos), [board])
  const laneBoardRef = useRef(null)
  const [focusListId, setFocusListId] = useState(null)

  useEffect(() => {
    if (!lists.length) return
    if (!focusListId || !lists.some((l) => l.id === focusListId)) setFocusListId(lists[0].id)
  }, [lists, focusListId])

  function scrollToLane(listId) {
    setFocusListId(listId)
    const el = laneBoardRef.current?.querySelector(`[data-lane-id="${listId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [subs, meets, books] = await Promise.all([
        supabase
          .from('ops_form_submissions')
          .select('id, calendar_at, due_at, respondent_label, status, ops_forms ( name, kind )')
          .or('calendar_at.not.is.null,due_at.not.is.null')
          .limit(300),
        supabase
          .from('events')
          .select('id, title, starts_at, ends_at, is_published, slug')
          .order('starts_at', { ascending: false })
          .limit(200),
        supabase
          .from('bookings')
          .select('id, customer_name, scheduled_start, scheduled_end, status, branch, vehicle_plate')
          .eq('is_archived', false)
          .not('scheduled_start', 'is', null)
          .order('scheduled_start', { ascending: false })
          .limit(300),
      ])
      if (cancelled) return
      setCalExtra({
        formSubs: subs.error ? [] : subs.data || [],
        meetEvents: meets.error ? [] : meets.data || [],
        bookings: books.error ? [] : books.data || [],
      })
    })()
    return () => { cancelled = true }
  }, [tab])

  const calendarEvents = useMemo(() => {
    const out = []
    if (calSources.planning) {
      for (const list of lists) {
        for (const card of list.plan_cards || []) {
          if (!card.due_at) continue
          const start = new Date(card.due_at)
          out.push({
            id: `plan-${card.id}`,
            title: `[Plan] ${card.title}`,
            start,
            end: new Date(start.getTime() + 60 * 60_000),
            resource: { type: 'planning', card },
          })
        }
      }
    }
    if (calSources.forms) {
      for (const s of calExtra.formSubs) {
        const iso = s.calendar_at || s.due_at
        if (!iso) continue
        const start = new Date(iso)
        out.push({
          id: `form-${s.id}`,
          title: `[Form] ${s.ops_forms?.name || 'Form'}: ${s.respondent_label || s.status}`,
          start,
          end: new Date(start.getTime() + 60 * 60_000),
          resource: { type: 'form', submission: s },
        })
      }
    }
    if (calSources.events) {
      for (const ev of calExtra.meetEvents) {
        if (!ev.starts_at) continue
        const start = new Date(ev.starts_at)
        const end = ev.ends_at ? new Date(ev.ends_at) : new Date(start.getTime() + 60 * 60_000)
        out.push({
          id: `event-${ev.id}`,
          title: `[Event] ${ev.title}${ev.is_published ? '' : ' (draft)'}`,
          start,
          end,
          resource: { type: 'event', event: ev },
        })
      }
    }
    if (calSources.bookings) {
      for (const b of calExtra.bookings) {
        const start = new Date(b.scheduled_start)
        const end = b.scheduled_end ? new Date(b.scheduled_end) : new Date(start.getTime() + 60 * 60_000)
        out.push({
          id: `booking-${b.id}`,
          title: `[Booking] ${b.customer_name}${b.vehicle_plate ? ` · ${b.vehicle_plate}` : ''}`,
          start,
          end,
          resource: { type: 'booking', booking: b },
        })
      }
    }
    return out
  }, [lists, calSources, calExtra])

  const moveCard = async (cardId, targetListId) => {
    if (!canEdit) return
    const { error } = await supabase
      .from('plan_cards')
      .update({
        list_id: targetListId,
        position: Date.now() % 1_000_000,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cardId)
    if (error) toast.error(error.message)
    else load()
  }

  const addList = async () => {
    if (!canEdit || !board || !newListTitle.trim()) return
    const { error } = await supabase.from('plan_lists').insert({
      board_id: board.id,
      title: newListTitle.trim(),
      position: lists.length,
    })
    if (error) toast.error(error.message)
    else {
      setNewListTitle('')
      load()
    }
  }

  const addCard = async (listId) => {
    if (!canEdit || !newCardTitle.trim()) return
    const list = lists.find((l) => l.id === listId)
    const { error } = await supabase.from('plan_cards').insert({
      list_id: listId,
      title: newCardTitle.trim(),
      position: (list?.plan_cards || []).length,
      created_by: profile?.id || null,
    })
    if (error) toast.error(error.message)
    else {
      setNewCardTitle('')
      setAddingCardFor(null)
      load()
    }
  }

  const renameList = async (list, title) => {
    if (!canEdit || !title.trim() || title === list.title) return
    const { error } = await supabase.from('plan_lists').update({ title: title.trim() }).eq('id', list.id)
    if (error) toast.error(error.message)
    else load()
  }

  function setTab(next) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next === 'board') params.delete('tab')
      else params.set('tab', next)
      if (board?.id) params.set('board', board.id)
      return params
    }, { replace: true })
  }

  function selectBoard(boardId) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      params.set('board', boardId)
      return params
    }, { replace: true })
  }

  if (!canViewPlanning(profile)) return <Navigate to="/operations/access-denied" replace />

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <LoaderCircle className="animate-spin" size={20} /> Loading Planner
      </div>
    )
  }

  if (!board) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 text-foreground">
        <h1 className="text-xl font-semibold">Planner is not set up yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask a Super Admin to run the latest Planner migration, then refresh this page.
        </p>
      </section>
    )
  }

  return (
    <section className="planning-shell flex min-h-0 flex-col gap-4">
      <header className="planning-hero">
        <div className="planning-hero-copy">
          <h1 className="planning-title">
            <Columns3 className="size-6 text-primary sm:size-7" aria-hidden />
            Planner
          </h1>
          <p className="planning-lead">
            {canEdit
              ? 'Add cards, assign people, and share forms. Assigned staff get an in-app notice.'
              : 'View tasks, calendar, and forms. You can fill forms you are allowed to use.'}
          </p>
          {boards.length > 1 ? (
            <div className="planning-board-picker">
              <Label htmlFor="planner-board-filter">Board</Label>
              <NamedSelect
                id="planner-board-filter"
                value={board.id}
                onChange={selectBoard}
                options={boards.map((b) => ({ value: b.id, label: b.name }))}
              />
            </div>
          ) : (
            <p className="planning-board-name">{board.name}</p>
          )}
        </div>
        <Badge variant={canEdit ? 'default' : 'secondary'} className="planning-role-badge">
          {canEdit ? 'Can edit' : 'View only'}
        </Badge>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="planning-tabs-list">
          {PLANNER_TABS.map((item) => {
            const Icon = TAB_ICONS[item.icon]
            return (
              <TabsTrigger key={item.id} value={item.id} title={item.hint}>
                {Icon ? <Icon className="size-4" aria-hidden /> : null}
                {item.label}
              </TabsTrigger>
            )
          })}
        </TabsList>
        <p className="planning-tab-hint">{PLANNER_TABS.find((item) => item.id === tab)?.hint}</p>

        <TabsContent value="board" className="mt-4">
          {lists.length > 1 ? (
            <div className="planning-lane-jump" role="navigation" aria-label="Columns">
              {lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  className={`planning-lane-jump-btn${focusListId === list.id ? ' is-active' : ''}`}
                  onClick={() => scrollToLane(list.id)}
                >
                  {list.title}
                  <span>{(list.plan_cards || []).length}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div ref={laneBoardRef} className="planning-lane-board" role="region" aria-label="Task columns">
            {lists.map((list) => {
              const cards = [...(list.plan_cards || [])].sort(sortByPos)
              return (
                <section
                  key={list.id}
                  data-lane-id={list.id}
                  className="floor-lane planning-lane"
                  aria-label={list.title}
                  onDragOver={(e) => canEdit && e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (!canEdit || !dragCardId) return
                    moveCard(dragCardId, list.id)
                    setDragCardId(null)
                  }}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    {canEdit ? (
                      <input
                        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none"
                        defaultValue={list.title}
                        onBlur={(e) => renameList(list, e.target.value)}
                        aria-label="Column name"
                      />
                    ) : (
                      <h2 className="text-sm font-semibold text-foreground">{list.title}</h2>
                    )}
                    <Badge variant="secondary" className="tabular-nums">{cards.length}</Badge>
                  </div>
                  <div className="floor-lane-body">
                    {cards.map((card) => {
                      const { done, total } = checklistStats(card)
                      const labels = Array.isArray(card.labels) ? card.labels : []
                      const people = assigneeNames(card)
                      return (
                        <article
                          key={card.id}
                          className="floor-ticket planning-card"
                          draggable={canEdit}
                          onDragStart={() => setDragCardId(card.id)}
                          onDragEnd={() => setDragCardId(null)}
                        >
                          <button
                            type="button"
                            className="planning-card-open"
                            onClick={() => setActiveCard(card)}
                          >
                            {labels.length > 0 && (
                              <div className="mb-2 flex flex-wrap gap-1">
                                {labels.map((l) => (
                                  <span
                                    key={l.name}
                                    className="rounded-full px-2 py-0.5 text-[10px] font-bold text-[#020a31]"
                                    style={{ backgroundColor: l.color || '#94a3b8' }}
                                  >
                                    {l.name}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="font-medium text-foreground">{card.title}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                              {card.due_at && (
                                <span className="inline-flex items-center gap-1">
                                  <CalendarDays size={12} />
                                  {format(new Date(card.due_at), 'MMM d')}
                                </span>
                              )}
                              {total > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <CheckSquare size={12} />
                                  {done}/{total}
                                </span>
                              )}
                              {people.length > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <Users size={12} />
                                  {people.join(', ')}
                                </span>
                              )}
                              {(card.plan_card_assignees || []).some((a) => a.status === 'for_review') && (
                                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">For review</span>
                              )}
                            </div>
                          </button>
                          {canEdit && lists.length > 1 ? (
                            <label className="planning-card-move">
                              <span className="planning-visually-hidden">Move {card.title}</span>
                              <select
                                value={list.id}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  if (e.target.value !== list.id) moveCard(card.id, e.target.value)
                                }}
                              >
                                {lists.map((opt) => (
                                  <option key={opt.id} value={opt.id}>{opt.title}</option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                        </article>
                      )
                    })}
                    {!cards.length && (
                      <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                        No cards in this column yet.
                      </p>
                    )}
                    {canEdit && (
                      addingCardFor === list.id ? (
                        <div className="mt-1 space-y-2 rounded-xl border border-border bg-background p-2">
                          <input
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                            placeholder="What needs to get done?"
                            value={newCardTitle}
                            onChange={(e) => setNewCardTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addCard(list.id)}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => addCard(list.id)}>Add card</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setAddingCardFor(null); setNewCardTitle('') }}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed border-border px-2 text-sm text-muted-foreground transition hover:border-primary/40 hover:bg-background hover:text-foreground"
                          onClick={() => setAddingCardFor(list.id)}
                        >
                          <Plus size={16} /> Add card
                        </button>
                      )
                    )}
                  </div>
                </section>
              )
            })}
            {canEdit && (
              <section className="floor-lane planning-lane planning-lane-new">
                <input
                  className="mb-3 w-full bg-transparent text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase outline-none placeholder:text-muted-foreground"
                  placeholder="New list…"
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addList()}
                />
                <Button size="sm" variant="outline" className="w-full cursor-pointer" onClick={addList} disabled={!newListTitle.trim()}>
                  Add list
                </Button>
              </section>
            )}
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <div className="planning-cal-filters" role="group" aria-label="Calendar sources">
            <span className="planning-cal-filters-label">Show</span>
            {[
              { key: 'planning', label: 'Tasks' },
              { key: 'forms', label: 'Form answers' },
              { key: 'events', label: 'Events' },
              { key: 'bookings', label: 'Bookings' },
            ].map((src) => (
              <button
                key={src.key}
                type="button"
                className="planning-cal-filter"
                aria-pressed={calSources[src.key]}
                onClick={() => setCalSources((s) => ({ ...s, [src.key]: !s[src.key] }))}
              >
                <span className="planning-cal-filter-dot" aria-hidden />
                {src.label}
              </button>
            ))}
          </div>
          <div className="planning-calendar min-h-[28rem] rounded-2xl border border-border bg-card p-3 text-foreground shadow-sm sm:p-4">
            <BigCalendar
              localizer={localizer}
              events={calendarEvents}
              defaultView={Views.MONTH}
              views={[Views.MONTH, Views.WEEK, Views.AGENDA]}
              style={{ minHeight: 420 }}
              onSelectEvent={(ev) => {
                if (ev.resource?.type === 'planning' && ev.resource.card) setActiveCard(ev.resource.card)
                else if (ev.resource?.type === 'event' && ev.resource.event?.slug) {
                  window.open(`/events/${ev.resource.event.slug}`, '_blank', 'noopener,noreferrer')
                } else if (ev.resource?.type === 'form') {
                  setTab('forms')
                  toast.message('Open Forms → Results to manage this submission')
                } else if (ev.resource?.type === 'booking') {
                  toast.message(`Booking · ${ev.resource.booking?.status || 'scheduled'}`)
                }
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <PlanningSettingsPanel
            canEdit={canEdit}
            onPresetsChanged={(rows) => {
              if (rows?.length) setLabelPresets(rows)
              loadCatalogs()
            }}
          />
        </TabsContent>

        <TabsContent value="forms" className="mt-4">
          <PlanningFormsPanel canEdit={canEdit} lists={lists} />
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <PlanningEventsPanel canEdit={canEdit} />
        </TabsContent>
      </Tabs>

      {activeCard && (
        <CardModal
          card={activeCard}
          canEdit={canEdit}
          labelPresets={labelPresets}
          checklistTemplates={checklistTemplates}
          onClose={() => setActiveCard(null)}
          onSaved={() => load()}
          onDeleted={() => { setActiveCard(null); load() }}
        />
      )}
    </section>
  )
}
