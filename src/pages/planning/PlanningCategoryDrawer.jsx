import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function PlanningCategoryDrawer({ open, categories, templates = [], canEdit, onClose, onChanged }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#052699')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#052699')
  const [tmplName, setTmplName] = useState('')
  const [tmplItems, setTmplItems] = useState('')
  if (!open) return null

  async function add(e) {
    e.preventDefault()
    if (!canEdit || !name.trim()) return
    const { error } = await supabase.from('plan_categories').insert({
      name: name.trim(),
      color,
      position: categories.length,
    })
    if (error) return toast.error(error.message)
    toast.success('Category added')
    setName('')
    onChanged()
  }

  function startEdit(c) {
    setEditingId(c.id)
    setEditName(c.name)
    setEditColor(c.color || '#052699')
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!canEdit || !editingId || !editName.trim()) return
    const { error } = await supabase
      .from('plan_categories')
      .update({ name: editName.trim(), color: editColor })
      .eq('id', editingId)
    if (error) return toast.error(error.message)
    toast.success('Category saved')
    setEditingId(null)
    onChanged()
  }

  async function remove(id) {
    if (!canEdit || !window.confirm('Delete this category? Tasks stay, uncategorized.')) return
    const { error } = await supabase.from('plan_categories').delete().eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Category deleted')
    if (editingId === id) setEditingId(null)
    onChanged()
  }

  async function addTemplate(e) {
    e.preventDefault()
    if (!canEdit) return
    const titles = tmplItems.split('\n').map((s) => s.trim()).filter(Boolean)
    if (!tmplName.trim() || !titles.length) return toast.error('Name and at least one checklist line required')
    const { data, error } = await supabase
      .from('plan_checklist_templates')
      .insert({ name: tmplName.trim(), position: templates.length })
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

  async function removeTemplate(id) {
    if (!canEdit || !window.confirm('Delete this checklist template?')) return
    const { error } = await supabase.from('plan_checklist_templates').delete().eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Template deleted')
    onChanged()
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#020a31]/30" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col gap-4 overflow-y-auto border-l border-border bg-card p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Categories</h2>
          <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
        </div>
        {canEdit && (
          <form onSubmit={add} className="flex flex-wrap gap-2">
            <Input required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1" />
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-11 w-14 p-1" aria-label="Color" />
            <Button type="submit">Add</Button>
          </form>
        )}
        <ul className="space-y-2">
          {categories.map((c) => (
            <li key={c.id} className="rounded-xl border border-border px-3 py-2">
              {editingId === c.id ? (
                <form onSubmit={saveEdit} className="flex flex-wrap items-center gap-2">
                  <Input required value={editName} onChange={(e) => setEditName(e.target.value)} className="min-w-0 flex-1" />
                  <Input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-11 w-14 p-1" aria-label="Color" />
                  <Button type="submit" size="sm">Save</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                </form>
              ) : (
                <div className="flex min-h-11 items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm">
                    <i className="size-3 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </span>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(c)}>Edit</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => remove(c.id)}>Delete</Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
          {!categories.length && <li className="text-sm text-muted-foreground">No categories yet.</li>}
        </ul>

        <h3 className="mt-2 text-sm font-semibold">Checklist templates</h3>
        {canEdit && (
          <form onSubmit={addTemplate} className="grid gap-2">
            <Input required placeholder="Template name" value={tmplName} onChange={(e) => setTmplName(e.target.value)} />
            <textarea
              required
              className="min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              placeholder={'One item per line'}
              value={tmplItems}
              onChange={(e) => setTmplItems(e.target.value)}
            />
            <Button type="submit" className="w-fit">Save template</Button>
          </form>
        )}
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t.id} className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
              <span className="min-w-0">
                <strong className="block">{t.name}</strong>
                <span className="text-xs text-muted-foreground">
                  {(t.plan_checklist_template_items || []).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((i) => i.title).join(' · ') || 'No items'}
                </span>
              </span>
              {canEdit && (
                <Button type="button" size="sm" variant="ghost" onClick={() => removeTemplate(t.id)}>Delete</Button>
              )}
            </li>
          ))}
          {!templates.length && <li className="text-sm text-muted-foreground">No templates yet.</li>}
        </ul>
      </aside>
    </div>
  )
}
