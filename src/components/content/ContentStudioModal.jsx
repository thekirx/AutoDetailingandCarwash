import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Columns2,
  Eye,
  FileText,
  Globe,
  Laptop,
  Loader2,
  PenLine,
  RotateCcw,
  Save,
  Send,
  Settings2,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
} from 'lucide-react'
import ContentBlockEditor, { MediaDropzoneField } from '@/components/content/ContentBlockEditor'
import ContentBlockRenderer from '@/components/content/ContentBlockRenderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NamedSelect } from '@/components/ui/named-select'
import { Textarea } from '@/components/ui/textarea'
import {
  BLOG_CATEGORY_OPTIONS,
  BLOG_REGION_OPTIONS,
  estimateReadingStats,
  slugifyContentTitle,
} from '@/lib/contentBlocks'
import { slugifyEventTitle } from '@/lib/planningPart6'
import {
  clearAutosaveDraft,
  deleteCmsBlog,
  deleteCmsEvent,
  readAutosaveDraft,
  saveCmsBlog,
  saveCmsEvent,
  writeAutosaveDraft,
} from '@/lib/contentCmsApi'
import { toast } from 'sonner'

/**
 * WordPress-style interactive Content Studio for both Blog Posts and Events.
 * Includes:
 * - Write / Split View / Live Preview modes
 * - Responsive Desktop / Tablet / Mobile preview switcher
 * - Real-time localStorage autosave + 1-click draft recovery
 * - Drag-and-drop photo upload + Media Library picker
 * - One-click Save Draft, Publish Now, and Delete actions
 */
export default function ContentStudioModal({
  open,
  onOpenChange,
  kind = 'blog', // 'blog' | 'event'
  initialValue = null,
  profile = null,
  forms = [],
  branchOptions = [],
  onSaved,
  onDeleted,
}) {
  const [draft, setDraft] = useState(initialValue)
  const [viewMode, setViewMode] = useState('write') // 'write' | 'split' | 'preview'
  const [viewport, setViewport] = useState('desktop') // 'desktop' | 'tablet' | 'mobile'
  const [showSettings, setShowSettings] = useState(true)
  const [saving, setSaving] = useState(false)
  const [autosaveInfo, setAutosaveInfo] = useState({ status: 'idle', time: '' })
  const [recoverableDraft, setRecoverableDraft] = useState(null)
  const dirtyRef = useRef(false)

  const draftKey = useMemo(() => {
    if (!initialValue) return 'new'
    return initialValue.id || initialValue.slug || 'new'
  }, [initialValue])

  useEffect(() => {
    if (!open || !initialValue) return
    setDraft(initialValue)
    dirtyRef.current = false
    setAutosaveInfo({ status: 'idle', time: '' })
    const saved = readAutosaveDraft(kind, initialValue.id || initialValue.slug || 'new')
    if (saved?.data && saved.data.title && saved.data.title !== initialValue.title) {
      setRecoverableDraft(saved)
    } else if (saved?.data && !initialValue.id && !initialValue.title) {
      setRecoverableDraft(saved)
    } else {
      setRecoverableDraft(null)
    }
  }, [open, initialValue, kind])

  // Real-time debounced autosave
  useEffect(() => {
    if (!open || !draft || !dirtyRef.current) return undefined
    setAutosaveInfo((prev) => ({ ...prev, status: 'saving' }))
    const timer = setTimeout(() => {
      const iso = writeAutosaveDraft(kind, draftKey, draft)
      if (iso) {
        const formatted = new Date(iso).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        setAutosaveInfo({ status: 'saved', time: formatted })
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [open, draft, kind, draftKey])

  function updateDraft(patch) {
    dirtyRef.current = true
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const formsById = useMemo(() => {
    const map = {}
    for (const f of forms) map[f.id] = f
    return map
  }, [forms])

  const stats = useMemo(
    () =>
      estimateReadingStats(
        draft?.content_blocks || [],
        draft?.title || '',
        kind === 'blog' ? draft?.excerpt || '' : draft?.description || '',
      ),
    [draft?.content_blocks, draft?.title, draft?.excerpt, draft?.description, kind],
  )

  if (!draft) return null

  const isBlog = kind === 'blog'
  const isPublished = isBlog ? draft.status === 'published' || draft.is_published : Boolean(draft.is_published)
  const previewSlug =
    draft.slug ||
    (isBlog
      ? slugifyContentTitle(draft.title || 'new-post')
      : slugifyEventTitle(draft.title || 'new-event'))

  async function persistWithStatus(targetStatus) {
    const nextDraft = { ...draft }
    if (isBlog) {
      if (targetStatus === 'published') {
        nextDraft.status = 'published'
        nextDraft.is_published = true
      } else if (targetStatus === 'draft') {
        nextDraft.status = 'draft'
        nextDraft.is_published = false
      }
    } else if (targetStatus === 'published') {
      nextDraft.is_published = true
    } else if (targetStatus === 'draft') {
      nextDraft.is_published = false
    }

    setSaving(true)
    try {
      const saved = isBlog
        ? await saveCmsBlog(nextDraft, profile)
        : await saveCmsEvent(nextDraft)
      dirtyRef.current = false
      toast.success(
        targetStatus === 'published'
          ? `${isBlog ? 'Blog post' : 'Event'} published live!`
          : targetStatus === 'draft'
            ? `${isBlog ? 'Blog' : 'Event'} saved as draft`
            : `${isBlog ? 'Blog' : 'Event'} saved`,
      )
      onSaved?.(saved)
      onOpenChange?.(false)
    } catch (err) {
      toast.error(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const label = isBlog ? 'blog post' : 'event'
    if (!window.confirm(`Delete "${draft.title || label}"?`)) return
    setSaving(true)
    try {
      if (isBlog) await deleteCmsBlog(draft, profile)
      else await deleteCmsEvent(draft.id)
      clearAutosaveDraft(kind, draftKey)
      toast.success(`${isBlog ? 'Blog post' : 'Event'} deleted`)
      onDeleted?.(draft)
      onOpenChange?.(false)
    } catch (err) {
      toast.error(err?.message || 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const previewWidthClass =
    viewport === 'mobile'
      ? 'mx-auto max-w-[375px]'
      : viewport === 'tablet'
        ? 'mx-auto max-w-[768px]'
        : 'w-full'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-[96vw] overflow-y-auto p-0 sm:max-w-6xl">
        {/* Top WordPress Studio Command Bar */}
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <DialogHeader className="space-y-0.5 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="text-base font-semibold sm:text-lg">
                {draft.id || draft.is_builtin_guide
                  ? `Edit ${isBlog ? 'Blog Post' : 'Event'}`
                  : `New ${isBlog ? 'Blog Post' : 'Event'}`}
              </DialogTitle>
              <Badge variant={isPublished ? 'default' : 'secondary'}>
                {isPublished ? 'Published' : isBlog ? draft.status || 'Draft' : 'Draft'}
              </Badge>
              {draft.is_builtin_guide && (
                <Badge variant="outline" className="text-[11px]">
                  Regional SEO Guide
                </Badge>
              )}
            </div>
            <DialogDescription className="flex flex-wrap items-center gap-3 text-xs">
              <span>
                {stats.words} words · {stats.blockCount} blocks · ~{stats.readMinutes} min read
              </span>
              {autosaveInfo.status === 'saving' && (
                <span className="inline-flex items-center gap-1 text-amber-500">
                  <Clock className="size-3 animate-spin" /> Autosaving draft…
                </span>
              )}
              {autosaveInfo.status === 'saved' && (
                <span className="inline-flex items-center gap-1 text-emerald-500">
                  <CheckCircle2 className="size-3" /> Draft autosaved {autosaveInfo.time}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* View Mode & Viewport Switcher */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('write')}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === 'write'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <PenLine className="size-3.5" /> Write
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`hidden cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition lg:inline-flex ${
                  viewMode === 'split'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Columns2 className="size-3.5" /> Split View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === 'preview'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Eye className="size-3.5" /> Preview
              </button>
            </div>

            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewport('desktop')}
                  title="Desktop preview"
                  className={`cursor-pointer rounded-md p-1.5 text-xs ${
                    viewport === 'desktop' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'
                  }`}
                >
                  <Laptop className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewport('tablet')}
                  title="Tablet preview (768px)"
                  className={`cursor-pointer rounded-md p-1.5 text-xs ${
                    viewport === 'tablet' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'
                  }`}
                >
                  <Tablet className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewport('mobile')}
                  title="Mobile preview (375px)"
                  className={`cursor-pointer rounded-md p-1.5 text-xs ${
                    viewport === 'mobile' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'
                  }`}
                >
                  <Smartphone className="size-3.5" />
                </button>
              </div>
            )}

            <Button
              type="button"
              size="sm"
              variant={showSettings ? 'secondary' : 'outline'}
              className="h-8 cursor-pointer text-xs"
              onClick={() => setShowSettings((s) => !s)}
            >
              <Settings2 className="mr-1 size-3.5" />
              Settings
            </Button>
          </div>
        </div>

        {/* Unsaved Draft Recovery Banner */}
        {recoverableDraft && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs">
            <span className="font-medium text-foreground">
              Unsaved local draft found (&ldquo;{recoverableDraft.data?.title || 'Untitled'}&rdquo; · saved{' '}
              {new Date(recoverableDraft.savedAt).toLocaleTimeString()}).
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 cursor-pointer text-xs"
                onClick={() => {
                  setDraft(recoverableDraft.data)
                  setRecoverableDraft(null)
                  toast.success('Autosaved draft restored')
                }}
              >
                <RotateCcw className="mr-1 size-3" /> Restore Draft
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 cursor-pointer text-xs"
                onClick={() => {
                  clearAutosaveDraft(kind, draftKey)
                  setRecoverableDraft(null)
                }}
              >
                Discard
              </Button>
            </div>
          </div>
        )}

        {/* Main Studio Body */}
        <div
          className={`grid gap-6 p-4 sm:p-6 ${
            viewMode === 'split' ? 'lg:grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {/* Left / Write Column */}
          {viewMode !== 'preview' && (
            <div className="flex flex-col gap-5">
              {/* Primary Title & Slug */}
              <div className="grid gap-3 rounded-xl border border-border bg-muted/15 p-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cms-title" className="text-sm font-semibold">
                    {isBlog ? 'Article Headline (H1)' : 'Event Title'}
                  </Label>
                  <Input
                    id="cms-title"
                    required
                    placeholder={
                      isBlog
                        ? 'e.g., Why Hakum Auto Care Is the Best Car Wash in Bacoor'
                        : 'e.g., Hakum Saturday Cars & Coffee Meet'
                    }
                    className="text-base font-medium"
                    value={draft.title}
                    onChange={(e) => updateDraft({ title: e.target.value })}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cms-slug" className="text-xs text-muted-foreground">
                      URL Permalink ({isBlog ? `/blog/${previewSlug}` : `/events/${previewSlug}`})
                    </Label>
                    <Input
                      id="cms-slug"
                      placeholder="auto-generated-from-title"
                      value={draft.slug}
                      onChange={(e) => updateDraft({ slug: e.target.value })}
                    />
                  </div>
                  {isBlog ? (
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Publication Status</Label>
                      <NamedSelect
                        value={draft.status || 'draft'}
                        onChange={(status) =>
                          updateDraft({ status, is_published: status === 'published' })
                        }
                        options={[
                          { value: 'draft', label: 'Draft (Private)' },
                          { value: 'published', label: 'Published (Live on Site)' },
                          { value: 'archived', label: 'Archived (Hidden)' },
                        ]}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Event Visibility</Label>
                      <NamedSelect
                        value={draft.is_published ? 'yes' : 'no'}
                        onChange={(v) => updateDraft({ is_published: v === 'yes' })}
                        options={[
                          { value: 'no', label: 'Draft (Hidden)' },
                          { value: 'yes', label: 'Published (Live on /events)' },
                        ]}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Featured Cover Photo / Event Banner with Drag & Drop + Media Library */}
              <div className="rounded-xl border border-border bg-muted/15 p-4">
                <MediaDropzoneField
                  label={isBlog ? 'Featured Cover Photo' : 'Event Banner Photo'}
                  value={isBlog ? draft.cover_url : draft.banner_url}
                  onChange={(url) =>
                    updateDraft(isBlog ? { cover_url: url } : { banner_url: url })
                  }
                  helperText="Drag & drop a photo, upload from your phone/computer, or select from the Hakum Media Library."
                />
              </div>

              {/* Collapsible WordPress Settings, SEO & Options Panel */}
              {showSettings && (
                <div className="grid gap-4 rounded-xl border border-border bg-muted/15 p-4">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      <Settings2 className="size-3.5 text-primary" />
                      {isBlog ? 'Post Settings, Regional SEO & AI Summary' : 'Event Schedule, Branch & RSVP Form'}
                    </span>
                  </div>

                  {isBlog ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label>Target Region / City SEO Hub</Label>
                        <NamedSelect
                          value={draft.region || 'all'}
                          onChange={(region) => updateDraft({ region })}
                          options={BLOG_REGION_OPTIONS}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Article Category Badge</Label>
                        <NamedSelect
                          value={draft.category || 'Regional Authority Guide'}
                          onChange={(category) => updateDraft({ category })}
                          options={BLOG_CATEGORY_OPTIONS}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Author / Studio Byline</Label>
                        <Input
                          value={draft.author_label || ''}
                          onChange={(e) => updateDraft({ author_label: e.target.value })}
                          placeholder="Hakum Auto Care"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Estimated Reading Time (minutes)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={60}
                          value={draft.read_minutes || stats.readMinutes}
                          onChange={(e) => updateDraft({ read_minutes: Number(e.target.value) || 4 })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <Label>Card Excerpt (Shown on /events#blog grid)</Label>
                        <Textarea
                          rows={2}
                          value={draft.excerpt || ''}
                          onChange={(e) => updateDraft({ excerpt: e.target.value })}
                          placeholder="Short summary shown on the blog card…"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <Label className="flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-primary" />
                          Executive Summary / AI Search Citation Box (Google AI Overviews &amp; ChatGPT)
                        </Label>
                        <Textarea
                          rows={3}
                          value={draft.ai_summary || ''}
                          onChange={(e) => updateDraft({ ai_summary: e.target.value })}
                          placeholder="Direct, factual answer summarizing why Hakum Auto Care is the top studio for this topic and city…"
                        />
                      </div>

                      {/* Live Google SERP Preview */}
                      <div className="rounded-lg border border-border bg-background/80 p-3 sm:col-span-2">
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                          <Globe className="size-3" /> Google Search &amp; AI Snippet Preview
                        </p>
                        <p className="truncate text-xs text-emerald-500">
                          https://www.hakumautocare.com/blog/{previewSlug}
                        </p>
                        <p className="truncate text-sm font-semibold text-blue-400">
                          {draft.title || 'Untitled Blog Post'} · Hakum Auto Care
                        </p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {draft.ai_summary ||
                            draft.excerpt ||
                            'Explore car wash, auto detailing, ceramic coating, and PPF guides from Hakum Auto Care.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label>Branch Location</Label>
                        <NamedSelect
                          value={draft.branch || ''}
                          onChange={(branch) => updateDraft({ branch })}
                          options={[{ value: '', label: 'All Branches / Community' }, ...branchOptions]}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Attached RSVP / Registration Smart Form</Label>
                        <NamedSelect
                          value={draft.form_id || ''}
                          onChange={(form_id) => updateDraft({ form_id })}
                          emptyLabel="Built-in Quick Registration Form"
                          options={forms.map((f) => ({ value: f.id, label: f.name }))}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Starts At</Label>
                        <Input
                          type="datetime-local"
                          disabled={Boolean(draft.is_date_tba)}
                          required={!draft.is_date_tba}
                          value={draft.starts_at || ''}
                          onChange={(e) => updateDraft({ starts_at: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Ends At (Optional)</Label>
                        <Input
                          type="datetime-local"
                          disabled={Boolean(draft.is_date_tba)}
                          value={draft.ends_at || ''}
                          onChange={(e) => updateDraft({ ends_at: e.target.value })}
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={Boolean(draft.is_date_tba)}
                          onChange={(e) => updateDraft({ is_date_tba: e.target.checked })}
                        />
                        Date is To Be Announced (TBA) — shows &ldquo;To be announced&rdquo; on public card
                      </label>
                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <Label>Event Summary / Short Description</Label>
                        <Textarea
                          rows={2}
                          value={draft.description || ''}
                          onChange={(e) => updateDraft({ description: e.target.value })}
                          placeholder="Short summary shown on the /events card…"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* WordPress Block Editor */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold">
                    <FileText className="size-4 text-primary" />
                    WordPress Content Blocks ({stats.blockCount})
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Add headings, paragraphs, photos, galleries, callouts, videos, quotes, or CTA buttons
                  </span>
                </div>
                <ContentBlockEditor
                  allowFormCta={!isBlog}
                  forms={forms}
                  blocks={draft.content_blocks}
                  onChange={(content_blocks) => updateDraft({ content_blocks })}
                />
              </div>
            </div>
          )}

          {/* Right / Live Interactive Preview Column */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  Live Interactive Preview ({viewport.toUpperCase()})
                </span>
                <span>
                  {isBlog ? `/blog/${previewSlug}` : `/events/${previewSlug}`}
                </span>
              </div>

              <div
                className={`overflow-hidden rounded-2xl border border-border bg-[#070b16] p-5 text-[#f0f4fa] shadow-xl transition-all sm:p-7 ${previewWidthClass}`}
              >
                <p className="mb-2 text-[11px] font-semibold tracking-widest text-blue-400 uppercase">
                  {isBlog
                    ? `${draft.category || 'Regional Authority Guide'}${
                        draft.region && draft.region !== 'all' ? ` · ${draft.region.toUpperCase()}` : ''
                      }`
                    : `Event${draft.branch ? ` · ${draft.branch}` : ''}`}
                </p>
                <h2 className="mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {draft.title || (isBlog ? 'Untitled Blog Post' : 'Untitled Event')}
                </h2>
                <p className="mb-4 text-xs text-slate-400">
                  {isBlog
                    ? `${draft.author_label || 'Hakum Auto Care'} · ${stats.readMinutes} min read`
                    : draft.is_date_tba
                      ? 'Date To Be Announced'
                      : draft.starts_at
                        ? new Date(draft.starts_at).toLocaleString()
                        : 'Date not set'}
                </p>

                {(isBlog ? draft.cover_url : draft.banner_url) ? (
                  <div className="mb-5 overflow-hidden rounded-xl border border-white/10">
                    <img
                      src={isBlog ? draft.cover_url : draft.banner_url}
                      alt={draft.title || ''}
                      className="max-h-64 w-full object-cover"
                    />
                  </div>
                ) : null}

                {isBlog && draft.ai_summary ? (
                  <div className="mb-5 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                    <p className="mb-1 text-[11px] font-bold tracking-wider text-blue-400 uppercase">
                      Executive Summary
                    </p>
                    <p className="text-sm leading-relaxed text-slate-200">{draft.ai_summary}</p>
                  </div>
                ) : null}

                {!isBlog && draft.description ? (
                  <p className="mb-5 text-sm leading-relaxed text-slate-200">{draft.description}</p>
                ) : null}

                <ContentBlockRenderer
                  blocks={draft.content_blocks}
                  formsById={formsById}
                  mobile={viewport === 'mobile'}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sticky Interactive Footer: Delete, Save Draft, Publish Now */}
        <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            {(draft.id || draft.is_builtin_guide) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                className="cursor-pointer text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
              >
                <Trash2 className="mr-1.5 size-4" />
                Delete
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              className="cursor-pointer"
              onClick={() => onOpenChange?.(false)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              className="cursor-pointer"
              onClick={() => persistWithStatus('draft')}
            >
              {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Save className="mr-1.5 size-3.5" />}
              Save as Draft
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={saving}
              className="cursor-pointer"
              onClick={() => persistWithStatus('published')}
            >
              {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Send className="mr-1.5 size-3.5" />}
              {isPublished ? 'Update Published' : 'Publish Now'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
