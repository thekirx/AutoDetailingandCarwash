import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { canEditPlanning, canViewPlanning } from '@/auth/permissions'
import { createCoalescedReload } from '@/lib/coalesceReload'
import { PLAN_BOARD_DETAIL_SELECT, PLAN_BOARDS_LIST_SELECT, defaultPlanListId, pickPlannerBoard, plannerTabFromSearch, plannerTabsForAccess, visiblePlannerBoards } from '@/lib/plannerBoard'
import { filterCategoriesForRole } from '@/lib/planCategoryRoles'
import { hrefForCalendarItem } from '@/lib/plannerCalendar'
import { collectPaged } from '@/lib/crmInsights'
import { isBookingBoardRow } from '@/lib/serviceKinds'
import { cardsFromAssigneeRows, filterPlannerCards, flattenPlannerCards, reviewItemsFromAssigneeRows } from '@/lib/plannerTasks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { CalendarDays, CheckSquare, ClipboardCheck, ClipboardList, Clock, FileText, Filter, FolderKanban, Inbox, LayoutList, Plus, RotateCcw, Settings2, ShieldCheck, Table2 } from 'lucide-react'
import OpsGuideCard from '@/components/ops/OpsGuideCard'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import { PLANNING_WORKFLOW_STEPS } from '@/components/ops/opsGuideCopy'
import PlanningFormsSmartPanel from '@/pages/planning/PlanningFormsSmartPanel'
import { PlanningEventsPanel } from '@/pages/planning/PlanningPart6Panels'
import PlanningConfigurePanel from '@/pages/planning/PlanningConfigurePanel'
import PlanningReviewPanel from '@/pages/planning/PlanningReviewPanel'
import TaskModal from '@/pages/planning/TaskModal'
import '@/styles/planning-board.css'

const FormResultsBoardPage = lazy(() => import('@/pages/FormResultsBoardPage'))

const TAB_ICONS = {
  board: FolderKanban,
  calendar: CalendarDays,
  forms: ClipboardList,
  results: ClipboardCheck,
  events: FileText,
  review: Inbox,
  configure: Settings2,
}

/** Source-scan contract — keep literal ids for ops shell tests. */
const PLANNING_SHELL_TABS = Object.freeze(
  Object.entries(TAB_ICONS).map(([id, icon]) => ({
    id,
    label: ({ board: 'Board', calendar: 'Calendar', forms: 'Forms', results: 'Form Results', events: 'Events', review: 'Review', configure: 'Configure' })[id],
    icon,
  })),
)

const ASSIGNEE_CARD_SELECT = `
  id, staff_id, status, proof_url, proof_note, proof_submitted_at, reviewed_at,
  staff_profiles ( id, full_name ),
  plan_cards (
    id, title, description, labels, due_at, position, created_at, updated_at, created_by, category_id, proof_required, list_id, form_id,
    ops_forms ( id, name ),
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

const STATUS_META = {
  todo: { label: 'To do', tone: 'is-todo' },
  in_progress: { label: 'In progress', tone: 'is-progress' },
  for_review: { label: 'For review', tone: 'is-review' },
  done: { label: 'Done', tone: 'is-done' },
  unassigned: { label: 'Unassigned', tone: 'is-unassigned' },
}

const ASSIGNED_LANE_ORDER = ['in_progress', 'for_review', 'todo', 'done', 'unassigned']

function cardWorkflowStatus(card) {
  const rows = card?.plan_card_assignees || []
  if (!rows.length) return 'unassigned'
  if (rows.some((a) => a.status === 'for_review')) return 'for_review'
  if (rows.some((a) => a.status === 'in_progress')) return 'in_progress'
  if (rows.every((a) => a.status === 'done')) return 'done'
  return 'todo'
}

function cardDueMeta(dueAt, statusKey) {
  if (!dueAt) return null
  const date = new Date(dueAt)
  if (Number.isNaN(date.getTime())) return null
  const now = new Date()
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
  const formatted = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (statusKey !== 'done' && sameDay) return { label: 'Due today', tone: 'is-today' }
  if (statusKey !== 'done' && date.getTime() < now.getTime()) return { label: `Overdue · ${formatted}`, tone: 'is-overdue' }
  return { label: formatted, tone: 'is-upcoming' }
}

function initialsForName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

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
  const [view, setView] = useState('board')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [status, setStatus] = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [assigneeId, setAssigneeId] = useState('all')
  const [due, setDue] = useState('all')
  const [listFilter, setListFilter] = useState('all')
  const [assignedCards, setAssignedCards] = useState([])
  const [reviewItems, setReviewItems] = useState([])
  const [cardId, setCardId] = useState(searchParams.get('card'))
  const [calCursor, setCalCursor] = useState(() => new Date())
  const [calSources, setCalSources] = useState({ tasks: true, events: true, bookings: canEdit, forms: canEdit })
  const [calExtra, setCalExtra] = useState({ events: [], bookings: [], forms: [] })

  const lists = useMemo(() => [...(board?.plan_lists || [])].sort((a, b) => a.position - b.position), [board])
  const visibleCategories = useMemo(
    () => (canEdit ? categories : filterCategoriesForRole(categories, profile?.role)),
    [canEdit, categories, profile?.role],
  )
  const categoryMap = useMemo(
    () => new Map((categories || []).map((c) => [c.id, c])),
    [categories],
  )
  const activeFilterCount = useMemo(
    () =>
      [
        q.trim() !== '',
        status !== 'all',
        due !== 'all',
        canEdit && listFilter !== 'all',
        canEdit && categoryId !== 'all',
        canEdit && assigneeId !== 'all',
      ].filter(Boolean).length,
    [q, status, due, canEdit, listFilter, categoryId, assigneeId],
  )
  function resetFilters() {
    setQ('')
    setStatus('all')
    setDue('all')
    setListFilter('all')
    setCategoryId('all')
    setAssigneeId('all')
  }
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
        listId: listFilter,
        assignedOnly: !canEdit,
        viewerId: profile?.id,
      }),
    [cards, q, status, categoryId, assigneeId, due, listFilter, canEdit, profile?.id],
  )
  const reviewCount = reviewItems.length
  const activeCard = useMemo(() => {
    if (cardId === 'new') return canEdit ? { id: 'new' } : null
    return cards.find((c) => c.id === cardId) || null
  }, [cardId, cards, canEdit])

  const load = useCallback(async () => {
    const requested = searchParams.get('board')
    const catQ = supabase.from('plan_categories').select('id, name, color, position, visible_roles').order('position')
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
    const [{ data: boardRows, error: boardErr }, { data: catRows, error: catErr }, { data: staffRows, error: staffErr }, { data: tplRows, error: tplErr }, { data: reviewRows, error: reviewErr }] = await Promise.all([
      supabase.from('plan_boards').select(PLAN_BOARDS_LIST_SELECT).order('name'),
      catQ,
      supabase.from('staff_profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
      supabase.from('plan_checklist_templates').select('id, name, position, plan_checklist_template_items ( id, title, position )').order('position'),
      supabase.from('plan_card_assignees').select(ASSIGNEE_CARD_SELECT).eq('status', 'for_review'),
    ])
    const loadErr = boardErr || catErr || staffErr || tplErr || reviewErr
    if (loadErr) toast.error(loadErr.message)
    const visible = visiblePlannerBoards(boardRows, profile)
    setBoards(visible)
    setCategories(catRows || [])
    setStaff(staffRows || [])
    setTemplates(tplRows || [])
    setReviewItems(reviewItemsFromAssigneeRows(reviewRows))
    const next = pickPlannerBoard(boardRows, requested, profile)
    if (!next) {
      setBoard(null)
      setLoading(false)
      return
    }
    const { data, error } = await supabase.from('plan_boards').select(PLAN_BOARD_DETAIL_SELECT).eq('id', next.id).maybeSingle()
    if (error) toast.error(error.message)
    setBoard(data || null)
    setLoading(false)
  }, [searchParams, canEdit, profile])

  useEffect(() => {
    load()
  }, [load])

  const loadRef = useRef(load)
  loadRef.current = load
  const scheduleReload = useMemo(() => createCoalescedReload(() => loadRef.current(), 450), [])

  useEffect(() => {
    const channel = supabase
      .channel('planner-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_cards' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_card_assignees' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_lists' }, scheduleReload)
      .subscribe()
    return () => {
      scheduleReload.cancel()
      supabase.removeChannel(channel)
    }
  }, [scheduleReload])

  useEffect(() => {
    setCardId(searchParams.get('card'))
  }, [searchParams])

  useEffect(() => {
    if (listFilter !== 'all' && !lists.some((l) => l.id === listFilter)) setListFilter('all')
  }, [lists, listFilter])

  useEffect(() => {
    if (tab !== 'calendar') return
    const y = calCursor.getFullYear()
    const m = calCursor.getMonth()
    const from = new Date(y, m, 1).toISOString()
    const to = new Date(y, m + 1, 1).toISOString()
    const rows = ({ data, error }) => {
      if (error) throw error
      return data || []
    }
    const eventsQ = supabase.from('events').select('id, title, starts_at, ends_at, is_published').gte('starts_at', from).lt('starts_at', to)
    // Walk-in wash tickets share the bookings table; the calendar shows the same appointments as the Bookings board.
    const bookingsPage = (start, end) =>
      supabase
        .from('bookings')
        .select('id, customer_name, scheduled_start, status, services ( slug, pay_category )')
        .eq('is_archived', false)
        .neq('status', 'cancelled')
        .gte('scheduled_start', from)
        .lt('scheduled_start', to)
        .order('id')
        .range(start, end)
        .then(rows)
    let stale = false
    Promise.all([
      (canEdit ? eventsQ : eventsQ.eq('is_published', true)).then(rows),
      canEdit ? collectPaged(bookingsPage).then((list) => list.filter(isBookingBoardRow)) : [],
      canEdit
        ? supabase
          .from('ops_form_submissions')
          .select('id, form_id, due_at, calendar_at, ops_forms ( name )')
          .not('calendar_at', 'is', null)
          .gte('calendar_at', from)
          .lt('calendar_at', to)
          .then(rows)
        : [],
    ])
      .then(([events, bookings, forms]) => {
        if (!stale) setCalExtra({ events, bookings, forms })
      })
      .catch((err) => {
        if (!stale) toast.error(err.message)
      })
    return () => {
      stale = true
    }
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
          href: hrefForCalendarItem({ type: 'booking', booking: b }),
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
    setCardId(null)
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next === 'board') params.delete('tab')
      else params.set('tab', next)
      if (board?.id) params.set('board', board.id)
      params.delete('create')
      params.delete('card')
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

  const planningTabs = PLANNING_SHELL_TABS
    .filter((t) => tabs.some((x) => x.id === t.id))
    .map((t) => (t.id === 'review' && reviewCount > 0 ? { ...t, badge: reviewCount } : t))

  const planningStepIcons = {
    board: FolderKanban,
    review: Inbox,
    calendar: CalendarDays,
    configure: Settings2,
  }

  return (
    <OpsPageShell
      className="hakum-planning"
      eyebrow="Shop floor"
      title="Planner Board"
      description={
        tab === 'configure'
          ? 'Lists, categories, checklists, and boards.'
          : canEdit
            ? 'Assign work, attach a form to an event, review proof.'
            : 'Your assigned work and published events.'
      }
      actions={
        canEdit && tab === 'board' ? (
          <Button type="button" className="min-h-11" onClick={() => openCard('new')}>
            <Plus data-icon="inline-start" /> New task
          </Button>
        ) : null
      }
    >
      <OpsGuideCard
        title="How planner works"
        description="Track tasks across board stages, review submitted proof, check deadlines on Calendar, and configure lists or forms."
        steps={PLANNING_WORKFLOW_STEPS.filter((s) => s.id !== 'configure' || canEdit)}
        stepIcons={planningStepIcons}
      />

      <div className="planner-v2">
        <Tabs value={tab} onValueChange={setTab}>
          <OpsTabList tabs={planningTabs} aria-label="Planner Board" />
        </Tabs>

        {tab === 'board' && (
          <div className="planner-v2-body">
            <section className={`planner-v2-rail ${filtersOpen ? 'is-filters-open' : ''}`} aria-label="Task filters and view">
              <div className="planner-v2-rail-top">
                <label className="planner-v2-rail-search">
                  <span>Search</span>
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={canEdit ? 'Search title or note…' : 'Search your tasks…'} />
                </label>

                {canEdit && boards.length > 0 && (
                  <label className="planner-v2-rail-board">
                    <span>Board</span>
                    <select value={board?.id || ''} onChange={(e) => setSearchParams((p) => { const n = new URLSearchParams(p); n.set('board', e.target.value); return n }, { replace: true })}>
                      {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </label>
                )}

                <div className="planner-v2-rail-actions">
                  <span className="planner-v2-count" aria-live="polite">
                    {visibleCards.length} {visibleCards.length === 1 ? 'task' : 'tasks'}
                  </span>
                  <div className="planner-v2-view-toggle" role="group" aria-label="Layout view">
                    <Button type="button" size="sm" variant={view === 'board' ? 'default' : 'outline'} onClick={() => setView('board')}>
                      <LayoutList className="size-3.5" /> Board
                    </Button>
                    <Button type="button" size="sm" variant={view === 'table' ? 'default' : 'outline'} onClick={() => setView('table')}>
                      <Table2 className="size-3.5" /> Table
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={filtersOpen || activeFilterCount > 0 ? 'secondary' : 'outline'}
                    className="planner-v2-filter-toggle"
                    aria-expanded={filtersOpen}
                    onClick={() => setFiltersOpen((prev) => !prev)}
                  >
                    <Filter className="size-3.5" /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                  </Button>
                  {activeFilterCount > 0 && (
                    <Button type="button" size="sm" variant="ghost" onClick={resetFilters}>
                      <RotateCcw className="size-3.5" /> Reset
                    </Button>
                  )}
                  {canEdit && (
                    <Button type="button" size="sm" variant="outline" onClick={() => setTab('configure')}>
                      <Settings2 className="size-3.5" /> Configure
                    </Button>
                  )}
                </div>
              </div>

              <div className="planner-v2-rail-filters">
                <label>
                  <span>Status</span>
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    {STATUS_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>
                {canEdit && (
                  <label>
                    <span>List</span>
                    <select value={listFilter} onChange={(e) => setListFilter(e.target.value)}>
                      <option value="all">Any list</option>
                      {lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                    </select>
                  </label>
                )}
                {canEdit && (
                  <label>
                    <span>Category</span>
                    <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                      <option value="all">Any category</option>
                      <option value="none">Uncategorized</option>
                      {visibleCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                )}
                {canEdit && (
                  <label>
                    <span>Assignee</span>
                    <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                      <option value="all">Anyone</option>
                      <option value="unassigned">Unassigned</option>
                      {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                  </label>
                )}
                <label>
                  <span>Deadline</span>
                  <select value={due} onChange={(e) => setDue(e.target.value)}>
                    {DUE_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <div className="min-w-0">
              {!visibleCards.length ? (
                <div className="planner-empty">
                  <strong>{canEdit ? 'No tasks match' : activeFilterCount > 0 ? 'No matching assigned tasks' : 'Nothing assigned to you'}</strong>
                  <p>{canEdit ? 'Clear a filter or create a new task.' : activeFilterCount > 0 ? 'Try clearing filters to see all assigned tasks.' : 'When someone assigns you work, it shows up here.'}</p>
                  {activeFilterCount > 0 ? (
                    <Button type="button" variant="outline" onClick={resetFilters}>Clear filters</Button>
                  ) : (
                    canEdit && <Button type="button" onClick={() => openCard('new')}>New task</Button>
                  )}
                </div>
              ) : view === 'board' ? (
                canEdit ? (
                  <div className="planner-v2-cols" style={{ '--planning-list-cols': Math.min(Math.max(lists.length, 1), 5) }}>
                    {lists.map((list) => {
                      const col = visibleCards.filter((c) => c.list_id === list.id)
                      const doneInLane = col.filter((c) => cardWorkflowStatus(c) === 'done').length
                      return (
                        <section key={list.id} className="planner-v2-lane">
                          <header className="planner-v2-lane-head">
                            <h2>
                              <span>{list.title}</span>
                              <span className="planner-v2-lane-count">{col.length}</span>
                            </h2>
                            {col.length > 0 && doneInLane > 0 && (
                              <span className="planner-v2-lane-done">{doneInLane}/{col.length} done</span>
                            )}
                          </header>
                          {col.length ? (
                            <div className="planner-v2-lane-cards">
                              {col.map((card) => (
                                <PlannerTaskCard
                                  key={card.id}
                                  card={card}
                                  category={categoryMap.get(card.category_id)}
                                  onOpen={openCard}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="planner-v2-lane-empty">
                              {activeFilterCount > 0 ? 'No matching tasks' : 'No tasks yet'}
                            </p>
                          )}
                        </section>
                      )
                    })}
                  </div>
                ) : (
                  <div className="planner-v2-cols" style={{ '--planning-list-cols': Math.min(Math.max(ASSIGNED_LANE_ORDER.filter((st) => visibleCards.some((c) => cardWorkflowStatus(c) === st)).length, 1), 4) }}>
                    {ASSIGNED_LANE_ORDER.map((statusKey) => {
                      const col = visibleCards.filter((c) => cardWorkflowStatus(c) === statusKey)
                      if (!col.length) return null
                      const meta = STATUS_META[statusKey] || STATUS_META.todo
                      return (
                        <section key={statusKey} className="planner-v2-lane">
                          <header className="planner-v2-lane-head">
                            <h2>
                              <span>{meta.label}</span>
                              <span className="planner-v2-lane-count">{col.length}</span>
                            </h2>
                          </header>
                          <div className="planner-v2-lane-cards">
                            {col.map((card) => (
                              <PlannerTaskCard
                                key={card.id}
                                card={card}
                                category={categoryMap.get(card.category_id)}
                                showListBadge
                                onOpen={openCard}
                              />
                            ))}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                )
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
                        const wf = cardWorkflowStatus(card)
                        const meta = STATUS_META[wf] || STATUS_META.unassigned
                        const names = (card.plan_card_assignees || []).map((x) => x.staff_profiles?.full_name).filter(Boolean)
                        const dueMeta = cardDueMeta(card.due_at, wf)
                        return (
                          <tr key={card.id} onClick={() => openCard(card.id)}>
                            <td className="planner-v2-table-title">
                              <button type="button" className="planner-v2-row-link" onClick={(e) => { e.stopPropagation(); openCard(card.id) }}>
                                {card.title}
                              </button>
                            </td>
                            <td>{card.list_title}</td>
                            <td>{names.length ? (names.length > 2 ? `${names[0]} +${names.length - 1}` : names.join(', ')) : '—'}</td>
                            <td>
                              {dueMeta ? <span className={`planner-v2-due ${dueMeta.tone}`}>{dueMeta.label}</span> : '—'}
                            </td>
                            <td>
                              <span className={`planner-v2-pill ${meta.tone}`}>{meta.label}</span>
                            </td>
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
            resultsId={searchParams.get('results')}
          />
        )}

        {tab === 'results' && (
          <Suspense fallback={<p className="py-6 text-sm text-muted-foreground">Loading form results…</p>}>
            <FormResultsBoardPage embedded initialFormSlug={searchParams.get('results') || ''} />
          </Suspense>
        )}

        {tab === 'events' && (
          <PlanningEventsPanel
            canEdit={canEdit}
            highlightId={searchParams.get('event')}
          />
        )}

        {tab === 'review' && canEdit && (
          <PlanningReviewPanel items={reviewItems} canEdit={canEdit} onChanged={load} />
        )}

        {tab === 'configure' && canEdit && (
          <PlanningConfigurePanel
            boards={boards}
            board={board}
            lists={lists}
            categories={categories}
            templates={templates}
            canEdit={canEdit}
            viewerRole={profile?.role}
            onChanged={load}
            onSelectBoard={(id) => {
              setSearchParams((prev) => {
                const params = new URLSearchParams(prev)
                params.set('board', id)
                params.set('tab', 'configure')
                return params
              }, { replace: true })
            }}
          />
        )}

        {activeCard && (
          <TaskModal
            card={activeCard.id === 'new' ? null : activeCard}
            listId={defaultPlanListId(lists)}
            lists={lists}
            categories={visibleCategories}
            checklistTemplates={templates}
            canEdit={canEdit}
            onClose={() => openCard(null)}
            onSaved={load}
            onDeleted={load}
          />
        )}
      </div>
    </OpsPageShell>
  )
}

function PlannerTaskCard({ card, category, showListBadge = false, onOpen }) {
  const wf = cardWorkflowStatus(card)
  const meta = STATUS_META[wf] || STATUS_META.unassigned
  const dueMeta = cardDueMeta(card.due_at, wf)
  const assignees = (card.plan_card_assignees || []).filter((a) => a.staff_profiles?.full_name || a.staff_id)
  const checklist = card.plan_checklist_items || []
  const checklistDone = checklist.filter((item) => item.done).length
  const hasProofSent = assignees.some((a) => a.proof_url || a.proof_note || a.proof_submitted_at)
  const visibleAssignees = assignees.slice(0, 2)
  const extraAssignees = assignees.length - visibleAssignees.length

  return (
    <button
      type="button"
      className="planner-v2-card planner-ticket"
      style={category?.color ? { '--planner-card-accent': category.color } : undefined}
      onClick={() => onOpen(card.id)}
    >
      <div className="planner-v2-card-badges">
        <span className={`planner-v2-pill ${meta.tone}`}>{meta.label}</span>
        {showListBadge && card.list_title ? <span className="planner-v2-pill is-list">{card.list_title}</span> : null}
        {category?.name ? <span className="planner-v2-pill is-cat">{category.name}</span> : null}
        {card.proof_required ? <span className="planner-v2-pill is-proof">Proof</span> : null}
      </div>

      <strong className="planner-v2-card-title">{card.title}</strong>
      {card.description ? <p className="planner-v2-card-desc">{card.description}</p> : null}

      {(card.ops_forms?.name || checklist.length > 0 || hasProofSent) && (
        <div className="planner-v2-card-chips">
          {card.ops_forms?.name ? (
            <span className="planner-v2-chip">
              <FileText className="size-3.5 shrink-0" />
              <span className="truncate">{card.ops_forms.name}</span>
            </span>
          ) : null}
          {checklist.length > 0 ? (
            <span className={`planner-v2-chip ${checklistDone === checklist.length ? 'is-complete' : ''}`}>
              <CheckSquare className="size-3.5 shrink-0" />
              <span>{checklistDone}/{checklist.length}</span>
            </span>
          ) : null}
          {hasProofSent ? (
            <span className="planner-v2-chip is-proof-sent">
              <ShieldCheck className="size-3.5 shrink-0" />
              <span>Proof sent</span>
            </span>
          ) : null}
        </div>
      )}

      <div className="planner-v2-card-foot">
        <div className="planner-v2-card-who">
          {visibleAssignees.length ? (
            <>
              {visibleAssignees.map((a) => {
                const name = a.staff_profiles?.full_name || 'Staff'
                return (
                  <span key={a.id || a.staff_id || name} className="planner-v2-assignee">
                    <span className="planner-v2-avatar" aria-hidden="true">{initialsForName(name)}</span>
                    <span className="truncate">{name}</span>
                  </span>
                )
              })}
              {extraAssignees > 0 ? <span className="planner-v2-extra">+{extraAssignees}</span> : null}
            </>
          ) : (
            <span className="planner-v2-unassigned">Unassigned</span>
          )}
        </div>

        {dueMeta ? (
          <span className={`planner-v2-due ${dueMeta.tone}`}>
            <Clock className="size-3 shrink-0" />
            <span>{dueMeta.label}</span>
          </span>
        ) : null}
      </div>
    </button>
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
