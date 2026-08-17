import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { canEditPlanning, canViewPlanning } from '@/auth/permissions'
import { PLANNER_TABS, plannerTabFromSearch, plannerTabsForAccess } from '@/lib/plannerBoard'
import { hrefForCalendarItem } from '@/lib/plannerCalendar'
import { cardsFromAssigneeRows, filterPlannerCards, flattenPlannerCards, reviewItemsFromAssigneeRows } from '@/lib/plannerTasks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { CalendarDays, ClipboardList, FileText, FolderKanban, Inbox, LayoutList, Plus, Table2 } from 'lucide-react'
import PlanningFormsSmartPanel from '@/pages/planning/PlanningFormsSmartPanel'
import { PlanningEventsPanel } from '@/pages/planning/PlanningPart6Panels'
import PlanningCategoryDrawer from '@/pages/planning/PlanningCategoryDrawer'
import PlanningReviewPanel from '@/pages/planning/PlanningReviewPanel'
import TaskModal from '@/pages/planning/TaskModal'

const TAB_ICONS = {
  board: FolderKanban,
  calendar: CalendarDays,
  forms: ClipboardList,
  events: FileText,
  review: Inbox,
}

const BOARD_SELECT = `
  id, title, kind,
  plan_lists (
    id, title, position,
    plan_cards (
      id, title, description, labels, due_at, position, created_at, updated_at, created_by, category_id,
      plan_checklist_items ( id, title, done, position ),
      plan_card_assignees (
        id, staff_id, status, proof_url, proof_note, proof_submitted_at, reviewed_at, staff_profiles ( id, full_name )
      )
    )
  )
`

const ASSIGNEE_CARD_SELECT = `
  id, staff_id, status, proof_url, proof_note, proof_submitted_at, reviewed_at,
  staff_profiles ( id, full_name ),
  plan_cards (
    id, title, description, labels, due_at, position, created_at, updated_at, created_by, category_id, list_id,
    plan_checklist_items ( id, title, done, position ),
    plan_lists ( id, title )
  )
`

const DUE_OPTIONS = [
  { id: 'all', label: 'Any date' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'none', label: 'No deadline' },
]

const STATUS_OPTIONS = [
  { id: 'all', label: 'Any status' },
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'for_review', label: 'For review' },
  { id: 'done', label: 'Done' },
]

export default function PlanningBoardPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const canEdit = canEditPlanning(profile)
  const tabs = useMemo(() => plannerTabsForAccess({ canEdit, role: profile?.role }), [canEdit, profile?.role])
  const tab = plannerTabFromSearch(searchParams, tabs.map((t) => t.id))
  const [boards, setBoards] = useState([])
  const [board, setBoard] = useState(null)
  const [categories, setCategories] = useState([])
  const [staff, setStaff] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState(canEdit ? 'table' : 'list')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [assigneeId, setAssigneeId] = useState('all')
  const [due, setDue] = useState('all')
  const [assignedCards, setAssignedCards] = useState([])
  const [reviewItems, setReviewItems] = useState([])
  const [cardId, setCardId] = useState(searchParams.get('card'))
  const [catsOpen, setCatsOpen] = useState(false)
  const [calCursor, setCalCursor] = useState(() => new Date())
  const [calSources, setCalSources] = useState({ tasks: true, events: true, bookings: canEdit, forms: canEdit })
  const [calExtra, setCalExtra] = useState({ events: [], bookings: [], forms: [] })

  const lists = useMemo(() => [...(board?.plan_lists || [])].sort((a, b) => a.position - b.position), [board])
  const cards = useMemo(
    () => (canEdit ? flattenPlannerCards(board) : assignedCards),
    [canEdit, board, assignedCards],
  )
  const visibleCards = useMemo(
    () =>
      filterPlannerCards(cards, {
        q,
        status,
        categoryId,
        assigneeId,
        due,
        assignedOnly: !canEdit,
        viewerId: profile?.id,
      }),
    [cards, q, status, categoryId, assigneeId, due, canEdit, profile?.id],
  )
  const reviewCount = reviewItems.length
  const activeCard = useMemo(() => {
    if (cardId === 'new') return canEdit ? { id: 'new' } : null
    return cards.find((c) => c.id === cardId) || null
  }, [cardId, cards, canEdit])

  const load = useCallback(async () => {
    const requested = searchParams.get('board')
    const catQ = supabase.from('plan_categories').select('id, name, color, position').order('position')
    if (!canEdit) {
      const [{ data: catRows }, { data: mine, error: mineErr }] = await Promise.all([
        catQ,
        supabase.from('plan_card_assignees').select(ASSIGNEE_CARD_SELECT).eq('staff_id', profile?.id),
      ])
      if (mineErr) toast.error(mineErr.message)
      setCategories(catRows || [])
      setAssignedCards(cardsFromAssigneeRows(mine))
      setBoards([])
      setBoard(null)
      setStaff([])
      setTemplates([])
      setReviewItems([])
      setLoading(false)
      return
    }
    const [{ data: boardRows }, { data: catRows }, { data: staffRows }, { data: tplRows }, { data: reviewRows, error: reviewErr }] = await Promise.all([
      supabase.from('plan_boards').select('id, title, kind, position').order('position'),
      catQ,
      supabase.from('staff_profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
      supabase.from('plan_checklist_templates').select('id, name, position, plan_checklist_template_items ( id, title, position )').order('position'),
      supabase.from('plan_card_assignees').select(ASSIGNEE_CARD_SELECT).eq('status', 'for_review'),
    ])
    if (reviewErr) toast.error(reviewErr.message)
    const visible = (boardRows || []).filter((b) => b.kind !== 'complaints')
    setBoards(visible)
    setCategories(catRows || [])
    setStaff(staffRows || [])
    setTemplates(tplRows || [])
    setReviewItems(reviewItemsFromAssigneeRows(reviewRows))
    const next = visible.find((b) => b.id === requested) || visible[0]
    if (!next) {
      setBoard(null)
      setLoading(false)
      return
    }
    const { data, error } = await supabase.from('plan_boards').select(BOARD_SELECT).eq('id', next.id).maybeSingle()
    if (error) toast.error(error.message)
    setBoard(data || null)
    setLoading(false)
  }, [searchParams, canEdit, profile?.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setCardId(searchParams.get('card'))
  }, [searchParams])

  useEffect(() => {
    if (tab !== 'calendar') return
    const y = calCursor.getFullYear()
    const m = calCursor.getMonth()
    const from = new Date(y, m, 1).toISOString()
    const to = new Date(y, m + 1, 1).toISOString()
    const eventsQ = supabase.from('events').select('id, title, starts_at, ends_at, is_published').gte('starts_at', from).lt('starts_at', to)
    Promise.all([
      canEdit ? eventsQ : eventsQ.eq('is_published', true),
      canEdit
        ? supabase
            .from('bookings')
            .select('id, customer_name, scheduled_start, status')
            .gte('scheduled_start', from)
            .lt('scheduled_start', to)
        : Promise.resolve({ data: [] }),
      canEdit
        ? supabase
            .from('ops_form_submissions')
            .select('id, form_id, due_at, calendar_at, ops_forms ( name )')
            .not('calendar_at', 'is', null)
            .gte('calendar_at', from)
            .lt('calendar_at', to)
        : Promise.resolve({ data: [] }),
    ]).then(([ev, bk, fm]) => {
      setCalExtra({
        events: ev.data || [],
        bookings: bk.data || [],
        forms: fm.data || [],
      })
    })
  }, [calCursor, canEdit, tab])

  const calItems = useMemo(() => {
    const y = calCursor.getFullYear()
    const m = calCursor.getMonth()
    const inMonth = (iso) => {
      if (!iso) return false
      const d = new Date(iso)
      return d.getFullYear() === y && d.getMonth() === m
    }
    const out = []
    if (calSources.tasks) {
      visibleCards.filter((c) => inMonth(c.due_at)).forEach((c) => {
        out.push({
          id: `t-${c.id}`,
          date: c.due_at,
          title: c.title,
          kind: 'task',
          href: hrefForCalendarItem({ type: 'planning', card: { id: c.id } }),
        })
      })
    }
    if (calSources.events) {
      calExtra.events.forEach((e) => {
        out.push({
          id: `e-${e.id}`,
          date: e.starts_at,
          title: e.title,
          kind: 'event',
          href: hrefForCalendarItem({ type: 'event', event: { id: e.id } }),
        })
      })
    }
    if (calSources.bookings) {
      calExtra.bookings.forEach((b) => {
        out.push({
          id: `b-${b.id}`,
          date: b.scheduled_start,
          title: b.customer_name || 'Booking',
          kind: 'booking',
          href: hrefForCalendarItem({ type: 'booking', booking: { id: b.id } }),
        })
      })
    }
    if (calSources.forms) {
      calExtra.forms.forEach((f) => {
        out.push({
          id: `f-${f.id}`,
          date: f.calendar_at || f.due_at,
          title: f.ops_forms?.name || 'Form',
          kind: 'form',
          href: hrefForCalendarItem({ type: 'form', submission: { form_id: f.form_id } }),
        })
      })
    }
    return out
  }, [visibleCards, calSources, calExtra, calCursor])

  function setTab(next) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next === 'board') params.delete('tab')
      else params.set('tab', next)
      if (board?.id) params.set('board', board.id)
      params.delete('create')
      return params
    }, { replace: true })
  }

  function openCard(id) {
    setCardId(id)
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (id) params.set('card', id)
      else params.delete('card')
      return params
    }, { replace: true })
  }

  if (!canViewPlanning(profile)) return <Navigate to="/operations/access-denied" replace />
  if (loading) {
    return (
      <div className="planner-v2" aria-busy="true" aria-label="Loading planner">
        <div className="planner-skel planner-skel-head" />
        <div className="planner-skel-tabs">
          <span className="planner-skel" />
          <span className="planner-skel" />
          <span className="planner-skel" />
        </div>
        <div className="planner-skel-grid">
          <span className="planner-skel planner-ticket" />
          <span className="planner-skel planner-ticket" />
          <span className="planner-skel planner-ticket" />
        </div>
      </div>
    )
  }

  return (
    <div className="planner-v2">
      <header className="planner-v2-head">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">Shop floor</p>
          <h1>Planner</h1>
          <p>{canEdit ? 'Assign work, attach a form to an event, review proof.' : 'Your assigned work and published events.'}</p>
        </div>
        {canEdit && tab === 'board' && (
          <Button type="button" onClick={() => openCard('new')}>
            <Plus className="size-4" /> New task
          </Button>
        )}
      </header>

      <nav className="planner-v2-tabs" aria-label="Planner">
        {tabs.map((t) => {
          const Icon = TAB_ICONS[t.id]
          return (
            <button key={t.id} type="button" className={tab === t.id ? 'is-on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <Icon className="size-4" />
              {t.label}
              {t.id === 'review' && reviewCount > 0 ? <span className="planner-v2-count">{reviewCount}</span> : null}
            </button>
          )
        })}
      </nav>

      {tab === 'board' && (
        <div className={`planner-v2-body ${canEdit ? 'has-rail' : ''}`}>
          {canEdit && (
            <aside className="planner-v2-rail">
              <label>
                Search
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title or note" />
              </label>
              <label>
                Status
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUS_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
              <label>
                Category
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="all">Any category</option>
                  <option value="none">Uncategorized</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label>
                Assignee
                <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="all">Anyone</option>
                  <option value="unassigned">Unassigned</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </label>
              <label>
                Deadline
                <select value={due} onChange={(e) => setDue(e.target.value)}>
                  {DUE_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
              <label>
                Board
                <select value={board?.id || ''} onChange={(e) => setSearchParams((p) => { const n = new URLSearchParams(p); n.set('board', e.target.value); return n }, { replace: true })}>
                  {boards.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant={view === 'table' ? 'default' : 'outline'} onClick={() => setView('table')}>
                  <Table2 className="size-3.5" /> Table
                </Button>
                <Button type="button" size="sm" variant={view === 'board' ? 'default' : 'outline'} onClick={() => setView('board')}>
                  <LayoutList className="size-3.5" /> Board
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setCatsOpen(true)}>Categories</Button>
              </div>
            </aside>
          )}

          <div className="min-w-0">
            {!canEdit && (
              <label className="mb-3 block max-w-sm text-xs font-medium text-muted-foreground">
                Search
                <Input className="mt-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Your tasks" />
              </label>
            )}
            {!visibleCards.length ? (
              <div className="planner-empty">
                <strong>{canEdit ? 'No tasks match' : 'Nothing assigned to you'}</strong>
                <p>{canEdit ? 'Clear a filter or create a task.' : 'When someone assigns you work, it shows up here.'}</p>
                {canEdit && <Button type="button" onClick={() => openCard('new')}>New task</Button>}
              </div>
            ) : view === 'board' && canEdit ? (
              <div className="planner-v2-cols" style={{ '--planning-list-cols': Math.min(Math.max(lists.length, 1), 5) }}>
                {lists.map((list) => {
                  const col = visibleCards.filter((c) => c.list_id === list.id)
                  return (
                    <section key={list.id}>
                      <h2>{list.title} <span>{col.length}</span></h2>
                      {col.map((card) => (
                        <button key={card.id} type="button" className="planner-v2-card planner-ticket" onClick={() => openCard(card.id)}>
                          <strong>{card.title}</strong>
                          <span>{card.plan_card_assignees?.[0]?.staff_profiles?.full_name || 'Unassigned'}</span>
                          <em>{(card.plan_card_assignees?.[0]?.status || 'todo').replace('_', ' ')}{card.due_at ? ` · ${new Date(card.due_at).toLocaleDateString()}` : ''}</em>
                        </button>
                      ))}
                    </section>
                  )
                })}
              </div>
            ) : (
              <div className="planner-v2-table-wrap">
                <table className="planner-v2-table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>List</th>
                      <th>Who</th>
                      <th>Due</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCards.map((card) => {
                      const a = card.plan_card_assignees?.[0]
                      return (
                        <tr key={card.id} onClick={() => openCard(card.id)}>
                          <td>{card.title}</td>
                          <td>{card.list_title}</td>
                          <td>{a?.staff_profiles?.full_name || '—'}</td>
                          <td>{card.due_at ? new Date(card.due_at).toLocaleDateString() : '—'}</td>
                          <td>{a?.status?.replace('_', ' ') || 'unassigned'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'calendar' && (
        <CalendarMonth
          cursor={calCursor}
          onCursor={setCalCursor}
          items={calItems}
          sources={calSources}
          onSources={setCalSources}
          canEdit={canEdit}
        />
      )}

      {tab === 'forms' && (
        <PlanningFormsSmartPanel
          canEdit={canEdit}
          lists={lists}
          initialCreateKind={searchParams.get('create')}
          resultsId={searchParams.get('results')}
        />
      )}

      {tab === 'events' && (
        <PlanningEventsPanel
          canEdit={canEdit}
          highlightId={searchParams.get('event')}
          onCreateForm={() =>
            setSearchParams((prev) => {
              const params = new URLSearchParams(prev)
              params.set('tab', 'forms')
              params.set('create', 'event')
              return params
            }, { replace: true })
          }
        />
      )}

      {tab === 'review' && canEdit && (
        <PlanningReviewPanel items={reviewItems} canEdit={canEdit} onChanged={load} />
      )}

      {canEdit && tab === 'board' && (
        <button type="button" className="planner-v2-fab md:hidden" onClick={() => openCard('new')} aria-label="New task">
          <Plus className="size-5" />
        </button>
      )}

      {activeCard && (
        <TaskModal
          card={activeCard.id === 'new' ? null : activeCard}
          listId={lists[0]?.id}
          lists={lists}
          categories={categories}
          checklistTemplates={templates}
          canEdit={canEdit}
          onClose={() => openCard(null)}
          onSaved={load}
        />
      )}

      <PlanningCategoryDrawer
        open={catsOpen}
        categories={categories}
        templates={templates}
        canEdit={canEdit}
        onClose={() => setCatsOpen(false)}
        onChanged={load}
      />
    </div>
  )
}

function CalendarMonth({ cursor, onCursor, items, sources, onSources, canEdit }) {
  const y = cursor.getFullYear()
  const m = cursor.getMonth()
  const start = new Date(y, m, 1)
  const pad = (start.getDay() + 6) % 7
  const days = new Date(y, m + 1, 0).getDate()
  const cells = [...Array(pad).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  const byDay = new Map()
  items.forEach((item) => {
    const d = new Date(item.date).getDate()
    byDay.set(d, [...(byDay.get(d) || []), item])
  })

  const today = new Date()
  const isToday = (day) =>
    day && y === today.getFullYear() && m === today.getMonth() && day === today.getDate()

  return (
    <div className="planner-cal">
      <div className="planner-cal-toolbar">
        <Button type="button" variant="outline" size="sm" onClick={() => onCursor(new Date(y, m - 1, 1))}>Prev</Button>
        <strong>{cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</strong>
        <Button type="button" variant="outline" size="sm" onClick={() => onCursor(new Date(y, m + 1, 1))}>Next</Button>
      </div>
      <div className="planner-cal-filters">
        {Object.entries({ tasks: 'Tasks', events: 'Events', ...(canEdit ? { bookings: 'Bookings', forms: 'Forms' } : {}) }).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={!!sources[key]}
              onChange={(e) => onSources((s) => ({ ...s, [key]: e.target.checked }))}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="planner-cal-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="planner-cal-dow">{d}</span>)}
        {cells.map((day, i) => (
          <div key={i} className={`planner-cal-cell ${day ? '' : 'is-pad'} ${isToday(day) ? 'is-today' : ''}`}>
            {day ? <b>{day}</b> : null}
            {(byDay.get(day) || []).map((item) => (
              <Link key={item.id} to={item.href} className={`planner-cal-chip is-${item.kind}`}>{item.title}</Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
