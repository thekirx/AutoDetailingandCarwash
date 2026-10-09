import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { isSuperAdmin } from '@/auth/permissions'
import { supabase } from '@/lib/supabase'
import { TINT_VEHICLES, TINT_QUESTIONS, tintPeso, validateTintConfig } from '@/lib/tintFinder'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const selectClass='min-h-11 rounded-md border border-input bg-background px-3 text-sm w-full'
const fieldClass='flex flex-col gap-2 text-sm'
export default function TintFinderSettingsPage() {
  const {profile}=useAuth()
  const allowed=isSuperAdmin(profile)
  const [config,setConfig]=useState(null)
  const [leads,setLeads]=useState([])
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [saving,setSaving]=useState(false)
  useEffect(()=>{
    if(!allowed) return
    let active=true
    Promise.all([
      supabase.from('tint_finder_settings').select('config').eq('id',1).single(),
      supabase.from('tint_finder_leads').select('*').order('created_at',{ascending:false}).limit(100),
    ]).then(([settings,inbox])=>{
      if(!active) return
      if(settings.error || inbox.error) setError('Unable to load Tint Finder settings or requests. Check that migration 20261005130000_tint_finder has been applied and your account has access.')
      else {setConfig(settings.data.config);setLeads(inbox.data || [])}
    }).catch(()=>{if(active) setError('Unable to connect. Please reload and try again.')})
    return ()=>{active=false}
  },[allowed])
  if(!allowed) return <Navigate to="/operations/access-denied" replace/>
  function update(fn) {setNotice('');setConfig(c=>{const next=structuredClone(c);fn(next);return next})}
  async function save(e) {
    e.preventDefault();setError('');setNotice('')
    const invalid=validateTintConfig(config)
    if(invalid) return setError(invalid)
    setSaving(true)
    try {
      const {data,error:err}=await supabase.from('tint_finder_settings').update({config,updated_at:new Date().toISOString()}).eq('id',1).select('id').single()
      if(err || !data) throw new Error('Unable to save settings. Check your permissions and try again.')
      setNotice('Saved. New customer visits will use these prices, specs and rules.')
    } catch(err) {setError(err.message)} finally {setSaving(false)}
  }
  async function setStatus(id,status) {
    const {data,error:err}=await supabase.from('tint_finder_leads').update({status}).eq('id',id).select('id').single()
    if(err || !data) return setError('Unable to update this request. Please try again.')
    setLeads(rows=>rows.map(r=>r.id===id?{...r,status}:r))
  }
  return <OpsPageShell eyebrow="Settings" title="Tint Finder" description="Edit the customer recommendations and review tint booking requests. Super Admin access only." actions={<Button asChild variant="outline"><Link to="/services/tint">View customer page</Link></Button>}>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
    {!config && !error && <p>Loading Tint Finder…</p>}
    {config && <form onSubmit={save} className="grid gap-6">
      <Card><CardHeader><CardTitle>Packages and prices</CardTitle></CardHeader><CardContent className="grid gap-6 sm:grid-cols-2">{Object.entries(config.packages).map(([id,p])=><fieldset key={id} className="grid gap-3"><legend className="font-semibold mb-3">{p.name}</legend><label className={fieldClass}>Package name<Input required value={p.name} onChange={e=>update(c=>{c.packages[id].name=e.target.value})}/></label><label className={fieldClass}>Warranty<Input required value={p.warranty} onChange={e=>update(c=>{c.packages[id].warranty=e.target.value})}/></label>{TINT_VEHICLES.map(v=><label key={v.id} className={fieldClass}>{v.label} (₱)<Input type="number" min="1" max="1000000" required value={p.prices[v.id]} onChange={e=>update(c=>{c.packages[id].prices[v.id]=Number(e.target.value)})}/></label>)}</fieldset>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Film specifications</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Film','VLT %','TSER %','IRR %','UVR %'].map(v=><th key={v} className="text-left p-2">{v}</th>)}</tr></thead><tbody>{Object.entries(config.films).map(([id,f])=><tr key={id}><th scope="row" className="text-left p-2 min-w-40"><Input aria-label={`${id} name`} value={f.name} required onChange={e=>update(c=>{c.films[id].name=e.target.value})}/></th>{['vlt','tser','irr','uvr'].map(k=><td key={k} className="p-2 min-w-24"><Input aria-label={`${id} ${k}`} required type={k==='uvr'?'text':'number'} min="0" max="100" value={f[k]} onChange={e=>update(c=>{c.films[id][k]=k==='uvr'?e.target.value:Number(e.target.value)})}/></td>)}</tr>)}</tbody></table></CardContent></Card>
      <Card><CardHeader><CardTitle>Option combinations</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">{Object.entries(config.options).map(([id,o])=><fieldset key={id} className="grid gap-3 rounded-lg border p-4"><legend className="px-2">{id}</legend><label className={fieldClass}>Package<select className={selectClass} value={o.package} onChange={e=>update(c=>{c.options[id].package=e.target.value})}>{Object.entries(config.packages).map(([key,p])=><option key={key} value={key}>{p.name}</option>)}</select></label>{['front','rear'].map(zone=><label key={zone} className={fieldClass}>{zone==='front'?'Front zone':'Rear zone'}<select className={selectClass} value={o[zone]} onChange={e=>update(c=>{c.options[id][zone]=e.target.value})}>{Object.entries(config.films).map(([key,f])=><option key={key} value={key}>{f.name}</option>)}</select></label>)}</fieldset>)}</CardContent></Card>
      {/* Suggestions follow fixed, client-approved rules (src/lib/tintFinder.js):
          the pairs below supply the films, so prices and shades stay editable here. */}
      <Card><CardHeader><CardTitle>How suggestions are chosen</CardTitle></CardHeader><CardContent className="grid gap-2 text-sm">
        <p>The Finder suggests one front/rear pair and shows it in both tints, Pro first. Change the films in a pair above to change what customers see.</p>
        <ul className="list-disc pl-5 grid gap-1">
          <li><strong>Poor eyesight</strong> → OPT-B (Pro) and OPT-A (Nano Ceramic).</li>
          <li><strong>Drives at night, wears prescription, or chose visibility</strong> → OPT-C and OPT-D.</li>
          <li><strong>Everyone else</strong> → OPT-E and OPT-F.</li>
        </ul>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Benefits and certification</CardTitle></CardHeader><CardContent className="grid gap-4">
        {config.benefits.map((b,i)=><div key={b.id} className="grid gap-2"><label className={fieldClass}>Benefit {b.id}<Input required value={b.title} onChange={e=>update(c=>{c.benefits[i].title=e.target.value})}/></label><label className={fieldClass}>Description<textarea className={`${selectClass} py-3`} required value={b.description} onChange={e=>update(c=>{c.benefits[i].description=e.target.value})}/></label></div>)}
        <h3 className="font-semibold">Personalized benefit order</h3>
        {config.benefitRules.map((r,i)=><div key={`${r.eyesight}-${r.priority}`} className="grid gap-3 border-b pb-4 sm:grid-cols-4"><p className="text-sm">{TINT_QUESTIONS[1].choices.find(v=>v.id===r.eyesight)?.label} · {r.priority}</p>{r.benefits.map((id,j)=><label key={j} className={fieldClass}>Benefit {j+1}<select className={selectClass} value={id} onChange={e=>update(c=>{c.benefitRules[i].benefits[j]=e.target.value})}>{config.benefits.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select></label>)}</div>)}
        <p className="text-sm text-muted-foreground">Display the seal only after checking the exact films against the Foundation’s recommended product list. Verify all films in a package before selecting it below.</p>
        <label className="flex gap-3 items-center text-sm"><input type="checkbox" checked={config.sealEnabled} onChange={e=>update(c=>{c.sealEnabled=e.target.checked})}/>Enable Skin Cancer Foundation seal</label>
        {Object.entries(config.packages).map(([id,p])=><label key={id} className="flex gap-3 items-center text-sm"><input type="checkbox" checked={config.sealVerifiedPackages.includes(id)} onChange={e=>update(c=>{c.sealVerifiedPackages=e.target.checked?[...c.sealVerifiedPackages,id]:c.sealVerifiedPackages.filter(v=>v!==id)})}/>{p.name}: all films verified</label>)}
      </CardContent></Card>
      <Button type="submit" disabled={saving}>{saving?'Saving…':'Save Tint Finder settings'}</Button>
    </form>}
    <Card className="mt-6"><CardHeader><CardTitle>Tint requests · latest 100</CardTitle></CardHeader><CardContent>{leads.length===0?<p className="text-sm text-muted-foreground">No requests to show.</p>:<div className="grid gap-4">{leads.map(l=><article className="border rounded-lg p-4 grid gap-2" key={l.id}><div className="flex flex-wrap justify-between gap-3"><strong>{l.name} · <a className="underline" href={`tel:${l.phone}`}>{l.phone}</a></strong><select className={`${selectClass} max-w-40`} aria-label={`Status for ${l.name}`} value={l.status} onChange={e=>setStatus(l.id,e.target.value)}>{['new','contacted','closed'].map(s=><option key={s}>{s}</option>)}</select></div><p className="text-sm">{l.branch} · {l.preferred_date} · {l.vehicle_model}</p><p className="text-sm">{l.recommendation.packageName} · {l.recommendation.front} front / {l.recommendation.rear} rear · {tintPeso(l.recommendation.price)}</p><dl className="flex flex-wrap gap-4 text-xs">{TINT_QUESTIONS.map(q=><div key={q.key}><dt className="text-muted-foreground">{q.key}</dt><dd>{q.choices.find(v=>v.id===l.answers[q.key])?.label}</dd></div>)}</dl><small className="text-muted-foreground">Received {new Date(l.created_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})} · Disclaimers acknowledged</small></article>)}</div>}</CardContent></Card>
  </OpsPageShell>
}
