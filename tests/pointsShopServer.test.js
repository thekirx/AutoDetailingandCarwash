import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertPickupScope, maskedPickup, sendShopMessage, runPointsShopExpiry } from '../server/pointsShop.mjs'
import { allowRoute, getOperationsNav } from '../src/auth/permissions.js'
test('staff payload projection never discloses pickup code or added secret fields', () => {
 const row = maskedPickup({id:'a',pickup_code:'HK-SECRET',new_secret:'secret',products:{name:'T-shirt'}})
 assert.equal(row.pickup_code,'HK-••••'); assert.equal(row.new_secret,undefined)
 assert.doesNotMatch(JSON.stringify(row),/SECRET|secret/)
})
test('branch/role scope and services_merch page grant are enforced', () => {
 const admin={id:'s',role:'admin',is_active:true,branch_slug:'bacoor'}
 assert.deepEqual(assertPickupScope(admin,'bacoor'),['bacoor'])
 assert.throws(()=>assertPickupScope(admin,'imus'),/assigned branch/)
 assert.throws(()=>assertPickupScope({...admin,is_active:false},'bacoor'),/access required/)
 assert.throws(()=>assertPickupScope({...admin,role:'detailer'},'bacoor'),/access required/)
 const asa={role:'assistant_super_admin',is_active:true,permission_grants:{services_merch:false,pos:true}}
 assert.equal(allowRoute(asa,'merch-shop'),false)
 assert.equal(allowRoute({...asa,permission_grants:{services_merch:true}},'merch-shop'),true)
 const nav=getOperationsNav({role:'BossMich'}).map((r)=>r.label)
 assert.equal(nav.indexOf('Merch shop'),nav.indexOf('Memberships')+1)
})
test('claim/reminder/expiry messages contain no code; duplicate inbox means no duplicate push', async () => {
 const messages=[];const pushes=[];const tags=new Set()
 const db={from:()=>({insert:async(row)=>{ if(tags.has(row.tag)) return {error:{code:'23505'}};tags.add(row.tag);messages.push(row);return {} }})}
 const row={id:'a',customer_id:'c',name:'T-shirt',points_spent:50,branches:{name:'Bacoor'},pickup_code:'HK-SECRET',expires_at:new Date(Date.now()+2*86400000).toISOString()}
 for(const event of ['claimed','reminder','expired','expired']) await sendShopMessage(db,row,event,async(p)=>{pushes.push(p);return {sent:1}})
 assert.equal(pushes.length,3);assert.match(pushes[0].title,/set aside at Bacoor/)
 assert.match(pushes[1].title,/2 days left/);assert.match(pushes[2].body,/50 points returned/)
 assert.doesNotMatch(JSON.stringify([...messages,...pushes]),/HK-SECRET|sms/i)
})
test('expiry cron calls refund RPC before delivering due reminders and expiry messages', async () => {
 const calls=[]; const sent=[]
 const rows=[{id:'a',customer_id:'c',status:'expired',points_spent:50},{id:'b',customer_id:'c',status:'pending',expires_at:'2026-11-07T00:00:00Z'},{id:'c',status:'pending',expires_at:'2026-11-04'}]
 const db={rpc:async(name)=>{calls.push(name);return {data:1}},from:(table)=> table==='user_notifications'?{insert:async()=>({})}:{select:()=>({in:()=>({lte:async()=>({data:rows})})})}}
 const result=await runPointsShopExpiry(db,async(p)=>{sent.push(p);return {}},new Date('2026-11-05T00:00:00Z'))
 assert.deepEqual(calls,['expire_redemptions']);assert.equal(sent.length,2);assert.equal(result.expired,1)
})
