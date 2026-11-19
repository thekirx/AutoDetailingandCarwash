import { adminClient } from './supabaseAdmin.mjs'

function tryAdminClient() {
  try {
    return adminClient()
  } catch {
    return null
  }
}
import { extractContentMeta } from '../src/lib/contentBlocks.js'
import { buildDocumentTitle } from '../src/lib/pageMeta.js'
import {
  SEO_LOCAL_GUIDES,
  buildBlogPostJsonLd,
  findBuiltInBlogPost,
} from '../src/lib/seoLocalGuides.js'

const ORIGIN = 'https://www.hakumautocare.com'

export const STATIC_SITEMAP_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/services', changefreq: 'monthly', priority: '0.9' },
  { path: '/services/ppf', changefreq: 'monthly', priority: '0.8' },
  { path: '/services/ceramic', changefreq: 'monthly', priority: '0.8' },
  { path: '/tint-finder', changefreq: 'monthly', priority: '0.8' },
  { path: '/services/tint', changefreq: 'monthly', priority: '0.8' },
  { path: '/services/wash-detailing', changefreq: 'monthly', priority: '0.8' },
  { path: '/shop', changefreq: 'weekly', priority: '0.8' },
  { path: '/branches', changefreq: 'monthly', priority: '0.9' },
  { path: '/branches/bacoor', changefreq: 'weekly', priority: '0.9' },
  { path: '/branches/batangas', changefreq: 'weekly', priority: '0.9' },
  { path: '/branches/imus', changefreq: 'monthly', priority: '0.8' },
  { path: '/branches/cavite', changefreq: 'weekly', priority: '0.9' },
  { path: '/book', changefreq: 'weekly', priority: '0.9' },
  { path: '/queue', changefreq: 'daily', priority: '0.8' },
  { path: '/events', changefreq: 'weekly', priority: '0.8' },
  { path: '/blog', changefreq: 'weekly', priority: '0.9' },
  { path: '/partnerships', changefreq: 'monthly', priority: '0.6' },
  { path: '/contact', changefreq: 'monthly', priority: '0.6' },
  { path: '/complaints', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms', changefreq: 'yearly', priority: '0.2' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.2' },
  { path: '/cookies', changefreq: 'yearly', priority: '0.2' },
]

function escXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function absUrl(pathOrUrl, origin = ORIGIN) {
  const raw = String(pathOrUrl || '').trim()
  if (!raw) return `${origin}/og-image.png`
  if (/^https?:\/\//i.test(raw)) return raw
  return `${origin}${raw.startsWith('/') ? '' : '/'}${raw}`
}

function isLivePublishedPost(row, nowMs = Date.now()) {
  if (!row || row.status === 'archived' || row.status === 'draft') return false
  if (row.noindex === true || row.content_blocks?.[0]?.post_meta?.noindex === true) return false
  const pubMs = row.published_at ? Date.parse(row.published_at) : NaN
  if (row.status === 'scheduled') {
    return Number.isFinite(pubMs) && pubMs <= nowMs
  }
  if (row.status === 'published' || row.is_published === true) {
    return !Number.isFinite(pubMs) || pubMs <= nowMs
  }
  return false
}

async function fetchPublishedDbContent() {
  const admin = tryAdminClient()
  if (!admin) return { blogs: [], events: [] }
  const nowIso = new Date().toISOString()
  const [blogsRes, eventsRes] = await Promise.all([
    admin
      .from('blogs')
      .select('id, title, slug, excerpt, cover_url, author_label, status, is_published, published_at, updated_at, content_blocks')
      .in('status', ['published', 'scheduled'])
      .order('published_at', { ascending: false })
      .limit(500),
    admin
      .from('events')
      .select('id, title, description, slug, banner_url, starts_at, updated_at, is_published')
      .eq('is_published', true)
      .order('starts_at', { ascending: false })
      .limit(200),
  ])
  const nowMs = Date.parse(nowIso)
  const blogs = (blogsRes.data || []).filter((b) => isLivePublishedPost(b, nowMs))
  const events = eventsRes.data || []
  return { blogs, events }
}

/** Pure XML builder (assertable in unit tests without network/Supabase). */
export function buildSitemapXml({ dbBlogs = [], dbEvents = [], origin = ORIGIN } = {}) {
  const seenLocs = new Set()
  const entries = []

  const pushEntry = (loc, { lastmod, changefreq = 'monthly', priority = '0.7', image } = {}) => {
    if (!loc || seenLocs.has(loc)) return
    seenLocs.add(loc)
    entries.push({ loc, lastmod, changefreq, priority, image })
  }

  for (const r of STATIC_SITEMAP_ROUTES) {
    pushEntry(`${origin}${r.path === '/' ? '/' : r.path}`, {
      changefreq: r.changefreq,
      priority: r.priority,
    })
  }

  const guideBySlug = new Map(SEO_LOCAL_GUIDES.map((g) => [String(g.slug).toLowerCase(), g]))
  for (const post of dbBlogs) {
    if (!post?.slug || !isLivePublishedPost(post)) continue
    const slug = String(post.slug).trim()
    const isGuide = guideBySlug.has(slug.toLowerCase())
    const lastmodRaw = post.updated_at || post.published_at
    const lastmod = lastmodRaw ? new Date(lastmodRaw).toISOString().slice(0, 10) : undefined
    const meta = extractContentMeta(post)
    pushEntry(`${origin}/blog/${slug}`, {
      lastmod,
      changefreq: 'monthly',
      priority: isGuide ? '0.8' : '0.7',
      image: post.og_image_url || meta.og_image_url || post.cover_url ? absUrl(post.og_image_url || meta.og_image_url || post.cover_url, origin) : undefined,
    })
  }

  for (const g of SEO_LOCAL_GUIDES) {
    pushEntry(`${origin}/blog/${g.slug}`, {
      lastmod: g.published_at ? g.published_at.slice(0, 10) : undefined,
      changefreq: 'monthly',
      priority: g.region && ['bacoor', 'batangas', 'imus', 'cavite'].includes(g.region) ? '0.8' : '0.7',
    })
  }

  for (const ev of dbEvents) {
    if (!ev?.slug || !ev.is_published) continue
    const lastmodRaw = ev.updated_at || ev.starts_at
    pushEntry(`${origin}/events/${String(ev.slug).trim()}`, {
      lastmod: lastmodRaw ? new Date(lastmodRaw).toISOString().slice(0, 10) : undefined,
      changefreq: 'weekly',
      priority: '0.7',
    })
  }

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  ]
  for (const item of entries) {
    lines.push('  <url>')
    lines.push(`    <loc>${escXml(item.loc)}</loc>`)
    if (item.lastmod) lines.push(`    <lastmod>${escXml(item.lastmod)}</lastmod>`)
    lines.push(`    <changefreq>${escXml(item.changefreq)}</changefreq>`)
    lines.push(`    <priority>${escXml(item.priority)}</priority>`)
    if (item.image) {
      lines.push('    <image:image>')
      lines.push(`      <image:loc>${escXml(item.image)}</image:loc>`)
      lines.push('    </image:image>')
    }
    lines.push('  </url>')
  }
  lines.push('</urlset>')
  return lines.join('\n')
}

export function buildRssXml({ dbBlogs = [], origin = ORIGIN } = {}) {
  const seenSlugs = new Set()
  const items = []
  for (const post of [...dbBlogs, ...SEO_LOCAL_GUIDES]) {
    if (!post?.slug || !post?.title) continue
    const slugKey = String(post.slug).toLowerCase()
    if (seenSlugs.has(slugKey)) continue
    if (post.status && !isLivePublishedPost(post)) continue
    seenSlugs.add(slugKey)
    const meta = extractContentMeta(post)
    const link = `${origin}/blog/${post.slug}`
    const pubDate = new Date(post.published_at || post.updated_at || '2026-10-15T08:00:00+08:00').toUTCString()
    const desc = post.seo_description || meta.seo_description || meta.ai_summary || post.excerpt || ''
    items.push(
      `    <item>\n` +
        `      <title>${escXml(post.title)}</title>\n` +
        `      <link>${escXml(link)}</link>\n` +
        `      <guid isPermaLink="true">${escXml(link)}</guid>\n` +
        `      <pubDate>${escXml(pubDate)}</pubDate>\n` +
        `      <category>${escXml(meta.category || post.category || 'Automotive Care')}</category>\n` +
        `      <description>${escXml(desc)}</description>\n` +
        `    </item>`,
    )
    if (items.length >= 40) break
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>Hakum Auto Care Journal &amp; Local Guides</title>',
    `    <link>${origin}/blog</link>`,
    '    <description>Car wash science, auto detailing, Kisho 9H ceramic coating, and ClearPro PPF guides in the Philippines.</description>',
    '    <language>en-ph</language>',
    `    <atom:link href="${origin}/rss.xml" rel="self" type="application/rss+xml" />`,
    ...items,
    '  </channel>',
    '</rss>',
  ].join('\n')
}

export function buildArticleCrawlerHtml({ post, origin = ORIGIN, slug = '' } = {}) {
  const cleanSlug = String(slug || post?.slug || '').trim()
  if (!post) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Article not found · Hakum Auto Care</title></head><body><main><h1>Article not found</h1><p><a href="/blog">Back to Hakum Blog</a></p></main></body></html>`
  }

  const meta = extractContentMeta(post)
  const fullTitle = buildDocumentTitle(meta.seo_title || post.seo_title || post.title)
  const desc = String(meta.seo_description || post.seo_description || meta.ai_summary || post.excerpt || '').trim()
  const canonical = String(meta.canonical_url || post.canonical_url || `${origin}/blog/${cleanSlug}`).trim()
  const img = absUrl(meta.og_image_url || post.og_image_url || post.cover_url, origin)
  const noindex = Boolean(post.noindex ?? meta.noindex)
  const robots = noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large'
  const jsonLd = buildBlogPostJsonLd({ ...post, ...meta }, origin)
  const blocksHtml = (Array.isArray(post.content_blocks) ? post.content_blocks : [])
    .map((b) => {
      if (b?.type === 'heading') return `<h2>${escHtml(b.text)}</h2>`
      if (b?.type === 'paragraph') return `<p>${escHtml(b.text)}</p>`
      if (b?.type === 'list' && Array.isArray(b.items)) return `<ul>${b.items.map((i) => `<li>${escHtml(i)}</li>`).join('')}</ul>`
      if (b?.type === 'quote') return `<blockquote>${escHtml(b.text)}</blockquote>`
      return ''
    })
    .join('\n      ')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escHtml(fullTitle)}</title>
    <meta name="description" content="${escHtml(desc)}" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${escHtml(canonical)}" />
    <meta property="og:site_name" content="Hakum Auto Care" />
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="en_PH" />
    <meta property="og:title" content="${escHtml(fullTitle)}" />
    <meta property="og:description" content="${escHtml(desc)}" />
    <meta property="og:url" content="${escHtml(canonical)}" />
    <meta property="og:image" content="${escHtml(img)}" />
    ${post.published_at ? `<meta property="article:published_time" content="${escHtml(post.published_at)}" />` : ''}
    ${post.updated_at ? `<meta property="article:modified_time" content="${escHtml(post.updated_at)}" />` : ''}
    ${meta.category ? `<meta property="article:section" content="${escHtml(meta.category)}" />` : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escHtml(fullTitle)}" />
    <meta name="twitter:description" content="${escHtml(desc)}" />
    <meta name="twitter:image" content="${escHtml(img)}" />
    ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
  </head>
  <body>
    <main style="max-width:860px;margin:0 auto;padding:32px 20px;font-family:system-ui,sans-serif;line-height:1.6">
      <h1>${escHtml(post.title)}</h1>
      ${desc ? `<p><strong>Summary:</strong> ${escHtml(desc)}</p>` : ''}
      ${blocksHtml}
      <nav aria-label="Blog navigation"><a href="/blog">All Hakum Guides</a> · <a href="/book">Book a Slot</a></nav>
    </main>
  </body>
</html>`
}

/** Public read-only SEO endpoint (/sitemap.xml, /rss.xml, crawler meta, optional IndexNow verification key). */
export async function handleSeoRequest(req, res) {
  const url = new URL(req.url || '/', 'http://localhost')
  const op = String(url.searchParams.get('operation') || url.searchParams.get('op') || 'sitemap').toLowerCase()

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  if (op === 'indexnow-key') {
    const key = String(process.env.INDEXNOW_KEY || '').trim()
    if (!key) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' })
    res.end(key)
    return
  }

  if (op === 'blog-meta') {
    const slug = String(url.searchParams.get('slug') || '').replace(/^\/+|\/+$/g, '').trim()
    let post = null
    const admin = tryAdminClient()
    if (admin && slug) {
      const { data } = await admin
        .from('blogs')
        .select('id, title, slug, excerpt, cover_url, author_label, status, is_published, published_at, updated_at, content_blocks')
        .eq('slug', slug)
        .maybeSingle()
      if (data && isLivePublishedPost(data)) post = data
    }
    if (!post && slug) post = findBuiltInBlogPost(slug)
    const html = buildArticleCrawlerHtml({ post, slug, origin: ORIGIN })
    res.writeHead(post ? 200 : 404, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    })
    res.end(html)
    return
  }

  if (op === 'event-meta') {
    const slug = String(url.searchParams.get('slug') || '').replace(/^\/+|\/+$/g, '').trim()
    let ev = null
    const admin = tryAdminClient()
    if (admin && slug) {
      const { data } = await admin
        .from('events')
        .select('id, title, description, slug, banner_url, starts_at, updated_at, is_published, content_blocks')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle()
      if (data) ev = data
    }
    const postLike = ev
      ? {
          title: ev.title,
          slug: ev.slug,
          excerpt: ev.description,
          cover_url: ev.banner_url,
          published_at: ev.starts_at,
          updated_at: ev.updated_at,
          content_blocks: ev.content_blocks,
        }
      : null
    const html = buildArticleCrawlerHtml({
      post: postLike,
      slug,
      origin: ORIGIN,
    }).replace(`${ORIGIN}/blog/${slug}`, `${ORIGIN}/events/${slug}`)
    res.writeHead(ev ? 200 : 404, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    })
    res.end(html)
    return
  }

  const { blogs, events } = await fetchPublishedDbContent()

  if (op === 'rss') {
    const xml = buildRssXml({ dbBlogs: blogs, origin: ORIGIN })
    res.writeHead(200, {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    })
    res.end(xml)
    return
  }

  const xml = buildSitemapXml({ dbBlogs: blogs, dbEvents: events, origin: ORIGIN })
  res.writeHead(200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
  })
  res.end(xml)
}
