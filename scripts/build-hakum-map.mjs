#!/usr/bin/env node
/**
 * Builds docs/architecture/hakum-workflow-database.html — the owner-facing
 * "HAKUM Workflow & Database" map.
 *
 * Sources (no network): graphify-out/graph.json (code files + links),
 * supabase/migrations/*.sql (tables, views, foreign keys, RPC bodies),
 * `.from('x')` / `.rpc('x')` calls in src/api/server, and the validated
 * shop-day workflow spec in docs/architecture/shop-day-flops.workflow.json.
 *
 * Usage: node scripts/build-hakum-map.mjs   (re-run after `graphify update .`)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'docs/architecture/hakum-workflow-database.html')
const TEMPLATE = path.join(ROOT, 'scripts/hakum-map.template.html')

// Order = the shop-day story; first match wins, so specific areas come first.
export const AREAS = [
  { id: 'customers', name: 'Customers & bookings', color: '#6ea8ff', re: /booking|customer|crm|vehicle(?!_size)|plate|member|loyalty|stamp|birthday|perk|review|complaint|inquir|contact|visit|maintenance/ },
  { id: 'queue', name: 'Wash & detail queue', color: '#22d3ee', re: /queue|floor|bay|final_?check|detailing|cancellation/ },
  { id: 'pos', name: 'POS & sales', color: '#c084fc', re: /(^|[/_.-])pos(?!t)|sale|handoff|product|inventor|stock|recon|payment/ },
  { id: 'finance', name: 'End of shift & finance', color: '#34d399', re: /financ|shift|drawer|expense|cash|daily_pl|quote|vendor|corporate|kpi|report|money|settlement/ },
  { id: 'access', name: 'Accounts & roles', color: '#f87171', re: /auth|permission|role|rls|profile|grant|login|signup|password|audit|protected/ },
  { id: 'payroll', name: 'Crew, attendance & payroll', color: '#fbbf24', re: /payroll|pay_package|compensation|attendance|clock|staff|crew|people|advance|mypay|commission/ },
  { id: 'messaging', name: 'SMS & push messages', color: '#f472b6', re: /sms|notif|push|broadcast|reminder|template|email|brandtxt|busybee/ },
  { id: 'catalog', name: 'Branches, services & prices', color: '#fb923c', re: /branch|service|package|size|catalog|price|setting|hours|ops_?lab|ops_?form|opsform|opslab/ },
  { id: 'planning', name: 'Planning & tasks', color: '#a3e635', re: /plan|roadmap|task|checklist|kanban/ },
  { id: 'public', name: 'Public website & content', color: '#2dd4bf', re: /public|home|content|blog|event|seo|marketing|partnership|bredesign|landing|hero|ppf|legal|cookie/ },
  { id: 'platform', name: 'Shared building blocks', color: '#94a3b8', re: /[\s\S]*/ },
]

export function classifyArea(key) {
  const k = String(key || '').toLowerCase()
  return AREAS.find((a) => a.re.test(k)).id
}

const IDENT = '"?([a-z0-9_]+)"?'
const QUAL = `(?:([a-z_]+)\\.)?${IDENT}`

/** Tables/views that survive all migrations, their foreign keys, and RPC bodies. */
export function parseMigrations(files) {
  const objects = new Map()
  const functions = new Map()
  const fnRe = () => /create\s+(?:or\s+replace\s+)?function\s+(?:([a-z_]+)\.)?"?([a-z0-9_]+)"?\s*\(([\s\S]*?)\bas\s+\$([a-z_]*)\$([\s\S]*?)\$\4\$/g
  const define = (name, kind, file) => {
    if (!objects.has(name)) objects.set(name, { name, kind, definedIn: file, fks: new Set() })
    else objects.get(name).kind = kind
  }

  for (const { name: file, sql } of files) {
    const lower = sql.toLowerCase().replace(/--[^\n]*/g, ' ')
    for (const m of lower.matchAll(fnRe())) {
      if (m[1] && m[1] !== 'public') continue
      functions.set(m[2], { name: m[2], definedIn: functions.get(m[2])?.definedIn || file, body: m[5] })
    }
    for (const stmt of lower.replace(fnRe(), ' ').split(';')) {
      const drop = stmt.match(new RegExp(`drop\\s+(?:materialized\\s+)?(?:table|view)\\s+(?:if\\s+exists\\s+)?${QUAL}`))
      if (drop && (!drop[1] || drop[1] === 'public')) objects.delete(drop[2])
      const table = stmt.match(new RegExp(`create\\s+(?:unlogged\\s+)?table\\s+(?:if\\s+not\\s+exists\\s+)?${QUAL}`))
      const view = stmt.match(new RegExp(`create\\s+(?:or\\s+replace\\s+)?(?:materialized\\s+)?view\\s+(?:if\\s+not\\s+exists\\s+)?${QUAL}`))
      const alter = stmt.match(new RegExp(`alter\\s+table\\s+(?:only\\s+)?(?:if\\s+exists\\s+)?(?:only\\s+)?${QUAL}`))
      if (table && (!table[1] || table[1] === 'public')) define(table[2], 'table', file)
      if (view && (!view[1] || view[1] === 'public')) define(view[2], 'view', file)
      const owner = (table && table[2]) || (alter && (!alter[1] || alter[1] === 'public') && alter[2])
      if (!owner || !objects.has(owner)) continue
      for (const ref of stmt.matchAll(new RegExp(`references\\s+${QUAL}`, 'g'))) {
        if ((!ref[1] || ref[1] === 'public') && ref[2] !== owner) objects.get(owner).fks.add(ref[2])
      }
    }
  }
  for (const fn of functions.values()) {
    fn.touches = new Set(
      [...fn.body.matchAll(new RegExp(`\\b(?:from|join|into|update)\\s+(?:public\\.)?${IDENT}`, 'g'))]
        .map((m) => m[1])
        .filter((t) => objects.has(t)),
    )
  }
  return { objects, functions }
}

/** Supabase tables and RPCs a source file touches. */
export function scanDbUsage(source) {
  const grab = (re) => new Set([...source.matchAll(re)].map((m) => m[1]))
  return {
    tables: grab(/\.from\(\s*['"`]([a-z0-9_]+)['"`]/g),
    rpcs: grab(/\.rpc\(\s*['"`]([a-z0-9_]+)['"`]/g),
  }
}

/** One area per grid cell (uniform cells keep titles aligned); nodes on a sunflower spiral. */
export function layoutClusters(items, { spacing, cols, gap }) {
  const byArea = new Map()
  for (const it of items) byArea.set(it.area, [...(byArea.get(it.area) || []), it])
  const order = AREAS.map((a) => a.id).filter((id) => byArea.has(id))
  const radius = (id) => spacing * Math.sqrt(byArea.get(id).length) + spacing
  const maxR = Math.max(...order.map(radius))
  const cell = 2 * maxR + gap
  const labelBlock = Math.round(cell * 0.24)
  const rowH = labelBlock + cell
  const positions = {}
  const clusters = []
  order.forEach((id, i) => {
    const row = Math.floor(i / cols)
    const inRow = Math.min(cols, order.length - row * cols)
    const cx = ((cols - inRow) / 2 + (i % cols) + 0.5) * cell
    const cy = row * rowH + labelBlock + maxR
    const list = byArea.get(id).sort((a, b) => b.weight - a.weight)
    list.forEach((it, k) => {
      const rad = spacing * Math.sqrt(k + 0.5)
      const t = k * 2.399963
      positions[it.id] = { x: Math.round(cx + rad * Math.cos(t)), y: Math.round(cy + rad * Math.sin(t)) }
    })
    clusters.push({ area: id, x: Math.round(cx), y: Math.round(cy), r: Math.round(radius(id)), labelY: row * rowH + Math.round(labelBlock * 0.35), cell: Math.round(cell), count: list.length })
  })
  return { positions, clusters }
}

/** Area panels in a masonry of fixed-width columns; boxes on a 2-column grid inside. */
export function layoutPanels(items, { columns, cellW, cellH, pad, header, gap }) {
  const byArea = new Map()
  for (const it of items) byArea.set(it.area, [...(byArea.get(it.area) || []), it])
  const panelW = 2 * cellW + 2 * pad
  const colHeights = Array(columns).fill(0)
  const positions = {}
  const panels = []
  for (const { id } of AREAS) {
    const list = byArea.get(id)
    if (!list) continue
    const rows = Math.ceil(list.length / 2)
    const h = header + rows * cellH + pad
    const col = colHeights.indexOf(Math.min(...colHeights))
    const px = col * (panelW + gap)
    const py = colHeights[col]
    list.forEach((it, k) => {
      positions[it.id] = { x: px + pad + (k % 2) * cellW + cellW / 2, y: py + header + Math.floor(k / 2) * cellH + cellH / 2 }
    })
    panels.push({ area: id, x: px, y: py, w: panelW, h, count: list.length })
    colHeights[col] += h + gap
  }
  return { positions, panels }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p)
    return /\.(jsx?|mjs)$/.test(e.name) ? [p] : []
  })
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/')

function fileKind(file) {
  if (file.startsWith('src/pages/')) return 'Screen'
  if (file.startsWith('src/components/')) return 'Component'
  if (file.startsWith('src/layouts/')) return 'Layout'
  if (/^(api|server)\//.test(file)) return 'Server API'
  return 'Logic'
}

function fileLabel(file) {
  const parts = file.split('/')
  const base = parts.at(-1).replace(/\.(jsx?|mjs)$/, '')
  return base === 'index' ? `${parts.at(-2)}/index` : base
}

function build() {
  const graph = JSON.parse(fs.readFileSync(path.join(ROOT, 'graphify-out/graph.json'), 'utf8'))
  const workflow = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/architecture/shop-day-flops.workflow.json'), 'utf8'))

  // ── Database ────────────────────────────────────────────────
  const migDir = path.join(ROOT, 'supabase/migrations')
  const migrations = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()
  const baseSchema = path.join(ROOT, 'schema.sql')
  const { objects, functions } = parseMigrations([
    ...(fs.existsSync(baseSchema) ? [{ name: 'schema.sql (base schema)', sql: fs.readFileSync(baseSchema, 'utf8') }] : []),
    ...migrations.map((name) => ({ name, sql: fs.readFileSync(path.join(migDir, name), 'utf8') })),
  ])

  // ── Code files + DB usage ───────────────────────────────────
  const files = ['src', 'api', 'server'].flatMap((d) => walk(path.join(ROOT, d))).map(rel).sort()
  const fileSet = new Set(files)
  const usage = {}
  for (const f of files) {
    const { tables, rpcs } = scanDbUsage(fs.readFileSync(path.join(ROOT, f), 'utf8'))
    if (tables.size || rpcs.size) usage[f] = { tables: [...tables], rpcs: [...rpcs] }
  }
  const tableUsers = new Map()
  const rpcUsers = new Map()
  for (const [f, u] of Object.entries(usage)) {
    for (const t of u.tables) tableUsers.set(t, [...(tableUsers.get(t) || []), f])
    for (const r of u.rpcs) rpcUsers.set(r, [...(rpcUsers.get(r) || []), f])
  }

  // ── File-to-file links from graphify ────────────────────────
  const CODE_REL = new Set(['imports', 'imports_from', 'calls', 're_exports', 'dynamic_import', 'indirect_call'])
  const nodeFile = new Map(graph.nodes.map((n) => [n.id, String(n.source_file || '').replace(/\\/g, '/')]))
  const linkCount = new Map()
  for (const e of graph.links) {
    if (!CODE_REL.has(e.relation)) continue
    const a = nodeFile.get(e.source)
    const b = nodeFile.get(e.target)
    if (!a || !b || a === b || !fileSet.has(a) || !fileSet.has(b)) continue
    linkCount.set(`${a}\u0000${b}`, (linkCount.get(`${a}\u0000${b}`) || 0) + 1)
  }
  const codeEdges = [...linkCount].map(([k, w]) => {
    const [from, to] = k.split('\u0000')
    return { from, to, w }
  })
  const degree = new Map()
  for (const e of codeEdges) {
    degree.set(e.from, (degree.get(e.from) || 0) + 1)
    degree.set(e.to, (degree.get(e.to) || 0) + 1)
  }

  const codeItems = files.map((f) => ({ id: f, area: classifyArea(f), weight: degree.get(f) || 0 }))
  const codeLayout = layoutClusters(codeItems, { spacing: 28, cols: 4, gap: 140 })
  const codeNodes = codeItems.map((it) => ({
    id: it.id,
    label: fileLabel(it.id),
    area: it.area,
    kind: fileKind(it.id),
    deg: it.weight,
    ...codeLayout.positions[it.id],
    db: usage[it.id] || null,
  }))

  // ── Database board ──────────────────────────────────────────
  const tableNames = new Set([...objects.keys(), ...tableUsers.keys()])
  const rpcNames = [...rpcUsers.keys()].sort()
  const dbItems = [
    ...[...tableNames].map((t) => ({ id: `t:${t}`, name: t, area: classifyArea(t), type: objects.get(t)?.kind || 'table', weight: (tableUsers.get(t) || []).length })),
    ...rpcNames.map((r) => ({ id: `f:${r}`, name: r, area: classifyArea(r), type: 'rpc', weight: -1 })),
  ].sort((a, b) => (a.type === 'rpc') - (b.type === 'rpc') || b.weight - a.weight || a.name.localeCompare(b.name))
  const dbLayout = layoutPanels(dbItems, { columns: 4, cellW: 256, cellH: 50, pad: 22, header: 100, gap: 44 })
  const dbNodes = dbItems.map((it) => ({
    id: it.id,
    label: it.type === 'rpc' ? `${it.name}()` : it.name,
    name: it.name,
    area: it.area,
    type: it.type,
    ...dbLayout.positions[it.id],
    usedBy: (it.type === 'rpc' ? rpcUsers.get(it.name) : tableUsers.get(it.name)) || [],
    definedIn: (it.type === 'rpc' ? functions.get(it.name)?.definedIn : objects.get(it.name)?.definedIn) || null,
  }))
  const dbIds = new Set(dbNodes.map((n) => n.id))
  const dbEdges = []
  for (const obj of objects.values()) {
    for (const fk of obj.fks) if (dbIds.has(`t:${obj.name}`) && dbIds.has(`t:${fk}`)) dbEdges.push({ from: `t:${obj.name}`, to: `t:${fk}`, kind: 'fk' })
  }
  for (const r of rpcNames) {
    for (const t of functions.get(r)?.touches || []) if (dbIds.has(`t:${t}`)) dbEdges.push({ from: `f:${r}`, to: `t:${t}`, kind: 'rpc' })
  }

  // ── Complete graphify graph (every node + link) ─────────────
  const index = new Map(graph.nodes.map((n, i) => [n.id, i]))
  const relations = [...new Set(graph.links.map((e) => e.relation))].sort()
  const relIdx = new Map(relations.map((r, i) => [r, i]))
  const pairs = new Map()
  for (const e of graph.links) {
    const s = index.get(e.source)
    const t = index.get(e.target)
    if (s === undefined || t === undefined || s === t) continue
    const key = `${s},${t}`
    if (!pairs.has(key)) pairs.set(key, [s, t, []])
    const rels = pairs.get(key)[2]
    if (!rels.includes(relIdx.get(e.relation))) rels.push(relIdx.get(e.relation))
  }
  const fullEdges = [...pairs.values()]
  const neighbours = graph.nodes.map(() => new Set())
  for (const [s, t] of fullEdges) {
    neighbours[s].add(t)
    neighbours[t].add(s)
  }
  const fullItems = graph.nodes.map((n, i) => {
    const file = nodeFile.get(n.id)
    return { id: i, area: classifyArea(`${file} ${n.label}`), weight: neighbours[i].size }
  })
  const fullLayout = layoutClusters(fullItems, { spacing: 22, cols: 4, gap: 260 })
  const fullNodes = graph.nodes.map((n, i) => {
    const p = fullLayout.positions[i]
    return [String(n.label || n.id), fullItems[i].area, n.file_type || 'code', nodeFile.get(n.id) || '', n.source_location || '', n.community_name || '', neighbours[i].size, p.x, p.y]
  })
  const hyperedges = (graph.hyperedges || [])
    .map((h) => ({ label: h.label, nodes: (h.nodes || []).map((id) => index.get(id)).filter((i) => i !== undefined) }))
    .filter((h) => h.nodes.length)

  // ── Area summary for the workflow tab ───────────────────────
  const areas = AREAS.map(({ id, name, color }) => ({
    id,
    name,
    color,
    screens: codeNodes.filter((n) => n.area === id && n.kind === 'Screen').length,
    files: codeNodes.filter((n) => n.area === id).length,
    tables: dbNodes.filter((n) => n.area === id && n.type !== 'rpc').length,
    rpcs: dbNodes.filter((n) => n.area === id && n.type === 'rpc').length,
  }))

  const data = {
    generatedAt: new Date().toISOString().slice(0, 10),
    commit: String(graph.built_at_commit || '').slice(0, 7),
    migrations: migrations.length,
    areas,
    workflow,
    code: { nodes: codeNodes, edges: codeEdges, clusters: codeLayout.clusters },
    db: { nodes: dbNodes, edges: dbEdges, panels: dbLayout.panels },
    full: { nodes: fullNodes, edges: fullEdges, relations, clusters: fullLayout.clusters, hyperedges },
  }
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  const html = fs.readFileSync(TEMPLATE, 'utf8').replace('/*__DATA__*/null', () => json)
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, html)
  console.log(`wrote ${rel(OUT)} · ${codeNodes.length} files · ${codeEdges.length} links · ${dbNodes.length - rpcNames.length} tables/views · ${rpcNames.length} RPCs · ${dbEdges.length} db links · full graph ${fullNodes.length} nodes / ${fullEdges.length} links (${graph.links.length} raw)`)
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) build()
