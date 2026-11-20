import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBreadcrumbJsonLd, buildDocumentTitle, buildLocalBusinessJsonLd, buildServicePageJsonLd, buildSiteJsonLd } from '../src/lib/pageMeta.js'
import { SERVICE_DETAIL_CONTENT } from '../src/data/serviceDetailContent.js'
import { SEO_LOCAL_GUIDES, SEO_LOCAL_FAQS, buildBlogPostJsonLd, buildEventsBlogSeoJsonLd } from '../src/lib/seoLocalGuides.js'
import { BRANCH_MAP_LISTINGS, MAIN_LINE, branchPhone } from '../src/lib/homeBranches.js'
import {
  LOCAL_BRANCH_PAGES,
  LOCAL_BRANCH_SERVICE_PAGES,
  buildBranchCityJsonLd,
  buildBranchServiceJsonLd,
} from '../src/lib/localBranchPages.js'
import { buildSitemapXml } from '../server/seoApi.mjs'

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

function faqHtml(heading, faqs = []) {
  if (!Array.isArray(faqs) || !faqs.length) return ''
  return `
    <h2>${esc(heading)}</h2>
    <ul>${faqs.map((f) => `<li><strong>${esc(f.question || f.q)}</strong>: ${esc(f.answer || f.a)}</li>`).join('')}</ul>
  `
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

  const branchServiceLinksHtml = LOCAL_BRANCH_SERVICE_PAGES.map(
    (bs) => `<li><a href="/branches/${esc(bs.citySlug)}/${esc(bs.serviceSlug)}">${esc(bs.serviceLabel)} in ${esc(bs.cityName)}</a> — ${esc(bs.seoDescription)}</li>`,
  ).join('')

  const routes = [
    {
      path: '/home',
      canonicalPath: '/',
      robots: 'noindex,nofollow',
      title: 'Car Wash, Auto Detailing, Ceramic Coating & PPF Philippines (Bacoor, Imus, Cavite & Batangas)',
      description:
        'Hakum Auto Care — One of the fastest-growing and most trusted automotive detailing, paint protection (PPF & ceramic coating), and car wash studios in the Philippines, serving Bacoor, Imus, Dasmariñas, Cavite, and Batangas.',
      h1: 'Hakum Auto Care — Car Wash, Auto Detailing, Ceramic Coating & PPF Philippines',
      bodyHtml: `
        <p>Hakum Auto Care delivers two-bucket pH-neutral car washes, interior deep cleaning, multi-stage Rupes paint correction, Kisho 9H ceramic coating, ClearPro optical TPU Paint Protection Film (PPF), and nano ceramic window tint in the Philippines.</p>
        <h2>Open Branches &amp; Expansion Hubs</h2>
        <ul>
          <li><a href="/branches/bacoor">Hakum Auto Care Bacoor, Cavite</a> — RFC Molino II, Molino Boulevard, Bacoor (0915 629 6096)</li>
          <li><a href="/branches/batangas">Hakum Auto Care Batangas City</a> — National Highway, Brgy. Alangilan, Batangas City (0956 007 1028)</li>
          <li><a href="/branches/imus">Car Wash &amp; Detailing Near Imus, Cavite</a></li>
          <li><a href="/branches/dasmarinas">Car Wash &amp; Detailing Near Dasmariñas, Cavite</a></li>
          <li><a href="/branches/cavite">Cavite Regional Auto Detailing &amp; PPF Hub</a></li>
        </ul>
      `,
    },
    {
      path: '/services',
      title: 'Car Wash, Auto Detailing, Ceramic Coating & PPF Services — Bacoor & Batangas',
      description:
        'Explore Hakum Auto Care services: pH-neutral car wash, deep interior & exterior detailing, paint correction, Kisho ceramic coating, ClearPro PPF, and nano ceramic tint in Bacoor, Imus, Dasmariñas, Cavite, and Batangas.',
      h1: 'Automotive Detailing, Paint Protection & Car Wash Services',
      bodyHtml: `
        <p>Hakum Auto Care delivers swirl-safe two-bucket pH-neutral car washes, interior sanitization, multi-stage Rupes paint correction, Kisho 9H ceramic coating, ClearPro TPU Paint Protection Film (PPF), and nano ceramic window tint across our Bacoor (Cavite) and Batangas City studios.</p>
        <h2>Core Protection &amp; Care Services</h2>
        <ul>
          <li><a href="/services/ppf">ClearPro Paint Protection Film (PPF)</a> — self-healing optical TPU armor with 10-year manufacturer warranty.</li>
          <li><a href="/services/ceramic">Kisho 9H Ceramic Coating</a> — multi-stage paint correction and Unlimited Recoating support.</li>
          <li><a href="/services/tint">Nano Ceramic Window Tint</a> &amp; <a href="/tint-finder">3D Interactive Tint Finder</a> — clear night visibility and infrared heat rejection.</li>
          <li><a href="/services/wash-detailing">Signature pH-Neutral Car Wash &amp; Auto Detailing</a> — walk-in queue bays with real-time wait visibility.</li>
        </ul>
        <h2>Services by Branch</h2>
        <ul>${branchServiceLinksHtml}</ul>
      `,
    },
    {
      path: '/services/ppf',
      title: 'ClearPro Paint Protection Film (PPF) — Bacoor & Batangas Near Me',
      description:
        'Self-healing ClearPro TPU Paint Protection Film (PPF) installed inside dust-controlled studios in Bacoor, Cavite and Batangas City, serving Imus, Dasmariñas, and Metro South.',
      jsonLd: buildServicePageJsonLd({
        slug: 'ppf',
        name: 'ClearPro Paint Protection Film (PPF)',
        description:
          'Self-healing ClearPro TPU Paint Protection Film installed inside dust-controlled Hakum Auto Care studios in Bacoor, Cavite and Batangas City.',
        faqs: SERVICE_DETAIL_CONTENT.ppf?.faqs || [],
        origin: ORIGIN,
      }),
      jsonLdId: 'hakum-service-ppf',
      h1: 'ClearPro Paint Protection Film (PPF) Near Me — Bacoor & Batangas',
      bodyHtml: `
        <p>Protect factory paint from SLEX, MCX, Daang Hari, and STAR Tollway rock chips, scratches, and UV yellowing with genuine ClearPro optical TPU film installed in our enclosed Bacoor and Batangas City bays.</p>
        <h2>ClearPro Patented Film Highlights</h2>
        <ul>
          <li>Polyoptico high-gloss 95 GU finish with zero orange peel and optional UltraSatin / Cosmoblack finishes.</li>
          <li>Invisiglue residue-free adhesive backed by an official 10-year manufacturer warranty.</li>
          <li>Book dedicated installation bays at <a href="/branches/bacoor/ppf">Hakum Bacoor PPF Studio</a> or <a href="/branches/batangas/ppf">Hakum Batangas PPF Studio</a>.</li>
        </ul>
        ${faqHtml('Paint Protection Film (PPF) FAQ', SERVICE_DETAIL_CONTENT.ppf?.faqs || [])}
      `,
    },
    {
      path: '/services/ceramic',
      title: 'Kisho 9H Ceramic Coating — Bacoor, Cavite & Batangas Near Me',
      description:
        'Long-lasting Kisho 9H ceramic coating paired with machine paint correction and IPA prep in Bacoor, Cavite and Batangas City, backed by Unlimited Recoating packages.',
      jsonLd: buildServicePageJsonLd({
        slug: 'ceramic',
        name: 'Kisho 9H Ceramic Coating',
        description:
          'Long-lasting Kisho 9H ceramic coating paired with machine paint correction and IPA prep for glossy, hydrophobic protection in Bacoor and Batangas City.',
        faqs: SERVICE_DETAIL_CONTENT.ceramic?.faqs || [],
        origin: ORIGIN,
      }),
      jsonLdId: 'hakum-service-ceramic',
      h1: 'Kisho 9H Ceramic Coating in Bacoor & Batangas City',
      bodyHtml: `
        <p>True ceramic coating requires spotless preparation. Hakum Auto Care performs chemical iron decontamination, clay bar cleansing, digital paint thickness inspection, and multi-stage Rupes + Menzerna machine polishing before curing genuine Japanese Kisho ceramic layers.</p>
        <h2>Book Ceramic Coating by Studio</h2>
        <ul>
          <li><a href="/branches/bacoor/ceramic-coating">Ceramic Coating in Bacoor, Cavite (RFC Molino II)</a> — serving Bacoor, Molino, Imus, Dasmariñas, and Alabang.</li>
          <li><a href="/branches/batangas/ceramic-coating">Ceramic Coating in Batangas City (Alangilan)</a> — serving Batangas City, Lipa, Bauan, and STAR Tollway drivers.</li>
        </ul>
        ${faqHtml('Ceramic Coating FAQ', SERVICE_DETAIL_CONTENT.ceramic?.faqs || [])}
      `,
    },
    {
      path: '/services/tint',
      title: 'Nano Ceramic Window Tint — Bacoor, Imus & Batangas',
      description:
        'High IR heat-rejection nano ceramic window tint installation in Bacoor, Cavite and Batangas City — clear night visibility, RFID compatibility, and 3D shade preview.',
      jsonLd: buildServicePageJsonLd({
        slug: 'tint',
        name: 'Nano Ceramic Window Tint',
        description:
          'High IR heat-rejection nano ceramic window tint installation in Bacoor, Cavite and Batangas City — clear night visibility and cabin comfort.',
        faqs: SERVICE_DETAIL_CONTENT.tint?.faqs || [],
        origin: ORIGIN,
      }),
      jsonLdId: 'hakum-service-tint',
      h1: 'Nano Ceramic Window Tint in Bacoor & Batangas City',
      bodyHtml: `
        <p>Stay cool in heavy Philippine sun while keeping nighttime clarity sharp. Non-metallic nano ceramic film rejects harsh solar infrared heat without blocking Autosweep/Easytrip RFID, GPS, or cellular signal.</p>
        <ul>
          <li>Preview shades live in 3D on our <a href="/tint-finder">Hakum Tint Finder</a>.</li>
          <li>Book <a href="/branches/bacoor/window-tint">Window Tint in Bacoor, Cavite</a> or <a href="/branches/batangas/window-tint">Window Tint in Batangas City</a>.</li>
        </ul>
        ${faqHtml('Window Tint FAQ', SERVICE_DETAIL_CONTENT.tint?.faqs || [])}
      `,
    },
    {
      path: '/services/wash-detailing',
      title: 'Car Wash & Auto Detailing — Bacoor, Imus & Batangas',
      description:
        'Swirl-safe two-bucket pH-neutral car wash, deep interior detailing, engine bay cleanup, watermark removal, and leather conditioning at Hakum Auto Care.',
      jsonLd: buildServicePageJsonLd({
        slug: 'wash-detailing',
        name: 'Signature pH-Neutral Car Wash & Auto Detailing',
        description:
          'Swirl-safe two-bucket pH-neutral car wash, deep interior detailing, engine bay cleanup, and leather conditioning at Hakum Auto Care.',
        faqs: SERVICE_DETAIL_CONTENT['wash-detailing']?.faqs || [],
        origin: ORIGIN,
      }),
      jsonLdId: 'hakum-service-wash',
      h1: 'Signature pH-Neutral Car Wash & Auto Detailing',
      bodyHtml: `
        <p>Protect coated, wrapped, or factory clear coats with safe two-bucket grit-guard washing, snow-foam pre-soak, dedicated wheel mitts, deep interior sanitization, leather care, and acid-rain glass restoration.</p>
        <ul>
          <li><a href="/branches/bacoor/car-wash">Car Wash &amp; Detailing in Bacoor, Cavite</a> (RFC Molino II · live walk-in queue)</li>
          <li><a href="/branches/batangas/car-wash">Car Wash &amp; Detailing in Batangas City</a> (Brgy. Alangilan · live walk-in queue)</li>
        </ul>
        ${faqHtml('Car Wash & Detailing FAQ', SERVICE_DETAIL_CONTENT['wash-detailing']?.faqs || [])}
      `,
    },
    {
      path: '/shop',
      title: 'Car Care & Aftercare Shop — pH-Neutral Shampoos & Boosters',
      description:
        'Shop pH-neutral car shampoos, ceramic boosters, microfiber towels, and detailing essentials stocked at Hakum Auto Care Bacoor and Batangas City.',
      jsonLd: buildBreadcrumbJsonLd(
        [
          { name: 'Home', path: '/' },
          { name: 'Car Care Shop', path: '/shop' },
        ],
        ORIGIN,
      ),
      jsonLdId: 'hakum-shop-breadcrumb',
      h1: 'Hakum Car Care & Aftercare Shop',
      bodyHtml: `
        <p>Maintain ceramic-coated and PPF-protected finishes safely between studio visits using curated pH-neutral shampoos, quick detailers, interior protectants, and plush Korean microfiber towels stocked in Bacoor and Batangas City.</p>
        <ul>
          <li>Safe for Kisho 9H Ceramic Coating and ClearPro TPU Paint Protection Film.</li>
          <li>Available in-branch during wash or detailing visits in <a href="/branches/bacoor">Bacoor</a> and <a href="/branches/batangas">Batangas City</a>.</li>
        </ul>
      `,
    },
    {
      path: '/tint-finder',
      title: '3D Nano Ceramic Tint Finder — Compare Shade & Heat Rejection',
      description:
        'Preview front windshield, side window, and rear glass tint shades on an interactive 3D car before booking installation in Bacoor or Batangas City.',
      h1: 'Hakum Interactive 3D Nano Ceramic Tint Finder',
      bodyHtml: `
        <p>Compare Light, Medium, Dark, and Super Dark ceramic window tint combinations in daylight and nighttime road views before reserving your clean-bay fitting at Hakum Bacoor or Batangas City.</p>
        <ul>
          <li>Non-metallic RFID-friendly nano ceramic films for Autosweep and Easytrip toll gates.</li>
          <li><a href="/branches/bacoor/window-tint">Book Tint in Bacoor</a> · <a href="/branches/batangas/window-tint">Book Tint in Batangas City</a>.</li>
        </ul>
      `,
    },
    {
      path: '/branches',
      title: 'Car Wash & Detailing Branches Near Me — Bacoor, Imus, Dasmariñas, Cavite & Batangas',
      description:
        'Find the nearest Hakum Auto Care studio in Bacoor, Imus, Dasmariñas, Cavite, and Batangas City. Direct phone numbers, Google Maps pins, services, and live queue.',
      jsonLd: branchesGraph,
      jsonLdId: 'hakum-branches',
      h1: 'Hakum Auto Care Branches — Bacoor, Imus, Dasmariñas, Cavite & Batangas',
      bodyHtml: `
        <p>Find the closest Hakum Auto Care car wash, detailing, and paint protection studio near you:</p>
        <ul>${LOCAL_BRANCH_PAGES.map((c) => `<li><a href="/branches/${esc(c.slug)}">Hakum Auto Care — ${esc(c.cityName)}</a>: ${esc(c.landmarkAddress)}</li>`).join('')}</ul>
        <h2>Local Service Studios</h2>
        <ul>${branchServiceLinksHtml}</ul>
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
        <h2>Popular Services in ${esc(city.shortName)}</h2>
        <ul>${LOCAL_BRANCH_SERVICE_PAGES.filter((bs) => bs.citySlug === city.branchSlug).map((bs) => `<li><a href="/branches/${esc(bs.citySlug)}/${esc(bs.serviceSlug)}">${esc(bs.serviceLabel)} in ${esc(bs.cityName)}</a></li>`).join('')}</ul>
        <p>Serving: ${esc(city.corridors.join(', '))}.</p>
        ${faqHtml(`Questions in ${city.cityName}`, city.qa || [])}
      `,
    })),
    ...LOCAL_BRANCH_SERVICE_PAGES.map((bs) => {
      const city = LOCAL_BRANCH_PAGES.find((c) => c.slug === bs.citySlug)
      const phone = branchPhone(bs.branchSlug) || MAIN_LINE
      return {
        path: `/branches/${bs.citySlug}/${bs.serviceSlug}`,
        title: bs.seoTitle,
        description: bs.seoDescription,
        jsonLd: buildBranchServiceJsonLd(bs, { origin: ORIGIN }),
        jsonLdId: `hakum-branch-service-${bs.citySlug}-${bs.serviceSlug}`,
        h1: bs.h1,
        bodyHtml: `
          <p>${esc(bs.heroSummary)}</p>
          <p><strong>Studio:</strong> ${esc(city?.landmarkAddress || bs.cityName)} · <strong>Direct Phone:</strong> ${esc(phone.display)}</p>
          <h2>How We Deliver ${esc(bs.serviceLabel)} in ${esc(bs.shortCity)}</h2>
          <ol>${bs.processSteps.map((step) => `<li>${esc(step)}</li>`).join('')}</ol>
          <h2>Local Advantages</h2>
          <ul>${bs.localHighlights.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
          <p>Areas served: ${esc((city?.corridors || []).join(', '))}.</p>
          ${faqHtml(`${bs.serviceLabel} in ${bs.shortCity} FAQ`, bs.qa || [])}
          <p><a href="/branches/${esc(bs.citySlug)}">All services in ${esc(bs.shortCity)}</a> · <a href="${esc(bs.serviceDetailRoute)}">National ${esc(bs.serviceLabel)} overview</a></p>
        `,
      }
    }),
    {
      path: '/book',
      title: 'Book Car Wash, Detailing, Ceramic Coating or PPF Near Me',
      description:
        'Book your detailing consultation, Kisho 9H ceramic coating, ClearPro PPF, or ceramic window tint slot online at Hakum Auto Care Bacoor or Batangas City.',
      h1: 'Book Your Hakum Auto Care Studio Slot Online',
      bodyHtml: `
        <p>Select Hakum Bacoor (RFC Molino II, serving Imus and Dasmariñas) or Hakum Batangas City (Brgy. Alangilan), choose your vehicle size and service package, and pick your preferred date online.</p>
        <ul>
          <li>Need a routine walk-in car wash? Check live wait times on <a href="/queue">Live Branch Queue</a> before driving over.</li>
          <li>Comparing protection packages? See <a href="/services/ceramic">Ceramic Coating</a> and <a href="/services/ppf">ClearPro PPF</a>.</li>
        </ul>
      `,
    },
    {
      path: '/queue',
      title: 'Live Car Wash & Detailing Queue — Bacoor & Batangas City',
      description:
        'Check real-time waiting cars and active bays at Hakum Auto Care Bacoor (RFC Molino) and Batangas City (Alangilan) before leaving home.',
      h1: 'Live Car Wash & Detailing Branch Queue',
      bodyHtml: `
        <p>See how many cars are currently waiting or in-bay at Hakum Auto Care Bacoor and Batangas City in real time so you never guess wait times.</p>
        <ul>
          <li><a href="/branches/bacoor/car-wash">Car Wash &amp; Queue in Bacoor (RFC Molino II)</a> — 0915 629 6096</li>
          <li><a href="/branches/batangas/car-wash">Car Wash &amp; Queue in Batangas City (Alangilan)</a> — 0956 007 1028</li>
        </ul>
      `,
    },
    {
      path: '/events',
      title: 'Events, Car Meets & Detailing Blog — Bacoor & Batangas',
      description:
        'Hakum Auto Care community meets, branch events, customer car stories, and local car care guides across Bacoor, Imus, Dasmariñas, Cavite, and Batangas.',
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
        'Detailing craft, ceramic coating protection, PPF insights, and local studio guides for Bacoor, Imus, Dasmariñas, Cavite, and Batangas City by Hakum Auto Care.',
      jsonLd: buildEventsBlogSeoJsonLd(ORIGIN),
      jsonLdId: 'hakum-blog-hub-jsonld',
      h1: 'Hakum Auto Care Blog & Regional Car Care Guides',
      bodyHtml: `
        <p>Guides covering two-bucket pH-neutral car washing, ceramic coating longevity in Philippine heat, ClearPro PPF, and Hakum branches near you.</p>
        <ul>${SEO_LOCAL_GUIDES.map((g) => `<li><a href="/blog/${esc(g.slug)}">${esc(g.title)}</a> — ${esc(g.ai_summary || g.excerpt)}</li>`).join('')}</ul>
        ${faqHtml('Quick Car Care Answers', SEO_LOCAL_FAQS)}
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
        ogType: 'article',
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
      path: '/contact',
      title: 'Contact Hakum Auto Care — Bacoor & Batangas Studios',
      description: 'Contact Hakum Auto Care in Bacoor, Cavite (0915 629 6096) or Batangas City (0956 007 1028) for bookings, PPF quotes, and ceramic coating consultations.',
      h1: 'Contact Hakum Auto Care',
      bodyHtml: `
        <p>Reach Hakum Auto Care Bacoor (RFC Molino II, Molino Boulevard) at <strong>0915 629 6096</strong> or Batangas City (National Highway, Brgy. Alangilan) at <strong>0956 007 1028</strong>.</p>
        <ul>
          <li>Email inquiries: sales@hakumautocare.com · admin@hakumautocare.com</li>
          <li>Direct studio pages: <a href="/branches/bacoor">Bacoor</a> · <a href="/branches/batangas">Batangas City</a> · <a href="/branches/imus">Imus</a> · <a href="/branches/dasmarinas">Dasmariñas</a></li>
        </ul>
      `,
    },
    {
      path: '/complaints',
      robots: 'noindex,nofollow',
      title: 'Submit a Complaint',
      description: 'Report a service or branch issue to Hakum Auto Care management.',
      h1: 'Submit a Complaint',
      bodyHtml: '<p>Submit branch or service feedback directly to Hakum Auto Care management.</p>',
    },
  ]

  return routes
}

function stampRouteHtml(template, route) {
  const fullTitle = buildDocumentTitle(route.title)
  const desc = route.description
  const canonicalPath = route.canonicalPath || route.path
  const canonical = canonicalPath === '/' ? `${ORIGIN}/` : `${ORIGIN}${canonicalPath}`
  const robots = route.robots || 'index,follow'
  const img = route.image || `${ORIGIN}/og-image.png`
  const siteLd = buildSiteJsonLd({ origin: ORIGIN })

  let html = template
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(fullTitle)}</title>`)
  html = html.replace(
    /<meta\s+name="robots"\s+content="[^"]*"\s*\/>/,
    `<meta name="robots" content="${esc(robots)}" />`,
  )
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
    /<meta\s+property="og:type"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:type" content="${route.ogType === 'article' ? 'article' : 'website'}" />`,
  )
  html = html.replace(
    /<link\s+rel="alternate"\s+hreflang="en-PH"\s+href="[^"]*"\s*\/>/,
    `<link rel="alternate" hreflang="en-PH" href="${esc(canonical)}" />`,
  )
  html = html.replace(
    /<link\s+rel="alternate"\s+hreflang="x-default"\s+href="[^"]*"\s*\/>/,
    `<link rel="alternate" hreflang="x-default" href="${esc(canonical)}" />`,
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
          <a href="/branches/bacoor" style="color:#9db4ff">Bacoor</a> ·
          <a href="/branches/batangas" style="color:#9db4ff">Batangas</a> ·
          <a href="/blog" style="color:#9db4ff">Blog</a> ·
          <a href="/book" style="color:#9db4ff">Book Online</a>
        </nav>
      </main>`

  html = html.replace(/<div id="root">[\s\S]*?<\/div>/, `<div id="root">${semanticBody}</div>`)
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>\s*/g, '')
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

// Keep dist/sitemap.xml aligned identically with STATIC_SITEMAP_ROUTES + SEO_LOCAL_GUIDES
writeFileSync(join(distDir, 'sitemap.xml'), buildSitemapXml({ origin: ORIGIN }), 'utf8')

console.log(`prerender-seo: wrote ${written} static route HTML shells + synced dist/sitemap.xml`)
