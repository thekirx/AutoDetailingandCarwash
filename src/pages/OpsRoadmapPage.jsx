/**
 * Ops Lab — plans, roadmaps, solutions, brainstorms for SA / ASA / BA / Operations Lead.
 * Canvas + library list; brand-aligned Hakum ops chrome; complaint/form links; notify on create.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import {
  LayoutGrid,
  List,
  Minus,
  Plus,
  Trash2,
  Type,
  StickyNote,
  Square,
  Maximize2,
  Link2,
  CheckSquare,
  MessageSquareWarning,
  Archive,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessOpsRoadmap } from '@/auth/permissions'
import { createCoalescedReload } from '@/lib/coalesceReload'
import {
  BOARD_KINDS,
  BOARD_PRIORITIES,
  BOARD_STATUSES,
  ITEM_STATUSES,
  ROADMAP_COLORS,
  ROADMAP_KINDS,
  boardKindMeta,
  boardPointFromClient,
  filterBoards,
  itemLinkLabel,
  newBoardDraft,
  newRoadmapItemDraft,
  normalizeViewport,
  roadmapColor,
  screenToBoardDelta,
} from '@/lib/opsRoadmap'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NamedSelect } from '@/components/ui/named-select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

async function notifyOpsLab({ event, board, profile }) {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    if (!token || !board?.id) return
    await fetch('/api/notify-ops-lab', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        event,
        board_id: board.id,
        board_title: board.title,
        board_kind: board.board_kind || 'brainstorm',
        actor_name: profile?.full_name || 'Teammate',
      }),
    })
  } catch {
    /* best-effort */
  }
}

function StickyCard({ item, selected, onSelect, onChange, onDelete, onDragStart, complaints }) {
  const palette = roadmapColor(item.color)
  const isHeading = item.kind === 'heading'
  const isFrame = item.kind === 'frame'
  const isComplaint = item.kind === 'complaint_link'
  const isForm = item.kind === 'form_link'
  const isAction = item.kind === 'action'
  const linkLabel = itemLinkLabel(item)

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={(e) => onDragStart(e, item)}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(item.id)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(item.id)
        }
      }}
      className={`absolute touch-none select-none rounded-[0.85rem] border shadow-[0_8px_24px_rgba(5,38,153,0.08)] transition-[box-shadow,transform] ${
        selected ? 'ring-2 ring-[var(--ops-primary)] ring-offset-2' : ''
      }`}
      style={{
        left: item.x,
        top: item.y,
        width: item.w,
        height: item.h,
        zIndex: item.z_index || 1,
        background: isFrame ? `${palette.bg}66` : palette.bg,
        borderColor: palette.border,
        color: palette.ink,
        borderStyle: isFrame ? 'dashed' : 'solid',
        borderWidth: isFrame ? 2 : 1,
      }}
    >
      <div className="flex h-full flex-col gap-1 p-2.5 sm:p-3">
        {(isComplaint || isForm || isAction) && (
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] opacity-70">
            {ROADMAP_KINDS.find((k) => k.value === item.kind)?.label}
          </p>
        )}
        {isHeading ? (
          <input
            className="w-full bg-transparent font-[family-name:var(--font-ops)] text-lg font-semibold outline-none placeholder:opacity-50 sm:text-xl"
            value={item.title || ''}
            placeholder="Heading"
            onChange={(e) => onChange(item.id, { title: e.target.value })}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <input
              className="w-full bg-transparent text-sm font-semibold outline-none placeholder:opacity-50"
              value={item.title || ''}
              placeholder={isFrame ? 'Frame label' : 'Title'}
              onChange={(e) => onChange(item.id, { title: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
            />
            {!isFrame ? (
              <textarea
                className="min-h-0 flex-1 resize-none bg-transparent text-sm leading-snug outline-none placeholder:opacity-50"
                value={item.body || ''}
                placeholder="Write the idea…"
                onChange={(e) => onChange(item.id, { body: e.target.value })}
                onPointerDown={(e) => e.stopPropagation()}
              />
            ) : null}
          </>
        )}

        {isComplaint && selected ? (
          <select
            className="mt-1 w-full rounded-md border border-black/10 bg-white/70 px-2 py-1 text-xs"
            value={item.meta?.submission_id || ''}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const row = complaints.find((c) => c.id === e.target.value)
              onChange(item.id, {
                meta: {
                  ...(item.meta || {}),
                  submission_id: e.target.value || null,
                  complaint_label: row
                    ? `${row.respondent_label || 'Guest'} · ${String(row.payload?.subject || row.payload?.message || '').slice(0, 48)}`
                    : null,
                  respondent_label: row?.respondent_label || null,
                },
                title: row
                  ? `Complaint · ${row.respondent_label || 'Guest'}`
                  : item.title,
              })
            }}
          >
            <option value="">Pick a complaint…</option>
            {complaints.map((c) => (
              <option key={c.id} value={c.id}>
                {(c.respondent_label || 'Guest').slice(0, 24)} ·{' '}
                {String(c.payload?.subject || c.payload?.message || c.id).slice(0, 36)}
              </option>
            ))}
          </select>
        ) : null}

        {isForm && selected ? (
          <input
            className="mt-1 w-full rounded-md border border-black/10 bg-white/70 px-2 py-1 text-xs"
            placeholder="https://… or /operations/…"
            value={item.meta?.url || ''}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) =>
              onChange(item.id, {
                meta: { ...(item.meta || {}), url: e.target.value, form_label: e.target.value },
              })
            }
          />
        ) : null}

        {linkLabel && !selected ? (
          <p className="truncate text-[0.7rem] font-medium opacity-80">{linkLabel}</p>
        ) : null}

        {selected ? (
          <div className="mt-auto flex flex-col gap-1.5 pt-1">
            <div className="flex items-center gap-1">
              <select
                className="h-7 flex-1 rounded-md border border-black/10 bg-white/70 px-1 text-[0.65rem]"
                value={item.item_status || 'open'}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => onChange(item.id, { item_status: e.target.value })}
              >
                {ITEM_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded p-1 text-destructive hover:bg-black/5"
                title="Delete"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(item.id)
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {ROADMAP_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  className="size-4 rounded-full border border-black/10"
                  style={{
                    background: c.bg,
                    outline: item.color === c.value ? `2px solid ${c.border}` : undefined,
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange(item.id, { color: c.value })
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-auto text-[0.6rem] uppercase tracking-wide opacity-60">
            {item.item_status || 'open'}
          </p>
        )}
      </div>
    </div>
  )
}

export default function OpsRoadmapPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [boards, setBoards] = useState([])
  const [boardId, setBoardId] = useState('')
  const [items, setItems] = useState([])
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [viewport, setViewport] = useState(() => normalizeViewport())
  const [viewMode, setViewMode] = useState('canvas')
  const [kindFilter, setKindFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [draftKind, setDraftKind] = useState('brainstorm')
  const [newTitle, setNewTitle] = useState('')
  const surfaceRef = useRef(null)
  const dragRef = useRef(null)
  const panRef = useRef(null)
  const saveTimers = useRef(new Map())
  const viewportTimer = useRef(null)

  const allowed = canAccessOpsRoadmap(profile)
  const board = useMemo(() => boards.find((b) => b.id === boardId) || null, [boards, boardId])
  const visibleBoards = useMemo(
    () => filterBoards(boards, { kind: kindFilter, status: statusFilter, q: query }),
    [boards, kindFilter, statusFilter, query],
  )

  const loadBoards = useCallback(async () => {
    const { data, error } = await supabase
      .from('ops_roadmap_boards')
      .select(
        'id, title, description, board_kind, status, priority, branch_slug, viewport, updated_at, created_by, linked_form_submission_id',
      )
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(80)
    if (error) {
      toast.error(error.message)
      return
    }
    setBoards(data || [])
    const fromUrl = searchParams.get('board')
    setBoardId((prev) => prev || fromUrl || data?.[0]?.id || '')
  }, [searchParams])

  const loadItems = useCallback(async (id) => {
    if (!id) {
      setItems([])
      return
    }
    const { data, error } = await supabase
      .from('ops_roadmap_items')
      .select('*')
      .eq('board_id', id)
      .order('z_index', { ascending: true })
    if (error) {
      toast.error(error.message)
      return
    }
    setItems(data || [])
  }, [])

  const loadComplaints = useCallback(async () => {
    const { data, error } = await supabase
      .from('ops_form_submissions')
      .select('id, payload, status, respondent_label, created_at, ops_forms!inner ( kind, name )')
      .eq('ops_forms.kind', 'complaint')
      .order('created_at', { ascending: false })
      .limit(40)
    if (!error) setComplaints(data || [])
  }, [])

  useEffect(() => {
    if (!allowed) return
    setLoading(true)
    Promise.all([loadBoards(), loadComplaints()]).finally(() => setLoading(false))
  }, [allowed, loadBoards, loadComplaints])

  useEffect(() => {
    if (!boardId) {
      setItems([])
      return
    }
    const b = boards.find((row) => row.id === boardId)
    if (b?.viewport) setViewport(normalizeViewport(b.viewport))
    loadItems(boardId)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('board', boardId)
      return next
    }, { replace: true })
  }, [boardId, boards, loadItems, setSearchParams])

  useEffect(() => {
    if (!allowed || !boardId) return
    const reload = createCoalescedReload(() => loadItems(boardId), 350)
    const channel = supabase
      .channel(`ops-lab-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ops_roadmap_items', filter: `board_id=eq.${boardId}` },
        reload,
      )
      .subscribe()
    return () => {
      reload.cancel()
      supabase.removeChannel(channel)
    }
  }, [allowed, boardId, loadItems])

  function scheduleItemSave(id, patch) {
    const prev = saveTimers.current.get(id)
    if (prev) clearTimeout(prev)
    saveTimers.current.set(
      id,
      setTimeout(async () => {
        saveTimers.current.delete(id)
        const { error } = await supabase
          .from('ops_roadmap_items')
          .update({ ...patch, updated_by: profile.id, updated_at: new Date().toISOString() })
          .eq('id', id)
        if (error) toast.error(error.message)
        if (patch.meta?.submission_id && board) {
          notifyOpsLab({ event: 'complaint_linked', board, profile })
        }
      }, 400),
    )
  }

  function patchItemLocal(id, patch) {
    setItems((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
    scheduleItemSave(id, patch)
  }

  function scheduleViewportSave(next) {
    if (!boardId) return
    if (viewportTimer.current) clearTimeout(viewportTimer.current)
    viewportTimer.current = setTimeout(async () => {
      await supabase
        .from('ops_roadmap_boards')
        .update({
          viewport: next,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', boardId)
    }, 600)
  }

  async function createBoard() {
    const draft = newBoardDraft({
      title: newTitle,
      boardKind: draftKind,
      createdBy: profile.id,
    })
    const { data, error } = await supabase
      .from('ops_roadmap_boards')
      .insert(draft)
      .select(
        'id, title, description, board_kind, status, priority, branch_slug, viewport, updated_at, created_by, linked_form_submission_id',
      )
      .maybeSingle()
    if (error) {
      toast.error(error.message)
      return
    }
    setNewTitle('')
    setBoards((rows) => [data, ...rows])
    setBoardId(data.id)
    toast.success(`${boardKindMeta(data.board_kind).label} created`)
    notifyOpsLab({ event: 'board_created', board: data, profile })
  }

  async function patchBoard(patch) {
    if (!boardId) return
    const prev = board
    setBoards((rows) => rows.map((b) => (b.id === boardId ? { ...b, ...patch } : b)))
    const { error } = await supabase
      .from('ops_roadmap_boards')
      .update({ ...patch, updated_by: profile.id, updated_at: new Date().toISOString() })
      .eq('id', boardId)
    if (error) {
      toast.error(error.message)
      return
    }
    // Notify peers when status or kind changes (not every keystroke on title)
    if (prev && (patch.status || patch.board_kind || patch.priority === 'high')) {
      notifyOpsLab({
        event: 'board_updated',
        board: { ...prev, ...patch },
        profile,
      })
    }
  }

  async function archiveBoard() {
    if (!boardId) return
    const { error } = await supabase
      .from('ops_roadmap_boards')
      .update({ is_archived: true, updated_by: profile.id })
      .eq('id', boardId)
    if (error) {
      toast.error(error.message)
      return
    }
    setBoards((rows) => rows.filter((b) => b.id !== boardId))
    setBoardId('')
    toast.success('Board archived')
  }

  async function addItem(kind) {
    if (!boardId) {
      toast.error('Create or select a board first')
      return
    }
    const rect = surfaceRef.current?.getBoundingClientRect()
    const center = rect
      ? boardPointFromClient({
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          rect,
          viewport,
        })
      : { x: 140, y: 120 }
    const draft = newRoadmapItemDraft({
      boardId,
      kind,
      x: center.x - 110,
      y: center.y - 80,
      createdBy: profile.id,
    })
    const { data, error } = await supabase.from('ops_roadmap_items').insert(draft).select('*').maybeSingle()
    if (error) {
      toast.error(error.message)
      return
    }
    setItems((rows) => [...rows, data])
    setSelectedId(data.id)
    setViewMode('canvas')
  }

  async function deleteItem(id) {
    setItems((rows) => rows.filter((r) => r.id !== id))
    if (selectedId === id) setSelectedId(null)
    const { error } = await supabase.from('ops_roadmap_items').delete().eq('id', id)
    if (error) toast.error(error.message)
  }

  function onSurfacePointerDown(e) {
    if (e.button === 1 || e.button === 2 || e.altKey || e.buttons === 4) {
      e.preventDefault()
      panRef.current = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y }
      return
    }
    if (e.target === e.currentTarget) setSelectedId(null)
  }

  function onItemDragStart(e, item) {
    if (e.button !== 0) return
    e.stopPropagation()
    setSelectedId(item.id)
    dragRef.current = {
      id: item.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: Number(item.x) || 0,
      origY: Number(item.y) || 0,
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function onSurfacePointerMove(e) {
    if (panRef.current) {
      const dx = e.clientX - panRef.current.x
      const dy = e.clientY - panRef.current.y
      setViewport(
        normalizeViewport({
          x: panRef.current.vx + dx,
          y: panRef.current.vy + dy,
          zoom: viewport.zoom,
        }),
      )
      return
    }
    if (!dragRef.current) return
    const { dx, dy } = screenToBoardDelta(
      e.clientX - dragRef.current.startX,
      e.clientY - dragRef.current.startY,
      viewport.zoom,
    )
    patchItemLocal(dragRef.current.id, {
      x: Math.round(dragRef.current.origX + dx),
      y: Math.round(dragRef.current.origY + dy),
    })
  }

  function onSurfacePointerUp() {
    if (panRef.current) {
      scheduleViewportSave(viewport)
      panRef.current = null
    }
    dragRef.current = null
  }

  function onWheel(e) {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const next = normalizeViewport({
      ...viewport,
      zoom: viewport.zoom + (e.deltaY > 0 ? -0.08 : 0.08),
    })
    setViewport(next)
    scheduleViewportSave(next)
  }

  function zoomBy(step) {
    const next = normalizeViewport({ ...viewport, zoom: viewport.zoom + step })
    setViewport(next)
    scheduleViewportSave(next)
  }

  if (!allowed) return <Navigate to="/operations/access-denied" replace />

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-3 px-3 pb-6 pt-2 sm:px-5 sm:pb-8">
      <header className="mb-1 space-y-1">
        <p className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--ops-primary)]">
          Leadership
        </p>
        <h1 className="font-[family-name:var(--font-ops)] text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Ops Lab
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Plans, roadmaps, and solutions shared with Super Admin, ASA, and Branch Admins. Link
          complaints, assign actions, brainstorm improvements.
        </p>
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        {/* Library rail */}
        <aside className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:p-4">
          <div className="space-y-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search boards…"
              aria-label="Search boards"
            />
            <div className="grid grid-cols-2 gap-2">
              <NamedSelect
                id="lab-kind-filter"
                value={kindFilter}
                onChange={setKindFilter}
                options={[
                  { value: 'all', label: 'All types' },
                  ...BOARD_KINDS.map((k) => ({ value: k.value, label: k.label })),
                ]}
              />
              <NamedSelect
                id="lab-status-filter"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'All status' },
                  ...BOARD_STATUSES.map((s) => ({ value: s.value, label: s.label })),
                ]}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-dashed border-[var(--ops-primary)]/30 bg-[var(--color-brand-primary-soft)]/40 p-2.5">
            <NamedSelect
              id="lab-new-kind"
              value={draftKind}
              onChange={setDraftKind}
              options={BOARD_KINDS.map((k) => ({ value: k.value, label: k.label }))}
            />
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Board title"
            />
            <Button type="button" className="w-full gap-1.5" onClick={createBoard}>
              <Plus className="size-4" /> New board
            </Button>
          </div>

          <ul className="max-h-[42vh] space-y-1.5 overflow-y-auto lg:max-h-[min(58vh,560px)]">
            {loading ? (
              <li className="px-1 py-6 text-center text-sm text-muted-foreground">Loading…</li>
            ) : visibleBoards.length === 0 ? (
              <li className="px-1 py-6 text-center text-sm text-muted-foreground">
                No boards yet. Create a plan or solution.
              </li>
            ) : (
              visibleBoards.map((b) => {
                const active = b.id === boardId
                const meta = boardKindMeta(b.board_kind)
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => setBoardId(b.id)}
                      className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                        active
                          ? 'border-[var(--ops-primary)] bg-[var(--color-brand-primary-soft)]'
                          : 'border-transparent hover:bg-muted/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{b.title}</span>
                        {b.priority === 'high' ? (
                          <Badge variant="destructive" className="shrink-0 text-[0.6rem]">
                            High
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                        {meta.label} · {b.status?.replace('_', ' ')}
                      </p>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </aside>

        {/* Workspace */}
        <section className="flex min-w-0 flex-col gap-3">
          {board ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:p-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  value={board.title || ''}
                  onChange={(e) => patchBoard({ title: e.target.value })}
                  className="font-semibold sm:col-span-2"
                  aria-label="Board title"
                />
                <NamedSelect
                  id="board-kind"
                  value={board.board_kind || 'brainstorm'}
                  onChange={(v) => patchBoard({ board_kind: v })}
                  options={BOARD_KINDS.map((k) => ({ value: k.value, label: k.label }))}
                />
                <NamedSelect
                  id="board-status"
                  value={board.status || 'open'}
                  onChange={(v) => patchBoard({ status: v })}
                  options={BOARD_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                />
                <NamedSelect
                  id="board-priority"
                  value={board.priority || 'normal'}
                  onChange={(v) => patchBoard({ priority: v })}
                  options={BOARD_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
                />
                <Input
                  className="sm:col-span-2 lg:col-span-3"
                  value={board.description || ''}
                  onChange={(e) => patchBoard({ description: e.target.value })}
                  placeholder="What problem does this board solve?"
                />
                <Button type="button" variant="outline" className="gap-1.5" onClick={archiveBoard}>
                  <Archive className="size-3.5" /> Archive
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => addItem('note')}>
                  <StickyNote className="size-3.5" /> Sticky
                </Button>
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => addItem('heading')}>
                  <Type className="size-3.5" /> Heading
                </Button>
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => addItem('frame')}>
                  <Square className="size-3.5" /> Frame
                </Button>
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => addItem('action')}>
                  <CheckSquare className="size-3.5" /> Action
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => addItem('complaint_link')}
                >
                  <MessageSquareWarning className="size-3.5" /> Complaint
                </Button>
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => addItem('form_link')}>
                  <Link2 className="size-3.5" /> Link
                </Button>
                <Link
                  to="/operations/inquiries"
                  className="text-xs text-[var(--ops-primary)] underline-offset-2 hover:underline"
                >
                  Open inquiries
                </Link>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={viewMode === 'canvas' ? 'default' : 'outline'}
                    onClick={() => setViewMode('canvas')}
                    aria-label="Canvas view"
                  >
                    <LayoutGrid className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={viewMode === 'stack' ? 'default' : 'outline'}
                    onClick={() => setViewMode('stack')}
                    aria-label="List view"
                  >
                    <List className="size-3.5" />
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => zoomBy(-0.1)} aria-label="Zoom out">
                    <Minus className="size-3.5" />
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => zoomBy(0.1)} aria-label="Zoom in">
                    <Plus className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const next = normalizeViewport({ x: 0, y: 0, zoom: 1 })
                      setViewport(next)
                      scheduleViewportSave(next)
                    }}
                    aria-label="Reset view"
                  >
                    <Maximize2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {!boardId ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-14 text-center">
              <p className="text-sm text-muted-foreground">
                Create a plan, roadmap, or solution board to start.
              </p>
            </div>
          ) : viewMode === 'stack' ? (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.length === 0 ? (
                <li className="col-span-full rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  Empty board — add stickies, actions, or a complaint link.
                </li>
              ) : (
                items.map((item) => {
                  const palette = roadmapColor(item.color)
                  return (
                    <li
                      key={item.id}
                      className="rounded-xl border p-3 shadow-sm"
                      style={{
                        background: palette.bg,
                        borderColor: palette.border,
                        color: palette.ink,
                      }}
                    >
                      <p className="text-[0.65rem] font-semibold uppercase tracking-wider opacity-70">
                        {ROADMAP_KINDS.find((k) => k.value === item.kind)?.label || item.kind}
                      </p>
                      <input
                        className="mt-1 w-full bg-transparent text-base font-semibold outline-none"
                        value={item.title || ''}
                        onChange={(e) => patchItemLocal(item.id, { title: e.target.value })}
                      />
                      {item.kind !== 'heading' && item.kind !== 'frame' ? (
                        <textarea
                          className="mt-2 min-h-24 w-full resize-y bg-transparent text-sm outline-none"
                          value={item.body || ''}
                          onChange={(e) => patchItemLocal(item.id, { body: e.target.value })}
                        />
                      ) : null}
                      <div className="mt-2 flex justify-end">
                        <Button type="button" size="sm" variant="ghost" onClick={() => deleteItem(item.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </li>
                  )
                })
              )}
            </ul>
          ) : (
            <div
              ref={surfaceRef}
              className="relative h-[min(70vh,740px)] overflow-hidden rounded-xl border border-border touch-none"
              style={{
                backgroundColor: 'var(--ops-page)',
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, rgba(5,38,153,0.12) 1px, transparent 0)',
                backgroundSize: '22px 22px',
              }}
              onPointerDown={onSurfacePointerDown}
              onPointerMove={onSurfacePointerMove}
              onPointerUp={onSurfacePointerUp}
              onPointerLeave={onSurfacePointerUp}
              onWheel={onWheel}
              onContextMenu={(e) => e.preventDefault()}
            >
              <div
                className="absolute left-0 top-0 origin-top-left will-change-transform"
                style={{
                  transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                }}
              >
                {items.map((item) => (
                  <StickyCard
                    key={item.id}
                    item={item}
                    selected={selectedId === item.id}
                    onSelect={setSelectedId}
                    onChange={patchItemLocal}
                    onDelete={deleteItem}
                    onDragStart={onItemDragStart}
                    complaints={complaints}
                  />
                ))}
              </div>
              <p className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-background/85 px-2 py-1 text-[0.65rem] text-muted-foreground backdrop-blur sm:text-xs">
                Drag cards · Alt-drag to pan · Ctrl/⌘+scroll zoom · {Math.round(viewport.zoom * 100)}%
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
