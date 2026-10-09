export const TINT_VEHICLES = [
  { id: 'sedan', label: 'Sedan / Hatchback' },
  { id: 'suv', label: 'MPV / Crossover / SUV / Pickup truck' },
  { id: 'van', label: 'Full SUV / Van / Commuter' },
]
export const TINT_QUESTIONS = [
  { key: 'night', title: 'Do you frequently drive at night?', hint: 'Night driving affects how dark your front windows should be.', choices: [{id:'yes',label:'Yes',description:'I’m often on the road after sunset.'},{id:'no',label:'No',description:'I drive mostly during the day.'}] },
  { key: 'eyesight', title: 'How’s your eyesight condition?', hint: 'Your comfort behind the wheel comes first.', choices: [{id:'excellent',label:'Excellent'},{id:'prescription',label:'Wear prescription'},{id:'poor',label:'Poor condition, especially at night'}] },
  { key: 'priority', title: 'What’s your priority?', hint: 'Choose what matters most to you.', choices: [{id:'privacy',label:'Privacy',description:'More privacy from the outside.'},{id:'visibility',label:'Visibility',description:'A clearer view from inside.'},{id:'balance',label:'A balance of both',description:'Privacy with comfortable visibility.'}] },
  { key: 'vehicle', title: 'What type of vehicle do you drive?', hint: 'We’ll show the full-window package price for your vehicle.', choices: TINT_VEHICLES },
]
/* Customer-facing names. The catalog keeps its own short names for staff. */
export const TINT_PACKAGE_NAMES = { ceramic: 'Nano Ceramic Tint', pro: 'Nano Ceramic Pro Tint' }
export const tintPackageName = (config, id) => TINT_PACKAGE_NAMES[id] || config.packages[id]?.name || id
/* Shade names by film key, shared by the Finder and the comparison tables. */
export const TINT_FILM_SHADES = { 'Clear Bluish': 'Clear Bluish', C30: 'Light Black', C20: 'Medium Black', C08: 'Super Black', HC35: 'Fair Black', HC25: 'Light Black', HC15: 'Medium Black', HC05: 'Super Black' }
export const tintShade = key => TINT_FILM_SHADES[key] || key
/* The approved suggestion (client sign-off, 9 Oct 2026): one front/rear shade
   pair, offered in both tints (Pro first). The first matching tier wins:
   poor eyesight → lightest; night driver, prescription or visibility → light
   front over a medium rear; everyone else → medium front over a super black rear.
   The pairs are catalog options, so their films and prices stay editable. */
export const TINT_SUGGESTION_TIERS = {
  lightest: { options: ['OPT-B', 'OPT-A'], title: 'Lightest shades', summary: 'The clearest view we offer, day and night.' },
  light: { options: ['OPT-C', 'OPT-D'], summary: 'A clearer front for the road, a darker rear for heat and privacy.' },
  dark: { options: ['OPT-E', 'OPT-F'], summary: 'Strong heat rejection, with real privacy in the back.' },
}
export function tintSuggestionTier(answers) {
  if (answers.eyesight === 'poor') return 'lightest'
  if (answers.night === 'yes' || answers.eyesight === 'prescription' || answers.priority === 'visibility') return 'light'
  return 'dark'
}
/* "7 years" → "7-year warranty", "Lifetime" → "Lifetime warranty". */
export const tintWarranty = w => `${String(w).replace(/^(\d+) years?$/i, '$1-year')} warranty`
export const tintPeso = n => `₱${Number(n).toLocaleString('en-PH')}`
export function recommendTint(config, answers) {
  if (TINT_QUESTIONS.some(q => !q.choices.some(c => c.id === answers?.[q.key]))) return []
  return TINT_SUGGESTION_TIERS[tintSuggestionTier(answers)].options.filter(id => config.options[id]).map(id => {
    const option = config.options[id]
    return { id, ...option, price: config.packages[option.package].prices[answers.vehicle] }
  })
}
/* The pick, its headline and the reasons, all from the customer's own answers. */
export function suggestTint(config, answers) {
  const options = recommendTint(config, answers)
  if (!options.length) return null
  const tier = TINT_SUGGESTION_TIERS[tintSuggestionTier(answers)]
  const lead = options[0]
  const title = tier.title || (lead.front === lead.rear ? `${tintShade(lead.front)} on every window` : `${tintShade(lead.front)} front · ${tintShade(lead.rear)} rear`)
  const reasons = [
    answers.night === 'yes' ? ['You often drive at night', 'so the front windows stay lighter for a clearer view of the road.'] : ['You drive mostly during the day', 'so a darker front is still comfortable.'],
    answers.eyesight === 'poor' ? ['Your eyesight is weaker at night', 'so we chose the lightest shades on every window.'] : answers.eyesight === 'prescription' ? ['You wear prescription glasses', 'so we kept the front lighter to avoid strain.'] : ['Your eyesight is excellent', 'so darker shades won’t make the road hard to see.'],
    answers.priority === 'privacy' ? ['You chose privacy', 'so the rear windows get the darker shade.'] : answers.priority === 'visibility' ? ['You chose visibility', 'so we leaned towards lighter shades.'] : ['You wanted a balance', 'so the front is lighter than the rear.'],
  ]
  return { options, title, summary: tier.summary, reasons }
}
export function orderedBenefits(config, answers) {
  const first = config.benefitRules.find(r => r.eyesight === answers.eyesight && r.priority === answers.priority)?.benefits || []
  return [...first, ...config.benefits.map(b => b.id).filter(id => !first.includes(id))].map(id => ({...config.benefits.find(b => b.id === id), personalized: first.includes(id)}))
}
export function validateTintConfig(c) {
  try {
    if (!c || c.version !== 1 || !c.packages || !c.films || !c.options || !Array.isArray(c.rules)) return 'Missing catalog, options or rules.'
    const safeText = v => typeof v === 'string' && v.trim().length > 0 && v.length <= 1000
    for (const p of Object.values(c.packages)) {
      if (!safeText(p.name) || !safeText(p.warranty)) return 'Each package needs a name and warranty.'
      for (const v of TINT_VEHICLES) if (!Number.isFinite(p.prices[v.id]) || p.prices[v.id] <= 0 || p.prices[v.id] > 1000000) return 'Enter a valid positive price for every vehicle size.'
    }
    for (const f of Object.values(c.films)) {
      if (!c.packages[f.package] || !safeText(f.name) || !safeText(f.uvr)) return 'Invalid film details.'
      for (const k of ['vlt','tser','irr']) if (!Number.isFinite(f[k]) || f[k] < 0 || f[k] > 100) return 'Film percentages must be between 0 and 100.'
    }
    for (const o of Object.values(c.options)) {
      if (!c.packages[o.package] || !c.films[o.front] || !c.films[o.rear] || c.films[o.front].package !== o.package || c.films[o.rear].package !== o.package) return 'An option must use films from one package.'
      if ([o.front,o.rear].includes('Clear Bluish') && o.front !== o.rear) return 'Clear Bluish must cover all windows.'
    }
    for (const r of c.rules) {
      if (!['poor','excellent','prescription'].includes(r.eyesight) || !['any','privacy','visibility','balance'].includes(r.priority) || !Array.isArray(r.options) || !r.options.length || new Set(r.options).size !== r.options.length || r.options.some(id=>!c.options[id])) return 'Invalid recommendation rule.'
    }
    for (const e of ['poor','excellent','prescription']) for (const p of ['privacy','visibility','balance']) {
      if (c.rules.filter(r=>r.eyesight===e && (r.priority===p || r.priority==='any')).length !== 1) return 'Every eyesight and priority combination needs exactly one rule.'
      const b=c.benefitRules.filter(r=>r.eyesight===e && r.priority===p)
      if (b.length!==1 || b[0].benefits.length!==3 || new Set(b[0].benefits).size!==3 || b[0].benefits.some(id=>!c.benefits.some(v=>v.id===id))) return 'Each benefit rule must select three distinct benefits.'
    }
    if (c.benefits.length!==9 || new Set(c.benefits.map(b=>b.id)).size!==9 || c.benefits.some(b=>!safeText(b.title)||!safeText(b.description)||! /^[1-9]$/.test(b.id))) return 'Keep the nine original benefit IDs and their descriptions.'
    if (typeof c.sealEnabled!=='boolean' || !Array.isArray(c.sealVerifiedPackages) || c.sealVerifiedPackages.some(id=>!c.packages[id])) return 'Invalid certification settings.'
    if (c.sealEnabled && !c.sealVerifiedPackages.length) return 'Verify at least one package before enabling the seal.'
    return ''
  } catch { return 'Incomplete configuration. Check packages, films, rules and benefits.' }
}
export function buildTintLead(body, config, now = new Date()) {
  const clean = v => typeof v === 'string' ? v.trim() : ''
  const name=clean(body.name), phone=clean(body.phone), branch=clean(body.branch), vehicleModel=clean(body.vehicleModel), date=clean(body.preferredDate)
  if (!name || name.length>120 || !vehicleModel || vehicleModel.length>160 || !branch || branch.length>80) return {error:'Name, branch and vehicle model are required.'}
  if (! /^(?:09\d{9}|\+?639\d{9})$/.test(phone)) return {error:'Enter a valid Philippine mobile number.'}
  if (! /^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date || date < now.toLocaleDateString('en-CA',{timeZone:'Asia/Manila'})) return {error:'Choose a valid date from today onward.'}
  if (body.acknowledged!==true) return {error:'Please acknowledge the tint information before requesting a booking.'}
  const answers = Object.fromEntries(TINT_QUESTIONS.map(q=>[q.key,body.answers?.[q.key]]))
  if (TINT_QUESTIONS.some(q=>!q.choices.some(c=>c.id===answers[q.key]))) return {error:'Complete all four questions.'}
  const option=recommendTint(config,answers).find(o=>o.id===body.optionId)
  if (!option) return {error:'Choose one of your recommended options.'}
  return {row:{name,phone,branch,preferred_date:date,vehicle_model:vehicleModel,answers,option_id:option.id,recommendation:{...option,packageName:config.packages[option.package].name,warranty:config.packages[option.package].warranty,frontFilm:config.films[option.front],rearFilm:config.films[option.rear]},acknowledged:true,status:'new'}}
}
