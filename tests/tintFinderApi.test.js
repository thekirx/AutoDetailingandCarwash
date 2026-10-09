import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import {handlePublicInquiryRequest} from '../server/publicInquiry.mjs'
const config=JSON.parse(readFileSync(new URL('../src/data/tintFinderConfig.json',import.meta.url)))
const valid={kind:'tint_finder',elapsedMs:5000,name:'QA Customer',phone:'09171234567',branch:'bacoor',preferredDate:'2099-10-06',vehicleModel:'Toyota Vios',answers:{night:'yes',eyesight:'poor',priority:'privacy',vehicle:'sedan'},optionId:'OPT-A',acknowledged:true}
let counter=0
async function call(body,{branchAvailable=true,catalog=config,insertFails=false}={}) {
 const beforeFetch=globalThis.fetch
 const originalUrl=process.env.SUPABASE_URL,originalKey=process.env.SUPABASE_SERVICE_ROLE_KEY
 process.env.SUPABASE_URL='https://tint-test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-key'
 const inserts=[]
 globalThis.fetch=async (input,init)=>{
  const url=String(input)
  if(!url.startsWith('https://tint-test.invalid/')) throw new Error('Unexpected test network destination')
  let response={};let status=200
  if(url.includes('/tint_finder_settings')) response={config:catalog}
  else if(url.includes('/branches')) response=branchAvailable?{slug:'bacoor'}:null
  else if(url.includes('/tint_finder_leads')) {inserts.push(JSON.parse(init.body));response=insertFails?{message:'Unavailable'}:{id:'qa-id'};status=insertFails?500:200}
  else if(url.includes('/staff_profiles')) response=[]
  else throw new Error(`Unexpected query: ${url}`)
  return new Response(JSON.stringify(response),{status,headers:{'content-type':'application/json'}})
 }
 const res={statusCode:0,setHeader(){},end(value){this.body=JSON.parse(value)}}
 try {await handlePublicInquiryRequest({method:'POST',body,headers:{'x-forwarded-for':`tint-test-${counter++}`}},res);return {res,inserts}}
 finally {globalThis.fetch=beforeFetch;if(originalUrl===undefined) delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=originalUrl;if(originalKey===undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=originalKey}
}
test('Tint intake saves full answers with server catalog price, ignoring client quotes',async()=>{
 const {res,inserts}=await call({...valid,price:1,recommendation:{price:1}})
 assert.equal(res.statusCode,200);assert.equal(inserts.length,1)
 assert.equal(inserts[0].recommendation.price,6000)
 assert.deepEqual(inserts[0].answers,valid.answers)
})
test('Tint intake rejects unavailable branches and invalid recommendations without inserts',async()=>{
 for(const [body,opts] of [[valid,{branchAvailable:false}],[{...valid,optionId:'OPT-E'},{}],[{...valid,acknowledged:false},{}],[{...valid,honeypot:'bot'},{}],[{...valid,elapsedMs:100},{}]]){
  const {res,inserts}=await call(body,opts);assert.equal(res.statusCode,400);assert.equal(inserts.length,0)
 }
})
test('Tint intake fails closed when catalog is unavailable or save fails',async()=>{
 const missing=await call(valid,{catalog:null});assert.equal(missing.res.statusCode,503);assert.equal(missing.inserts.length,0)
 const failed=await call(valid,{insertFails:true});assert.equal(failed.res.statusCode,500)
})
