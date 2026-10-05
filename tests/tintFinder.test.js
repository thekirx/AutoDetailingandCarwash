import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { recommendTint, orderedBenefits, validateTintConfig, buildTintLead } from '../src/lib/tintFinder.js'
const config = JSON.parse(readFileSync(new URL('../src/data/tintFinderConfig.json', import.meta.url)))
const cases = [ ['poor','privacy','ABD'], ['poor','visibility','ABD'], ['poor','balance','ABD'], ['excellent','balance','CD'], ['excellent','visibility','CD'], ['excellent','privacy','EF'], ['prescription','balance','BCD'], ['prescription','visibility','BCD'], ['prescription','privacy','CD'] ]
for (const [eyesight,priority,ids] of cases) for (const [vehicle,delta] of [['sedan',0],['suv',2000],['van',4000]]) test(`${eyesight}/${priority}/${vehicle}: approved options, prices, night-independent`, () => {
 const answers = {eyesight,priority,vehicle,night:'yes'}
 const result = recommendTint(config, answers)
 assert.deepEqual(result.map(o=>o.id), [...ids].map(id=>'OPT-'+id))
 for (const o of result) assert.equal(o.price,(o.package==='pro'?10000:6000)+delta)
 assert.deepEqual(result, recommendTint(config,{...answers,night:'no'}))
 assert.equal(result.filter(o=>o.front==='Clear Bluish').every(o=>o.rear==='Clear Bluish'),true)
})
test('personalized benefits appear first once, with all nine retained',()=>{
 const list=orderedBenefits(config,{eyesight:'excellent',priority:'balance'})
 assert.deepEqual(list.slice(0,3).map(b=>b.id),['2','6','1'])
 assert.equal(new Set(list.map(b=>b.id)).size,9)
 assert.equal(list.filter(b=>b.personalized).length,3)
})
test('business price/rule edits change results without implementation changes',()=>{
 const c=structuredClone(config); c.packages.ceramic.prices.sedan=6500; c.rules[0].options=['OPT-A']
 assert.equal(validateTintConfig(c),'')
 assert.equal(recommendTint(c,{eyesight:'poor',priority:'balance',vehicle:'sedan'})[0].price,6500)
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
