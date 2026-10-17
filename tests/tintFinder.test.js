import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { recommendTint, suggestTint, tintPackageName, tintWarranty, orderedBenefits, validateTintConfig, buildTintLead } from '../src/lib/tintFinder.js'
const config = JSON.parse(readFileSync(new URL('../src/data/tintFinderConfig.json', import.meta.url)))
/* Approved 9 Oct 2026: poor eyesight → lightest (but with privacy or balance →
   lightest tinted front over a darker rear, 17 Oct 2026); night, prescription or
   visibility → light front / medium rear; everyone else → medium / super black.
   Shown cheapest first: Nano Ceramic, Pro, then Black Series (13 Oct 2026). */
const tierFor = ({ night, eyesight, priority }) => eyesight === 'poor' ? (priority === 'visibility' ? 'ABG' : 'DBG') : (night === 'yes' || eyesight === 'prescription' || priority === 'visibility') ? 'DCH' : 'FEI'
for (const night of ['yes','no']) for (const eyesight of ['excellent','prescription','poor']) for (const priority of ['privacy','visibility','balance']) for (const [vehicle,delta] of [['sedan',0],['suv',2000],['van',4000]]) test(`${night}/${eyesight}/${priority}/${vehicle}: approved pair in all three tints, priced`, () => {
 const answers = {night,eyesight,priority,vehicle}
 const result = recommendTint(config, answers)
 assert.deepEqual(result.map(o=>o.id), [...tierFor(answers)].map(id=>'OPT-'+id))
 assert.deepEqual(result.map(o=>o.package), ['ceramic','pro','black'])
 for (const o of result) assert.equal(o.price,{pro:10000,ceramic:6000,black:13000}[o.package]+delta)
 assert.equal(result.filter(o=>o.front==='Clear Bluish').every(o=>o.rear==='Clear Bluish'),true)
})
/* The suggestion must make sense for every set of answers, not just the ones we tried. */
const ALL = []
for (const night of ['yes','no']) for (const eyesight of ['excellent','prescription','poor']) for (const priority of ['privacy','balance','visibility']) ALL.push({night,eyesight,priority,vehicle:'sedan'})
const vlt = key => config.films[key].vlt
const frontFor = (answers, pkg) => vlt(recommendTint(config,answers).find(o=>o.package===pkg).front)
test('privacy or a balance always gets a tinted, darker rear (never Clear Bluish)', () => {
 for (const a of ALL.filter(a=>a.priority!=='visibility')) for (const o of recommendTint(config,a)) {
  assert.notEqual(o.front,'Clear Bluish',JSON.stringify(a)); assert.notEqual(o.rear,'Clear Bluish',JSON.stringify(a))
  assert.ok(vlt(o.rear) < vlt(o.front), JSON.stringify(a))
 }
})
test('no rear is ever lighter than its front', () => {
 for (const a of ALL) for (const o of recommendTint(config,a)) assert.ok(vlt(o.rear) <= vlt(o.front), JSON.stringify(a))
})
test('a more demanding answer never makes the front darker', () => {
 // Lighter-leaning answer first: visibility < balance < privacy, poor < prescription < excellent, night < day.
 const ladders = { priority: ['visibility','balance','privacy'], eyesight: ['poor','prescription','excellent'], night: ['yes','no'] }
 for (const a of ALL) for (const [key, ladder] of Object.entries(ladders)) for (let i = 1; i < ladder.length; i++) for (const pkg of ['ceramic','pro','black']) {
  const lighter = {...a,[key]:ladder[i-1]}, darker = {...a,[key]:ladder[i]}
  assert.ok(frontFor(lighter,pkg) >= frontFor(darker,pkg), `${pkg} ${JSON.stringify(lighter)} vs ${key}=${ladder[i]}`)
 }
})
test('every reason agrees with what was suggested', () => {
 for (const a of ALL) {
  const s = suggestTint(config,a), text = s.reasons.map(r=>r.join(' ')).join(' ')
  const lead = s.options[0], isDark = lead.front === 'C20'
  assert.equal(/darker front|darker shades won|darkest shade/.test(text), isDark, `${JSON.stringify(a)}: ${text}`)
  if (/front is lighter than the rear|rear windows are darker/.test(text)) for (const o of s.options) assert.ok(vlt(o.rear) < vlt(o.front), JSON.stringify(a))
  if (/lightest shades on every window/.test(text)) assert.ok(s.options.some(o=>o.front==='Clear Bluish'))
 }
})
test('night driving now changes the suggestion', () => {
 const day = recommendTint(config,{night:'no',eyesight:'excellent',priority:'privacy',vehicle:'sedan'}).map(o=>o.id)
 const night = recommendTint(config,{night:'yes',eyesight:'excellent',priority:'privacy',vehicle:'sedan'}).map(o=>o.id)
 assert.deepEqual(day,['OPT-F','OPT-E','OPT-I'])
 assert.deepEqual(night,['OPT-D','OPT-C','OPT-H'])
})
test('incomplete answers give no suggestion', () => {
 assert.deepEqual(recommendTint(config,{night:'no',eyesight:'excellent',priority:'balance'}),[])
 assert.equal(suggestTint(config,{eyesight:'excellent'}),null)
})
test('the suggestion names its shades and explains itself from the answers', () => {
 const s = suggestTint(config,{night:'no',eyesight:'excellent',priority:'balance',vehicle:'sedan'})
 assert.equal(s.title,'Medium Black front · Super Black rear')
 assert.deepEqual(s.reasons.map(r=>r[0]),['You drive mostly during the day','Your eyesight is excellent','You wanted a balance'])
 assert.equal(suggestTint(config,{night:'yes',eyesight:'poor',priority:'privacy',vehicle:'van'}).title,'Light shades with privacy')
 assert.equal(suggestTint(config,{night:'yes',eyesight:'poor',priority:'visibility',vehicle:'van'}).title,'Lightest shades')
 assert.equal(suggestTint(config,{night:'yes',eyesight:'excellent',priority:'privacy',vehicle:'van'}).title,'Light Black front · Medium Black rear')
})
test('customer-facing names and warranty labels', () => {
 assert.equal(tintPackageName(config,'ceramic'),'Nano Ceramic')
 assert.equal(tintPackageName(config,'pro'),'Nano Ceramic Pro')
 assert.equal(tintPackageName(config,'black'),'Nano Ceramic Pro Black Series')
 // Three tints, three warranties (handover v1.3 + client note, Oct 2026).
 assert.equal(config.packages.ceramic.warranty,'7 years')
 assert.equal(config.packages.pro.warranty,'10 years')
 assert.equal(config.packages.black.warranty,'Lifetime')
 assert.equal(tintWarranty('10 years'),'10-year warranty')
 assert.equal(tintWarranty('7 years'),'7-year warranty')
 assert.equal(tintWarranty('Lifetime'),'Lifetime warranty')
})
test('personalized benefits appear first once, with all nine retained',()=>{
 const list=orderedBenefits(config,{eyesight:'excellent',priority:'balance'})
 assert.deepEqual(list.slice(0,3).map(b=>b.id),['2','6','1'])
 assert.equal(new Set(list.map(b=>b.id)).size,9)
 assert.equal(list.filter(b=>b.personalized).length,3)
})
test('business price and film-pair edits change results without implementation changes',()=>{
 const c=structuredClone(config); c.packages.ceramic.prices.sedan=6500; c.options['OPT-F'].rear='C20'
 assert.equal(validateTintConfig(c),'')
 const result=recommendTint(c,{night:'no',eyesight:'excellent',priority:'balance',vehicle:'sedan'})
 assert.equal(result[0].price,6500)
 assert.equal(result[0].rear,'C20')
})
test('invalid cross-package options, missing rules and unsafe values rejected',()=>{
 for (const mutate of [c=>c.options['OPT-A'].rear='C20',c=>c.options['OPT-B'].front='C30',c=>c.rules.pop(),c=>c.packages.pro.prices.sedan=-1,c=>c.films.C30.vlt=101]) {
  const c=structuredClone(config);mutate(c);assert.notEqual(validateTintConfig(c),'')
 }
})
test('lead validation requires consent and derives a trusted recommendation snapshot',()=>{
 const body={name:'Test Customer',phone:'09171234567',branch:'bacoor',preferredDate:'2099-10-06',vehicleModel:'Toyota Vios',answers:{night:'yes',eyesight:'poor',priority:'visibility',vehicle:'sedan'},optionId:'OPT-A',acknowledged:true,price:1}
 const {row}=buildTintLead(body,config)
 assert.equal(row.recommendation.price,6000)
 assert.equal(row.answers.night,'yes')
 assert.ok(buildTintLead({...body,acknowledged:false},config).error)
 assert.ok(buildTintLead({...body,optionId:'OPT-E'},config).error)
 assert.ok(buildTintLead({...body,phone:'foo'},config).error)
 for (const priority of ['privacy','balance']) assert.ok(buildTintLead({...body,answers:{...body.answers,priority}},config).error) // Clear Bluish is not offered with privacy or a balance.
 assert.ok(buildTintLead({...body,preferredDate:'2099-02-31'},config).error)
})
