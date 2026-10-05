import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { test } from 'node:test'
import { launchPuppeteer, newPreparedPage } from './puppeteerLaunch.js'
const origin=process.env.PUBLIC_TEST_URL || 'http://127.0.0.1:5173'
const config=JSON.parse(readFileSync(new URL('../src/data/tintFinderConfig.json',import.meta.url)))

for (const width of [1440,390,320]) test(`Tint Finder preserves answers, recommends, and captures a request at ${width}px`,async()=>{
 const browser=await launchPuppeteer()
 try {
  const page=await newPreparedPage(browser,{width,height:900})
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message))
  const submissions=[]
  await page.setRequestInterception(true)
  page.on('request',req=>{
   const url=req.url()
   if(url.includes('/rest/v1/tint_finder_settings')) return req.respond({headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET, POST, OPTIONS'},status:200,contentType:'application/json',body:JSON.stringify({config})})
   if(url.includes('/rest/v1/branches')) return req.respond({headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET, POST, OPTIONS'},status:200,contentType:'application/json',body:JSON.stringify([{slug:'bacoor',name:'Bacoor',is_active:true}])})
   if(url.includes('/rest/v1/branch_operating_hours')) return req.respond({headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET, POST, OPTIONS'},status:200,contentType:'application/json',body:'[]'})
   if(url.includes('/api/public-inquiry')) {
    submissions.push(JSON.parse(req.postData()))
    return req.respond({headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET, POST, OPTIONS'},status:submissions.length===1?503:200,contentType:'application/json',body:JSON.stringify(submissions.length===1?{ok:false,error:'Please try again.'}:{ok:true})})
   }
   return req.continue()
  })
  await page.goto(`${origin}/services/tint`,{waitUntil:'networkidle0'})
  await page.waitForSelector('.tf-quiz')
  const cookie=await page.$('.cookie-consent-secondary')
  if(cookie) await cookie.click()
  assert.equal(await page.$eval('.tf-actions .bd-btn',e=>e.disabled),true)
  async function choose(index) {const previous=await page.$eval('.tf-progress',e=>e.getAttribute('aria-valuenow'));await page.click(`.tf-choices button:nth-child(${index+1})`);await page.waitForFunction(()=>!document.querySelector('.tf-actions .bd-btn').disabled);await page.click('.tf-actions .bd-btn');await page.waitForFunction(p=>document.querySelector('.tf-results') || document.querySelector('.tf-progress')?.getAttribute('aria-valuenow')!==p,{},previous)}
  await choose(0);await choose(1)
  await page.click('.tf-actions .tf-back')
  await page.waitForFunction(()=>document.querySelector('.tf-progress')?.getAttribute('aria-valuenow')==='2')
  assert.equal(await page.$eval('.tf-choices button:nth-child(2)',e=>e.getAttribute('aria-pressed')),'true')
  await page.click('.tf-actions .bd-btn')
  await page.waitForFunction(()=>document.querySelector('.tf-progress')?.getAttribute('aria-valuenow')==='3')
  await choose(2);await choose(1)
  assert.deepEqual(await page.$$eval('[data-tint-option]',els=>els.map(e=>e.dataset.tintOption)),['OPT-B','OPT-C','OPT-D'])
  assert.deepEqual(await page.$$eval('.tf-price strong',els=>els.map(e=>e.textContent)),['₱12,000','₱12,000','₱8,000'])
  assert.equal(await page.$$eval('.tf-benefit-grid article',els=>els.length),9)
  assert.deepEqual(await page.$$eval('.tf-benefit-grid article',els=>els.slice(0,3).map(e=>e.querySelector('h3').textContent)),['Ultra Clarity','Glare Reduction','Heat Insulation'])
  assert.equal(await page.$$eval('.tf-for-you',els=>els.length),3)
  assert.equal(await page.$('.tf-seal'),null)
  assert.equal(await page.$$eval('.tf-disclaimers p',els=>els.length),5)
  await page.click('.tf-price-list summary')
  assert.equal(await page.$eval('.tf-price-list .is-current td',e=>e.textContent),'₱12,000')
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await mkdir('/tmp/hakum-tint-qa',{recursive:true})
  await page.$eval('.tf-results-head',e=>e.scrollIntoView({block:'start'}))
  await page.screenshot({path:`/tmp/hakum-tint-qa/results-${width}.png`})
  if(width===1440){await page.$eval('.tf-benefits',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:'/tmp/hakum-tint-qa/benefits-1440.png'})}
  await page.click('.tf-option-actions button')
  await page.waitForSelector('.tf-booking select:not(:disabled)')
  assert.equal(await page.$eval('.tf-booking form',e=>e.checkValidity()),false)
  await page.type('input[autocomplete="name"]','QA Customer')
  await page.type('input[type="tel"]','09171234567')
  await page.select('.tf-booking select','bacoor')
  await page.$eval('input[type="date"]',e=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'2099-10-06');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})
  await page.type('input[placeholder="e.g. Toyota Vios"]','Toyota Vios')
  await page.click('.tf-consent input')
  await page.click('.tf-booking button[type="submit"]')
  await page.waitForSelector('.tf-booking [role="alert"]')
  assert.equal(await page.$eval('.tf-booking [role="alert"]',e=>e.textContent),'Please try again.')
  await page.click('.tf-booking button[type="submit"]')
  await page.waitForSelector('.tf-booking [role="status"]')
  assert.equal(submissions[1].optionId,'OPT-B')
  assert.deepEqual(submissions[1].answers,{night:'yes',eyesight:'prescription',priority:'balance',vehicle:'suv'})
  assert.equal(submissions[1].acknowledged,true)
  assert.equal(submissions[1].vehicleModel,'Toyota Vios')
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  assert.deepEqual(pageErrors,[])
 } finally {await browser.close()}
})
