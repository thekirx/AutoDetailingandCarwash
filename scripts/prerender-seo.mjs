import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDocumentTitle, buildLocalBusinessJsonLd, buildSiteJsonLd } from '../src/lib/pageMeta.js'
import { SEO_LOCAL_GUIDES, SEO_LOCAL_FAQS, buildBlogPostJsonLd, buildEventsBlogSeoJsonLd } from '../src/lib/seoLocalGuides.js'
import { BRANCH_MAP_LISTINGS, MAIN_LINE, branchPhone } from '../src/lib/homeBranches.js'
import { LOCAL_BRANCH_PAGES, buildBranchCityJsonLd } from '../src/lib/localBranchPages.js'

const ORIGIN = 'https://www.hakumautocare.com'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(root, 'dist')
const distIndexPath = join(distDir, 'index.html')

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c')
}

function buildStaticRoutes() {
  const branchesGraph = buildLocalBusinessJsonLd({
    branches: [
      {
        slug: 'bacoor',
        name: 'Bacoor',
        address: 'RFC Molino II, Molino Boulevard, Bacoor, Cavite',
        phone: branchPhone('bacoor')?.display || MAIN_LINE.display,
        latitude: BRANCH_MAP_LISTINGS.bacoor.lat,
        longitude: BRANCH_MAP_LISTINGS.bacoor.lng,
      },
      {
        slug: 'batangas',
        name: 'Batangas',
        address: 'National Highway, Brgy. Alangilan, Batangas City',
        phone: branchPhone('batangas')?.display || MAIN_LINE.display,
        latitude: BRANCH_MAP_LISTINGS.batangas.lat,
        longitude: BRANCH_MAP_LISTINGS.batangas.lng,
      },
    ],
    origin: ORIGIN,
  })

  const routes = [
    {
      path: '/services',
      title: 'Car Wash, Auto Detailing, Ceramic Coating & PPF Services Philippines',
      description:
        'Explore Hakum Auto Care services: pH-neutral car wash, deep interior & exterior detailing, paint correction, Kisho ceramic coating, ClearPro PPF, and nano ceramic tint in Bacoor, Imus, Cavite, and Batangas.',
      h1: 'Automotive Detailing, Paint Protection & Car Wash Services',
      bodyHtml: `
        <p>Hakum Auto Care delivers two-bucket pH-neutral car washes, interior sanitization, multi-stage paint correction, Kisho 9H ceramic coating, ClearPro TPU Paint Protection Film (PPF), and nano ceramic window tint in the Philippines.</p>
        <ul>
          <li><a href="/services/ppf">ClearPro Paint Protection Film (PPF)</a></li>
          <li><a href="/services/ceramic">Kisho 9H Ceramic Coating</a></li>
          <li><a href="/services/tint">Nano Ceramic Window Tint</a> &amp; <a href="/tint-finder">Tint Finder</a></li>
          <li><a href="/services/wash-detailing">Signature pH-Neutral Car Wash &amp; Detailing</a></li>
        </ul>
      `,
    },
    {
      path: '/services/ppf',
      title: 'ClearPro Paint Protection Film (PPF) Installation Philippines',
      description:
        'Self-healing ClearPro TPU Paint Protection Film installed inside dust-controlled Hakum Auto Care studios in Bacoor, Cavite and Batangas City.',
      h1: 'ClearPro Paint Protection Film (PPF)',
      bodyHtml:
        '<p>Protect factory paint from stone chips, road rash, and tropical UV with ClearPro TPU PPF installed by trained Hakum technicians serving Bacoor, Imus, Cavite, and Batangas.</p>',
    },
    {
      path: '/services/ceramic',
      title: 'Kisho 9H Ceramic Coating Philippines',
      description:
        'Long-lasting Kisho 9H ceramic coating paired with machine paint correction and IPA prep for glossy, hydrophobic protection in Cavite and Batangas.',
      h1: 'Kisho 9H Ceramic Coating',
      bodyHtml:
        '<p>Multi-stage decontamination, paint correction, and genuine Kisho ceramic protection engineered for Philippine sun, rain, and daily commutes.</p>',
    },
    {
      path: '/services/tint',
      title: 'Nano Ceramic Window Tint Philippines',
      description:
        'High IR heat-rejection nano ceramic window tint installation in Bacoor, Cavite and Batangas City — clear night visibility and cabin comfort.',
      h1: 'Nano Ceramic Window Tint',
      bodyHtml:
        '<p>Compare shade visibility and infrared heat rejection with our interactive Tint Finder and book window tinting in Bacoor or Batangas City.</p>',
    },
    {
      path: '/services/wash-detailing',
      title: 'pH-Neutral Car Wash & Auto Detailing Philippines',
      description:
        'Swirl-safe two-bucket pH-neutral car wash, deep interior detailing, engine bay cleanup, and leather conditioning at Hakum Auto Care.',
      h1: 'Signature pH-Neutral Car Wash & Auto Detailing',
      bodyHtml:
        '<p>Safe daily maintenance washes and complete interior/exterior detailing with grit guards, soft microfiber zones, and transparent live queue tracking.</p>',
    },
    {
      path: '/tint-finder',
      title: 'Nano Ceramic Tint Finder Philippines',
      description:
        'Find your recommended front and rear window tint shades and compare three nano ceramic tint packages at Hakum Auto Care.',
      h1: 'Hakum Nano Ceramic Tint Finder',
      bodyHtml:
        '<p>Answer four quick driving questions to match your shade preference and reserve tint installation in Bacoor or Batangas City.</p>',
    },
    {
      path: '/branches',
      title: 'Car Wash & Detailing Branches Near Me — Bacoor, Imus, Cavite & Batangas',
      description:
        'Find the nearest Hakum Auto Care studio in Bacoor, Imus, Cavite, and Batangas City. Direct phone numbers, Google Maps pins, and live queue.',
      jsonLd: branchesGraph,
      jsonLdId: 'hakum-branches',
      h1: 'Hakum Auto Care Branches — Bacoor, Imus, Cavite & Batangas',
      bodyHtml: `
        <p>Find the closest Hakum Auto Care car wash, detailing, and paint protection studio near you:</p>
        <ul>
          <li><a href="/branches/bacoor">Hakum Auto Care Bacoor, Cavite</a> — RFC Molino II, Molino Boulevard, Bacoor (0915 629 6096)</li>
          <li><a href="/branches/batangas">Hakum Auto Care Batangas City</a> — National Highway, Brgy. Alangilan, Batangas City (0956 007 1028)</li>
          <li><a href="/branches/imus">Car Wash &amp; Detailing Near Imus, Cavite</a></li>
          <li><a href="/branches/cavite">Cavite Regional Auto Detailing &amp; PPF Hub</a></li>
        </ul>
      `,
    },
    ...LOCAL_BRANCH_PAGES.map((city) => ({
      path: `/branches/${city.slug}`,
      title: city.seoTitle,
      description: city.seoDescription,
      jsonLd: buildBranchCityJsonLd(city, { origin: ORIGIN }),
      jsonLdId: `hakum-city-${city.slug}`,
      h1: city.h1,
      bodyHtml: `
        <p>${esc(city.heroSummary)}</p>
        <p><strong>Location:</strong> ${esc(city.landmarkAddress)} · <strong>Phone:</strong> ${esc(city.phone?.display || MAIN_LINE.display)}</p>
        <ul>${city.highlights.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
        <p>Serving: ${esc(city.corridors.join(', '))}.</p>
      `,
    })),
    {
      path: '/book',
      title: 'Book Car Wash, Detailing or PPF Near Me',
      description:
        'Book your car wash, detailing, ceramic coating, ceramic tint, or ClearPro PPF visit online at Hakum Auto Care Bacoor or Batangas City.',
      h1: 'Book Your Hakum Auto Care Visit',
      bodyHtml:
        '<p>Select Bacoor (near Imus, Cavite) or Batangas City, pick your vehicle service or protection package, and reserve your bay online.</p>',
    },
    {
      path: '/queue',
      title: 'Live Car Wash & Detailing Queue Philippines',
      description:
        'Check real-time queue counts at Hakum Auto Care Bacoor and Batangas City before driving over.',
      h1: 'Live Branch Queue Status',
      bodyHtml:
        '<p>View live bay counts for Hakum Auto Care Bacoor and Hakum Auto Care Batangas City before you visit.</p>',
    },
    {
      path: '/events',
      title: 'Events, Car Meets & Detailing Blog Philippines',
      description:
        'Hakum Auto Care community meets, branch events, customer car stories, and local car care guides across Bacoor, Imus, Cavite, and Batangas.',
      jsonLd: buildEventsBlogSeoJsonLd(ORIGIN),
      jsonLdId: 'hakum-events-seo',
      h1: 'Hakum Auto Care Events & Detailing Guides',
      bodyHtml: `
        <p>Car meets, workshops, and regional detailing authority guides for Cavite and Batangas motorists.</p>
        <ul>${SEO_LOCAL_GUIDES.map((g) => `<li><a href="/blog/${esc(g.slug)}">${esc(g.title)}</a></li>`).join('')}</ul>
      `,
    },
    {
      path: '/blog',
      title: 'Auto Detailing, PPF & Car Wash Blog Philippines',
      description:
        'Detailing craft, ceramic coating protection, PPF insights, and local studio guides for Bacoor, Imus, Cavite, and Batangas City by Hakum Auto Care.',
      jsonLd: buildEventsBlogSeoJsonLd(ORIGIN),
      jsonLdId: 'hakum-blog-hub-jsonld',
      h1: 'Hakum Auto Care Blog & Regional Car Care Guides',
      bodyHtml: `
        <p>Guides covering two-bucket pH-neutral car washing, ceramic coating longevity in Philippine heat, ClearPro PPF, and Hakum branches near you.</p>
        <ul>${SEO_LOCAL_GUIDES.map((g) => `<li><a href="/blog/${esc(g.slug)}">${esc(g.title)}</a> — ${esc(g.ai_summary || g.excerpt)}</li>`).join('')}</ul>
        <h2>Quick Answers</h2>
        <ul>${SEO_LOCAL_FAQS.map((f) => `<li><strong>${esc(f.question)}</strong>: ${esc(f.answer)}</li>`).join('')}</ul>
      `,
    },
    ...SEO_LOCAL_GUIDES.map((guide) => {
      const blocksText = (guide.content_blocks || [])
        .map((b) => {
          if (b.type === 'heading') return `<h2>${esc(b.text)}</h2>`
          if (b.type === 'paragraph') return `<p>${esc(b.text)}</p>`
          if (b.type === 'list' && Array.isArray(b.items)) {
            return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
          }
          if (b.type === 'quote') return `<blockquote>${esc(b.text)}</blockquote>`
          return ''
        })
        .join('')
      return {
        path: `/blog/${guide.slug}`,
        title: guide.title,
        description: guide.ai_summary || guide.excerpt,
        image: guide.cover_url ? `${ORIGIN}${guide.cover_url.startsWith('/') ? '' : '/'}${guide.cover_url}` : `${ORIGIN}/og-image.png`,
        jsonLd: buildBlogPostJsonLd(guide, ORIGIN),
        jsonLdId: 'hakum-blogpost-jsonld',
        h1: guide.title,
        bodyHtml: `
          <p><strong>Summary:</strong> ${esc(guide.ai_summary || guide.excerpt)}</p>
          ${blocksText}
          <p><a href="/blog">All Hakum Blog Guides</a> · <a href="/branches">Find Nearest Branch</a></p>
        `,
      }
    }),
    {
      path: '/partnerships',
      title: 'Brand Collabs & Automotive Events',
      description: 'Collaborate with Hakum Auto Care on car meets, automotive products, events, and distribution in the Philippines.',
      h1: 'Partner with Hakum Auto Care',
      bodyHtml: '<p>Brand collaborations, car club meets, and automotive sponsorships across Cavite and Batangas.</p>',
    },
    {
      path: '/contact',
      title: 'Contact Hakum Auto Care Philippines',
      description: 'Contact Hakum Auto Care in Bacoor, Cavite (0915 629 6096) or Batangas City (0956 007 1028) for bookings and consultations.',
      h1: 'Contact Hakum Auto Care',
      bodyHtml:
        '<p>Reach Hakum Auto Care Bacoor at 0915 629 6096 or Batangas City at 0956 007 1028.</p>',
    },
  ]

  return routes
}

function stampRouteHtml(template, route) {
  const fullTitle = buildDocumentTitle(route.title)
  const desc = route.description
  const canonical = `${ORIGIN}${route.path}`
  const img = route.image || `${ORIGIN}/og-image.png`
  const siteLd = buildSiteJsonLd({ origin: ORIGIN })

  let html = template
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(fullTitle)}</title>`)
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
    `<meta name="description" content="${esc(desc)}" />`,
  )
  html = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${esc(canonical)}" />`,
  )
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${esc(fullTitle)}" />`,
  )
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${esc(desc)}" />`,
  )
  html = html.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:url" content="${esc(canonical)}" />`,
  )
  html = html.replace(
    /<meta\s+property="og:image"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:image" content="${esc(img)}" />`,
  )
  html = html.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/>/,
    `<meta name="twitter:title" content="${esc(fullTitle)}" />`,
  )
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
  )
  html = html.replace(
    /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/>/,
    `<meta name="twitter:image" content="${esc(img)}" />`,
  )

  const extraLd = route.jsonLd
    ? `\n    <script type="application/ld+json" data-jsonld="${esc(route.jsonLdId || 'hakum-route')}">${escJsonLd(route.jsonLd)}</script>`
    : ''
  html = html.replace(
    /<script type="application\/ld\+json" data-jsonld="hakum-site">[\s\S]*?<\/script>/,
    `<script type="application/ld+json" data-jsonld="hakum-site">${escJsonLd(siteLd)}</script>${extraLd}`,
  )

  const semanticBody = `<main style="max-width:960px;margin:0 auto;padding:48px 20px;color:#f1f1ed;font-family:system-ui,-apple-system,sans-serif;line-height:1.6">
        <h1>${esc(route.h1)}</h1>
        ${route.bodyHtml}
        <nav aria-label="Site sections" style="margin-top:24px">
          <a href="/" style="color:#9db4ff">Home</a> ·
          <a href="/services" style="color:#9db4ff">Services</a> ·
          <a href="/branches" style="color:#9db4ff">Branches</a> ·
          <a href="/blog" style="color:#9db4ff">Blog</a> ·
          <a href="/book" style="color:#9db4ff">Book Online</a>
        </nav>
      </main>`

  html = html.replace(/<div id="root">[\s\S]*?<\/div>/, `<div id="root">${semanticBody}</div>`)
  return html
}

if (!existsSync(distIndexPath)) {
  console.error('prerender-seo: dist/index.html not found — run vite build first')
  process.exit(1)
}

const template = readFileSync(distIndexPath, 'utf8')
const routes = buildStaticRoutes()
let written = 0

// Never overwrite dist/index.html after VitePWA generates Workbox precache hashes;
// write clean-URL HTML files (`dist/<route>.html`) paired with cleanUrls:true in vercel.json.
for (const route of routes) {
  const clean = route.path.replace(/^\/+/, '').replace(/\/+$/, '')
  if (!clean) continue
  const outFile = join(distDir, `${clean}.html`)
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, stampRouteHtml(template, route), 'utf8')
  written += 1
}

console.log(`prerender-seo: wrote ${written} static route HTML shells under dist/`)
