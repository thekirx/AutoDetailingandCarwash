import { supabase } from '@/lib/supabase'
import {
  attachContentMeta,
  emptyBlock,
  estimateReadingStats,
  extractContentMeta,
  normalizeBlocks,
  slugifyContentTitle,
} from '@/lib/contentBlocks'
import { slugifyEventTitle } from '@/lib/planningPart6'
import { findBuiltInBlogPost } from '@/lib/seoLocalGuides'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUuid(id) {
  return UUID_RE.test(String(id || '').trim())
}

async function callManageContentApi(body) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Please sign in to manage site content.')
  const resp = await fetch('/api/staff?op=manage-content', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(json?.error || `Content operation failed (${resp.status})`)
  }
  return json
}

export function createEmptyBlogDraft() {
  return {
    id: null,
    title: '',
    slug: '',
    excerpt: '',
    cover_url: '/branding/hakum-lw-blue.png',
    author_label: 'Hakum Auto Care',
    status: 'draft',
    is_published: false,
    published_at: new Date().toISOString(),
    category: 'Regional Authority Guide',
    region: 'all',
    ai_summary: '',
    read_minutes: 4,
    is_featured: false,
    content_blocks: [emptyBlock('heading'), emptyBlock('paragraph')],
  }
}

export function prepareBlogForEditor(post = {}) {
  if (!post || !post.title) return createEmptyBlogDraft()
  const meta = extractContentMeta(post)
  const blocks = normalizeBlocks(post.content_blocks)
  return {
    id: isValidUuid(post.id) ? post.id : null,
    slug: post.slug || '',
    title: post.title || '',
    excerpt: post.excerpt || '',
    cover_url: post.cover_url || '/branding/hakum-lw-blue.png',
    author_label: post.author_label || 'Hakum Auto Care',
    status: post.status || (post.is_published ? 'published' : 'draft'),
    is_published: Boolean(post.is_published ?? post.status === 'published'),
    published_at: post.published_at || new Date().toISOString(),
    category: meta.category || 'Regional Authority Guide',
    region: meta.region || 'all',
    ai_summary: meta.ai_summary || post.excerpt || '',
    read_minutes: meta.read_minutes || estimateReadingStats(blocks, post.title, post.excerpt).readMinutes,
    is_featured: Boolean(meta.is_featured),
    is_builtin_guide: Boolean(post.is_builtin_guide && !isValidUuid(post.id)),
    content_blocks: blocks.length ? blocks : [emptyBlock('paragraph')],
  }
}

export function createEmptyEventDraft(defaultBranch = '') {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  now.setHours(now.getHours() + 24)
  return {
    id: null,
    title: '',
    slug: '',
    description: '',
    branch: defaultBranch || '',
    starts_at: toLocalDatetimeInput(now.toISOString()),
    ends_at: '',
    banner_url: '/content/events-stay-tuned.webp',
    is_published: false,
    is_date_tba: false,
    form_id: '',
    content_blocks: [emptyBlock('heading'), emptyBlock('paragraph')],
  }
}

export function prepareEventForEditor(ev = {}, defaultBranch = '') {
  if (!ev || !ev.title) return createEmptyEventDraft(defaultBranch)
  const blocks = normalizeBlocks(ev.content_blocks)
  return {
    id: isValidUuid(ev.id) ? ev.id : null,
    title: ev.title || '',
    slug: ev.slug || '',
    description: ev.description || '',
    branch: ev.branch || '',
    starts_at: toLocalDatetimeInput(ev.starts_at),
    ends_at: toLocalDatetimeInput(ev.ends_at),
    banner_url: ev.banner_url || '/content/events-stay-tuned.webp',
    is_published: Boolean(ev.is_published),
    is_date_tba: Boolean(ev.is_date_tba),
    form_id: ev.form_id || '',
    content_blocks: blocks,
  }
}

export function toLocalDatetimeInput(iso) {
  if (!iso) return ''
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(iso))) return String(iso)
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export async function fetchAllCmsBlogs() {
  const { data, error } = await supabase
    .from('blogs')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(100)
  if (!error && Array.isArray(data)) {
    return data
  }
  try {
    const res = await callManageContentApi({ action: 'list-blogs' })
    return res.data || []
  } catch {
    return data || []
  }
}

export async function fetchAllCmsEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, description, branch, starts_at, ends_at, is_published, is_date_tba, slug, form_id, banner_url, content_blocks, ops_forms!form_id ( id, name, slug, public_enabled, status )')
    .order('starts_at', { ascending: false })
    .limit(80)
  if (!error && Array.isArray(data)) {
    return data
  }
  try {
    const res = await callManageContentApi({ action: 'list-events' })
    return res.data || []
  } catch {
    return data || []
  }
}

export async function saveCmsBlog(editorState, profile = null) {
  const title = String(editorState?.title || '').trim()
  if (!title) throw new Error('Blog title is required.')

  const stats = estimateReadingStats(editorState.content_blocks, title, editorState.excerpt)
  const blocksWithMeta = attachContentMeta(editorState.content_blocks, {
    category: editorState.category || 'Regional Authority Guide',
    region: editorState.region || 'all',
    ai_summary: editorState.ai_summary || editorState.excerpt || '',
    read_minutes: Number(editorState.read_minutes) || stats.readMinutes,
    is_featured: Boolean(editorState.is_featured),
  })

  let existingId = isValidUuid(editorState.id) ? editorState.id : null
  const rawSlug = String(editorState.slug || '').trim()

  if (!existingId && rawSlug) {
    const { data: existingBySlug } = await supabase
      .from('blogs')
      .select('id')
      .eq('slug', rawSlug)
      .maybeSingle()
    if (existingBySlug?.id) existingId = existingBySlug.id
  }

  const id = existingId || crypto.randomUUID()
  const slug = rawSlug || slugifyContentTitle(title, id)
  const status = ['draft', 'published', 'archived'].includes(editorState.status)
    ? editorState.status
    : editorState.is_published
      ? 'published'
      : 'draft'
  const published = status === 'published'

  const row = {
    id,
    title,
    slug,
    excerpt: String(editorState.excerpt || '').trim() || null,
    cover_url: String(editorState.cover_url || '').trim() || null,
    author_label: String(editorState.author_label || '').trim() || 'Hakum Auto Care',
    status,
    is_published: published,
    published_at: published
      ? editorState.published_at
        ? new Date(editorState.published_at).toISOString()
        : new Date().toISOString()
      : null,
    content_blocks: blocksWithMeta,
    updated_at: new Date().toISOString(),
  }

  const query = existingId
    ? supabase.from('blogs').update(row).eq('id', existingId).select('*').maybeSingle()
    : supabase
        .from('blogs')
        .upsert({ ...row, created_by: profile?.id || null }, { onConflict: 'slug' })
        .select('*')
        .maybeSingle()

  const { data, error } = await query
  if (!error) {
    clearAutosaveDraft('blog', existingId || slug || 'new')
    clearAutosaveDraft('blog', 'new')
    return data || row
  }

  // Fallback to authenticated server endpoint
  const res = await callManageContentApi({ action: 'save-blog', row })
  clearAutosaveDraft('blog', existingId || slug || 'new')
  clearAutosaveDraft('blog', 'new')
  return res.data || row
}

export async function deleteCmsBlog(post, profile = null) {
  const id = isValidUuid(post?.id) ? post.id : null
  const slug = String(post?.slug || '').trim()
  const isBuiltIn = Boolean(findBuiltInBlogPost(slug))

  // If this is a built-in guide with no DB row yet, or if deleting a built-in guide,
  // archive it in the DB so it is hidden from public pages unless restored.
  if (isBuiltIn && !id) {
    const builtIn = findBuiltInBlogPost(slug)
    return saveCmsBlog(
      {
        ...builtIn,
        id: null,
        status: 'archived',
        is_published: false,
      },
      profile,
    )
  }

  if (id) {
    const { error } = await supabase.from('blogs').delete().eq('id', id)
    if (!error) return { ok: true }
  }

  return callManageContentApi({ action: 'delete-blog', id, slug })
}

export async function saveCmsEvent(editorState) {
  const title = String(editorState?.title || '').trim()
  if (!title) throw new Error('Event title is required.')
  if (!editorState?.starts_at && !editorState?.is_date_tba) {
    throw new Error('Event start date/time is required (or mark Date TBA).')
  }

  const existingId = isValidUuid(editorState.id) ? editorState.id : null
  const id = existingId || crypto.randomUUID()
  const slug = String(editorState.slug || '').trim() || slugifyEventTitle(title, id)
  const startsIso = editorState.starts_at
    ? new Date(editorState.starts_at).toISOString()
    : new Date().toISOString()
  const endsIso = editorState.ends_at ? new Date(editorState.ends_at).toISOString() : null

  const row = {
    id,
    title,
    slug,
    description: String(editorState.description || '').trim() || null,
    branch: String(editorState.branch || '').trim() || null,
    starts_at: startsIso,
    ends_at: endsIso,
    banner_url: String(editorState.banner_url || '').trim() || null,
    is_published: Boolean(editorState.is_published),
    is_date_tba: Boolean(editorState.is_date_tba),
    form_id: editorState.form_id || null,
    content_blocks: normalizeBlocks(editorState.content_blocks),
    updated_at: new Date().toISOString(),
  }

  const query = existingId
    ? supabase.from('events').update(row).eq('id', existingId).select('*').maybeSingle()
    : supabase.from('events').insert(row).select('*').maybeSingle()

  const { data, error } = await query
  if (!error) {
    clearAutosaveDraft('event', existingId || slug || 'new')
    clearAutosaveDraft('event', 'new')
    return data || row
  }

  const res = await callManageContentApi({ action: 'save-event', row })
  clearAutosaveDraft('event', existingId || slug || 'new')
  clearAutosaveDraft('event', 'new')
  return res.data || row
}

export async function deleteCmsEvent(id) {
  if (!id) throw new Error('Event ID is required.')
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (!error) return { ok: true }
  return callManageContentApi({ action: 'delete-event', id })
}

// ── LocalStorage Autosave Helpers ──────────────────────────────────────────
function autosaveStorageKey(kind, key) {
  return `hakum_cms_autosave_${kind}_${key || 'new'}`
}

export function writeAutosaveDraft(kind, key, data) {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const savedAt = new Date().toISOString()
    const payload = { savedAt, data }
    window.localStorage.setItem(autosaveStorageKey(kind, key), JSON.stringify(payload))
    return savedAt
  } catch {
    return null
  }
}

export function readAutosaveDraft(kind, key) {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const raw = window.localStorage.getItem(autosaveStorageKey(kind, key))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.data) return null
    return parsed
  } catch {
    return null
  }
}

export function clearAutosaveDraft(kind, key) {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.removeItem(autosaveStorageKey(kind, key))
  } catch {
    // ignore
  }
}

