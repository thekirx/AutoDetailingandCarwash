/**
 * Part 6: planning catalogs + forms + event slug smoke.
 * node scripts/e2e-part6-planning.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { slugifyEventTitle, parseCustomFieldsCsv } from '../src/lib/planningPart6.js'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1)
    if (!process.env[k]) process.env[k] = v
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && service, 'missing supabase env')
const results = []

assert(slugifyEventTitle('Test Meet', '11111111-2222-3333').endsWith('11111111'))
assert(parseCustomFieldsCsv('A|B').length === 2)
results.push('helpers: ok')

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: labels, error: labErr } = await admin.from('plan_label_presets').select('id, name').limit(5)
assert(!labErr, `plan_label_presets: ${labErr?.message}`)
assert(labels?.length, 'expected seeded label presets')
results.push(`db.plan_label_presets: ok (${labels.length})`)

const { error: tmplErr } = await admin
  .from('plan_checklist_templates')
  .select('id, name, plan_checklist_template_items(id)')
  .limit(1)
assert(!tmplErr, `plan_checklist_templates: ${tmplErr?.message}`)
results.push('db.plan_checklist_templates: ok')

const { data: forms, error: formErr } = await admin.from('ops_forms').select('id, kind').eq('kind', 'complaint')
assert(!formErr, `ops_forms: ${formErr?.message}`)
assert(forms?.length, 'expected complaint form seed')
results.push('db.ops_forms.complaint: ok')

const { data: ev, error: evErr } = await admin.from('events').select('id, slug, is_published').not('slug', 'is', null).limit(3)
assert(!evErr, `events.slug: ${evErr?.message}`)
results.push(`db.events.slug: ok (${ev?.length || 0} with slug)`)

const { error: subErr } = await admin.from('ops_form_submissions').select('id').limit(1)
assert(!subErr, `ops_form_submissions: ${subErr?.message}`)
results.push('db.ops_form_submissions: ok')

console.log(results.join('\n'))
console.log('e2e-part6-planning: PASS')
