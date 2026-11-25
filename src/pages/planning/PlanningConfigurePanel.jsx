import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Columns3,
  Globe,
  ListChecks,
  Lock,
  Plus,
  RotateCcw,
  Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ConfirmDialog from '@/components/ops/ConfirmDialog'
import { supabase } from '@/lib/supabase'
import {
  DEFAULT_PLAN_LISTS,
  PLANNER_SWATCHES,
  describeBoardVisibility,
  listCardCount,
  nextPlanListPosition,
  plannerBoardNameError,
  plannerSwatchValue,
  reorderPlanRows,
} from '@/lib/plannerBoard'
import {
  PLANNER_MANAGEMENT_ROLES,
  PLAN_CATEGORY_ROLE_OPTIONS,
  formatRoleLabels,
  normalizeVisibleRoles,
  roleLabelForId,
} from '@/lib/planCategoryRoles'
import { toast } from 'sonner'
import '@/styles/plannerConfigure.css'

const SWATCH_NAMES = ['Hakum Navy', 'Deep Ink', 'Brass Gold', 'Slate', 'Steel']

function swatchLabel(hex) {
  const idx = PLANNER_SWATCHES.findIndex((s) => s.toLowerCase() === String(hex || '').toLowerCase())
  return idx >= 0 && SWATCH_NAMES[idx] ? SWATCH_NAMES[idx] : String(hex || '').toUpperCase()
}

function sameRoleSet(a = [], b = []) {
  const left = normalizeVisibleRoles(a)
  const right = normalizeVisibleRoles(b)
  if (left.length !== right.length) return false
  const set = new Set(left)
  return right.every((id) => set.has(id))
}

function Section({ id, eyebrow, badge, title, hint, headerAction, children }) {
  return (
    <section id={id} className="planner-ticket planner-config-card rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">{eyebrow}</p>
            {badge}
          </div>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{title}</h2>
          {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Swatches({ value, onChange, disabled, previewName }) {
  const hex = plannerSwatchValue(value)
  const label = swatchLabel(hex)
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Color: <strong className="font-semibold text-foreground">{label}</strong>
        </span>
        <span className="planner-config-cat-preview">
          <i className="size-2.5 rounded-full" style={{ background: hex }} />
          {previewName?.trim() || 'Category preview'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {PLANNER_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            disabled={disabled}
            onClick={() => onChange(swatch)}
            className={`planner-swatch ${hex.toLowerCase() === swatch.toLowerCase() ? 'is-on' : ''}`}
            style={{ background: swatch }}
            aria-label={`Color ${swatchLabel(swatch)}`}
            aria-pressed={hex.toLowerCase() === swatch.toLowerCase()}
          />
        ))}
        <Input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="planner-color-input cursor-pointer"
          aria-label="Custom color"
        />
      </div>
    </div>
  )
}

function RoleChecks({
  mode = 'all',
  onModeChange,
  value = [],
  onChange,
  viewerRole,
  guardSelfAccess = false,
  legacyInfo,
  onUseLegacyDefault,
  subjectLabel = 'this item',
  disabled = false,
}) {
  const selected = normalizeVisibleRoles(value)
  const selectedLabels = formatRoleLabels(selected)
  const selfHidden = guardSelfAccess && mode === 'selected' && viewerRole && !selected.includes(viewerRole)

  const toggleRole = (roleId) => {
    if (disabled) return
    onChange(selected.includes(roleId) ? selected.filter((x) => x !== roleId) : [...selected, roleId])
  }

  return (
    <div className="planner-role-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Who can see {subjectLabel}
        </span>
        <div className="planner-access-switch" role="group" aria-label={`Access mode for ${subjectLabel}`}>
          <button
            type="button"
            disabled={disabled}
            aria-pressed={mode === 'all'}
            className={`planner-access-btn ${mode === 'all' ? 'is-on' : ''}`}
            onClick={() => onModeChange('all')}
          >
            <Globe className="size-3.5" />
            {legacyInfo?.isLegacyDefault ? 'Default rule' : 'Everyone'}
          </button>
          <button
            type="button"
            disabled={disabled}
            aria-pressed={mode === 'selected'}
            className={`planner-access-btn ${mode === 'selected' ? 'is-on' : ''}`}
            onClick={() => onModeChange('selected')}
          >
            <Lock className="size-3.5" />
            Specific roles
          </button>
        </div>
      </div>

      {mode === 'all' ? (
        legacyInfo?.isLegacyDefault ? (
          <div className="planner-role-summary is-legacy">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 text-xs leading-relaxed">
                <strong className="block font-semibold text-foreground">
                  Cash Advance default rule active ({legacyInfo.effectiveRoleIds.length} roles allowed)
                </strong>
                <p className="mt-1 text-muted-foreground">
                  Visible to:{' '}
                  <span className="font-medium text-foreground">
                    {formatRoleLabels(legacyInfo.effectiveRoleIds).join(', ')}
                  </span>
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  Hidden from: {formatRoleLabels(legacyInfo.hiddenRoleIds).join(', ')}
                </p>
              </div>
              {onUseLegacyDefault ? (
                <Button type="button" size="sm" variant="outline" onClick={onUseLegacyDefault}>
                  Customize roles
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="planner-role-summary is-open">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-900">
              <Check className="size-4 shrink-0 text-emerald-700" />
              <span>Visible to all {PLAN_CATEGORY_ROLE_OPTIONS.length} planner roles</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PLAN_CATEGORY_ROLE_OPTIONS.map((opt) => (
                <span key={opt.id} className="planner-role-readonly-pill">
                  {opt.label}
                </span>
              ))}
            </div>
          </div>
        )
      ) : (
        <div className="grid gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              className="h-8 px-2.5 text-xs"
              onClick={() => onChange(PLAN_CATEGORY_ROLE_OPTIONS.map((r) => r.id))}
            >
              Select all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              className="h-8 px-2.5 text-xs"
              onClick={() =>
                onChange(
                  normalizeVisibleRoles(
                    viewerRole ? [...PLANNER_MANAGEMENT_ROLES, viewerRole] : PLANNER_MANAGEMENT_ROLES,
                  ),
                )
              }
            >
              Management
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              className="h-8 px-2.5 text-xs"
              onClick={() => onChange([])}
            >
              Clear
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {PLAN_CATEGORY_ROLE_OPTIONS.map((opt) => {
              const checked = selected.includes(opt.id)
              return (
                <label
                  key={opt.id}
                  className={`planner-role-chip ${checked ? 'is-checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={checked}
                    onChange={() => toggleRole(opt.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                </label>
              )
            })}
          </div>

          {selected.length === 0 ? (
            <p className="planner-role-warn text-xs">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span>Pick at least 1 role, or switch access to Everyone.</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Selected ({selected.length}):{' '}
              <strong className="font-medium text-foreground">{selectedLabels.join(', ')}</strong>
            </p>
          )}

          {selfHidden ? (
            <div className="planner-role-warn flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 shrink-0" />
                Your role ({roleLabelForId(viewerRole)}) isn&apos;t checked — saving hides this board from you.
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 bg-background px-2.5 text-xs"
                onClick={() => toggleRole(viewerRole)}
              >
                Include {roleLabelForId(viewerRole)}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default function PlanningConfigurePanel({
  boards = [],
  board,
  lists = [],
  categories = [],
  templates = [],
  canEdit,
  viewerRole,
  onChanged,
  onSelectBoard,
}) {
  const [boardName, setBoardName] = useState('')
  const [boardAccessMode, setBoardAccessMode] = useState('all')
  const [boardRoles, setBoardRoles] = useState([])
  const [savingBoard, setSavingBoard] = useState(false)

  const [newBoardName, setNewBoardName] = useState('')
  const [newBoardAccessMode, setNewBoardAccessMode] = useState('all')
  const [newBoardRoles, setNewBoardRoles] = useState([])
  const [creatingBoard, setCreatingBoard] = useState(false)

  const [listTitle, setListTitle] = useState('')
  const [editingListId, setEditingListId] = useState(null)
  const [editListTitle, setEditListTitle] = useState('')

  const [showAddCategory, setShowAddCategory] = useState(() => categories.length === 0)
  const [catName, setCatName] = useState('')
  const [catColor, setCatColor] = useState('var(--color-brand-primary)')
  const [catAccessMode, setCatAccessMode] = useState('all')
  const [catRoles, setCatRoles] = useState([])
  const [editingCatId, setEditingCatId] = useState(null)
  const [editCatName, setEditCatName] = useState('')
  const [editCatColor, setEditCatColor] = useState('var(--color-brand-primary)')
  const [editCatAccessMode, setEditCatAccessMode] = useState('all')
  const [editCatRoles, setEditCatRoles] = useState([])

  const [showAddTemplate, setShowAddTemplate] = useState(() => templates.length === 0)
  const [tmplName, setTmplName] = useState('')
  const [tmplItems, setTmplItems] = useState('')
  const [editingTmplId, setEditingTmplId] = useState(null)
  const [editTmplName, setEditTmplName] = useState('')
  const [editTmplItems, setEditTmplItems] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deletingConfig, setDeletingConfig] = useState(false)

  const savedVisibility = useMemo(
    () => describeBoardVisibility(board, PLAN_CATEGORY_ROLE_OPTIONS),
    [board],
  )

  useEffect(() => {
    const savedRoles = normalizeVisibleRoles(board?.visible_roles || [])
    setBoardName(board?.name || '')
    setBoardRoles(savedRoles)
    setBoardAccessMode(savedRoles.length > 0 ? 'selected' : 'all')
    setListTitle('')
    setEditingListId(null)
  }, [board?.id, board?.name, board?.visible_roles])

  const savedBoardRoles = useMemo(() => normalizeVisibleRoles(board?.visible_roles || []), [board?.visible_roles])
  const trimmedBoardName = boardName.trim()
  const liveNameError = trimmedBoardName ? plannerBoardNameError(trimmedBoardName) : 'Name is required'
  const draftVisibleRoles = boardAccessMode === 'selected' ? normalizeVisibleRoles(boardRoles) : []
  const isBoardDirty = Boolean(
    board?.id &&
      (trimmedBoardName !== String(board?.name || '').trim() ||
        boardAccessMode !== (savedBoardRoles.length > 0 ? 'selected' : 'all') ||
        (boardAccessMode === 'selected' && !sameRoleSet(draftVisibleRoles, savedBoardRoles))),
  )

  const totalTasksOnBoard = useMemo(
    () => lists.reduce((n, list) => n + listCardCount(list), 0),
    [lists],
  )

  if (!canEdit) {
    return (
      <div className="planner-empty">
        <strong>Configure is for planners</strong>
        <p>Ask an admin if lists or categories need changing.</p>
      </div>
    )
  }

  function resetBoardDraft() {
    setBoardName(board?.name || '')
    setBoardRoles(savedBoardRoles)
    setBoardAccessMode(savedBoardRoles.length > 0 ? 'selected' : 'all')
  }

  function handleBoardModeChange(nextMode) {
    setBoardAccessMode(nextMode)
    if (nextMode === 'selected' && normalizeVisibleRoles(boardRoles).length === 0) {
      if (savedVisibility.isLegacyDefault) {
        setBoardRoles(savedVisibility.effectiveRoleIds)
      } else if (viewerRole) {
        setBoardRoles([viewerRole])
      }
    }
  }

  async function renameBoard(e) {
    e.preventDefault()
    if (!board?.id || savingBoard) return
    const err = plannerBoardNameError(trimmedBoardName)
    if (err) return toast.error(err)
    if (boardAccessMode === 'selected' && draftVisibleRoles.length === 0) {
      return toast.error('Pick at least one role, or switch access to Everyone.')
    }
    setSavingBoard(true)
    const { error } = await supabase
      .from('plan_boards')
      .update({
        name: trimmedBoardName,
        visible_roles: draftVisibleRoles,
        updated_at: new Date().toISOString(),
      })
      .eq('id', board.id)
    setSavingBoard(false)
    if (error) return toast.error(error.message)
    toast.success('Board settings saved')
    onChanged()
  }

  async function createBoard(e) {
    e.preventDefault()
    if (creatingBoard) return
    const err = plannerBoardNameError(newBoardName)
    if (err) return toast.error(err)
    const initialRoles = newBoardAccessMode === 'selected' ? normalizeVisibleRoles(newBoardRoles) : []
    if (newBoardAccessMode === 'selected' && initialRoles.length === 0) {
      return toast.error('Pick at least one role, or switch new board access to Everyone.')
    }
    setCreatingBoard(true)
    const { data, error } = await supabase
      .from('plan_boards')
      .insert({ name: newBoardName.trim(), visible_roles: initialRoles })
      .select('id, name')
      .single()
    if (error) {
      setCreatingBoard(false)
      return toast.error(error.message)
    }
    const { error: listErr } = await supabase.from('plan_lists').insert(
      DEFAULT_PLAN_LISTS.map((row) => ({ board_id: data.id, title: row.title, position: row.position })),
    )
    if (listErr) {
      await supabase.from('plan_boards').delete().eq('id', data.id)
      setCreatingBoard(false)
      return toast.error(listErr.message)
    }
    setCreatingBoard(false)
    toast.success('Board created')
    setNewBoardName('')
    setNewBoardAccessMode('all')
    setNewBoardRoles([])
    onSelectBoard?.(data.id)
    onChanged()
  }

  function removeBoard() {
    if (!board?.id) return
    if (boards.length < 2) return toast.error('Keep at least one board.')
    if (totalTasksOnBoard) return toast.error('Move or delete tasks on this board first.')
    setConfirmDelete({
      kind: 'board',
      id: board.id,
      title: `Delete board “${board.name}”?`,
      description: 'Lists on this board will also be deleted.',
    })
  }

  async function addList(e) {
    e.preventDefault()
    if (!board?.id || !listTitle.trim()) return
    const { error } = await supabase.from('plan_lists').insert({
      board_id: board.id,
      title: listTitle.trim(),
      position: nextPlanListPosition(lists),
    })
    if (error) return toast.error(error.message)
    toast.success('List added')
    setListTitle('')
    onChanged()
  }

  async function saveList(e) {
    e.preventDefault()
    if (!editingListId || !editListTitle.trim()) return
    const { error } = await supabase.from('plan_lists').update({ title: editListTitle.trim() }).eq('id', editingListId)
    if (error) return toast.error(error.message)
    toast.success('List saved')
    setEditingListId(null)
    onChanged()
  }

  async function moveList(list, dir) {
    const patch = reorderPlanRows(lists, list.id, dir)
    if (!patch.length) return
    const results = await Promise.all(
      patch.map((row) => supabase.from('plan_lists').update({ position: row.position }).eq('id', row.id)),
    )
    const err = results.find((row) => row.error)?.error
    if (err) return toast.error(err.message)
    onChanged()
  }

  function removeList(list) {
    if (lists.length < 2) return toast.error('Keep at least one list on this board.')
    const n = listCardCount(list)
    setConfirmDelete({
      kind: 'list',
      id: list.id,
      title: `Delete list “${list.title}”?`,
      description: n ? `That also deletes ${n} task${n === 1 ? '' : 's'} on it.` : 'This empty list will be deleted.',
    })
  }

  async function addCategory(e) {
    e.preventDefault()
    if (!catName.trim()) return
    const nextRoles = catAccessMode === 'selected' ? normalizeVisibleRoles(catRoles) : []
    if (catAccessMode === 'selected' && nextRoles.length === 0) {
      return toast.error('Pick at least one role, or switch access to Everyone.')
    }
    const { error } = await supabase.from('plan_categories').insert({
      name: catName.trim(),
      color: catColor,
      position: nextPlanListPosition(categories),
      visible_roles: nextRoles,
    })
    if (error) return toast.error(error.message)
    toast.success('Category added')
    setCatName('')
    setCatColor('var(--color-brand-primary)')
    setCatAccessMode('all')
    setCatRoles([])
    setShowAddCategory(false)
    onChanged()
  }

  async function saveCategory(e) {
    e.preventDefault()
    if (!editingCatId || !editCatName.trim()) return
    const nextRoles = editCatAccessMode === 'selected' ? normalizeVisibleRoles(editCatRoles) : []
    if (editCatAccessMode === 'selected' && nextRoles.length === 0) {
      return toast.error('Pick at least one role, or switch access to Everyone.')
    }
    const { error } = await supabase
      .from('plan_categories')
      .update({
        name: editCatName.trim(),
        color: editCatColor,
        visible_roles: nextRoles,
      })
      .eq('id', editingCatId)
    if (error) return toast.error(error.message)
    toast.success('Category saved')
    setEditingCatId(null)
    onChanged()
  }

  function removeCategory(id) {
    setConfirmDelete({
      kind: 'category',
      id,
      title: 'Delete this category?',
      description: 'Tasks stay, uncategorized.',
    })
  }

  async function addTemplate(e) {
    e.preventDefault()
    const titles = tmplItems.split('\n').map((s) => s.trim()).filter(Boolean)
    if (!tmplName.trim() || !titles.length) return toast.error('Name and at least one checklist line required')
    const { data, error } = await supabase
      .from('plan_checklist_templates')
      .insert({ name: tmplName.trim(), position: nextPlanListPosition(templates) })
      .select('id')
      .single()
    if (error) return toast.error(error.message)
    const { error: itemErr } = await supabase.from('plan_checklist_template_items').insert(
      titles.map((title, i) => ({ template_id: data.id, title, position: i })),
    )
    if (itemErr) return toast.error(itemErr.message)
    toast.success('Checklist template saved')
    setTmplName('')
    setTmplItems('')
    setShowAddTemplate(false)
    onChanged()
  }

  async function saveTemplate(e) {
    e.preventDefault()
    const titles = editTmplItems.split('\n').map((s) => s.trim()).filter(Boolean)
    if (!editingTmplId || !editTmplName.trim() || !titles.length) {
      return toast.error('Name and at least one checklist line required')
    }
    const { error } = await supabase.from('plan_checklist_templates').update({ name: editTmplName.trim() }).eq('id', editingTmplId)
    if (error) return toast.error(error.message)
    const { error: delErr } = await supabase.from('plan_checklist_template_items').delete().eq('template_id', editingTmplId)
    if (delErr) return toast.error(delErr.message)
    const { error: itemErr } = await supabase.from('plan_checklist_template_items').insert(
      titles.map((title, i) => ({ template_id: editingTmplId, title, position: i })),
    )
    if (itemErr) return toast.error(itemErr.message)
    toast.success('Template saved')
    setEditingTmplId(null)
    onChanged()
  }

  function removeTemplate(id) {
    setConfirmDelete({
      kind: 'template',
      id,
      title: 'Delete this checklist template?',
      description: 'Existing tasks with copied checklist items stay intact.',
    })
  }

  async function executeConfirmDelete() {
    if (!confirmDelete || deletingConfig) return
    setDeletingConfig(true)
    try {
      if (confirmDelete.kind === 'board') {
        const { error } = await supabase.from('plan_boards').delete().eq('id', confirmDelete.id)
        if (error) return toast.error(error.message)
        toast.success('Board deleted')
        const next = boards.find((b) => b.id !== confirmDelete.id)
        if (next) onSelectBoard?.(next.id)
      } else if (confirmDelete.kind === 'list') {
        const { error } = await supabase.from('plan_lists').delete().eq('id', confirmDelete.id)
        if (error) return toast.error(error.message)
        toast.success('List deleted')
      } else if (confirmDelete.kind === 'category') {
        const { error } = await supabase.from('plan_categories').delete().eq('id', confirmDelete.id)
        if (error) return toast.error(error.message)
        toast.success('Category deleted')
        if (editingCatId === confirmDelete.id) setEditingCatId(null)
      } else if (confirmDelete.kind === 'template') {
        const { error } = await supabase.from('plan_checklist_templates').delete().eq('id', confirmDelete.id)
        if (error) return toast.error(error.message)
        toast.success('Template deleted')
        if (editingTmplId === confirmDelete.id) setEditingTmplId(null)
      }
      setConfirmDelete(null)
      onChanged()
    } finally {
      setDeletingConfig(false)
    }
  }

  function jumpTo(sectionId) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const savedAccessSummaryText = savedVisibility.isLegacyDefault
    ? `Default Cash Advance rule · ${savedVisibility.effectiveRoleIds.length} roles`
    : savedVisibility.mode === 'selected' || savedVisibility.mode === 'custom'
      ? `Restricted · ${formatRoleLabels(savedVisibility.effectiveRoleIds).join(', ')}`
      : 'Everyone in Planner (all 10 roles)'

  const deleteBlockedReason =
    boards.length < 2
      ? 'Keep at least one board.'
      : totalTasksOnBoard > 0
        ? `Move or delete ${totalTasksOnBoard} task${totalTasksOnBoard === 1 ? '' : 's'} first.`
        : ''

  const parsedNewTemplateCount = tmplItems.split('\n').map((s) => s.trim()).filter(Boolean).length

  return (
    <div className="planner-configure">
      <div className="planner-config-hero planner-ticket rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">Workspace Settings</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              {board?.name || 'Select a board'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Switch boards below to inspect live visibility and columns, or update shop-wide categories and checklists.
            </p>
          </div>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => jumpTo('cfg-new-board')}>
            <Plus className="size-4" />
            New board
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Switch board to configure">
          {boards.map((b) => {
            const active = b.id === board?.id
            const vis = describeBoardVisibility(b, PLAN_CATEGORY_ROLE_OPTIONS)
            return (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`planner-board-pill ${active ? 'is-on' : ''}`}
                onClick={() => onSelectBoard?.(b.id)}
              >
                <span className="font-semibold">{b.name}</span>
                <span className="planner-board-pill-meta">
                  {vis.isLegacyDefault
                    ? 'Default rule'
                    : vis.mode === 'custom'
                      ? `${vis.effectiveRoleIds.length} roles`
                      : 'Everyone'}
                </span>
              </button>
            )
          })}
        </div>

        <div className="planner-config-snapshot mt-4">
          <div className="planner-config-stat">
            <span className="planner-config-stat-label">Active board</span>
            <strong className="planner-config-stat-value">
              {board?.name || 'None'} · {totalTasksOnBoard} task{totalTasksOnBoard === 1 ? '' : 's'}
            </strong>
          </div>
          <div className="planner-config-stat">
            <span className="planner-config-stat-label">Saved access</span>
            <strong className="planner-config-stat-value">{savedAccessSummaryText}</strong>
          </div>
          <div className="planner-config-stat">
            <span className="planner-config-stat-label">Columns on board</span>
            <strong className="planner-config-stat-value">
              {lists.length} list{lists.length === 1 ? '' : 's'}
              {lists.length ? `: ${lists.map((l) => l.title).join(' → ')}` : ''}
            </strong>
          </div>
          <div className="planner-config-stat">
            <span className="planner-config-stat-label">Shop-wide library</span>
            <strong className="planner-config-stat-value">
              {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} · {templates.length} checklist{templates.length === 1 ? '' : 's'}
            </strong>
          </div>
        </div>

        <nav className="mt-3 flex flex-wrap gap-1.5 border-t border-border/70 pt-3" aria-label="Configure sections">
          <button type="button" className="planner-jump-pill" onClick={() => jumpTo('cfg-board')}>
            Board &amp; access
          </button>
          <button type="button" className="planner-jump-pill" onClick={() => jumpTo('cfg-lists')}>
            Lists ({lists.length})
          </button>
          <button type="button" className="planner-jump-pill" onClick={() => jumpTo('cfg-categories')}>
            Categories ({categories.length})
          </button>
          <button type="button" className="planner-jump-pill" onClick={() => jumpTo('cfg-templates')}>
            Checklists ({templates.length})
          </button>
        </nav>
      </div>

      <div className="planner-configure-grid">
        <div className="grid content-start gap-4">
          <Section
            id="cfg-board"
            eyebrow="This board"
            title={board?.name || 'No board selected'}
            badge={
              isBoardDirty ? (
                <span className="planner-status-pill is-dirty">Unsaved changes</span>
              ) : (
                <span className="planner-status-pill is-saved">
                  {savedVisibility.mode === 'custom'
                    ? `Saved · ${savedVisibility.effectiveRoleIds.length} roles`
                    : savedVisibility.isLegacyDefault
                      ? 'Saved · Cash Advance rule'
                      : 'Saved · Everyone'}
                </span>
              )
            }
            hint="Settings here apply only to the selected board. Lists are the columns on it, and access controls who sees this workspace."
          >
            <form onSubmit={renameBoard} className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(11rem,0.44fr)_minmax(0,0.56fr)]">
                <label className="planner-configure-field">
                  Switch Board
                  <select value={board?.id || ''} onChange={(e) => onSelectBoard?.(e.target.value)} aria-label="Board">
                    {boards.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="planner-configure-field">
                  Board Name
                  <Input
                    value={boardName}
                    onChange={(e) => setBoardName(e.target.value)}
                    placeholder="Board name"
                    aria-label="Board name"
                  />
                </label>
              </div>

              {liveNameError && trimmedBoardName !== String(board?.name || '').trim() ? (
                <p className="text-xs font-medium text-destructive">{liveNameError}</p>
              ) : null}

              <RoleChecks
                mode={boardAccessMode}
                onModeChange={handleBoardModeChange}
                value={boardRoles}
                onChange={setBoardRoles}
                viewerRole={viewerRole}
                guardSelfAccess
                legacyInfo={savedVisibility}
                onUseLegacyDefault={() => {
                  setBoardAccessMode('selected')
                  setBoardRoles(savedVisibility.effectiveRoleIds)
                }}
                subjectLabel={board?.name ? `“${board.name}”` : 'this board'}
                disabled={!board?.id || savingBoard}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="submit"
                    className="min-h-11"
                    disabled={!board?.id || savingBoard || !isBoardDirty}
                  >
                    {savingBoard ? 'Saving...' : 'Save board'}
                  </Button>
                  {isBoardDirty ? (
                    <Button type="button" variant="outline" className="min-h-11" onClick={resetBoardDraft}>
                      <RotateCcw className="size-4" />
                      Reset
                    </Button>
                  ) : null}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 text-destructive"
                  onClick={removeBoard}
                  disabled={!board?.id}
                >
                  Delete board
                </Button>
              </div>
              {deleteBlockedReason ? (
                <p className="text-xs text-muted-foreground">To delete this board: {deleteBlockedReason}</p>
              ) : null}
            </form>
          </Section>

          <Section
            id="cfg-lists"
            eyebrow="Columns on this board"
            title={`Lists (${lists.length})`}
            badge={
              <span className="planner-status-pill is-neutral">
                <Columns3 className="size-3" /> {totalTasksOnBoard} total tasks
              </span>
            }
            hint="These are the horizontal LIST columns (Upcoming, In Progress, Done…). Task progress — To do, In progress, For review, Done — stays fixed so photo proof still works."
          >
            <form onSubmit={addList} className="flex flex-col gap-2 sm:flex-row">
              <Input
                required
                value={listTitle}
                onChange={(e) => setListTitle(e.target.value)}
                placeholder="New list (e.g. Waiting Parts)"
              />
              <Button type="submit" className="min-h-11 shrink-0" disabled={!board?.id}>
                Add list
              </Button>
            </form>

            <ul className="mt-3 space-y-2">
              {lists.map((list, index) => {
                const count = listCardCount(list)
                return (
                  <li key={list.id} className="rounded-xl border border-border bg-background/50 px-3 py-2">
                    {editingListId === list.id ? (
                      <form onSubmit={saveList} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input required value={editListTitle} onChange={(e) => setEditListTitle(e.target.value)} />
                        <div className="flex gap-1.5">
                          <Button type="submit" size="sm" className="min-h-11">
                            Save
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={() => setEditingListId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-[10rem] flex-1 items-center gap-2.5">
                          <span className="planner-list-order">{index + 1}</span>
                          <span className="min-w-0 text-sm font-medium text-foreground">
                            {list.title}
                            <span className="ml-2 text-xs font-normal whitespace-nowrap text-muted-foreground">
                              {count} task{count === 1 ? '' : 's'}
                            </span>
                          </span>
                        </div>
                        <div className="ml-auto flex items-center gap-0.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="size-11 p-0"
                            disabled={index === 0}
                            onClick={() => moveList(list, -1)}
                            aria-label="Move list up"
                          >
                            <ChevronUp size={16} />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="size-11 p-0"
                            disabled={index === lists.length - 1}
                            onClick={() => moveList(list, 1)}
                            aria-label="Move list down"
                          >
                            <ChevronDown size={16} />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="min-h-11"
                            onClick={() => {
                              setEditingListId(list.id)
                              setEditListTitle(list.title)
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="min-h-11 text-destructive"
                            disabled={lists.length < 2}
                            onClick={() => removeList(list)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
              {!lists.length && (
                <li className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                  No lists yet. Add one so tasks have a column.
                </li>
              )}
            </ul>
          </Section>
        </div>

        <div className="grid content-start gap-4">
          <Section
            id="cfg-categories"
            eyebrow="Shop-wide library"
            title={`Categories (${categories.length})`}
            badge={
              <span className="planner-status-pill is-neutral">
                <Tag className="size-3" /> Shared across boards
              </span>
            }
            hint="Pick color labels and which roles see each category. Deleting leaves tasks uncategorized."
            headerAction={
              <Button
                type="button"
                size="sm"
                variant={showAddCategory ? 'secondary' : 'outline'}
                className="min-h-11"
                onClick={() => setShowAddCategory((open) => !open)}
              >
                <Plus className="size-4" />
                {showAddCategory ? 'Close form' : 'New category'}
              </Button>
            }
          >
            {showAddCategory ? (
              <form onSubmit={addCategory} className="planner-config-subform mb-4 grid gap-3 rounded-xl border border-border bg-background/70 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Create category</p>
                <Input
                  required
                  placeholder="Category name (e.g. Ceramic Prep, Equipment)"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                />
                <Swatches value={catColor} onChange={setCatColor} previewName={catName} />
                <RoleChecks
                  mode={catAccessMode}
                  onModeChange={(nextMode) => {
                    setCatAccessMode(nextMode)
                    if (nextMode === 'selected' && normalizeVisibleRoles(catRoles).length === 0 && viewerRole) {
                      setCatRoles([viewerRole])
                    }
                  }}
                  value={catRoles}
                  onChange={setCatRoles}
                  subjectLabel="this category"
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" className="min-h-11">
                    Add category
                  </Button>
                  <Button type="button" variant="ghost" className="min-h-11" onClick={() => setShowAddCategory(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : null}

            <ul className="space-y-2">
              {categories.map((c) => {
                const roles = normalizeVisibleRoles(c.visible_roles || [])
                const roleLabels = formatRoleLabels(roles)
                return (
                  <li key={c.id} className="rounded-xl border border-border bg-background/50 px-3 py-2.5">
                    {editingCatId === c.id ? (
                      <form onSubmit={saveCategory} className="grid gap-3">
                        <Input required value={editCatName} onChange={(e) => setEditCatName(e.target.value)} />
                        <Swatches value={editCatColor} onChange={setEditCatColor} previewName={editCatName} />
                        <RoleChecks
                          mode={editCatAccessMode}
                          onModeChange={(nextMode) => {
                            setEditCatAccessMode(nextMode)
                            if (
                              nextMode === 'selected' &&
                              normalizeVisibleRoles(editCatRoles).length === 0 &&
                              viewerRole
                            ) {
                              setEditCatRoles([viewerRole])
                            }
                          }}
                          value={editCatRoles}
                          onChange={setEditCatRoles}
                          subjectLabel={`“${editCatName || c.name}”`}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" size="sm" className="min-h-11">
                            Save
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={() => setEditingCatId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
                        <span className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                          <span className="flex items-center gap-2 font-medium text-foreground">
                            <i className="size-3 shrink-0 rounded-full border border-black/10" style={{ background: c.color }} />
                            <span className="truncate">{c.name}</span>
                          </span>
                          <span className="flex flex-wrap items-center gap-1.5 text-xs">
                            {roleLabels.length ? (
                              <span className="planner-status-pill is-restricted">
                                Roles: {roleLabels.join(', ')}
                              </span>
                            ) : (
                              <span className="planner-status-pill is-saved">Visible to everyone</span>
                            )}
                          </span>
                        </span>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="min-h-11"
                            onClick={() => {
                              const currentRoles = normalizeVisibleRoles(c.visible_roles || [])
                              setEditingCatId(c.id)
                              setEditCatName(c.name)
                              setEditCatColor(c.color || 'var(--color-brand-primary)')
                              setEditCatRoles(currentRoles)
                              setEditCatAccessMode(currentRoles.length > 0 ? 'selected' : 'all')
                            }}
                          >
                            Edit
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="min-h-11 text-destructive" onClick={() => removeCategory(c.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
              {!categories.length && <li className="text-sm text-muted-foreground">No categories yet.</li>}
            </ul>
          </Section>

          <Section
            id="cfg-templates"
            eyebrow="Shop-wide library"
            title={`Checklist templates (${templates.length})`}
            badge={
              <span className="planner-status-pill is-neutral">
                <ListChecks className="size-3" /> Task presets
              </span>
            }
            hint="Reusable step-by-step checklists staff can insert when creating a task."
            headerAction={
              <Button
                type="button"
                size="sm"
                variant={showAddTemplate ? 'secondary' : 'outline'}
                className="min-h-11"
                onClick={() => setShowAddTemplate((open) => !open)}
              >
                <Plus className="size-4" />
                {showAddTemplate ? 'Close form' : 'New checklist'}
              </Button>
            }
          >
            {showAddTemplate ? (
              <form onSubmit={addTemplate} className="planner-config-subform mb-4 grid gap-2.5 rounded-xl border border-border bg-background/70 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Create checklist</p>
                  <span className="text-xs text-muted-foreground">
                    {parsedNewTemplateCount} step{parsedNewTemplateCount === 1 ? '' : 's'}
                  </span>
                </div>
                <Input required placeholder="Template name (e.g. Bay Opening Prep)" value={tmplName} onChange={(e) => setTmplName(e.target.value)} />
                <textarea
                  required
                  className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  placeholder={'One checklist step per line\nInspect foam cannon pressure\nCheck microfiber towels'}
                  value={tmplItems}
                  onChange={(e) => setTmplItems(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" className="min-h-11">
                    Save template
                  </Button>
                  <Button type="button" variant="ghost" className="min-h-11" onClick={() => setShowAddTemplate(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : null}

            <ul className="space-y-2">
              {templates.map((t) => {
                const lines = [...(t.plan_checklist_template_items || [])].sort(
                  (a, b) => (a.position ?? 0) - (b.position ?? 0),
                )
                return (
                  <li key={t.id} className="rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm">
                    {editingTmplId === t.id ? (
                      <form onSubmit={saveTemplate} className="grid gap-2">
                        <Input required value={editTmplName} onChange={(e) => setEditTmplName(e.target.value)} />
                        <textarea
                          required
                          className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                          value={editTmplItems}
                          onChange={(e) => setEditTmplItems(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" size="sm" className="min-h-11">
                            Save
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={() => setEditingTmplId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex min-h-11 flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="font-semibold text-foreground">{t.name}</strong>
                            <span className="planner-status-pill is-neutral">
                              {lines.length} step{lines.length === 1 ? '' : 's'}
                            </span>
                          </div>
                          {lines.length ? (
                            <ol className="mt-1.5 flex flex-wrap gap-1.5">
                              {lines.map((item, idx) => (
                                <li key={item.id} className="planner-tmpl-step-chip">
                                  <span>{idx + 1}.</span> {item.title}
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">No items</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="min-h-11"
                            onClick={() => {
                              setEditingTmplId(t.id)
                              setEditTmplName(t.name)
                              setEditTmplItems(lines.map((i) => i.title).join('\n'))
                            }}
                          >
                            Edit
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="min-h-11 text-destructive" onClick={() => removeTemplate(t.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
              {!templates.length && <li className="text-sm text-muted-foreground">No templates yet.</li>}
            </ul>
          </Section>

          <Section
            id="cfg-new-board"
            eyebrow="Planner"
            title="New board"
            hint="Creates a workspace with Upcoming, In Progress, and Done lists, plus your chosen access setting."
          >
            <form onSubmit={createBoard} className="grid gap-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  required
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder="Board name (e.g. Maintenance)"
                />
                <Button type="submit" className="min-h-11 shrink-0" disabled={creatingBoard}>
                  {creatingBoard ? 'Creating...' : 'Create board'}
                </Button>
              </div>
              <RoleChecks
                mode={newBoardAccessMode}
                onModeChange={(nextMode) => {
                  setNewBoardAccessMode(nextMode)
                  if (nextMode === 'selected' && normalizeVisibleRoles(newBoardRoles).length === 0 && viewerRole) {
                    setNewBoardRoles([viewerRole])
                  }
                }}
                value={newBoardRoles}
                onChange={setNewBoardRoles}
                viewerRole={viewerRole}
                guardSelfAccess
                subjectLabel="the new board"
              />
            </form>
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null)
        }}
        title={confirmDelete?.title || 'Confirm delete'}
        description={confirmDelete?.description || ''}
        confirmLabel="Delete"
        destructive
        pending={deletingConfig}
        onConfirm={executeConfirmDelete}
      />
    </div>
  )
}
