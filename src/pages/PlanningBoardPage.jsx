import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import { format, getDay, parse, startOfWeek } from 'date-fns'
import { enUS } from 'date-fns/locale'
import {
  CalendarDays,
  CheckSquare,
  Columns3,
  LoaderCircle,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useAuth } from '@/auth/AuthProvider'
import { canEditPlanning, canViewPlanning } from '@/auth/permissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import {
  PlanningEventsPanel,
  PlanningFormsPanel,
  PlanningSettingsPanel,
} from '@/pages/planning/PlanningPart6Panels'
import { toast } from 'sonner'

const PLAN_TABS = ['board', 'calendar', 'settings', 'forms', 'events']

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
      plan_card_assignees ( id, staff_id, status, notes, staff_profiles ( id, full_name, username ) )
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
      .in('role', ['staff', 'team_lead', 'admin', 'assistant_super_admin', 'BossMich'])
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
      .select('id, staff_id, status, notes, staff_profiles ( id, full_name, username )')
      .single()
    if (error) {
      toast.error(error.message)
      return
    }
    setAssignees((prev) => [...prev, data])
    toast.success(`Assigned ${staff.full_name}`)
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
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-card-title"
        className="max-h-[90svh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#111820] p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
              {canEdit ? 'Edit card' : 'View card'}
            </p>
            {canEdit ? (
              <input
                id="plan-card-title"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xl font-semibold text-slate-100 outline-none focus:border-primary/50"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            ) : (
              <h2 id="plan-card-title" className="mt-2 text-2xl font-semibold">
                {card.title}
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-xl border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>

        <label className="mt-5 block text-xs text-slate-500">
          Description
          <textarea
            className="mt-1 min-h-24 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 outline-none focus:border-primary/50 disabled:opacity-70"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEdit}
          />
        </label>

        <label className="mt-4 block text-xs text-slate-500">
          Due date
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 outline-none focus:border-primary/50 disabled:opacity-70"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            disabled={!canEdit}
          />
        </label>

        <div className="mt-4">
          <p className="text-xs text-slate-500">Labels</p>
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
                    opacity: on ? 1 : 0.35,
                    outline: on ? '2px solid white' : 'none',
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
          <p className="text-xs text-slate-500">Assignees {canEdit ? '(BossMich CRUD)' : ''}</p>
          {assignees.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {assignees.map((a) => (
                <Badge key={a.id} variant="secondary" className="gap-1">
                  {a.staff_profiles?.full_name || a.staff_id}
                  {a.staff_profiles?.username ? ` · @${a.staff_profiles.username}` : ''}
                  <span className="opacity-70">· {a.status}</span>
                </Badge>
              ))}
            </div>
          )}
          {canEdit && (
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/10 p-2">
              {staffPool.length ? staffPool.map((staff) => {
                const on = assignees.some((a) => a.staff_id === staff.id)
                return (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => toggleAssignee(staff)}
                    className={`flex w-full min-h-10 items-center justify-between rounded-lg px-3 text-left text-sm ${on ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-slate-300'}`}
                  >
                    <span>{staff.full_name}{staff.username ? ` · @${staff.username}` : ''}</span>
                    <span className="text-xs uppercase tracking-wide opacity-70">{on ? 'Assigned' : 'Add'}</span>
                  </button>
                )
              }) : <p className="px-2 py-3 text-xs text-slate-500">No staff profiles found.</p>}
            </div>
          )}
        </div>

        <div className="mt-5">
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <CheckSquare size={14} /> Checklist
          </p>
          <ul className="mt-2 space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                <input
                  type="checkbox"
                  checked={!!item.done}
                  disabled={!canEdit}
                  onChange={() => toggleCheck(item)}
                  className="size-4 accent-primary"
                />
                <span className={`flex-1 text-sm ${item.done ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                  {item.title}
                </span>
                {canEdit && (
                  <button type="button" className="text-slate-500 hover:text-red-400" onClick={() => removeCheck(item)} aria-label="Remove item">
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
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary/50"
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
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
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

        <div className="mt-6 flex flex-wrap gap-2">
          {canEdit && (
            <>
              <Button type="button" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button type="button" variant="outline" className="text-red-300" onClick={remove}>
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
  const tab = PLAN_TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'board'
  const [board, setBoard] = useState(null)
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
    const { data, error } = await supabase
      .from('plan_boards')
      .select(BOARD_SELECT)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) {
      toast.error(error.message)
      setBoard(null)
    } else {
      setBoard(data)
    }
    setLoading(false)
  }, [])

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
    const channel = supabase
      .channel('planning-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_cards' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_lists' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_checklist_items' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_card_assignees' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  const lists = useMemo(() => [...(board?.plan_lists || [])].sort(sortByPos), [board])

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
    setSearchParams(next === 'board' ? {} : { tab: next }, { replace: true })
  }

  if (!canViewPlanning(profile)) return <Navigate to="/operations/access-denied" replace />

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <LoaderCircle className="animate-spin" size={20} /> Loading planning…
      </div>
    )
  }

  if (!board) {
    return (
      <section className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-6 text-amber-100">
        No planning board found. Ask Super Admin to seed Hakum Planning (migration).
      </section>
    )
  }

  return (
    <section className="flex min-h-0 flex-col gap-4">
      <div className="floor-compact-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-bold tracking-[0.22em] text-primary uppercase">Planning</p>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <Columns3 className="size-7 text-primary" />
            {board.name}
          </h1>
          <p className="floor-desc mt-1 text-sm text-muted-foreground">
            {canEdit ? 'Edit enabled' : 'View only'} — board, filtered calendar, smart forms with share links, and events.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          <div className="planning-lane-board" role="region" aria-label="Planning columns">
            {lists.map((list) => {
              const cards = [...(list.plan_cards || [])].sort(sortByPos)
              return (
                <section
                  key={list.id}
                  className="floor-lane"
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
                        className="min-w-0 flex-1 bg-transparent text-xs font-bold tracking-[0.14em] text-slate-300 uppercase outline-none"
                        defaultValue={list.title}
                        onBlur={(e) => renameList(list, e.target.value)}
                        aria-label="List title"
                      />
                    ) : (
                      <h2 className="text-xs font-bold tracking-[0.14em] text-slate-300 uppercase">{list.title}</h2>
                    )}
                    <Badge variant="secondary">{cards.length}</Badge>
                  </div>
                  <div className="floor-lane-body">
                    {cards.map((card) => {
                      const { done, total } = checklistStats(card)
                      const labels = Array.isArray(card.labels) ? card.labels : []
                      return (
                        <article
                          key={card.id}
                          className="floor-ticket"
                          draggable={canEdit}
                          onDragStart={() => setDragCardId(card.id)}
                          onDragEnd={() => setDragCardId(null)}
                          onClick={() => setActiveCard(card)}
                        >
                          {labels.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1">
                              {labels.map((l) => (
                                <span
                                  key={l.name}
                                  className="rounded-full px-2 py-0.5 text-[10px] font-bold text-slate-950"
                                  style={{ backgroundColor: l.color || '#94a3b8' }}
                                >
                                  {l.name}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="font-medium">{card.title}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
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
                          </div>
                        </article>
                      )
                    })}
                    {canEdit && (
                      addingCardFor === list.id ? (
                        <div className="mt-2 space-y-2">
                          <input
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
                            placeholder="Card title"
                            value={newCardTitle}
                            onChange={(e) => setNewCardTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addCard(list.id)}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => addCard(list.id)}>Add</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setAddingCardFor(null); setNewCardTitle('') }}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="mt-2 flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200"
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
              <section className="floor-lane opacity-80">
                <input
                  className="mb-3 w-full bg-transparent text-xs font-bold tracking-[0.14em] text-slate-400 uppercase outline-none"
                  placeholder="New list…"
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addList()}
                />
                <Button size="sm" variant="outline" onClick={addList} disabled={!newListTitle.trim()}>
                  Add list
                </Button>
              </section>
            )}
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {[
              { key: 'planning', label: 'Planning cards' },
              { key: 'forms', label: 'Form results' },
              { key: 'events', label: 'Events' },
              { key: 'bookings', label: 'Bookings' },
            ].map((src) => (
              <button
                key={src.key}
                type="button"
                className={`min-h-10 cursor-pointer rounded-xl border px-3 text-sm font-medium transition ${
                  calSources[src.key]
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-muted'
                }`}
                aria-pressed={calSources[src.key]}
                onClick={() => setCalSources((s) => ({ ...s, [src.key]: !s[src.key] }))}
              >
                {src.label}
              </button>
            ))}
          </div>
          <div className="min-h-[28rem] rounded-2xl border border-border bg-card p-3 text-foreground shadow-sm sm:p-4 [&_.rbc-toolbar]:mb-3 [&_.rbc-toolbar_button]:min-h-10 [&_.rbc-toolbar_button]:cursor-pointer [&_.rbc-toolbar_button]:rounded-md [&_.rbc-toolbar_button]:border [&_.rbc-toolbar_button]:border-border [&_.rbc-toolbar_button]:bg-background [&_.rbc-toolbar_button]:px-3 [&_.rbc-toolbar_button]:text-foreground [&_.rbc-header]:border-border [&_.rbc-header]:bg-muted/40 [&_.rbc-header]:py-2 [&_.rbc-header]:text-xs [&_.rbc-header]:font-semibold [&_.rbc-header]:text-muted-foreground [&_.rbc-off-range-bg]:bg-muted/30 [&_.rbc-today]:bg-primary/5 [&_.rbc-event]:border-0 [&_.rbc-event]:bg-primary [&_.rbc-event]:text-primary-foreground [&_.rbc-month-view]:rounded-xl [&_.rbc-month-view]:border [&_.rbc-month-view]:border-border [&_.rbc-day-bg]:border-border [&_.rbc-month-row]:border-border">
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
