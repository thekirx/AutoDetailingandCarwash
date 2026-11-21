import { adminClient } from './supabaseAdmin.mjs'

function tryAdminClient() {
  try {
    return adminClient()
  } catch {
    return null
  }
}
import { extractContentMeta } from '../src/lib/contentBlocks.js'
import {
  COMPLETE_DETAILING_CATALOG,
  LOCAL_BRANCH_PAGES,
  LOCAL_BRANCH_SERVICE_PAGES,
  LOCAL_SERVICE_PILLARS,
  STUDIO_COMPARISON_ROWS,
  STUDIO_PRODUCTS_AND_BRANDS,
  buildBranchCityJsonLd,
  buildBranchServiceJsonLd,
  findLocalBranchPage,
  findLocalBranchServicePage,
} from '../src/lib/localBranchPages.js'
import { buildDocumentTitle, buildServicePageJsonLd } from '../src/lib/pageMeta.js'
import {
  SEO_LOCAL_GUIDES,
  buildBlogPostJsonLd,
  findBuiltInBlogPost,
} from '../src/lib/seoLocalGuides.js'

const ORIGIN = 'https://www.hakumautocare.com'

export const STATIC_SITEMAP_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/services', changefreq: 'monthly', priority: '0.9' },
  { path: '/services/ppf', changefreq: 'monthly', priority: '0.9' },
  { path: '/services/ceramic', changefreq: 'monthly', priority: '0.9' },
  { path: '/tint-finder', changefreq: 'monthly', priority: '0.8' },
  { path: '/services/tint', changefreq: 'monthly', priority: '0.8' },
  { path: '/services/wash-detailing', changefreq: 'monthly', priority: '0.9' },
  { path: '/shop', changefreq: 'weekly', priority: '0.8' },
  { path: '/branches', changefreq: 'monthly', priority: '0.9' },
  ...LOCAL_BRANCH_PAGES.map((city) => ({
    path: `/branches/${city.slug}`,
    changefreq: city.isOpen ? 'weekly' : 'monthly',
    priority: city.isOpen ? '0.9' : '0.8',
  })),
  ...LOCAL_BRANCH_SERVICE_PAGES.map((bs) => ({
    path: `/branches/${bs.citySlug}/${bs.serviceSlug}`,
    changefreq: 'weekly',
    priority: '0.9',
  })),
  { path: '/book', changefreq: 'weekly', priority: '0.9' },
  { path: '/queue', changefreq: 'daily', priority: '0.8' },
  { path: '/events', changefreq: 'weekly', priority: '0.8' },
  { path: '/blog', changefreq: 'weekly', priority: '0.9' },
  { path: '/contact', changefreq: 'monthly', priority: '0.7' },
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

export const CORE_SERVICES_DATA = {
  ppf: {
    slug: 'ppf',
    name: 'ClearPro Paint Protection Film (PPF)',
    title: 'ClearPro Paint Protection Film (PPF) — Bacoor & Batangas',
    description:
      'Self-healing ClearPro TPU Paint Protection Film (PPF) installed in dust-controlled bays in Bacoor, Cavite and Batangas City, serving Imus, Dasmariñas, and CALABARZON.',
    h1: 'ClearPro Paint Protection Film (PPF) Philippines',
    hero: 'Optical-grade TPU self-healing film installed in enclosed dust-controlled bays with wrapped edges and 10-year warranty.',
    faqs: [
      {
        question: 'What is ClearPro PPF made of?',
        answer:
          'ClearPro is manufactured from optical-grade aliphatic thermoplastic polyurethane (TPU) with a heat-activated self-healing top coat.',
      },
      {
        question: 'How long does the warranty last?',
        answer:
          'ClearPro PPF includes a 10-year manufacturer warranty against yellowing, cracking, peeling, and bubbling.',
      },
      {
        question: 'Which branches offer PPF installation?',
        answer:
          'Enclosed PPF installation bays operate at our Bacoor, Cavite flagship (RFC Molino II) and Batangas City studio (Brgy. Alangilan).',
      },
    ],
  },
  ceramic: {
    slug: 'ceramic',
    name: 'Kisho 9H Ceramic Coating',
    title: 'Kisho 9H Ceramic Coating — Bacoor, Cavite & Batangas',
    description:
      'Multi-stage paint correction and authentic Kisho 9H Ceramic Coating in Bacoor, Cavite and Batangas City with Unlimited Recoating packages.',
    h1: 'Kisho 9H Ceramic Coating Philippines',
    hero: 'Japanese inorganic silica ceramic protection paired with multi-stage Rupes & Menzerna machine paint correction for mirror clarity and hydrophobic rain protection.',
    faqs: [
      {
        question: 'What ceramic coating brand do you use?',
        answer:
          'We use genuine Kisho Japan 9H ceramic coating formulations applied inside clean, lighting-calibrated curing bays.',
      },
      {
        question: 'Is paint correction included?',
        answer:
          'Yes, all Hakum ceramic coating packages include full chemical and clay decontamination plus multi-stage machine polishing to remove swirls before coating.',
      },
      {
        question: 'What is the Paint Maintenance program?',
        answer:
          'Every ceramic coating customer receives automated 6-month maintenance reminders with Unlimited Recoating on Premium & Platinum tiers.',
      },
    ],
  },
  tint: {
    slug: 'tint',
    name: 'Nano Ceramic Window Tint',
    title: 'Nano Ceramic Window Tint — Bacoor, Imus & Batangas',
    description:
      'High heat-rejection nano ceramic window tint in Bacoor, Cavite and Batangas City — RFID-safe night clarity previewed in 3D before booking.',
    h1: 'Nano Ceramic Window Tint Philippines',
    hero: 'Advanced non-metallic nano-ceramic window films blocking infrared solar heat and UV radiation without reducing nighttime clarity or blocking Autosweep/Easytrip RFID signals.',
    faqs: [
      {
        question: 'Does nano ceramic tint block RFID or GPS signals?',
        answer:
          'No, our nano-ceramic films contain zero metallic particles and never interfere with RFID toll tags, mobile data, or GPS.',
      },
      {
        question: 'Can I preview shades before installation?',
        answer:
          'Yes, use our interactive 3D Tint Finder at hakumautocare.com/tint-finder to test visibility across shade combinations.',
      },
    ],
  },
  'wash-detailing': {
    slug: 'wash-detailing',
    name: 'Car Wash & Auto Detailing',
    title: 'Car Wash & Auto Detailing — Bacoor, Imus & Batangas',
    description:
      'Two-bucket pH-neutral car wash, interior sanitization, and swirl-free detailing in Bacoor (Molino), Batangas City (Alangilan), serving Imus and Dasmariñas.',
    h1: 'Two-Bucket pH-Neutral Car Wash & Auto Detailing',
    hero: 'Swirl-free contact washing using dedicated grit-guard buckets, pH-neutral foam shampoos, clean microfiber per zone, and deep cabin sanitization.',
    faqs: [
      {
        question: 'Why is two-bucket washing safer for car paint?',
        answer:
          'Two-bucket washing isolates road grit in a rinse bucket with a grit guard, preventing dirt from being dragged across your clear coat and causing swirl marks.',
      },
      {
        question: 'Can I check queue wait times online?',
        answer:
          'Yes, open hakumautocare.com/queue to view real-time bay and vehicle counts before driving to our Bacoor or Batangas studios.',
      },
    ],
  },
}

export function buildBranchCityCrawlerHtml({ cityPage, origin = ORIGIN } = {}) {
  if (!cityPage) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Branch not found · Hakum Auto Care</title></head><body><main><h1>Branch not found</h1><p><a href="/branches">Back to Branches</a></p></main></body></html>`
  }
  const fullTitle = buildDocumentTitle(cityPage.seoTitle)
  const canonical = `${origin}/branches/${cityPage.slug}`
  const jsonLd = buildBranchCityJsonLd(cityPage, { origin })
  const keywordsStr = Array.isArray(cityPage.keywords) ? cityPage.keywords.join(', ') : ''

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escHtml(fullTitle)}</title>
    <meta name="description" content="${escHtml(cityPage.seoDescription)}" />
    ${keywordsStr ? `<meta name="keywords" content="${escHtml(keywordsStr)}" />` : ''}
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <link rel="canonical" href="${escHtml(canonical)}" />
    <link rel="alternate" hreflang="en-PH" href="${escHtml(canonical)}" />
    <link rel="alternate" hreflang="x-default" href="${escHtml(canonical)}" />
    <meta property="og:site_name" content="Hakum Auto Care" />
    <meta property="og:type" content="business.business" />
    <meta property="og:locale" content="en_PH" />
    <meta property="og:title" content="${escHtml(fullTitle)}" />
    <meta property="og:description" content="${escHtml(cityPage.seoDescription)}" />
    <meta property="og:url" content="${escHtml(canonical)}" />
    <meta property="og:image" content="${origin}/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escHtml(fullTitle)}" />
    <meta name="twitter:description" content="${escHtml(cityPage.seoDescription)}" />
    <meta name="twitter:image" content="${origin}/og-image.png" />
    ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
  </head>
  <body>
    <main style="max-width:860px;margin:0 auto;padding:32px 20px;font-family:system-ui,sans-serif;line-height:1.6">
      <nav aria-label="Breadcrumb"><a href="/">Home</a> · <a href="/branches">Branches</a> · <span>${escHtml(cityPage.cityName)}</span></nav>
      <h1>${escHtml(cityPage.h1)}</h1>
      <p><strong>${escHtml(cityPage.eyebrow)}</strong></p>
      ${cityPage.aiSummary ? `<p><strong>Executive Summary:</strong> ${escHtml(cityPage.aiSummary)}</p>` : ''}
      <p>${escHtml(cityPage.heroSummary)}</p>
      <h2>Studio Address &amp; Service Corridors</h2>
      <p>${escHtml(cityPage.landmarkAddress)}</p>
      <p><strong>Corridors Served:</strong> ${escHtml(cityPage.corridors.join(', '))}</p>
      <h2>Studio Highlights</h2>
      <ul>${cityPage.highlights.map((h) => `<li>${escHtml(h)}</li>`).join('')}</ul>
      <h2>Specialized Local Services in ${escHtml(cityPage.shortName)}</h2>
      <ul>
        ${LOCAL_SERVICE_PILLARS.map((svc) => `<li><a href="/branches/${cityPage.slug}/${svc.slug}">${escHtml(svc.label)} in ${escHtml(cityPage.shortName)}</a></li>`).join('\n        ')}
      </ul>
      <h2>Complete 14-Service Detailing &amp; Paint Protection Menu</h2>
      <ul>
        ${COMPLETE_DETAILING_CATALOG.map((item) => `<li><strong>${escHtml(item.name)}:</strong> ${escHtml(item.summary)}</li>`).join('\n        ')}
      </ul>
      <h2>Certified Detailing Products &amp; Equipment Brands</h2>
      <ul>
        ${STUDIO_PRODUCTS_AND_BRANDS.map((b) => `<li><strong>${escHtml(b.brand)} (${escHtml(b.origin)}):</strong> ${escHtml(b.use)}</li>`).join('\n        ')}
      </ul>
      <h2>Workmanship Comparison: Hakum vs. Roadside Car Wash vs. Dealership</h2>
      <table>
        <thead>
          <tr><th>Criterion</th><th>Hakum Auto Care (${escHtml(cityPage.shortName)})</th><th>Typical Roadside Car Wash</th><th>Dealership Package</th></tr>
        </thead>
        <tbody>
          ${STUDIO_COMPARISON_ROWS.map((r) => `<tr><td>${escHtml(r.criteria)}</td><td>${escHtml(r.hakum)}</td><td>${escHtml(r.roadside)}</td><td>${escHtml(r.dealership)}</td></tr>`).join('\n          ')}
        </tbody>
      </table>
      <h2>Frequently Asked Questions</h2>
      ${cityPage.qa.map((qa) => `<details open><summary><strong>${escHtml(qa.q)}</strong></summary><p>${escHtml(qa.a)}</p></details>`).join('')}
      <nav aria-label="Call to action">
        <a href="/book?branch=${cityPage.branchSlug}">Book Detailing Slot</a> · 
        <a href="/queue/${cityPage.branchSlug}">Live Bay Queue Status</a> · 
        <a href="/branches">All Studio Branches</a>
      </nav>
    </main>
  </body>
</html>`
}

export function buildBranchServiceCrawlerHtml({ page, origin = ORIGIN } = {}) {
  if (!page) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Service not found · Hakum Auto Care</title></head><body><main><h1>Service not found</h1><p><a href="/branches">Back to Branches</a></p></main></body></html>`
  }
  const fullTitle = buildDocumentTitle(page.seoTitle)
  const canonical = `${origin}/branches/${page.citySlug}/${page.serviceSlug}`
  const jsonLd = buildBranchServiceJsonLd(page, { origin })
  const keywordsStr = Array.isArray(page.keywords) ? page.keywords.join(', ') : ''
  const relatedCatalog = COMPLETE_DETAILING_CATALOG.filter((item) => item.pillarSlug === page.serviceSlug)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escHtml(fullTitle)}</title>
    <meta name="description" content="${escHtml(page.seoDescription)}" />
    ${keywordsStr ? `<meta name="keywords" content="${escHtml(keywordsStr)}" />` : ''}
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <link rel="canonical" href="${escHtml(canonical)}" />
    <link rel="alternate" hreflang="en-PH" href="${escHtml(canonical)}" />
    <link rel="alternate" hreflang="x-default" href="${escHtml(canonical)}" />
    <meta property="og:site_name" content="Hakum Auto Care" />
    <meta property="og:type" content="service" />
    <meta property="og:locale" content="en_PH" />
    <meta property="og:title" content="${escHtml(fullTitle)}" />
    <meta property="og:description" content="${escHtml(page.seoDescription)}" />
    <meta property="og:url" content="${escHtml(canonical)}" />
    <meta property="og:image" content="${origin}/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escHtml(fullTitle)}" />
    <meta name="twitter:description" content="${escHtml(page.seoDescription)}" />
    <meta name="twitter:image" content="${origin}/og-image.png" />
    ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
  </head>
  <body>
    <main style="max-width:860px;margin:0 auto;padding:32px 20px;font-family:system-ui,sans-serif;line-height:1.6">
      <nav aria-label="Breadcrumb">
        <a href="/">Home</a> · 
        <a href="/branches">Branches</a> · 
        <a href="/branches/${page.citySlug}">${escHtml(page.cityName)}</a> · 
        <span>${escHtml(page.serviceLabel)}</span>
      </nav>
      <h1>${escHtml(page.h1)}</h1>
      <p><strong>${escHtml(page.eyebrow)}</strong></p>
      ${page.aiSummary ? `<p><strong>Quick Answer:</strong> ${escHtml(page.aiSummary)}</p>` : ''}
      <p>${escHtml(page.heroSummary)}</p>
      <h2>Service Process &amp; Standards</h2>
      <ol>${page.processSteps.map((s) => `<li>${escHtml(s)}</li>`).join('')}</ol>
      <h2>Local Studio Advantages</h2>
      <ul>${page.localHighlights.map((h) => `<li>${escHtml(h)}</li>`).join('')}</ul>
      ${
        relatedCatalog.length
          ? `<h2>Included ${escHtml(page.serviceLabel)} Treatments</h2><ul>${relatedCatalog.map((item) => `<li><strong>${escHtml(item.name)}:</strong> ${escHtml(item.summary)}</li>`).join('')}</ul>`
          : ''
      }
      <h2>Certified Detailing Products &amp; Brands</h2>
      <ul>
        ${STUDIO_PRODUCTS_AND_BRANDS.map((b) => `<li><strong>${escHtml(b.brand)} (${escHtml(b.origin)}):</strong> ${escHtml(b.use)}</li>`).join('\n        ')}
      </ul>
      <h2>Frequently Asked Questions</h2>
      ${page.qa.map((qa) => `<details open><summary><strong>${escHtml(qa.q)}</strong></summary><p>${escHtml(qa.a)}</p></details>`).join('')}
      <nav aria-label="Actions">
        ${page.mode === 'queue' ? `<a href="/queue/${page.branchSlug}">Check Live ${escHtml(page.shortCity)} Queue</a>` : `<a href="/book?branch=${page.branchSlug}">Book ${escHtml(page.serviceLabel)} in ${escHtml(page.shortCity)}</a>`} · 
        <a href="/branches/${page.citySlug}">More Services at Hakum ${escHtml(page.shortCity)}</a>
      </nav>
    </main>
  </body>
</html>`
}

export function buildCoreServiceCrawlerHtml({ serviceSlug = '', origin = ORIGIN } = {}) {
  const clean = String(serviceSlug || '').trim().toLowerCase()
  const s = CORE_SERVICES_DATA[clean]
  if (clean && !s) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Service not found · Hakum Auto Care</title></head><body><main><h1>Service not found</h1><p><a href="/services">All Services</a></p></main></body></html>`
  }

  const name = s ? s.name : 'All Detailing, Car Wash & Paint Protection Services'
  const title = s ? s.title : 'All Services & Packages — PPF, Ceramic Coating, Tint & Detailing'
  const desc = s
    ? s.description
    : 'Explore Hakum Auto Care services across Bacoor, Imus, Cavite, and Batangas: ClearPro PPF, Kisho 9H Ceramic Coating, Nano Ceramic Tint, and two-bucket pH-neutral car wash.'
  const fullTitle = buildDocumentTitle(title)
  const canonical = clean ? `${origin}/services/${clean}` : `${origin}/services`
  const jsonLd = buildServicePageJsonLd({
    slug: clean || undefined,
    name,
    description: desc,
    faqs: s ? s.faqs : [],
    origin,
  })

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escHtml(fullTitle)}</title>
    <meta name="description" content="${escHtml(desc)}" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <link rel="canonical" href="${escHtml(canonical)}" />
    <link rel="alternate" hreflang="en-PH" href="${escHtml(canonical)}" />
    <link rel="alternate" hreflang="x-default" href="${escHtml(canonical)}" />
    <meta property="og:site_name" content="Hakum Auto Care" />
    <meta property="og:type" content="service" />
    <meta property="og:locale" content="en_PH" />
    <meta property="og:title" content="${escHtml(fullTitle)}" />
    <meta property="og:description" content="${escHtml(desc)}" />
    <meta property="og:url" content="${escHtml(canonical)}" />
    <meta property="og:image" content="${origin}/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escHtml(fullTitle)}" />
    <meta name="twitter:description" content="${escHtml(desc)}" />
    <meta name="twitter:image" content="${origin}/og-image.png" />
    ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
  </head>
  <body>
    <main style="max-width:860px;margin:0 auto;padding:32px 20px;font-family:system-ui,sans-serif;line-height:1.6">
      <nav aria-label="Breadcrumb"><a href="/">Home</a> · <a href="/services">Services</a>${clean ? ` · <span>${escHtml(name)}</span>` : ''}</nav>
      <h1>${escHtml(s ? s.h1 : 'Hakum Auto Care Services & Packages')}</h1>
      <p>${escHtml(s ? s.hero : desc)}</p>
      ${
        s
          ? `<h2>Frequently Asked Questions</h2>${s.faqs.map((f) => `<details open><summary><strong>${escHtml(f.question)}</strong></summary><p>${escHtml(f.answer)}</p></details>`).join('')}`
          : `<h2>Service Categories</h2>
          <ul>
            <li><a href="/services/ppf">ClearPro Paint Protection Film (PPF)</a></li>
            <li><a href="/services/ceramic">Kisho 9H Ceramic Coating</a></li>
            <li><a href="/services/tint">Nano Ceramic Window Tint</a></li>
            <li><a href="/services/wash-detailing">Two-Bucket pH-Neutral Car Wash &amp; Detailing</a></li>
          </ul>`
      }
      <h2>Available Studio Branches</h2>
      <ul>
        <li><a href="/branches/bacoor">Bacoor, Cavite Flagship Studio (RFC Molino II)</a></li>
        <li><a href="/branches/batangas">Batangas City Studio (National Highway, Brgy. Alangilan)</a></li>
        <li><a href="/branches/imus">Car Wash &amp; Detailing Near Imus, Cavite</a></li>
        <li><a href="/branches/cavite">Cavite Regional Detailing Studio Network</a></li>
        <li><a href="/branches/dasmarinas">Car Wash &amp; Detailing Near Dasmariñas, Cavite</a></li>
      </ul>
      <nav aria-label="Action links"><a href="/book">Book Online</a> · <a href="/queue">Live Queue Status</a></nav>
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

  if (op === 'branch-meta') {
    const citySlug = String(url.searchParams.get('citySlug') || url.searchParams.get('slug') || '').trim().toLowerCase()
    const cityPage = findLocalBranchPage(citySlug)
    const html = buildBranchCityCrawlerHtml({ cityPage, origin: ORIGIN })
    res.writeHead(cityPage ? 200 : 404, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
    })
    res.end(html)
    return
  }

  if (op === 'branch-service-meta') {
    const citySlug = String(url.searchParams.get('citySlug') || '').trim().toLowerCase()
    const serviceSlug = String(url.searchParams.get('serviceSlug') || url.searchParams.get('slug') || '').trim().toLowerCase()
    const match = findLocalBranchServicePage(citySlug, serviceSlug)
    if (!match) {
      const html = buildBranchServiceCrawlerHtml({ page: null, origin: ORIGIN })
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }
    if (match.redirected) {
      res.writeHead(301, {
        Location: `/branches/${match.canonicalCitySlug}/${match.canonicalServiceSlug}`,
        'Cache-Control': 'public, max-age=86400',
      })
      res.end()
      return
    }
    const html = buildBranchServiceCrawlerHtml({ page: match.page, origin: ORIGIN })
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
    })
    res.end(html)
    return
  }

  if (op === 'service-meta') {
    const serviceSlug = String(url.searchParams.get('serviceSlug') || url.searchParams.get('slug') || '').trim().toLowerCase()
    const html = buildCoreServiceCrawlerHtml({ serviceSlug, origin: ORIGIN })
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
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
