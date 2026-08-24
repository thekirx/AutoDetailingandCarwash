/**
 * Ops Lab — leadership suggestions table (plans, roadmaps, solutions, links).
 * Custom types/statuses via Settings; status changes notify all Ops Lab peers; DB audits every action.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ExternalLink, Pencil, Plus, Settings2, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessOpsRoadmap } from '@/auth/permissions'
import {
  boardKindMeta,
  catalogStatusesToOptions,
  catalogTypesToOptions,
  filterSuggestions,
  flattenLabRows,
  itemDocumentHref,
  itemLinkLabel,
  itemStatusMeta,
  newBoardDraft,
  newSuggestionDraft,
  normalizeOpsLabSlug,
  suggestionKindLabel,
} from '@/lib/opsRoadmap'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

async function notifyOpsLab({ event, board, profile, itemTitle, fromStatus, toStatus }) {
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
        item_title: itemTitle || undefined,
        from_status: fromStatus || undefined,
        to_status: toStatus || undefined,
        actor_name: profile?.full_name || 'Teammate',
      }),
    })
  } catch {
    /* best-effort */
  }
}

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function CatalogEditor({
  kind,
  rows,
  onSaved,
  profileId,
}) {
  const [label, setLabel] = useState('')
  const [hint, setHint] = useState('')
  const [badge, setBadge] = useState('outline')
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const table = kind === 'type' ? 'ops_lab_types' : 'ops_lab_statuses'
  const title = kind === 'type' ? 'Types' : 'Statuses'

  function resetForm() {
    setLabel('')
    setHint('')
    setBadge('outline')
    setEditing(null)
  }

  function startEdit(row) {
    setEditing(row)
    setLabel(row.label || '')
    setHint(row.hint || '')
    setBadge(row.badge || 'outline')
  }

  async function save(e) {
    e.preventDefault()
    const trimmed = label.trim()
    if (!trimmed) {
      toast.error(`${kind === 'type' ? 'Type' : 'Status'} name is required`)
      return
    }
    setBusy(true)
    try {
      if (editing) {
        const patch = {
          label: trimmed,
          updated_by: profileId,
          updated_at: new Date().toISOString(),
        }
        if (kind === 'type') patch.hint = hint.trim()
        if (kind === 'status') patch.badge = badge
        const { error } = await supabase.from(table).update(patch).eq('id', editing.id)
        if (error) throw error
        toast.success(`${title.slice(0, -1)} updated`)
      } else {
        const slug = normalizeOpsLabSlug(trimmed)
        if (!slug) {
          toast.error('Could not build a slug from that name')
          return
        }
        const insert = {
          slug,
          label: trimmed,
          sort_order: 100 + (rows?.length || 0) * 10,
          is_system: false,
          created_by: profileId,
          updated_by: profileId,
        }
        if (kind === 'type') insert.hint = hint.trim()
        if (kind === 'status') insert.badge = badge
        const { error } = await supabase.from(table).insert(insert)
        if (error) throw error
        toast.success(`${title.slice(0, -1)} added`)
      }
      resetForm()
      await onSaved()
    } catch (err) {
      toast.error(err.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function archiveOrDelete(row) {
    setBusy(true)
    try {
      if (row.is_system) {
        const { error } = await supabase
          .from(table)
          .update({
            is_archived: !row.is_archived,
            updated_by: profileId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)
        if (error) throw error
        toast.success(row.is_archived ? 'Restored' : 'Hidden from menus')
      } else {
        const { error } = await supabase.from(table).delete().eq('id', row.id)
        if (error) {
          // Fallback: archive if delete blocked / in use
          const { error: archErr } = await supabase
            .from(table)
            .update({ is_archived: true, updated_by: profileId, updated_at: new Date().toISOString() })
            .eq('id', row.id)
          if (archErr) throw error
          toast.success('Hidden from menus')
        } else {
          toast.success('Deleted')
        }
      }
      if (editing?.id === row.id) resetForm()
      await onSaved()
    } catch (err) {
      toast.error(err.message || 'Could not remove')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="grid gap-3 rounded-lg border border-border/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{editing ? `Edit ${kind}` : `Add ${kind}`}</p>
          {editing ? (
            <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
              Cancel edit
            </Button>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`cat-${kind}-label`}>Name</Label>
          <Input
            id={`cat-${kind}-label`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={kind === 'type' ? 'e.g. Pilot' : 'e.g. Blocked'}
          />
        </div>
        {kind === 'type' ? (
          <div className="space-y-1.5">
            <Label htmlFor={`cat-${kind}-hint`}>Hint</Label>
            <Input
              id={`cat-${kind}-hint`}
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Short description"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor={`cat-${kind}-badge`}>Badge style</Label>
            <Select value={badge} onValueChange={setBadge}>
              <SelectTrigger id={`cat-${kind}-badge`} className="w-full cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="outline">Outline</SelectItem>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="secondary">Secondary</SelectItem>
                <SelectItem value="destructive">Destructive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <Button type="submit" disabled={busy} className="w-full sm:w-auto">
          {busy ? 'Saving…' : editing ? 'Save changes' : `Add ${kind}`}
        </Button>
      </form>

      <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
        {(rows || []).map((row) => (
          <li key={row.id} className="flex items-center gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {row.label}
                {row.is_archived ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(hidden)</span>
                ) : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {row.slug}
                {row.is_system ? ' · system' : ''}
                {kind === 'type' && row.hint ? ` · ${row.hint}` : ''}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => startEdit(row)}
              aria-label={`Edit ${row.label}`}
              disabled={busy}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:text-destructive"
              onClick={() => archiveOrDelete(row)}
              aria-label={row.is_system ? `Hide ${row.label}` : `Delete ${row.label}`}
              disabled={busy}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
        {!rows?.length ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">No rows yet.</li>
        ) : null}
      </ul>
    </div>
  )
}

export default function OpsRoadmapPage() {
  const { profile } = useAuth()
  const allowed = canAccessOpsRoadmap(profile)
  const [boards, setBoards] = useState([])
  const [items, setItems] = useState([])
  const [complaints, setComplaints] = useState([])
  const [typeRows, setTypeRows] = useState([])
  const [statusRows, setStatusRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [kindFilter, setKindFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draft, setDraft] = useState({
    title: '',
    notes: '',
    link: '',
    boardKind: 'plan',
    complaintId: '',
  })

  const typeOptions = useMemo(() => catalogTypesToOptions(typeRows), [typeRows])
  const statusOptions = useMemo(() => catalogStatusesToOptions(statusRows), [statusRows])

  const loadCatalog = useCallback(async () => {
    const [typesRes, statusRes] = await Promise.all([
      supabase.from('ops_lab_types').select('*').order('sort_order', { ascending: true }),
      supabase.from('ops_lab_statuses').select('*').order('sort_order', { ascending: true }),
    ])
    if (!typesRes.error) setTypeRows(typesRes.data || [])
    else setTypeRows([])
    if (!statusRes.error) setStatusRows(statusRes.data || [])
    else setStatusRows([])
  }, [])

  const loadBoards = useCallback(async () => {
    const { data, error } = await supabase
      .from('ops_roadmap_boards')
      .select('id, title, board_kind, status, updated_at')
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
    if (error) throw error
    setBoards(data || [])
    return data || []
  }, [])

  const loadItems = useCallback(async (boardRows) => {
    const ids = (boardRows || []).map((b) => b.id)
    if (!ids.length) {
      setItems([])
      return
    }
    const { data, error } = await supabase
      .from('ops_roadmap_items')
      .select('*')
      .in('board_id', ids)
      .order('updated_at', { ascending: false })
    if (error) throw error
    setItems(data || [])
  }, [])

  const loadComplaints = useCallback(async () => {
    const { data, error } = await supabase
      .from('ops_form_submissions')
      .select('id, payload, respondent_label, created_at, ops_forms!inner ( kind, name )')
      .eq('ops_forms.kind', 'complaint')
      .order('created_at', { ascending: false })
      .limit(50)
    if (!error) setComplaints(data || [])
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      await loadCatalog()
      const boardRows = await loadBoards()
      await Promise.all([loadItems(boardRows), loadComplaints()])
    } catch (err) {
      toast.error(err.message || 'Could not load Ops Lab')
    } finally {
      setLoading(false)
    }
  }, [loadCatalog, loadBoards, loadItems, loadComplaints])

  useEffect(() => {
    if (!allowed) return
    reload()
  }, [allowed, reload])

  const rows = useMemo(() => flattenLabRows(items, boards), [items, boards])
  const visibleRows = useMemo(
    () => filterSuggestions(rows, { kind: kindFilter, status: statusFilter, q: query }),
    [rows, kindFilter, statusFilter, query],
  )

  async function ensureBoard(boardKind) {
    const hit = boards.find((b) => b.board_kind === boardKind)
    if (hit) return hit
    const insert = newBoardDraft({
      title: `${boardKindMeta(boardKind, typeOptions).label} list`,
      boardKind,
      createdBy: profile.id,
      allowedKinds: typeOptions,
    })
    const { data, error } = await supabase
      .from('ops_roadmap_boards')
      .insert(insert)
      .select('id, title, board_kind, status, updated_at')
      .maybeSingle()
    if (error) throw error
    setBoards((prev) => [data, ...prev])
    notifyOpsLab({ event: 'board_created', board: data, profile })
    return data
  }

  async function addSuggestion(e) {
    e.preventDefault()
    const title = draft.title.trim()
    if (!title) {
      toast.error('Enter a suggestion title')
      return
    }
    setSaving(true)
    try {
      const board = await ensureBoard(draft.boardKind)
      const complaint = complaints.find((c) => c.id === draft.complaintId)
      const itemDraft = newSuggestionDraft({
        boardId: board.id,
        title,
        body: draft.notes.trim(),
        linkUrl: draft.link.trim(),
        complaintSubmissionId: draft.complaintId || null,
        createdBy: profile.id,
      })
      if (complaint) {
        itemDraft.meta = {
          submission_id: complaint.id,
          complaint_label: `${complaint.respondent_label || 'Guest'} · ${String(complaint.payload?.subject || complaint.payload?.message || '').slice(0, 48)}`,
          respondent_label: complaint.respondent_label || null,
        }
        itemDraft.title = title || `Complaint · ${complaint.respondent_label || 'Guest'}`
      }
      const { data, error } = await supabase.from('ops_roadmap_items').insert(itemDraft).select('*').maybeSingle()
      if (error) throw error
      setItems((prev) => [data, ...prev])
      setDraft({ title: '', notes: '', link: '', boardKind: draft.boardKind, complaintId: '' })
      setAddOpen(false)
      toast.success('Suggestion added')
      notifyOpsLab({
        event: draft.complaintId ? 'complaint_linked' : 'item_created',
        board,
        profile,
        itemTitle: data.title,
      })
    } catch (err) {
      toast.error(err.message || 'Could not add suggestion')
    } finally {
      setSaving(false)
    }
  }

  function onAddOpenChange(open) {
    setAddOpen(open)
    if (open) {
      const defaultKind = typeOptions.some((k) => k.value === 'plan')
        ? 'plan'
        : typeOptions[0]?.value || 'plan'
      setDraft({ title: '', notes: '', link: '', boardKind: defaultKind, complaintId: '' })
    }
  }

  async function patchItem(id, patch, { notifyStatus } = {}) {
    const prev = items.find((r) => r.id === id)
    setItems((list) => list.map((row) => (row.id === id ? { ...row, ...patch } : row)))
    const { error } = await supabase
      .from('ops_roadmap_items')
      .update({ ...patch, updated_by: profile.id, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      toast.error(error.message)
      if (prev) setItems((list) => list.map((row) => (row.id === id ? prev : row)))
      return
    }
    if (notifyStatus && prev && patch.item_status && patch.item_status !== prev.item_status) {
      const board = boards.find((b) => b.id === prev.board_id) || { id: prev.board_id, title: 'Ops Lab', board_kind: prev.board_kind }
      const fromLabel = itemStatusMeta(prev.item_status, statusOptions).label
      const toLabel = itemStatusMeta(patch.item_status, statusOptions).label
      notifyOpsLab({
        event: 'status_changed',
        board,
        profile,
        itemTitle: patch.title || prev.title,
        fromStatus: fromLabel,
        toStatus: toLabel,
      })
    }
  }

  function saveItemField(id, patch) {
    setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  async function commitItemField(id, patch) {
    await patchItem(id, patch)
  }

  async function deleteItem(id) {
    const prev = items.find((r) => r.id === id)
    setItems((list) => list.filter((row) => row.id !== id))
    const { error } = await supabase.from('ops_roadmap_items').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      if (prev) setItems((list) => [prev, ...list])
      return
    }
    if (prev) {
      const board = boards.find((b) => b.id === prev.board_id) || {
        id: prev.board_id,
        title: 'Ops Lab',
        board_kind: 'brainstorm',
      }
      notifyOpsLab({ event: 'item_deleted', board, profile, itemTitle: prev.title })
    }
  }

  if (!allowed) return <Navigate to="/operations/access-denied" replace />

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-ops)] text-2xl font-semibold tracking-tight sm:text-3xl">
            Ops Lab
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Shared suggestions for leadership. Status changes notify everyone with access; every action is audited.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-1.5" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="size-4" />
            Settings
          </Button>
          <Button type="button" className="gap-1.5" onClick={() => onAddOpenChange(true)}>
            <Plus className="size-4" />
            Add suggestion
          </Button>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={onAddOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add suggestion</DialogTitle>
            <DialogDescription>
              Title, type, optional notes, and a link to a document or complaint.
            </DialogDescription>
          </DialogHeader>
          <form id="ops-lab-add-form" onSubmit={addSuggestion} className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="lab-title">Suggestion</Label>
              <Input
                id="lab-title"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="e.g. Standardize tint intake checklist"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lab-type">Type</Label>
              <Select value={draft.boardKind} onValueChange={(v) => setDraft((d) => ({ ...d, boardKind: v }))}>
                <SelectTrigger id="lab-type" className="w-full cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lab-notes">Notes</Label>
              <Textarea
                id="lab-notes"
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                placeholder="Context, owner, or next step"
                rows={3}
                className="min-h-0 resize-y"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lab-link">Document link</Label>
              <Input
                id="lab-link"
                value={draft.link}
                onChange={(e) => setDraft((d) => ({ ...d, link: e.target.value, complaintId: '' }))}
                placeholder="https://… or /operations/…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lab-complaint">Or link complaint</Label>
              <Select
                value={draft.complaintId || 'none'}
                onValueChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    complaintId: v === 'none' ? '' : v,
                    link: v === 'none' ? d.link : '',
                  }))
                }
              >
                <SelectTrigger id="lab-complaint" className="w-full cursor-pointer">
                  <SelectValue placeholder="Pick a complaint (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No complaint</SelectItem>
                  {complaints.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {(c.respondent_label || 'Guest').slice(0, 28)} ·{' '}
                      {String(c.payload?.subject || c.payload?.message || c.id).slice(0, 40)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </form>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="ops-lab-add-form" className="gap-1.5" disabled={saving}>
              <Plus className="size-4" />
              {saving ? 'Saving…' : 'Add suggestion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ops Lab settings</DialogTitle>
            <DialogDescription>
              Customize types and statuses. Changes apply to filters and the add form. Actions are audited for Super Admin.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="types" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="types" className="flex-1">
                Types
              </TabsTrigger>
              <TabsTrigger value="statuses" className="flex-1">
                Statuses
              </TabsTrigger>
            </TabsList>
            <TabsContent value="types" className="mt-4">
              <CatalogEditor kind="type" rows={typeRows} onSaved={loadCatalog} profileId={profile.id} />
            </TabsContent>
            <TabsContent value="statuses" className="mt-4">
              <CatalogEditor kind="status" rows={statusRows} onSaved={loadCatalog} profileId={profile.id} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle>Suggestions</CardTitle>
          <CardDescription>
            {loading ? 'Loading…' : `${visibleRows.length} shown${rows.length !== visibleRows.length ? ` of ${rows.length}` : ''}`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search suggestions…"
              className="sm:max-w-xs"
              aria-label="Search suggestions"
            />
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="w-full cursor-pointer sm:w-40" aria-label="Filter by type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {typeOptions.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full cursor-pointer sm:w-36" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" className="sm:ml-auto" onClick={reload} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[12rem]">Suggestion</TableHead>
                  <TableHead className="w-[7rem]">Type</TableHead>
                  <TableHead className="w-[8rem]">Status</TableHead>
                  <TableHead className="min-w-[10rem]">Link</TableHead>
                  <TableHead className="w-[9rem]">Updated</TableHead>
                  <TableHead className="w-[3rem]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => {
                  const href = itemDocumentHref(row)
                  const linkLabel = itemLinkLabel(row)
                  const statusValue = statusOptions.some((s) => s.value === row.item_status)
                    ? row.item_status
                    : statusOptions[0]?.value || row.item_status || 'open'
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="align-top">
                        <Input
                          value={row.title || ''}
                          onChange={(e) => saveItemField(row.id, { title: e.target.value })}
                          onBlur={(e) => commitItemField(row.id, { title: e.target.value })}
                          className="h-8 border-transparent bg-transparent px-1 font-medium shadow-none focus-visible:border-input focus-visible:bg-background"
                          aria-label="Suggestion title"
                        />
                        <Textarea
                          value={row.body || ''}
                          onChange={(e) => saveItemField(row.id, { body: e.target.value })}
                          onBlur={(e) => commitItemField(row.id, { body: e.target.value })}
                          rows={2}
                          className="mt-1 min-h-0 resize-none border-transparent bg-transparent px-1 text-xs text-muted-foreground shadow-none focus-visible:border-input focus-visible:bg-background"
                          aria-label="Notes"
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline" className="font-normal">
                          {boardKindMeta(row.board_kind, typeOptions).label}
                        </Badge>
                        <p className="mt-1 text-[0.65rem] text-muted-foreground">{suggestionKindLabel(row)}</p>
                      </TableCell>
                      <TableCell className="align-top">
                        <Select
                          value={statusValue}
                          onValueChange={(v) => patchItem(row.id, { item_status: v }, { notifyStatus: true })}
                        >
                          <SelectTrigger className="h-8 w-[7.5rem] cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="align-top">
                        {href ? (
                          href.startsWith('http') ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-[var(--ops-primary)] underline-offset-2 hover:underline"
                            >
                              {linkLabel || 'Open link'}
                              <ExternalLink className="size-3.5 shrink-0 opacity-70" />
                            </a>
                          ) : (
                            <Link
                              to={href}
                              className="inline-flex items-center gap-1 text-sm text-[var(--ops-primary)] underline-offset-2 hover:underline"
                            >
                              {linkLabel || 'Open link'}
                              <ExternalLink className="size-3.5 shrink-0 opacity-70" />
                            </Link>
                          )
                        ) : (
                          <Input
                            value={row.meta?.url || ''}
                            onChange={(e) =>
                              saveItemField(row.id, {
                                kind: e.target.value ? 'form_link' : row.kind,
                                meta: { ...(row.meta || {}), url: e.target.value, form_label: e.target.value },
                              })
                            }
                            onBlur={(e) =>
                              commitItemField(row.id, {
                                kind: e.target.value ? 'form_link' : row.kind,
                                meta: { ...(row.meta || {}), url: e.target.value, form_label: e.target.value },
                              })
                            }
                            placeholder="Paste link"
                            className="h-8 text-xs"
                          />
                        )}
                      </TableCell>
                      <TableCell className="align-top text-xs whitespace-nowrap text-muted-foreground">
                        {formatWhen(row.updated_at)}
                      </TableCell>
                      <TableCell className="align-top">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => deleteItem(row.id)}
                          aria-label="Delete suggestion"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!loading && !visibleRows.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No suggestions yet. Click Add suggestion or loosen your filters.
                    </TableCell>
                  </TableRow>
                )}
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      Loading suggestions…
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            Need customer complaints outside this list?{' '}
            <Link to="/operations/inquiries" className="text-[var(--ops-primary)] underline-offset-2 hover:underline">
              Open inquiries
            </Link>
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
