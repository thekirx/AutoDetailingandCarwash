/** WordPress-like content blocks for blogs & events */

export const BLOCK_TYPES = [
  { value: 'heading', label: 'Heading' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'quote', label: 'Quote' },
  { value: 'list', label: 'List' },
  { value: 'divider', label: 'Divider' },
  { value: 'cta', label: 'Button / CTA' },
]

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().slice(0, 8)
  return `b${Date.now().toString(36)}`
}

export function slugifyContentTitle(title, id = '') {
  const base = String(title || 'post')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56) || 'post'
  const suffix = String(id || '').replace(/-/g, '').slice(0, 8)
  return suffix ? `${base}-${suffix}` : base
}

export function emptyBlock(type = 'paragraph') {
  const id = uid()
  if (type === 'heading') return { id, type, level: 2, text: '' }
  if (type === 'image') return { id, type, url: '', alt: '', caption: '' }
  if (type === 'video') return { id, type, url: '', provider: 'auto', caption: '' }
  if (type === 'quote') return { id, type, text: '', cite: '' }
  if (type === 'list') return { id, type, ordered: false, items: [''] }
  if (type === 'divider') return { id, type }
  if (type === 'cta') return { id, type, label: 'Learn more', url: '', form_id: '', style: 'primary' }
  return { id, type: 'paragraph', text: '' }
}

export function normalizeBlocks(blocks) {
  return (Array.isArray(blocks) ? blocks : []).map((raw) => {
    const type = BLOCK_TYPES.some((t) => t.value === raw?.type) ? raw.type : 'paragraph'
    const id = String(raw?.id || uid())
    if (type === 'heading') {
      const level = [1, 2, 3].includes(Number(raw.level)) ? Number(raw.level) : 2
      return { id, type, level, text: String(raw.text || '') }
    }
    if (type === 'image') {
      return {
        id,
        type,
        url: String(raw.url || '').trim(),
        alt: String(raw.alt || '').trim(),
        caption: String(raw.caption || '').trim(),
      }
    }
    if (type === 'video') {
      return {
        id,
        type,
        url: String(raw.url || '').trim(),
        provider: String(raw.provider || 'auto'),
        caption: String(raw.caption || '').trim(),
      }
    }
    if (type === 'quote') {
      return { id, type, text: String(raw.text || ''), cite: String(raw.cite || '') }
    }
    if (type === 'list') {
      const items = Array.isArray(raw.items)
        ? raw.items.map((s) => String(s || '').trim()).filter(Boolean)
        : String(raw.itemsText || '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
      return { id, type, ordered: Boolean(raw.ordered), items: items.length ? items : [''] }
    }
    if (type === 'divider') return { id, type }
    if (type === 'cta') {
      return {
        id,
        type,
        label: String(raw.label || 'Learn more').trim() || 'Learn more',
        url: String(raw.url || '').trim(),
        form_id: String(raw.form_id || '').trim(),
        style: raw.style === 'secondary' ? 'secondary' : 'primary',
      }
    }
    return { id, type: 'paragraph', text: String(raw.text || '') }
  })
}

/** Extract YouTube/Vimeo embed URL when possible; otherwise return original for <video src>. */
export function resolveVideoEmbed(url) {
  const raw = String(url || '').trim()
  if (!raw) return null
  const yt =
    raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/) ||
    raw.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/)
  if (yt) return { kind: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}` }
  const vim = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vim) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vim[1]}` }
  if (/\.(mp4|webm)(\?|$)/i.test(raw)) return { kind: 'file', src: raw }
  return { kind: 'link', src: raw }
}

export function sampleBlogBlocks() {
  return normalizeBlocks([
    { type: 'heading', level: 2, text: 'Heat, salt air, and daily wash cycles' },
    { type: 'paragraph', text: 'Metro and coastal cars take a beating. Ceramic is not a magic spray. It is prep, product, and discipline.' },
    { type: 'cta', label: 'Book a visit', url: '/book', style: 'primary' },
  ])
}
