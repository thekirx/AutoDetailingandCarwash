import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NamedSelect } from '@/components/ui/named-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BLOCK_TYPES,
  emptyBlock,
  normalizeBlocks,
} from '@/lib/contentBlocks'
import { uploadContentMedia } from '@/lib/contentMedia'

/**
 * WordPress-like block editor for blogs & events.
 * Optional form picker on CTA blocks (events).
 */
export default function ContentBlockEditor({
  blocks = [],
  onChange,
  forms = [],
  allowFormCta = false,
  disabled = false,
}) {
  const rows = normalizeBlocks(blocks)

  function commit(next) {
    onChange?.(normalizeBlocks(next))
  }

  function update(index, patch) {
    commit(rows.map((b, i) => (i === index ? { ...b, ...patch } : b)))
  }

  function remove(index) {
    commit(rows.filter((_, i) => i !== index))
  }

  function move(index, dir) {
    const j = index + dir
    if (j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[index], next[j]] = [next[j], next[index]]
    commit(next)
  }

  function add(type) {
    commit([...rows, emptyBlock(type)])
  }

  async function onUpload(index, file) {
    if (!file || disabled) return
    try {
      const url = await uploadContentMedia(file)
      update(index, { url })
    } catch (err) {
      window.alert(err.message || 'Upload failed')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((block, index) => (
        <div key={block.id} className="rounded-xl border border-border bg-muted/20 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <Select
              disabled={disabled}
              value={block.type}
              onValueChange={(type) => {
                const fresh = emptyBlock(type)
                commit(rows.map((b, i) => (i === index ? { ...fresh, id: b.id } : b)))
              }}
            >
              <SelectTrigger className="w-44 cursor-pointer"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BLOCK_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              <Button type="button" size="sm" variant="ghost" disabled={disabled || index === 0} onClick={() => move(index, -1)}>Up</Button>
              <Button type="button" size="sm" variant="ghost" disabled={disabled || index === rows.length - 1} onClick={() => move(index, 1)}>Down</Button>
              <Button type="button" size="sm" variant="ghost" disabled={disabled} className="text-destructive" onClick={() => remove(index)}>
                <Trash2 className="size-3.5" /> Remove
              </Button>
            </div>
          </div>

          {block.type === 'heading' && (
            <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
              <div className="flex flex-col gap-1.5">
                <Label>Level</Label>
                <Select disabled={disabled} value={String(block.level)} onValueChange={(v) => update(index, { level: Number(v) })}>
                  <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">H1</SelectItem>
                    <SelectItem value="2">H2</SelectItem>
                    <SelectItem value="3">H3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Text</Label>
                <Input disabled={disabled} value={block.text} onChange={(e) => update(index, { text: e.target.value })} />
              </div>
            </div>
          )}

          {block.type === 'paragraph' && (
            <div className="flex flex-col gap-1.5">
              <Label>Text</Label>
              <Textarea disabled={disabled} rows={4} value={block.text} onChange={(e) => update(index, { text: e.target.value })} />
            </div>
          )}

          {block.type === 'image' && (
            <div className="grid gap-2">
              <div className="flex flex-col gap-1.5">
                <Label>Image URL</Label>
                <Input disabled={disabled} value={block.url} onChange={(e) => update(index, { url: e.target.value })} placeholder="https://… or /branding/…" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  disabled={disabled}
                  className="max-w-xs cursor-pointer"
                  onChange={(e) => onUpload(index, e.target.files?.[0])}
                />
                {block.url ? <img src={block.url} alt="" className="h-14 rounded-md border object-cover" /> : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Alt text</Label>
                  <Input disabled={disabled} value={block.alt} onChange={(e) => update(index, { alt: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Caption</Label>
                  <Input disabled={disabled} value={block.caption} onChange={(e) => update(index, { caption: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {block.type === 'video' && (
            <div className="grid gap-2">
              <div className="flex flex-col gap-1.5">
                <Label>Video URL (YouTube, Vimeo, or .mp4)</Label>
                <Input disabled={disabled} value={block.url} onChange={(e) => update(index, { url: e.target.value })} />
              </div>
              <Input
                type="file"
                accept="video/mp4,video/webm"
                disabled={disabled}
                className="max-w-xs cursor-pointer"
                onChange={(e) => onUpload(index, e.target.files?.[0])}
              />
              <div className="flex flex-col gap-1.5">
                <Label>Caption</Label>
                <Input disabled={disabled} value={block.caption} onChange={(e) => update(index, { caption: e.target.value })} />
              </div>
            </div>
          )}

          {block.type === 'quote' && (
            <div className="grid gap-2">
              <div className="flex flex-col gap-1.5">
                <Label>Quote</Label>
                <Textarea disabled={disabled} value={block.text} onChange={(e) => update(index, { text: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Cite</Label>
                <Input disabled={disabled} value={block.cite} onChange={(e) => update(index, { cite: e.target.value })} />
              </div>
            </div>
          )}

          {block.type === 'list' && (
            <div className="grid gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={block.ordered}
                  onChange={(e) => update(index, { ordered: e.target.checked })}
                />
                Numbered list
              </label>
              <div className="flex flex-col gap-1.5">
                <Label>Items (one per line)</Label>
                <Textarea
                  disabled={disabled}
                  rows={4}
                  value={(block.items || []).join('\n')}
                  onChange={(e) => update(index, { items: e.target.value.split('\n') })}
                />
              </div>
            </div>
          )}

          {block.type === 'cta' && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Button label</Label>
                <Input disabled={disabled} value={block.label} onChange={(e) => update(index, { label: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Style</Label>
                <Select disabled={disabled} value={block.style || 'primary'} onValueChange={(style) => update(index, { style })}>
                  <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary</SelectItem>
                    <SelectItem value="secondary">Secondary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>Link URL</Label>
                <Input disabled={disabled} value={block.url} onChange={(e) => update(index, { url: e.target.value })} placeholder="/book or https://…" />
              </div>
              {allowFormCta && (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label>Optional form button (events)</Label>
                  <NamedSelect
                    disabled={disabled}
                    value={block.form_id || ''}
                    onChange={(form_id) => {
                      const form = forms.find((f) => f.id === form_id)
                      update(index, {
                        form_id,
                        url: form?.slug ? `/f/${form.slug}` : block.url,
                        label: block.label || (form ? `Open ${form.name}` : 'Open form'),
                      })
                    }}
                    emptyLabel="No form"
                    options={forms.map((f) => ({ value: f.id, label: f.name }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Picking a form sets the button to that public form link. You can still edit the URL.
                  </p>
                </div>
              )}
            </div>
          )}

          {block.type === 'divider' && (
            <p className="text-sm text-muted-foreground">Horizontal rule on the published page.</p>
          )}
        </div>
      ))}

      {!disabled && (
        <div className="flex flex-wrap gap-2">
          {BLOCK_TYPES.map((t) => (
            <Button key={t.value} type="button" size="sm" variant="outline" className="cursor-pointer" onClick={() => add(t.value)}>
              <Plus className="size-3.5" /> {t.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
