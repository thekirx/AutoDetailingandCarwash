import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { recommendTint, suggestTint, tintPackageName, tintWarranty, orderedBenefits, validateTintConfig, buildTintLead } from '../src/lib/tintFinder.js'
const config = JSON.parse(readFileSync(new URL('../src/data/tintFinderConfig.json', import.meta.url)))
/* Approved 9 Oct 2026: poor eyesight → lightest; night, prescription or
   visibility → light front / medium rear; everyone else → medium / super black.
   Pro first, then Nano Ceramic. */
const tierFor = ({ night, eyesight, priority }) => eyesight === 'poor' ? 'BA' : (night === 'yes' || eyesight === 'prescription' || priority === 'visibility') ? 'CD' : 'EF'
for (const night of ['yes','no']) for (const eyesight of ['excellent','prescription','poor']) for (const priority of ['privacy','visibility','balance']) for (const [vehicle,delta] of [['sedan',0],['suv',2000],['van',4000]]) test(`${night}/${eyesight}/${priority}/${vehicle}: approved pair in both tints, priced`, () => {
 const answers = {night,eyesight,priority,vehicle}
 const result = recommendTint(config, answers)
 assert.deepEqual(result.map(o=>o.id), [...tierFor(answers)].map(id=>'OPT-'+id))
 assert.deepEqual(result.map(o=>o.package), ['pro','ceramic'])
 for (const o of result) assert.equal(o.price,(o.package==='pro'?10000:6000)+delta)
 assert.equal(result.filter(o=>o.front==='Clear Bluish').every(o=>o.rear==='Clear Bluish'),true)
})
test('night driving now changes the suggestion', () => {
 const day = recommendTint(config,{night:'no',eyesight:'excellent',priority:'privacy',vehicle:'sedan'}).map(o=>o.id)
 const night = recommendTint(config,{night:'yes',eyesight:'excellent',priority:'privacy',vehicle:'sedan'}).map(o=>o.id)
 assert.deepEqual(day,['OPT-E','OPT-F'])
 assert.deepEqual(night,['OPT-C','OPT-D'])
})
test('incomplete answers give no suggestion', () => {
 assert.deepEqual(recommendTint(config,{night:'no',eyesight:'excellent',priority:'balance'}),[])
 assert.equal(suggestTint(config,{eyesight:'excellent'}),null)
})
test('the suggestion names its shades and explains itself from the answers', () => {
 const s = suggestTint(config,{night:'no',eyesight:'excellent',priority:'balance',vehicle:'sedan'})
 assert.equal(s.title,'Medium Black front · Super Black rear')
 assert.deepEqual(s.reasons.map(r=>r[0]),['You drive mostly during the day','Your eyesight is excellent','You wanted a balance'])
 assert.equal(suggestTint(config,{night:'yes',eyesight:'poor',priority:'privacy',vehicle:'van'}).title,'Lightest shades')
 assert.equal(suggestTint(config,{night:'yes',eyesight:'excellent',priority:'privacy',vehicle:'van'}).title,'Light Black front · Medium Black rear')
})
test('customer-facing names and warranty labels', () => {
 assert.equal(tintPackageName(config,'ceramic'),'Nano Ceramic Tint')
 assert.equal(tintPackageName(config,'pro'),'Nano Ceramic Pro Tint')
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
 assert.equal(result[1].price,6500)
 assert.equal(result[1].rear,'C20')
})
test('invalid cross-package options, missing rules and unsafe values rejected',()=>{
 for (const mutate of [c=>c.options['OPT-A'].rear='C20',c=>c.options['OPT-B'].front='C30',c=>c.rules.pop(),c=>c.packages.pro.prices.sedan=-1,c=>c.films.C30.vlt=101]) {
  const c=structuredClone(config);mutate(c);assert.notEqual(validateTintConfig(c),'')
 }
})
test('lead validation requires consent and derives a trusted recommendation snapshot',()=>{
 const body={name:'Test Customer',phone:'09171234567',branch:'bacoor',preferredDate:'2099-10-06',vehicleModel:'Toyota Vios',answers:{night:'yes',eyesight:'poor',priority:'privacy',vehicle:'sedan'},optionId:'OPT-A',acknowledged:true,price:1}
 const {row}=buildTintLead(body,config)
 assert.equal(row.recommendation.price,6000)
 assert.equal(row.answers.night,'yes')
 assert.ok(buildTintLead({...body,acknowledged:false},config).error)
 assert.ok(buildTintLead({...body,optionId:'OPT-E'},config).error)
 assert.ok(buildTintLead({...body,phone:'foo'},config).error)
 assert.ok(buildTintLead({...body,preferredDate:'2099-02-31'},config).error)
})
