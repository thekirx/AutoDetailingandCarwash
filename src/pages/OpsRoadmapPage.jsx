/**
 * Shared ops roadmap — Miro-style sticky canvas for SA / ASA / BA / Operations Lead.
 * Desktop: infinite pan/zoom canvas. Mobile: same canvas + stack list toggle.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
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
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessOpsRoadmap } from '@/auth/permissions'
import { createCoalescedReload } from '@/lib/coalesceReload'
import {
  ROADMAP_COLORS,
  ROADMAP_KINDS,
  boardPointFromClient,
  newRoadmapItemDraft,
  normalizeViewport,
  roadmapColor,
  screenToBoardDelta,
} from '@/lib/opsRoadmap'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NamedSelect } from '@/components/ui/named-select'
import { toast } from 'sonner'

function PageHeader() {
  return (
    <header className="mb-4 space-y-1 sm:mb-5">
      <p className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Operations
      </p>
      <h1 className="font-[family-name:var(--font-ops)] text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Roadmap board
      </h1>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Sticky ideas and suggestions shared with Super Admin, ASA, and Branch Admins. Drag to arrange ·
        double-click to edit.
      </p>
    </header>
  )
}

function StickyCard({ item, selected, onSelect, onChange, onDelete, onDragStart }) {
  const palette = roadmapColor(item.color)
  const isHeading = item.kind === 'heading'
  const isFrame = item.kind === 'frame'

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
      className={`absolute touch-none select-none rounded-lg border shadow-sm transition-[box-shadow,transform] ${
        selected ? 'ring-2 ring-[var(--ops-primary)] ring-offset-2' : ''
      } ${isFrame ? 'bg-transparent' : ''}`}
      style={{
        left: item.x,
        top: item.y,
        width: item.w,
        height: item.h,
        zIndex: item.z_index || 1,
        background: isFrame ? `${palette.bg}55` : palette.bg,
        borderColor: palette.border,
        color: palette.ink,
        borderStyle: isFrame ? 'dashed' : 'solid',
        borderWidth: isFrame ? 2 : 1,
      }}
    >
      <div className="flex h-full flex-col gap-1 p-2.5 sm:p-3">
        {isHeading ? (
          <input
            className="w-full bg-transparent text-lg font-semibold outline-none placeholder:opacity-50 sm:text-xl"
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
        {selected ? (
          <div className="mt-auto flex items-center justify-between gap-1 pt-1">
            <div className="flex flex-wrap gap-1">
              {ROADMAP_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  className="size-4 rounded-full border border-black/10"
                  style={{ background: c.bg, outline: item.color === c.value ? `2px solid ${c.border}` : undefined }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange(item.id, { color: c.value })
                  }}
                />
              ))}
            </div>
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
        ) : null}
      </div>
    </div>
  )
}

export default function OpsRoadmapPage() {
  const { profile } = useAuth()
  const [boards, setBoards] = useState([])
  const [boardId, setBoardId] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [viewport, setViewport] = useState(() => normalizeViewport())
  const [viewMode, setViewMode] = useState('canvas') // canvas | stack
  const [newTitle, setNewTitle] = useState('')
  const surfaceRef = useRef(null)
  const dragRef = useRef(null)
  const panRef = useRef(null)
  const saveTimers = useRef(new Map())
  const viewportTimer = useRef(null)

  const allowed = canAccessOpsRoadmap(profile)
  const board = useMemo(() => boards.find((b) => b.id === boardId) || null, [boards, boardId])

  const boardOptions = useMemo(
    () => [
      { value: '', label: boards.length ? 'Select a board' : 'No boards yet' },
      ...boards.map((b) => ({ value: b.id, label: b.title || 'Untitled' })),
    ],
    [boards],
  )

  const loadBoards = useCallback(async () => {
    const { data, error } = await supabase
      .from('ops_roadmap_boards')
      .select('id, title, description, viewport, updated_at, created_by')
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(50)
    if (error) {
      toast.error(error.message)
      return
    }
    setBoards(data || [])
    setBoardId((prev) => prev || data?.[0]?.id || '')
  }, [])

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

  useEffect(() => {
    if (!allowed) return
    setLoading(true)
    loadBoards().finally(() => setLoading(false))
  }, [allowed, loadBoards])

  useEffect(() => {
    if (!boardId) {
      setItems([])
      return
    }
    const b = boards.find((row) => row.id === boardId)
    if (b?.viewport) setViewport(normalizeViewport(b.viewport))
    loadItems(boardId)
  }, [boardId, boards, loadItems])

  useEffect(() => {
    if (!allowed || !boardId) return
    const reload = createCoalescedReload(() => loadItems(boardId), 350)
    const channel = supabase
      .channel(`ops-roadmap-${boardId}`)
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
    const title = String(newTitle || '').trim() || 'Ops roadmap'
    const { data, error } = await supabase
      .from('ops_roadmap_boards')
      .insert({
        title,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select('id, title, description, viewport, updated_at, created_by')
      .maybeSingle()
    if (error) {
      toast.error(error.message)
      return
    }
    setNewTitle('')
    setBoards((rows) => [data, ...rows])
    setBoardId(data.id)
    toast.success('Board created')
  }

  async function renameBoard(title) {
    if (!boardId) return
    const next = String(title || '').trim() || 'Untitled roadmap'
    setBoards((rows) => rows.map((b) => (b.id === boardId ? { ...b, title: next } : b)))
    const { error } = await supabase
      .from('ops_roadmap_boards')
      .update({ title: next, updated_by: profile.id, updated_at: new Date().toISOString() })
      .eq('id', boardId)
    if (error) toast.error(error.message)
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
      const next = normalizeViewport({
        x: panRef.current.vx + dx,
        y: panRef.current.vy + dy,
        zoom: viewport.zoom,
      })
      setViewport(next)
      return
    }
    if (!dragRef.current) return
    const { dx, dy } = screenToBoardDelta(
      e.clientX - dragRef.current.startX,
      e.clientY - dragRef.current.startY,
      viewport.zoom,
    )
    const x = Math.round(dragRef.current.origX + dx)
    const y = Math.round(dragRef.current.origY + dy)
    patchItemLocal(dragRef.current.id, { x, y })
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
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    const next = normalizeViewport({ ...viewport, zoom: viewport.zoom + delta })
    setViewport(next)
    scheduleViewportSave(next)
  }

  function zoomBy(step) {
    const next = normalizeViewport({ ...viewport, zoom: viewport.zoom + step })
    setViewport(next)
    scheduleViewportSave(next)
  }

  function resetView() {
    const next = normalizeViewport({ x: 0, y: 0, zoom: 1 })
    setViewport(next)
    scheduleViewportSave(next)
  }

  if (!allowed) return <Navigate to="/operations/access-denied" replace />

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-3 pb-6 pt-2 sm:px-5 sm:pb-8">
      <PageHeader />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="roadmap-board">
                Board
              </label>
              <NamedSelect
                id="roadmap-board"
                value={boardId}
                onChange={setBoardId}
                options={boardOptions.filter((o) => o.value)}
                emptyLabel={boards.length ? 'Select a board' : 'No boards yet'}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="roadmap-title">
                Board title
              </label>
              <Input
                id="roadmap-title"
                value={board?.title || ''}
                disabled={!board}
                onChange={(e) => renameBoard(e.target.value)}
                placeholder="Name this roadmap"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-[10rem] flex-1 sm:max-w-[14rem]"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="New board name"
            />
            <Button type="button" onClick={createBoard} className="gap-1.5">
              <Plus className="size-4" /> New board
            </Button>
          </div>
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
            <Button type="button" size="sm" variant="outline" onClick={resetView} aria-label="Reset view">
              <Maximize2 className="size-3.5" />
            </Button>
            <span className="hidden tabular-nums text-xs text-muted-foreground sm:inline">
              {Math.round(viewport.zoom * 100)}%
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading boards…</p>
      ) : !boardId ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">Create a board to start brainstorming improvements.</p>
        </div>
      ) : viewMode === 'stack' ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.length === 0 ? (
            <li className="col-span-full rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              No stickies yet — add one above.
            </li>
          ) : (
            items.map((item) => {
              const palette = roadmapColor(item.color)
              return (
                <li
                  key={item.id}
                  className="rounded-xl border p-3 shadow-sm"
                  style={{ background: palette.bg, borderColor: palette.border, color: palette.ink }}
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
          className="relative h-[min(70vh,720px)] overflow-hidden rounded-xl border border-border bg-[radial-gradient(circle_at_1px_1px,#d4d4d8_1px,transparent_0)] [background-size:24px_24px] [background-color:var(--ops-page)] touch-none"
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
              />
            ))}
          </div>
          <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-background/80 px-2 py-1 text-[0.65rem] text-muted-foreground backdrop-blur sm:text-xs">
            Drag stickies · Alt-drag or middle-click to pan · Ctrl/⌘+scroll to zoom
          </p>
        </div>
      )}
    </div>
  )
}
