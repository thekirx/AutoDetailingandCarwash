import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import {
  DEFAULT_PLAN_LISTS,
  PLANNER_SWATCHES,
  listCardCount,
  nextPlanListPosition,
  plannerBoardNameError,
  plannerSwatchValue,
  reorderPlanRows,
} from '@/lib/plannerBoard'
import { toast } from 'sonner'

function Section({ eyebrow, title, hint, children }) {
  return (
    <section className="planner-ticket rounded-2xl border border-border bg-card p-4 sm:p-5">
      <p className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">{eyebrow}</p>
      <h2 className="mt-1 text-lg font-semibold">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Swatches({ value, onChange, disabled }) {
  const hex = plannerSwatchValue(value)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PLANNER_SWATCHES.map((swatch) => (
        <button
          key={swatch}
          type="button"
          disabled={disabled}
          onClick={() => onChange(swatch)}
          className={`planner-swatch ${hex.toLowerCase() === swatch.toLowerCase() ? 'is-on' : ''}`}
          style={{ background: swatch }}
          aria-label={`Color ${swatch}`}
          aria-pressed={hex.toLowerCase() === swatch.toLowerCase()}
        />
      ))}
      <Input type="color" value={hex} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-11 w-14 p-1" aria-label="Custom color" />
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
  onChanged,
  onSelectBoard,
}) {
  const [boardName, setBoardName] = useState('')
  const [newBoardName, setNewBoardName] = useState('')
  const [listTitle, setListTitle] = useState('')
  const [editingListId, setEditingListId] = useState(null)
  const [editListTitle, setEditListTitle] = useState('')
  const [catName, setCatName] = useState('')
  const [catColor, setCatColor] = useState('var(--color-brand-primary)')
  const [editingCatId, setEditingCatId] = useState(null)
  const [editCatName, setEditCatName] = useState('')
  const [editCatColor, setEditCatColor] = useState('var(--color-brand-primary)')
  const [tmplName, setTmplName] = useState('')
  const [tmplItems, setTmplItems] = useState('')
  const [editingTmplId, setEditingTmplId] = useState(null)
  const [editTmplName, setEditTmplName] = useState('')
  const [editTmplItems, setEditTmplItems] = useState('')

  useEffect(() => {
    setBoardName('')
    setListTitle('')
    setEditingListId(null)
  }, [board?.id])

  if (!canEdit) {
    return (
      <div className="planner-empty">
        <strong>Configure is for planners</strong>
        <p>Ask an admin if lists or categories need changing.</p>
      </div>
    )
  }

  async function renameBoard(e) {
    e.preventDefault()
    const name = boardName.trim() || board?.name
    const err = plannerBoardNameError(name)
    if (err) return toast.error(err)
    if (!board?.id) return
    const { error } = await supabase.from('plan_boards').update({ name, updated_at: new Date().toISOString() }).eq('id', board.id)
    if (error) return toast.error(error.message)
    toast.success('Board saved')
    setBoardName('')
    onChanged()
  }

  async function createBoard(e) {
    e.preventDefault()
    const err = plannerBoardNameError(newBoardName)
    if (err) return toast.error(err)
    const { data, error } = await supabase.from('plan_boards').insert({ name: newBoardName.trim() }).select('id, name').single()
    if (error) return toast.error(error.message)
    const { error: listErr } = await supabase.from('plan_lists').insert(
      DEFAULT_PLAN_LISTS.map((row) => ({ board_id: data.id, title: row.title, position: row.position })),
    )
    if (listErr) {
      await supabase.from('plan_boards').delete().eq('id', data.id)
      return toast.error(listErr.message)
    }
    toast.success('Board created')
    setNewBoardName('')
    onSelectBoard?.(data.id)
    onChanged()
  }

  async function removeBoard() {
    if (!board?.id) return
    if (boards.length < 2) return toast.error('Keep at least one board.')
    const tasks = lists.reduce((n, list) => n + listCardCount(list), 0)
    if (tasks) return toast.error('Move or delete tasks on this board first.')
    if (!window.confirm(`Delete board “${board.name}”? Lists on it go too.`)) return
    const { error } = await supabase.from('plan_boards').delete().eq('id', board.id)
    if (error) return toast.error(error.message)
    toast.success('Board deleted')
    const next = boards.find((b) => b.id !== board.id)
    if (next) onSelectBoard?.(next.id)
    onChanged()
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

  async function removeList(list) {
    if (lists.length < 2) return toast.error('Keep at least one list on this board.')
    const n = listCardCount(list)
    const ok = window.confirm(
      n
        ? `Delete “${list.title}”? That also deletes ${n} task${n === 1 ? '' : 's'} on it.`
        : `Delete list “${list.title}”?`,
    )
    if (!ok) return
    const { error } = await supabase.from('plan_lists').delete().eq('id', list.id)
    if (error) return toast.error(error.message)
    toast.success('List deleted')
    onChanged()
  }

  async function addCategory(e) {
    e.preventDefault()
    if (!catName.trim()) return
    const { error } = await supabase.from('plan_categories').insert({
      name: catName.trim(),
      color: catColor,
      position: nextPlanListPosition(categories),
    })
    if (error) return toast.error(error.message)
    toast.success('Category added')
    setCatName('')
    setCatColor('var(--color-brand-primary)')
    onChanged()
  }

  async function saveCategory(e) {
    e.preventDefault()
    if (!editingCatId || !editCatName.trim()) return
    const { error } = await supabase
      .from('plan_categories')
      .update({ name: editCatName.trim(), color: editCatColor })
      .eq('id', editingCatId)
    if (error) return toast.error(error.message)
    toast.success('Category saved')
    setEditingCatId(null)
    onChanged()
  }

  async function removeCategory(id) {
    if (!window.confirm('Delete this category? Tasks stay, uncategorized.')) return
    const { error } = await supabase.from('plan_categories').delete().eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Category deleted')
    if (editingCatId === id) setEditingCatId(null)
    onChanged()
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
    onChanged()
  }

  async function saveTemplate(e) {
    e.preventDefault()
    const titles = editTmplItems.split('\n').map((s) => s.trim()).filter(Boolean)
    if (!editingTmplId || !editTmplName.trim() || !titles.length) return toast.error('Name and at least one checklist line required')
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

  async function removeTemplate(id) {
    if (!window.confirm('Delete this checklist template?')) return
    const { error } = await supabase.from('plan_checklist_templates').delete().eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Template deleted')
    if (editingTmplId === id) setEditingTmplId(null)
    onChanged()
  }

  return (
    <div className="planner-configure">
      <Section
        eyebrow="This board"
        title={board?.name || 'No board'}
        hint="A board is a workspace (Planner, Equipment, Cash Advance). Lists are the columns on it."
      >
        <div className="grid gap-3">
          <label className="planner-configure-field">
            Board
            <select value={board?.id || ''} onChange={(e) => onSelectBoard?.(e.target.value)} aria-label="Board">
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
          <form onSubmit={renameBoard} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              placeholder={board?.name || 'Board name'}
              aria-label="Board name"
            />
            <Button type="submit" className="min-h-11" disabled={!board?.id}>Save name</Button>
          </form>
          <div>
            <Button type="button" variant="ghost" className="min-h-11 text-destructive" onClick={removeBoard} disabled={!board?.id}>
              Delete board
            </Button>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Lists"
        title="Columns on this board"
        hint="These are the LIST values on tasks (New, Upcoming…). Task progress — To do, In progress, For review, Done — stays fixed so photo proof still works."
      >
        <form onSubmit={addList} className="flex flex-col gap-2 sm:flex-row">
          <Input required value={listTitle} onChange={(e) => setListTitle(e.target.value)} placeholder="New list name" />
          <Button type="submit" className="min-h-11" disabled={!board?.id}>Add list</Button>
        </form>
        <ul className="mt-3 space-y-2">
          {lists.map((list, index) => (
            <li key={list.id} className="rounded-xl border border-border px-3 py-2">
              {editingListId === list.id ? (
                <form onSubmit={saveList} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input required value={editListTitle} onChange={(e) => setEditListTitle(e.target.value)} />
                  <Button type="submit" size="sm" className="min-h-11">Save</Button>
                  <Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={() => setEditingListId(null)}>Cancel</Button>
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 text-sm font-medium">
                    {list.title}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{listCardCount(list)} tasks</span>
                  </span>
                  <div className="flex flex-wrap gap-1">
                    <Button type="button" size="sm" variant="ghost" className="size-11 p-0" disabled={index === 0} onClick={() => moveList(list, -1)} aria-label="Move list up">
                      <ChevronUp size={16} />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="size-11 p-0" disabled={index === lists.length - 1} onClick={() => moveList(list, 1)} aria-label="Move list down">
                      <ChevronDown size={16} />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={() => { setEditingListId(list.id); setEditListTitle(list.title) }}>Edit</Button>
                    <Button type="button" size="sm" variant="ghost" className="min-h-11 text-destructive" onClick={() => removeList(list)}>Delete</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {!lists.length && <li className="text-sm text-muted-foreground">No lists yet. Add one so tasks have a column.</li>}
        </ul>
      </Section>

      <Section eyebrow="Shop-wide" title="Categories" hint="Shared across every board. Deleting a category leaves tasks uncategorized.">
        <form onSubmit={addCategory} className="grid gap-2">
          <Input required placeholder="Category name" value={catName} onChange={(e) => setCatName(e.target.value)} />
          <Swatches value={catColor} onChange={setCatColor} />
          <Button type="submit" className="min-h-11 w-fit">Add category</Button>
        </form>
        <ul className="mt-3 space-y-2">
          {categories.map((c) => (
            <li key={c.id} className="rounded-xl border border-border px-3 py-2">
              {editingCatId === c.id ? (
                <form onSubmit={saveCategory} className="grid gap-2">
                  <Input required value={editCatName} onChange={(e) => setEditCatName(e.target.value)} />
                  <Swatches value={editCatColor} onChange={setEditCatColor} />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" size="sm" className="min-h-11">Save</Button>
                    <Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={() => setEditingCatId(null)}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm">
                    <i className="size-3 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </span>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={() => { setEditingCatId(c.id); setEditCatName(c.name); setEditCatColor(c.color || 'var(--color-brand-primary)') }}>Edit</Button>
                    <Button type="button" size="sm" variant="ghost" className="min-h-11 text-destructive" onClick={() => removeCategory(c.id)}>Delete</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {!categories.length && <li className="text-sm text-muted-foreground">No categories yet.</li>}
        </ul>
      </Section>

      <Section eyebrow="Shop-wide" title="Checklist templates" hint="Reusable checklists when creating a task.">
        <form onSubmit={addTemplate} className="grid gap-2">
          <Input required placeholder="Template name" value={tmplName} onChange={(e) => setTmplName(e.target.value)} />
          <textarea
            required
            className="min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            placeholder="One item per line"
            value={tmplItems}
            onChange={(e) => setTmplItems(e.target.value)}
          />
          <Button type="submit" className="min-h-11 w-fit">Save template</Button>
        </form>
        <ul className="mt-3 space-y-2">
          {templates.map((t) => {
            const lines = [...(t.plan_checklist_template_items || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            return (
              <li key={t.id} className="rounded-xl border border-border px-3 py-2 text-sm">
                {editingTmplId === t.id ? (
                  <form onSubmit={saveTemplate} className="grid gap-2">
                    <Input required value={editTmplName} onChange={(e) => setEditTmplName(e.target.value)} />
                    <textarea
                      required
                      className="min-h-20 w-full rounded-xl border px-3 py-2 text-sm"
                      value={editTmplItems}
                      onChange={(e) => setEditTmplItems(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" size="sm" className="min-h-11">Save</Button>
                      <Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={() => setEditingTmplId(null)}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0">
                      <strong className="block">{t.name}</strong>
                      <span className="text-xs text-muted-foreground">{lines.map((i) => i.title).join(' · ') || 'No items'}</span>
                    </span>
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
                      <Button type="button" size="sm" variant="ghost" className="min-h-11 text-destructive" onClick={() => removeTemplate(t.id)}>Delete</Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
          {!templates.length && <li className="text-sm text-muted-foreground">No templates yet.</li>}
        </ul>
      </Section>

      <Section eyebrow="Planner" title="New board" hint="Creates a workspace with Upcoming, In Progress, and Done lists.">
        <form onSubmit={createBoard} className="flex flex-col gap-2 sm:flex-row">
          <Input required value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} placeholder="Board name" />
          <Button type="submit" className="min-h-11">Create board</Button>
        </form>
      </Section>
    </div>
  )
}
