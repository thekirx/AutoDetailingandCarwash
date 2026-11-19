import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Code,
  Copy,
  FolderOpen,
  GripVertical,
  ImagePlus,
  Italic,
  Link2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NamedSelect } from '@/components/ui/named-select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BLOCK_TYPES,
  emptyBlock,
  normalizeBlocks,
} from '@/lib/contentBlocks'
import {
  listContentMediaLibrary,
  STUDIO_MEDIA_PRESETS,
  uploadContentMedia,
} from '@/lib/contentMedia'
import { toast } from 'sonner'

/**
 * WordPress-style Media Library modal — lets editors pick from uploaded photos
 * in Supabase `content-media` or curated Hakum Studio photography, or upload new files.
 */
export function MediaLibraryDialog({ open, onOpenChange, onSelect, title = 'Media Library' }) {
  const [items, setItems] = useState(STUDIO_MEDIA_PRESETS)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [filter, setFilter] = useState('all')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    listContentMediaLibrary()
      .then((res) => {
        if (active && res?.all) setItems(res.all)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open])

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []).filter(Boolean)
    if (!files.length) return
    setUploading(true)
    try {
      const uploadedItems = []
      for (const file of files) {
        const url = await uploadContentMedia(file)
        const entry = {
          id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name || 'Uploaded photo',
          url,
          alt: (file.name || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
          category: 'Uploaded Media',
        }
        uploadedItems.push(entry)
      }
      setItems((prev) => [...uploadedItems, ...prev])
      toast.success(
        uploadedItems.length === 1
          ? 'Photo uploaded to Media Library'
          : `${uploadedItems.length} photos uploaded`,
      )
      if (uploadedItems.length === 1 && onSelect) {
        onSelect(uploadedItems[0])
        onOpenChange?.(false)
      }
    } catch (err) {
      toast.error(err?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const categories = ['all', 'Uploaded Media', 'Studio & Branches', 'Paint & Ceramic', 'PPF & Tint', 'Wash & Detailing', 'Events & Branding']
  const filtered = filter === 'all' ? items : items.filter((item) => item.category === filter)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Upload photos from your device or choose from the Hakum Auto Care media library.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <Button
                key={cat}
                type="button"
                size="sm"
                variant={filter === cat ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => setFilter(cat)}
              >
                {cat === 'all' ? 'All Photos' : cat}
              </Button>
            ))}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              size="sm"
              className="cursor-pointer"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Upload className="mr-1.5 size-4" />}
              {uploading ? 'Uploading…' : 'Upload Photo'}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading media library…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filtered.map((item) => (
              <button
                key={item.id || item.url}
                type="button"
                onClick={() => {
                  onSelect?.(item)
                  onOpenChange?.(false)
                }}
                className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-muted/20 text-left transition hover:border-primary hover:ring-2 hover:ring-primary/30"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-black/20">
                  <img
                    src={item.url}
                    alt={item.alt || item.name}
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium text-foreground">{item.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{item.category}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Reusable WordPress-style cover/banner photo dropzone with Drag & Drop, Device Upload,
 * Media Library picker, and URL input.
 */
export function MediaDropzoneField({
  label = 'Featured Image',
  value = '',
  onChange,
  disabled = false,
  helperText = 'Drag & drop an image, upload from device, or choose from Media Library.',
}) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const fileRef = useRef(null)

  async function handleFile(file) {
    if (!file || disabled) return
    setUploading(true)
    try {
      const url = await uploadContentMedia(file)
      onChange?.(url)
      toast.success('Photo uploaded')
    } catch (err) {
      toast.error(err?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>{label}</Label>
        <div className="flex flex-wrap gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            disabled={disabled || uploading}
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || uploading}
            className="h-8 cursor-pointer text-xs"
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Upload className="mr-1.5 size-3.5" />}
            {uploading ? 'Uploading…' : 'Upload Photo'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            className="h-8 cursor-pointer text-xs"
            onClick={() => setLibraryOpen(true)}
          >
            <FolderOpen className="mr-1.5 size-3.5" />
            Media Library
          </Button>
          {value ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              className="h-8 cursor-pointer text-xs text-destructive"
              onClick={() => onChange?.('')}
            >
              <X className="size-3.5" /> Clear
            </Button>
          ) : null}
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          const f = e.dataTransfer?.files?.[0]
          if (f) handleFile(f)
        }}
        className={`relative flex flex-col gap-3 rounded-xl border border-dashed p-3 transition ${
          dragActive ? 'border-primary bg-primary/10' : 'border-border bg-muted/20'
        }`}
      >
        {value ? (
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr] sm:items-center">
            <div className="aspect-[16/10] w-full overflow-hidden rounded-lg border border-border bg-black/30">
              <img src={value} alt="Preview" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Input
                disabled={disabled}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                placeholder="https://… or /branding/…"
              />
              <p className="text-xs text-muted-foreground">{helperText}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
            <ImagePlus className="size-7 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{helperText}</p>
            <Input
              disabled={disabled}
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder="Or paste image URL (https://…)"
              className="max-w-md"
            />
          </div>
        )}
      </div>

      <MediaLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        title={`Select ${label}`}
        onSelect={(item) => onChange?.(item.url)}
      />
    </div>
  )
}

const INTERNAL_SEO_LINKS = [
  { label: 'Book Online', href: '/book' },
  { label: 'Live Queue', href: '/queue' },
  { label: 'Branches Locator', href: '/branches' },
  { label: 'Bacoor Branch', href: '/branches/bacoor' },
  { label: 'Batangas Branch', href: '/branches/batangas' },
  { label: 'Imus Hub', href: '/branches/imus' },
  { label: 'Cavite Hub', href: '/branches/cavite' },
  { label: 'ClearPro PPF', href: '/services/ppf' },
  { label: 'Kisho Ceramic Coating', href: '/services/ceramic' },
  { label: 'Nano Ceramic Tint', href: '/services/tint' },
  { label: 'Wash & Detailing', href: '/services/wash-detailing' },
  { label: 'Tint Finder', href: '/tint-finder' },
]

/**
 * WordPress-like Gutenberg block editor for blogs & events.
 * Supports true drag-and-drop block & gallery reordering, canvas/paste image upload,
 * inline rich-text formatting + internal SEO link insertion, `/` block switcher,
 * callouts, headings, quotes, lists, videos, dividers, and form CTA buttons.
 */
export default function ContentBlockEditor({
  blocks = [],
  onChange,
  forms = [],
  allowFormCta = false,
  disabled = false,
}) {
  const rows = normalizeBlocks(blocks)
  const [uploadingIndex, setUploadingIndex] = useState(null)
  const [canvasUploading, setCanvasUploading] = useState(false)
  const [canvasDragFiles, setCanvasDragFiles] = useState(false)
  const [libraryTarget, setLibraryTarget] = useState(null)
  const [dragBlockIndex, setDragBlockIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [galleryDrag, setGalleryDrag] = useState(null) // { blockIndex, imgIndex }
  const paragraphRefs = useRef({})

  function commit(next) {
    onChange?.(normalizeBlocks(next))
  }

  function update(index, patch) {
    commit(rows.map((b, i) => (i === index ? { ...b, ...patch } : b)))
  }

  function reorderBlocks(fromIdx, toIdx) {
    if (fromIdx == null || toIdx == null || fromIdx === toIdx) return
    if (fromIdx < 0 || fromIdx >= rows.length || toIdx < 0 || toIdx >= rows.length) return
    const next = [...rows]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    commit(next)
  }

  function transformBlockType(index, type) {
    const fresh = emptyBlock(type)
    commit(
      rows.map((b, i) => (i === index ? { ...fresh, id: b.id, post_meta: b.post_meta } : b)),
    )
  }

  function wrapParagraphSelection(index, prefix, suffix = prefix, fallbackText = '') {
    const el = paragraphRefs.current[index]
    const current = String(rows[index]?.text || '')
    if (!el || typeof el.selectionStart !== 'number') {
      update(index, { text: current ? `${current} ${prefix}${fallbackText}${suffix}` : `${prefix}${fallbackText}${suffix}` })
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = current.slice(start, end) || fallbackText
    const nextText = `${current.slice(0, start)}${prefix}${selected}${suffix}${current.slice(end)}`
    update(index, { text: nextText })
    requestAnimationFrame(() => {
      try {
        el.focus()
        const caret = start + prefix.length + selected.length + suffix.length
        el.setSelectionRange(caret, caret)
      } catch {
        // ignore focus errors
      }
    })
  }

  function insertParagraphLink(index, defaultHref = '', defaultLabel = '') {
    const el = paragraphRefs.current[index]
    const current = String(rows[index]?.text || '')
    const start = el && typeof el.selectionStart === 'number' ? el.selectionStart : current.length
    const end = el && typeof el.selectionEnd === 'number' ? el.selectionEnd : current.length
    const selected = current.slice(start, end).trim()
    const href = defaultHref || window.prompt('Enter internal route (e.g. /book) or full https:// URL:', '/book')
    if (!href) return
    const anchor = selected || defaultLabel || href.replace(/^\//, '').replace(/[-/]+/g, ' ') || 'Hakum Guide'
    const token = `[${anchor}](${href.trim()})`
    const nextText = `${current.slice(0, start)}${token}${current.slice(end)}`
    update(index, { text: nextText })
  }

  async function handleCanvasFilesDrop(fileList, insertAt = rows.length) {
    const files = Array.from(fileList || []).filter((f) => String(f?.type || '').startsWith('image/'))
    if (!files.length || disabled) return
    setCanvasUploading(true)
    try {
      if (files.length === 1) {
        const url = await uploadContentMedia(files[0])
        const alt = String(files[0].name || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
        const blk = { ...emptyBlock('image'), url, alt }
        const next = [...rows]
        next.splice(Math.max(0, Math.min(next.length, insertAt)), 0, blk)
        commit(next)
        toast.success('Photo dropped & added as Image block')
      } else {
        const imgs = []
        for (const f of files.slice(0, 8)) {
          const url = await uploadContentMedia(f)
          imgs.push({
            id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            url,
            alt: String(f.name || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
            caption: '',
          })
        }
        const blk = { ...emptyBlock('gallery'), columns: Math.min(4, Math.max(2, imgs.length)), images: imgs }
        const next = [...rows]
        next.splice(Math.max(0, Math.min(next.length, insertAt)), 0, blk)
        commit(next)
        toast.success(`${imgs.length} photos dropped & added as Gallery block`)
      }
    } catch (err) {
      toast.error(err?.message || 'Image drop upload failed')
    } finally {
      setCanvasUploading(false)
    }
  }

  function remove(index) {
    commit(rows.filter((_, i) => i !== index))
  }

  function duplicate(index) {
    const source = rows[index]
    if (!source) return
    const copy = {
      ...JSON.parse(JSON.stringify(source)),
      id: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    }
    delete copy.post_meta
    const next = [...rows]
    next.splice(index + 1, 0, copy)
    commit(next)
  }

  function insertAfter(index, type = 'paragraph') {
    const next = [...rows]
    next.splice(index + 1, 0, emptyBlock(type))
    commit(next)
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

  async function onUploadSingle(index, file) {
    if (!file || disabled) return
    setUploadingIndex(index)
    try {
      const url = await uploadContentMedia(file)
      const current = rows[index] || {}
      const inferredAlt =
        current.alt ||
        String(file.name || '')
          .replace(/\.[^.]+$/, '')
          .replace(/[-_]+/g, ' ')
      update(index, { url, alt: inferredAlt })
      toast.success('Photo added to block')
    } catch (err) {
      toast.error(err?.message || 'Upload failed')
    } finally {
      setUploadingIndex(null)
    }
  }

  async function onUploadGallery(index, fileList) {
    const files = Array.from(fileList || []).filter(Boolean)
    if (!files.length || disabled) return
    setUploadingIndex(index)
    try {
      const added = []
      for (const file of files) {
        const url = await uploadContentMedia(file)
        added.push({
          id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url,
          alt: String(file.name || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
          caption: '',
        })
      }
      const existing = Array.isArray(rows[index]?.images) ? rows[index].images : []
      update(index, { images: [...existing, ...added] })
      toast.success(`${added.length} photo${added.length > 1 ? 's' : ''} added to gallery`)
    } catch (err) {
      toast.error(err?.message || 'Gallery upload failed')
    } finally {
      setUploadingIndex(null)
    }
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl transition ${
        canvasDragFiles ? 'ring-2 ring-primary/60 bg-primary/5 p-2' : ''
      }`.trim()}
      onDragOver={(e) => {
        if (disabled) return
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault()
          setCanvasDragFiles(true)
        }
      }}
      onDragLeave={() => setCanvasDragFiles(false)}
      onDrop={(e) => {
        setCanvasDragFiles(false)
        if (disabled) return
        if (e.dataTransfer?.files?.length && dragBlockIndex === null && !galleryDrag) {
          e.preventDefault()
          handleCanvasFilesDrop(e.dataTransfer.files)
        }
      }}
    >
      {canvasUploading && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
          <Loader2 className="size-3.5 animate-spin" /> Uploading dropped/pasted photo(s)…
        </div>
      )}

      {rows.map((block, index) => (
        <div
          key={block.id}
          onDragOver={(e) => {
            if (disabled || dragBlockIndex === null || dragBlockIndex === index) return
            e.preventDefault()
            if (dragOverIndex !== index) setDragOverIndex(index)
          }}
          onDrop={(e) => {
            if (disabled || dragBlockIndex === null) return
            e.preventDefault()
            e.stopPropagation()
            reorderBlocks(dragBlockIndex, index)
            setDragBlockIndex(null)
            setDragOverIndex(null)
          }}
          className={`rounded-xl border bg-muted/20 p-3.5 transition ${
            dragOverIndex === index && dragBlockIndex !== null && dragBlockIndex !== index
              ? 'border-primary ring-2 ring-primary/40'
              : dragBlockIndex === index
                ? 'border-dashed border-primary/60 opacity-60'
                : 'border-border hover:border-border/80'
          }`}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              {!disabled && (
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    setDragBlockIndex(index)
                    try {
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', String(index))
                    } catch {
                      // ignore
                    }
                  }}
                  onDragEnd={() => {
                    setDragBlockIndex(null)
                    setDragOverIndex(null)
                  }}
                  title="Drag to reorder block"
                  aria-label={`Drag to reorder block ${index + 1}`}
                  className="inline-flex size-7 cursor-grab items-center justify-center rounded-md border border-border/60 bg-background/70 text-muted-foreground hover:text-foreground active:cursor-grabbing"
                >
                  <GripVertical className="size-3.5" />
                </button>
              )}
              <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                {index + 1}
              </span>
              <Select
                disabled={disabled}
                value={block.type}
                onValueChange={(type) => transformBlockType(index, type)}
              >
                <SelectTrigger className="h-8 w-44 cursor-pointer text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BLOCK_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 cursor-pointer px-2 text-xs"
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
                title="Move block up"
              >
                <ArrowUp className="size-3.5" /> Up
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 cursor-pointer px-2 text-xs"
                disabled={disabled || index === rows.length - 1}
                onClick={() => move(index, 1)}
                title="Move block down"
              >
                <ArrowDown className="size-3.5" /> Down
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 cursor-pointer px-2 text-xs"
                disabled={disabled}
                onClick={() => duplicate(index)}
                title="Duplicate block"
              >
                <Copy className="size-3.5" /> Duplicate
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 cursor-pointer px-2 text-xs"
                disabled={disabled}
                onClick={() => insertAfter(index, 'paragraph')}
                title="Insert block below"
              >
                <Plus className="size-3.5" /> Insert
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled}
                className="h-7 cursor-pointer px-2 text-xs text-destructive"
                onClick={() => remove(index)}
              >
                <Trash2 className="size-3.5" /> Remove
              </Button>
            </div>
          </div>

          {block.type === 'heading' && (
            <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
              <div className="flex flex-col gap-1.5">
                <Label>Level</Label>
                <Select
                  disabled={disabled}
                  value={String(block.level)}
                  onValueChange={(v) => update(index, { level: Number(v) })}
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">H1 — Main Section</SelectItem>
                    <SelectItem value="2">H2 — Subheading</SelectItem>
                    <SelectItem value="3">H3 — Minor Heading</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Heading Text</Label>
                <Input
                  disabled={disabled}
                  placeholder="Enter section heading…"
                  value={block.text}
                  onChange={(e) => update(index, { text: e.target.value })}
                />
              </div>
            </div>
          )}

          {block.type === 'paragraph' && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <Label>Paragraph Text</Label>
                {!disabled && (
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer px-2 text-xs"
                      onClick={() => wrapParagraphSelection(index, '**', '**', 'bold text')}
                      title="Bold selected text (**bold**)"
                    >
                      <Bold className="size-3" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer px-2 text-xs"
                      onClick={() => wrapParagraphSelection(index, '*', '*', 'italic text')}
                      title="Italic selected text (*italic*)"
                    >
                      <Italic className="size-3" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer px-2 text-xs"
                      onClick={() => wrapParagraphSelection(index, '`', '`', 'detailing')}
                      title="Inline code highlight"
                    >
                      <Code className="size-3" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer px-2 text-xs"
                      onClick={() => insertParagraphLink(index)}
                      title="Insert custom link"
                    >
                      <Link2 className="mr-1 size-3" /> Link
                    </Button>
                    <Select
                      value=""
                      onValueChange={(href) => {
                        const found = INTERNAL_SEO_LINKS.find((l) => l.href === href)
                        if (found) insertParagraphLink(index, found.href, found.label)
                      }}
                    >
                      <SelectTrigger className="h-7 w-40 cursor-pointer text-[11px]">
                        <SelectValue placeholder="+ Internal SEO Link" />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERNAL_SEO_LINKS.map((l) => (
                          <SelectItem key={l.href} value={l.href}>
                            {l.label} ({l.href})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <Textarea
                ref={(el) => {
                  paragraphRefs.current[index] = el
                }}
                disabled={disabled}
                rows={4}
                placeholder="Write your paragraph, type / for block picker, or paste a screenshot…"
                value={block.text}
                onChange={(e) => update(index, { text: e.target.value })}
                onPaste={(e) => {
                  const files = Array.from(e.clipboardData?.files || []).filter((f) =>
                    String(f?.type || '').startsWith('image/'),
                  )
                  if (files.length && !disabled) {
                    e.preventDefault()
                    handleCanvasFilesDrop(files, index + 1)
                  }
                }}
              />

              {!disabled && String(block.text || '').trim().startsWith('/') && (
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-primary/40 bg-background/95 p-2 shadow-md">
                  <span className="mr-1 text-[11px] font-semibold text-primary">Switch block:</span>
                  {BLOCK_TYPES.filter((t) => t.value !== 'paragraph').map((t) => (
                    <Button
                      key={t.value}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-6 cursor-pointer px-2 text-[11px]"
                      onClick={() => transformBlockType(index, t.value)}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          {block.type === 'image' && (
            <div
              className="grid gap-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer?.files?.[0]
                if (f) onUploadSingle(index, f)
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Photo Upload or URL</Label>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 cursor-pointer text-xs"
                    disabled={disabled}
                    onClick={() => setLibraryTarget({ index, mode: 'single' })}
                  >
                    <FolderOpen className="mr-1.5 size-3.5" /> Choose from Media Library
                  </Button>
                  {block.url ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 cursor-pointer text-xs text-destructive"
                      disabled={disabled}
                      onClick={() => update(index, { url: '' })}
                    >
                      <X className="size-3.5" /> Remove photo
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <Input
                  disabled={disabled}
                  value={block.url}
                  onChange={(e) => update(index, { url: e.target.value })}
                  placeholder="https://… or upload a photo below"
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={disabled || uploadingIndex === index}
                    className="max-w-xs cursor-pointer"
                    onChange={(e) => onUploadSingle(index, e.target.files?.[0])}
                  />
                  {uploadingIndex === index && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" /> Uploading…
                    </span>
                  )}
                </div>
              </div>

              {block.url ? (
                <div className="overflow-hidden rounded-xl border border-border bg-black/20 p-2">
                  <img
                    src={block.url}
                    alt={block.alt || ''}
                    className="max-h-56 w-full rounded-lg object-cover"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/80 px-3 py-4 text-center text-xs text-muted-foreground">
                  Drag &amp; drop a photo here, choose a file above, or open the Media Library.
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-4">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label>Alt text (SEO description)</Label>
                  <Input
                    disabled={disabled}
                    placeholder="e.g., Ceramic coating curing in Bacoor bay"
                    value={block.alt}
                    onChange={(e) => update(index, { alt: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Display Width</Label>
                  <Select
                    disabled={disabled}
                    value={block.layout || 'normal'}
                    onValueChange={(layout) => update(index, { layout })}
                  >
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Standard</SelectItem>
                      <SelectItem value="wide">Wide</SelectItem>
                      <SelectItem value="full">Full Bleed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Aspect Ratio</Label>
                  <Select
                    disabled={disabled}
                    value={block.aspect || 'auto'}
                    onValueChange={(aspect) => update(index, { aspect })}
                  >
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Original</SelectItem>
                      <SelectItem value="16:9">16:9 Widescreen</SelectItem>
                      <SelectItem value="4:3">4:3 Studio</SelectItem>
                      <SelectItem value="1:1">1:1 Square</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-4">
                  <Label>Caption (shown below photo)</Label>
                  <Input
                    disabled={disabled}
                    placeholder="Optional caption…"
                    value={block.caption}
                    onChange={(e) => update(index, { caption: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {block.type === 'gallery' && (
            <div
              className="grid gap-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (e.dataTransfer?.files?.length) onUploadGallery(index, e.dataTransfer.files)
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Label>WordPress Photo Gallery ({block.images?.length || 0} photos)</Label>
                  <Select
                    disabled={disabled}
                    value={String(block.columns || 2)}
                    onValueChange={(v) => update(index, { columns: Number(v) })}
                  >
                    <SelectTrigger className="h-8 w-32 cursor-pointer text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 Columns</SelectItem>
                      <SelectItem value="3">3 Columns</SelectItem>
                      <SelectItem value="4">4 Columns</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 cursor-pointer text-xs"
                    disabled={disabled}
                    onClick={() => setLibraryTarget({ index, mode: 'gallery' })}
                  >
                    <FolderOpen className="mr-1.5 size-3.5" /> Add from Media Library
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={disabled || uploadingIndex === index}
                  className="max-w-xs cursor-pointer"
                  onChange={(e) => {
                    onUploadGallery(index, e.target.files)
                    e.target.value = ''
                  }}
                />
                {uploadingIndex === index && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Uploading gallery photos…
                  </span>
                )}
              </div>

              {Array.isArray(block.images) && block.images.length > 0 ? (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {block.images.map((img, imgIdx) => (
                    <div
                      key={img.id || imgIdx}
                      draggable={!disabled}
                      onDragStart={(e) => {
                        setGalleryDrag({ blockIndex: index, imgIndex: imgIdx })
                        try {
                          e.stopPropagation()
                          e.dataTransfer.effectAllowed = 'move'
                        } catch {
                          // ignore
                        }
                      }}
                      onDragOver={(e) => {
                        if (galleryDrag?.blockIndex === index && galleryDrag.imgIndex !== imgIdx) {
                          e.preventDefault()
                        }
                      }}
                      onDrop={(e) => {
                        if (galleryDrag?.blockIndex !== index || galleryDrag.imgIndex === imgIdx) return
                        e.preventDefault()
                        e.stopPropagation()
                        const nextImgs = [...block.images]
                        const [moved] = nextImgs.splice(galleryDrag.imgIndex, 1)
                        nextImgs.splice(imgIdx, 0, moved)
                        update(index, { images: nextImgs })
                        setGalleryDrag(null)
                      }}
                      onDragEnd={() => setGalleryDrag(null)}
                      className={`flex flex-col gap-1.5 rounded-lg border bg-background/60 p-2 transition ${
                        galleryDrag?.blockIndex === index && galleryDrag.imgIndex === imgIdx
                          ? 'border-primary opacity-60'
                          : 'border-border'
                      }`}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-black/20">
                        <img src={img.url} alt={img.alt || ''} className="h-full w-full cursor-grab object-cover" />
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            const nextImgs = block.images.filter((_, i) => i !== imgIdx)
                            update(index, { images: nextImgs })
                          }}
                          className="absolute top-1.5 right-1.5 inline-flex size-6 cursor-pointer items-center justify-center rounded-full bg-black/75 text-white hover:bg-destructive"
                          title="Remove photo"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      <Input
                        disabled={disabled}
                        placeholder="Photo caption…"
                        className="h-7 text-xs"
                        value={img.caption || ''}
                        onChange={(e) => {
                          const nextImgs = block.images.map((item, i) =>
                            i === imgIdx ? { ...item, caption: e.target.value } : item,
                          )
                          update(index, { images: nextImgs })
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/80 px-3 py-5 text-center text-xs text-muted-foreground">
                  Drag &amp; drop multiple photos here, select files above, or pick from the Media Library.
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label>Gallery Caption</Label>
                <Input
                  disabled={disabled}
                  placeholder="Optional overall gallery caption…"
                  value={block.caption || ''}
                  onChange={(e) => update(index, { caption: e.target.value })}
                />
              </div>
            </div>
          )}

          {block.type === 'callout' && (
            <div className="grid gap-2 sm:grid-cols-[11rem_1fr]">
              <div className="flex flex-col gap-1.5">
                <Label>Callout Style</Label>
                <Select
                  disabled={disabled}
                  value={block.tone || 'tip'}
                  onValueChange={(tone) => update(index, { tone })}
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tip">Studio Tip</SelectItem>
                    <SelectItem value="summary">Executive Summary</SelectItem>
                    <SelectItem value="pricing">Pricing &amp; Package Guide</SelectItem>
                    <SelectItem value="note">Technical Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Callout Title</Label>
                <Input
                  disabled={disabled}
                  placeholder="e.g., Key Takeaway for Bacoor Drivers"
                  value={block.title || ''}
                  onChange={(e) => update(index, { title: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>Callout Text</Label>
                <Textarea
                  disabled={disabled}
                  rows={3}
                  placeholder="Highlight key facts, pricing notes, or technician tips…"
                  value={block.text || ''}
                  onChange={(e) => update(index, { text: e.target.value })}
                />
              </div>
            </div>
          )}

          {block.type === 'video' && (
            <div className="grid gap-2">
              <div className="flex flex-col gap-1.5">
                <Label>Video URL (YouTube, Vimeo, or .mp4)</Label>
                <Input
                  disabled={disabled}
                  placeholder="https://www.youtube.com/watch?v=…"
                  value={block.url}
                  onChange={(e) => update(index, { url: e.target.value })}
                />
              </div>
              <Input
                type="file"
                accept="video/mp4,video/webm"
                disabled={disabled || uploadingIndex === index}
                className="max-w-xs cursor-pointer"
                onChange={(e) => onUploadSingle(index, e.target.files?.[0])}
              />
              <div className="flex flex-col gap-1.5">
                <Label>Caption</Label>
                <Input
                  disabled={disabled}
                  value={block.caption}
                  onChange={(e) => update(index, { caption: e.target.value })}
                />
              </div>
            </div>
          )}

          {block.type === 'quote' && (
            <div className="grid gap-2">
              <div className="flex flex-col gap-1.5">
                <Label>Quote</Label>
                <Textarea
                  disabled={disabled}
                  placeholder="Enter pull quote…"
                  value={block.text}
                  onChange={(e) => update(index, { text: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Cite / Attribution</Label>
                <Input
                  disabled={disabled}
                  placeholder="e.g., Hakum Auto Care — Lead Detailer"
                  value={block.cite}
                  onChange={(e) => update(index, { cite: e.target.value })}
                />
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
                  placeholder="Enter one list item per line…"
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
                <Input
                  disabled={disabled}
                  value={block.label}
                  onChange={(e) => update(index, { label: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Style</Label>
                <Select
                  disabled={disabled}
                  value={block.style || 'primary'}
                  onValueChange={(style) => update(index, { style })}
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary (Electric Blue)</SelectItem>
                    <SelectItem value="secondary">Secondary (Outline)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>Link URL</Label>
                <Input
                  disabled={disabled}
                  value={block.url}
                  onChange={(e) => update(index, { url: e.target.value })}
                  placeholder="/book or https://…"
                />
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
        <div className="rounded-xl border border-dashed border-border bg-muted/10 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" /> Add WordPress Content Block
          </p>
          <div className="flex flex-wrap gap-1.5">
            {BLOCK_TYPES.map((t) => (
              <Button
                key={t.value}
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer text-xs"
                onClick={() => add(t.value)}
              >
                <Plus className="size-3.5" /> {t.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <MediaLibraryDialog
        open={Boolean(libraryTarget)}
        onOpenChange={(open) => !open && setLibraryTarget(null)}
        title="Insert Photo from Media Library"
        onSelect={(item) => {
          if (!libraryTarget) return
          const { index, mode } = libraryTarget
          if (mode === 'gallery') {
            const existing = Array.isArray(rows[index]?.images) ? rows[index].images : []
            update(index, {
              images: [
                ...existing,
                {
                  id: `g-${Date.now()}`,
                  url: item.url,
                  alt: item.alt || item.name || '',
                  caption: '',
                },
              ],
            })
          } else {
            update(index, {
              url: item.url,
              alt: rows[index]?.alt || item.alt || item.name || '',
            })
          }
          setLibraryTarget(null)
        }}
      />
    </div>
  )
}
