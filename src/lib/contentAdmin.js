import { normalizeContentStatus } from './contentStatus.js'
import { slugifyEventTitle } from './planningPart6Events.js'

const SUPPORTED_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
])
const MAX_MEDIA_BYTES = 20 * 1024 * 1024

function clean(value) {
  return String(value || '').trim()
}

function safeUrl(value) {
  const normalized = clean(value)
  if (!normalized) return null
  try {
    const url = new URL(normalized)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : false
  } catch {
    return false
  }
}

function isoDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : false
}

export function normalizePostInput(input = {}) {
  const errors = {}
  const title = clean(input.title)
  const sourceUrl = safeUrl(input.sourceUrl)
  const mediaUrl = safeUrl(input.mediaUrl)

  if (!title) errors.title = 'Title is required.'
  if (sourceUrl === false) errors.sourceUrl = 'Use a valid http or https link.'
  if (mediaUrl === false) errors.mediaUrl = 'Use a valid http or https media link.'

  return {
    value: {
      title,
      excerpt: clean(input.excerpt),
      source_url: sourceUrl || null,
      media_url: mediaUrl || null,
      platform: ['facebook', 'instagram', 'external'].includes(input.platform) ? input.platform : 'external',
      cta_label: clean(input.ctaLabel) || 'View original post',
      status: normalizeContentStatus(input.status),
      published_at: input.publishedAt || null,
    },
    errors,
  }
}

export function normalizeEventInput(input = {}) {
  const errors = {}
  const title = clean(input.title)
  const startsAt = isoDate(input.startsAt)
  const endsAt = isoDate(input.endsAt)
  const sourceUrl = safeUrl(input.sourceUrl)
  const registrationUrl = safeUrl(input.registrationUrl)
  const mediaUrl = safeUrl(input.mediaUrl)
  const status = normalizeContentStatus(input.status)

  if (!title) errors.title = 'Title is required.'
  if (!startsAt) errors.startsAt = 'Enter a valid start date and time.'
  if (endsAt === false) errors.endsAt = 'Enter a valid end date and time.'
  if (startsAt && endsAt && new Date(endsAt) < new Date(startsAt)) {
    errors.endsAt = 'End time must be after the start time.'
  }
  if (sourceUrl === false) errors.sourceUrl = 'Use a valid http or https link.'
  if (registrationUrl === false) errors.registrationUrl = 'Use a valid http or https registration link.'
  if (mediaUrl === false) errors.mediaUrl = 'Use a valid http or https media link.'

  return {
    value: {
      title,
      description: clean(input.description),
      branch: clean(input.branch) || null,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      status,
      is_published: status === 'published',
      location_text: clean(input.locationText),
      source_url: sourceUrl || null,
      registration_url: registrationUrl || null,
      platform: ['facebook', 'instagram', 'external'].includes(input.platform) ? input.platform : 'external',
      cta_label: clean(input.ctaLabel) || 'Event details',
      banner_url: mediaUrl || null,
    },
    errors,
  }
}

export function canTransitionContentStatus(from, to) {
  if (from === to) return true
  const transitions = {
    draft: new Set(['published', 'archived']),
    published: new Set(['draft', 'archived']),
    archived: new Set(['draft']),
  }
  return transitions[from]?.has(to) || false
}

export function contentMediaPath(kind, userId, fileName, uniqueId = crypto.randomUUID()) {
  const folder = kind === 'events' ? 'events' : 'posts'
  const safeUser = clean(userId).replace(/[^a-zA-Z0-9_-]/g, '') || 'unknown'
  const original = clean(fileName).toLowerCase()
  const extensionMatch = original.match(/\.([a-z0-9]+)$/)
  const extension = extensionMatch?.[1] || 'bin'
  const base = original
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'media'
  return `${folder}/${safeUser}/${uniqueId}-${base}.${extension}`
}

export function validateContentMedia(file) {
  if (!file || !SUPPORTED_MEDIA_TYPES.has(file.type)) {
    return { file: 'Upload a JPG, PNG, WebP, GIF, MP4, or WebM file.' }
  }
  if (file.size > MAX_MEDIA_BYTES) return { file: 'Media must be 20 MB or smaller.' }
  return {}
}

export async function listPosts(client) {
  return client.from('social_posts').select('*').order('updated_at', { ascending: false })
}

export async function listEvents(client) {
  return client.from('events').select('*').order('starts_at', { ascending: false }).limit(100)
}

export async function savePost(client, input, id = null) {
  const normalized = normalizePostInput(input)
  if (Object.keys(normalized.errors).length) return { data: null, error: normalized.errors }
  const payload = normalized.value.status === 'published' && !normalized.value.published_at
    ? { ...normalized.value, published_at: new Date().toISOString() }
    : normalized.value
  if (id) return client.from('social_posts').update(payload).eq('id', id).select().single()
  return client.from('social_posts').insert(payload).select().single()
}

export async function saveEvent(client, input, id = null) {
  const normalized = normalizeEventInput(input)
  if (Object.keys(normalized.errors).length) return { data: null, error: normalized.errors }
  if (id) return client.from('events').update(normalized.value).eq('id', id).select().single()
  const newId = crypto.randomUUID()
  return client
    .from('events')
    .insert({ ...normalized.value, id: newId, slug: slugifyEventTitle(normalized.value.title, newId) })
    .select()
    .single()
}

export async function deleteContent(client, table, id) {
  if (!['social_posts', 'events'].includes(table)) {
    return { data: null, error: { message: 'Unsupported content type.' } }
  }
  return client.from(table).delete().eq('id', id)
}

export async function uploadContentMedia(client, { file, kind, userId }) {
  const errors = validateContentMedia(file)
  if (Object.keys(errors).length) return { data: null, error: errors }
  const path = contentMediaPath(kind, userId, file.name)
  const result = await client.storage.from('content-media').upload(path, file, { upsert: true })
  if (result.error) return result
  const { data } = client.storage.from('content-media').getPublicUrl(path)
  return { data: { path, publicUrl: data.publicUrl }, error: null }
}
