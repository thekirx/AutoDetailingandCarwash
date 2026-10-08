/**
 * Seam S4 — public metadata: what crawlers and social scrapers actually read.
 *
 * BUG-051, verified live against production with Playwright: every blog post
 * and event share link rendered <title>Hakum Auto Care · Hakum Auto Care</title>
 * with the homepage description, because pageMeta.js appended " · ${SITE}" to a
 * fallback title that already WAS SITE, and because BlogPostPage / EventSharePage
 * never called usePageMeta at all.
 *
 * These are pure helpers, so the assertions are on returned strings — the same
 * strings the browser would put in document.head — not on rendered DOM.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

// ── H3a: the doubled title ───────────────────────────────────────────────

test('a title equal to the site name is not suffixed again', async () => {
  const { buildDocumentTitle, SITE } = await import('../src/lib/pageMeta.js')
  assert.equal(buildDocumentTitle(undefined), SITE)
  assert.equal(buildDocumentTitle(''), SITE)
  assert.equal(buildDocumentTitle(SITE), SITE, 'the homepage fallback must not double the name')
  assert.equal(buildDocumentTitle('Services'), `Services · ${SITE}`)
})

test('a real page title gets the site suffix exactly once', async () => {
  const { buildDocumentTitle, SITE } = await import('../src/lib/pageMeta.js')
  const t = buildDocumentTitle('Ceramic coating that actually lasts in PH heat')
  assert.equal(t, `Ceramic coating that actually lasts in PH heat · ${SITE}`)
  assert.equal((t.match(new RegExp(SITE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1)
})

test('the duplication bug is gone from the title builder', () => {
  // The literal string may appear in the doc comment explaining the bug, so
  // assert on behaviour instead: no unconditional suffix outside the guard.
  const src = read('src/lib/pageMeta.js')
  const body = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  assert.ok(
    !/return `\$\{value\} · \$\{SITE\}`/.test(body) || body.includes('if (!value || value === SITE)'),
    'the site name must be appended only after the equality guard',
  )
})

// ── H3b: per-page metadata actually exists ───────────────────────────────

for (const page of ['BlogPostPage', 'EventSharePage', 'EventsPage']) {
  test(`${page} publishes its own metadata`, () => {
    const src = read(`src/pages/${page}.jsx`)
    assert.match(src, /usePageMeta\(/, `${page}.jsx must call usePageMeta — otherwise every share renders the site default`)
  })
}

// ── H2: canonical ────────────────────────────────────────────────────────

test('a page emits exactly one canonical pointing at its own route', async () => {
  const { buildHeadPatch } = await import('../src/lib/pageMeta.js')
  const patch = buildHeadPatch({ title: 'Branches', path: '/branches' })
  const canonicals = patch.links.filter((l) => l.rel === 'canonical')
  assert.equal(canonicals.length, 1, 'exactly one canonical, or duplicate URL forms split ranking')
  assert.equal(canonicals[0].href.endsWith('/branches'), true)
  assert.equal(
    patch.meta.some((m) => m.key === 'og:url' && m.content === canonicals[0].href),
    true,
    'og:url must agree with the canonical or shares disagree with the SERP entry',
  )
})

test('duplicate URL forms collapse onto one canonical', async () => {
  const { buildHeadPatch } = await import('../src/lib/pageMeta.js')
  const canonical = (p) => buildHeadPatch({ path: p }).links.find((l) => l.rel === 'canonical').href
  // Trailing slash and bare form are the same page; a query string is not
  // canonicalisable away, but the router must at least normalise the slash.
  assert.equal(canonical('/services'), canonical('services'))
})

test('the shop-floor TV board is kept out of the index', async () => {
  const { buildHeadPatch } = await import('../src/lib/pageMeta.js')
  const tv = buildHeadPatch({ path: '/queue/bacoor/tv', noindex: true })
  assert.equal(tv.robots, 'noindex,nofollow')
  assert.equal(tv.meta.find((m) => m.key === 'robots').content, 'noindex,nofollow')
  const normal = buildHeadPatch({ path: '/branches' })
  assert.equal(normal.robots, 'index,follow')
})

test('robots.txt and sitemap.xml ship with the site', () => {
  assert.ok(existsSync(join(root, 'public', 'robots.txt')), 'public/robots.txt must exist')
  assert.ok(existsSync(join(root, 'public', 'sitemap.xml')), 'public/sitemap.xml must exist')
})

test('robots.txt points at the sitemap and does not block the site', () => {
  const txt = read('public/robots.txt')
  assert.match(txt, /Sitemap:/i)
  assert.doesNotMatch(txt, /^User-agent:\s*\*\s*\n\s*Disallow:\s*\/\s*$/m, 'must not disallow everything')
})

test('the sitemap is well-formed and covers the public routes', () => {
  const xml = read('public/sitemap.xml')
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  assert.ok(locs.length >= 10, `expected the public surface, got ${locs.length} urls`)
  for (const required of ['/services', '/branches', '/book', '/queue', '/events']) {
    assert.ok(
      locs.some((l) => new URL(l).pathname === required),
      `sitemap is missing ${required}`,
    )
  }
  // Nothing behind the login may be advertised for indexing.
  for (const hidden of ['/operations', '/account', '/app']) {
    assert.equal(
      locs.some((l) => new URL(l).pathname.startsWith(hidden)),
      false,
      `${hidden} must not be in the sitemap`,
    )
  }
})

test('every sitemap URL is absolute and unique', () => {
  const xml = read('public/sitemap.xml')
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  for (const loc of locs) {
    assert.match(loc, /^https:\/\/[a-z0-9.-]+\//, `sitemap loc must be absolute: ${loc}`)
  }
  assert.equal(new Set(locs).size, locs.length, 'duplicate <loc> entries in the sitemap')
})

// ── H1: structured data ──────────────────────────────────────────────────

test('the branch graph describes an AutomotiveBusiness with the facts we hold', async () => {
  const { buildLocalBusinessJsonLd } = await import('../src/lib/pageMeta.js')
  const graph = buildLocalBusinessJsonLd({
    branches: [
      { slug: 'bacoor', name: 'Bacoor', address: 'RFC Molino', phone: '09156296096' },
      { slug: 'batangas', name: 'Batangas', address: 'PNP Batangas', phone: '09560071028' },
    ],
    hoursBySlug: {
      bacoor: [
        { day_of_week: 1, opens_at: '08:00', closes_at: '18:00' },
        { day_of_week: 0, is_closed: true },
      ],
    },
  })

  assert.equal(graph['@context'], 'https://schema.org')
  assert.equal(graph['@graph'].length, 2)
  const [bacoor, batangas] = graph['@graph']
  assert.equal(bacoor['@type'], 'AutomotiveBusiness')
  assert.equal(bacoor.name, 'Hakum Auto Care Bacoor')
  assert.deepEqual(bacoor.areaServed, ['Bacoor', 'Batangas'])
  assert.equal(bacoor.address.addressLocality, 'Bacoor')
  assert.equal(bacoor.address.streetAddress, 'RFC Molino')
  assert.equal(bacoor.telephone, '09156296096')
  // Sunday is closed in the source rows and must not appear as open.
  assert.deepEqual(bacoor.openingHoursSpecification, [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/Monday', opens: '08:00', closes: '18:00' },
  ])
  // A branch with no hours rows must not gain invented ones.
  assert.equal('openingHoursSpecification' in batangas, false)
})

test('opening hours convert from the stored formats without guessing', async () => {
  const { openingHoursSpecification } = await import('../src/lib/pageMeta.js')
  assert.deepEqual(
    openingHoursSpecification([
      { day_of_week: 2, opens_at: '9:00:00', closes_at: '6:00 PM' },
      { day_of_week: 3, opens_at: '9 AM', closes_at: '5 PM' },
      { day_of_week: 4, opens_at: '', closes_at: '18:00' },
      { day_of_week: 6, opens_at: '08:00', closes_at: '18:00' },
      { day_of_week: 6, opens_at: '08:00', closes_at: '18:00' },
    ]),
    [
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/Tuesday', opens: '09:00', closes: '18:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/Wednesday', opens: '09:00', closes: '17:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/Saturday', opens: '08:00', closes: '18:00' },
    ],
  )
  assert.deepEqual(openingHoursSpecification([]), [])
})

test('day 0 is Sunday, matching the branch hours table', async () => {
  // WEEKDAY_LABELS in lib/branchOperatingHours.js starts at Sun. Publishing
  // the week one day out shifts every branch's hours in Google's listing.
  const { openingHoursSpecification } = await import('../src/lib/pageMeta.js')
  const [row] = openingHoursSpecification([{ day_of_week: 0, opens_at: '08:00', closes_at: '12:00' }])
  assert.equal(row.dayOfWeek, 'https://schema.org/Sunday')
  const last = openingHoursSpecification([{ day_of_week: 6, opens_at: '08:00', closes_at: '12:00' }])
  assert.equal(last[0].dayOfWeek, 'https://schema.org/Saturday')
})

test('a coming-soon branch advertises no hours', async () => {
  const { buildLocalBusinessJsonLd } = await import('../src/lib/pageMeta.js')
  const graph = buildLocalBusinessJsonLd({
    branches: [{ slug: 'dasmarinas-coming-soon', name: 'Dasmariñas', address: 'Dasmariñas, Cavite', coming_soon: true }],
    hoursBySlug: { 'dasmarinas-coming-soon': [{ day_of_week: 1, opens_at: '08:00', closes_at: '18:00' }] },
  })
  const [node] = graph['@graph']
  // Publishing opening hours for a branch that has not opened is a false claim.
  assert.deepEqual(node.openingHoursSpecification, [])
})

test('the site graph names the org and links the publisher', async () => {
  const { buildSiteJsonLd, SITE } = await import('../src/lib/pageMeta.js')
  const { '@graph': graph } = buildSiteJsonLd()
  const org = graph.find((n) => n['@type'] === 'Organization')
  const site = graph.find((n) => n['@type'] === 'WebSite')
  assert.equal(org.name, SITE)
  assert.equal(site.publisher['@id'], org['@id'], 'the website must name a publisher, not float free')
})

test('the public surfaces actually publish those graphs', () => {
  // Not a string-existence check on the helper: the callers must pass the
  // graphs through, or the structured data never reaches a crawler.
  const pageMeta = read('src/components/PublicPageMeta.jsx')
  const publicPages = read('src/pages/PublicPages.jsx')
  assert.match(pageMeta, /buildSiteJsonLd\(\)/, 'PublicPageMeta must publish the site graph')
  assert.match(pageMeta, /jsonLd:\s*siteJsonLd/, '...and pass it to usePageMeta')
  assert.match(publicPages, /buildLocalBusinessJsonLd\(\{/, 'BranchesPage must publish the branch graph')
  assert.match(publicPages, /jsonLd:\s*branchJsonLd/, '...and pass it to usePageMeta')
})

test('no aggregateRating is invented', async () => {
  const { buildLocalBusinessJsonLd, buildSiteJsonLd } = await import('../src/lib/pageMeta.js')
  const nodes = [
    ...buildLocalBusinessJsonLd({ branches: [{ slug: 'bacoor', name: 'Bacoor' }] })['@graph'],
    ...buildSiteJsonLd()['@graph'],
  ]
  for (const node of nodes) {
    assert.equal(
      'aggregateRating' in node,
      false,
      // No branch has a Google review URL yet (Unresolved decision #5/#13), so
      // any star rating here would be fabricated.
      'aggregateRating must not be emitted without a real review count',
    )
  }
})

test('no source file hardcodes a star rating', () => {
  const src = [
    'src/components/PublicPageMeta.jsx',
    'src/pages/PublicPages.jsx',
    'src/lib/pageMeta.js',
    'src/pages/BlogPostPage.jsx',
    'src/pages/EventSharePage.jsx',
    'src/pages/EventsPage.jsx',
    'index.html',
  ]
    .map(read)
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  assert.doesNotMatch(src, /aggregateRating|ratingValue|reviewCount/, 'invented review data must not reach a crawler')
})

// ── H4: NAP consistency ──────────────────────────────────────────────────

test('every NAP string says Bacoor and Batangas, never a mixed claim', () => {
  const offenders = ['src/pages/PublicPages.jsx', 'index.html', 'src/components/PublicPageMeta.jsx', 'src/lib/pageMeta.js']
    .filter((f) => /Cavite and Batangas/.test(read(f)))
  assert.deepEqual(offenders, [], `these contradict the other NAP strings: ${offenders.join(', ')}`)
})

test('the published area claim matches the branch slugs we actually serve', async () => {
  const slugs = [...read('src/lib/homeBranches.js').matchAll(/slug: '([^']+)'/g)].map((m) => m[1])
  for (const city of ['bacoor', 'batangas']) {
    assert.ok(slugs.includes(city), `${city} must be a real branch slug before we claim it in NAP`)
  }
  // The NAP claim and the branch list must not drift apart: whatever the
  // fallback branch cards name has to be the area the graph publishes.
  const { buildLocalBusinessJsonLd } = await import('../src/lib/pageMeta.js')
  const graph = buildLocalBusinessJsonLd({
    branches: [{ slug: 'bacoor', name: 'Bacoor' }, { slug: 'batangas', name: 'Batangas' }],
  })
  for (const node of graph['@graph']) {
    assert.deepEqual(node.areaServed, ['Bacoor', 'Batangas'])
  }
})

test('no customer-visible placeholder address on the branches page', () => {
  // Strip comments: the reasoning for dropping the placeholder lives in one,
  // and only the rendered string matters here.
  const src = read('src/pages/PublicPages.jsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  assert.doesNotMatch(src, /Address coming soon/, 'a placeholder address on the local-ranking page reads as broken')
})