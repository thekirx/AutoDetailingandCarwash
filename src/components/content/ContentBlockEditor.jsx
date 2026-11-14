import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  FolderOpen,
  ImagePlus,
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

/**
 * WordPress-like Gutenberg block editor for blogs & events.
 * Supports drag-and-drop photo upload, multi-photo galleries, callouts, headings,
 * paragraphs, quotes, lists, videos, dividers, and form CTA buttons.
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
  const [libraryTarget, setLibraryTarget] = useState(null)

  function commit(next) {
    onChange?.(normalizeBlocks(next))
  }

  function update(index, patch) {
    commit(rows.map((b, i) => (i === index ? { ...b, ...patch } : b)))
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
    <div className="flex flex-col gap-3">
      {rows.map((block, index) => (
        <div
          key={block.id}
          className="rounded-xl border border-border bg-muted/20 p-3.5 transition hover:border-border/80"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                {index + 1}
              </span>
              <Select
                disabled={disabled}
                value={block.type}
                onValueChange={(type) => {
                  const fresh = emptyBlock(type)
                  commit(
                    rows.map((b, i) =>
                      i === index ? { ...fresh, id: b.id, post_meta: b.post_meta } : b,
                    ),
                  )
                }}
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
            <div className="flex flex-col gap-1.5">
              <Label>Paragraph Text</Label>
              <Textarea
                disabled={disabled}
                rows={4}
                placeholder="Write your paragraph content…"
                value={block.text}
                onChange={(e) => update(index, { text: e.target.value })}
              />
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
                      className="flex flex-col gap-1.5 rounded-lg border border-border bg-background/60 p-2"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-black/20">
                        <img src={img.url} alt={img.alt || ''} className="h-full w-full object-cover" />
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
