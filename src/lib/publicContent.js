import { isPublishedContent } from './contentStatus.js'

function timeValue(value) {
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

export function selectLatestPublishedPost(rows) {
  if (!Array.isArray(rows)) return null
  return rows
    .filter(isPublishedContent)
    .sort((a, b) => timeValue(b.published_at || b.created_at) - timeValue(a.published_at || a.created_at))[0] || null
}

export function selectNextPublishedEvent(rows, now = new Date()) {
  if (!Array.isArray(rows)) return null
  const nowTime = timeValue(now)
  return rows
    .filter((row) => isPublishedContent(row) && timeValue(row.starts_at) >= nowTime)
    .sort((a, b) => timeValue(a.starts_at) - timeValue(b.starts_at))[0] || null
}

export function mapPostToHybridCard(row) {
  if (!row) return null
  return {
    id: row.id,
    kind: 'post',
    title: row.title,
    excerpt: row.excerpt || '',
    mediaUrl: row.media_url || '',
    href: row.source_url || '',
    platform: row.platform || 'external',
    ctaLabel: row.cta_label || 'View original post',
    date: row.published_at || row.created_at || null,
  }
}

export function mapEventToHybridCard(row) {
  if (!row) return null
  const href = row.slug
    ? `/events/${row.slug}`
    : row.registration_url || row.source_url || '/events'
  return {
    id: row.id,
    kind: 'event',
    title: row.title,
    excerpt: row.description || '',
    mediaUrl: row.banner_url || '',
    href,
    platform: row.platform || 'external',
    ctaLabel: row.cta_label || 'Event details',
    date: row.starts_at || null,
  }
}

function resultState(item, error) {
  if (error) return { status: 'error', item: null, error }
  return { status: item ? 'ready' : 'empty', item, error: null }
}

export async function loadHomepageContent(client, now = new Date()) {
  const [postsResult, eventsResult] = await Promise.all([
    client
      .from('social_posts')
      .select('id, platform, source_url, title, excerpt, media_url, cta_label, status, published_at, created_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(10),
    client
      .from('events')
      .select('id, title, description, banner_url, starts_at, slug, source_url, registration_url, platform, cta_label, status, is_published')
      .order('starts_at', { ascending: true })
      .limit(20),
  ])

  const post = selectLatestPublishedPost(postsResult.data)
  const event = selectNextPublishedEvent(eventsResult.data, now)
  return {
    post: resultState(mapPostToHybridCard(post), postsResult.error),
    event: resultState(mapEventToHybridCard(event), eventsResult.error),
  }
}
