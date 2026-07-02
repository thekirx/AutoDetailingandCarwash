import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, RoundedBox } from '@react-three/drei'
import { ArrowRight, Check, ChevronDown, Gift, ShieldCheck, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PPF_PACKAGES } from '../data/ppfPackages'

function getCoverageState(packageData) {
  const areas = new Set(packageData.coverageAreas.map(area => area.toLowerCase()))
  const fullBody = areas.has('full exterior')
  return {
    fullBody,
    hood: fullBody || areas.has('hood'), doors: fullBody || areas.has('all four doors'),
    headlights: fullBody || areas.has('headlights'), taillights: fullBody || areas.has('taillights'),
    bumpers: fullBody || areas.has('front bumper') || areas.has('rear bumper'),
    roof: fullBody || areas.has('roof'), trunk: fullBody || areas.has('trunk'),
    mirrors: fullBody || areas.has('side mirrors'), fenders: fullBody || areas.has('fenders'),
    trims: fullBody || areas.has('trims'), quarterPanels: fullBody || areas.has('quarter panels'),
    rockerPanels: areas.has('rocker panels'),
    emphasis: packageData.id === 'platinum' ? 'heavy' : 'standard',
  }
}

function BodyPanel({ position, size }) {
  return <RoundedBox position={position} args={size} radius={.18} smoothness={4}><meshStandardMaterial color="#17213b" metalness={.82} roughness={.18}/></RoundedBox>
}

function CoveragePanel({ label, description, position, size, active, emphasis, onInspect }) {
  const material = useRef(null)
  const isHeavy = emphasis === 'heavy'
  useFrame((_, delta) => {
    if (!material.current) return
    const target = active ? (isHeavy ? .76 : .58) : 0
    material.current.opacity += (target - material.current.opacity) * Math.min(delta * 7, 1)
  })
  const inspect = (event) => {
    if (!active) return
    event.stopPropagation()
    onInspect({ label, description })
  }
  return <RoundedBox position={position} args={size} radius={.1} smoothness={4} onPointerOver={inspect} onPointerOut={() => active && onInspect(null)} onClick={inspect}>
    <meshPhysicalMaterial ref={material} color={isHeavy ? '#a4b7ff' : '#4c73ff'} emissive={isHeavy ? '#315eff' : '#052699'} emissiveIntensity={isHeavy ? 2.7 : 1.7} transparent opacity={0} depthWrite={false}/>
  </RoundedBox>
}

function CoverageLight({ label, position, active, emphasis, onInspect }) {
  const material = useRef(null)
  const isHeavy = emphasis === 'heavy'
  useFrame((_, delta) => {
    if (!material.current) return
    const target = active ? (isHeavy ? 4.8 : 3.2) : .5
    material.current.emissiveIntensity += (target - material.current.emissiveIntensity) * Math.min(delta * 7, 1)
  })
  const inspect = (event) => {
    if (!active) return
    event.stopPropagation()
    onInspect({ label, description: 'Clear film helps protect this lighting surface from chips, staining, and daily road wear.' })
  }
  return <mesh position={position} onPointerOver={inspect} onPointerOut={() => active && onInspect(null)} onClick={inspect}>
    <sphereGeometry args={[.18,18,12]}/><meshStandardMaterial ref={material} color={active ? '#9bb0ff' : '#dfe7ff'} emissive={active ? '#315eff' : '#42506a'} emissiveIntensity={.5}/>
  </mesh>
}

function Car({ coverage, onInspect }) {
  const panel = { emphasis: coverage.emphasis, onInspect }
  return <group rotation={[0,-.2,0]}>
    <BodyPanel position={[1.75,.8,0]} size={[1.35,.55,2]}/><BodyPanel position={[.7,1.12,0]} size={[1.15,.3,1.9]}/><BodyPanel position={[-.25,1.28,0]} size={[1.05,.8,1.75]}/><BodyPanel position={[-1.35,.83,0]} size={[1.35,.65,2]}/><BodyPanel position={[0,.45,0]} size={[4.8,.4,1.85]}/>
    <CoveragePanel {...panel} active={coverage.bumpers} label="Front bumper" description="High-impact protection against road debris and surface abrasions." position={[2.23,.77,0]} size={[.42,.5,1.95]}/>
    <CoveragePanel {...panel} active={coverage.hood} label="Hood" description="A primary impact zone protected from stone chips, bug acids, and road wear." position={[.72,1.29,0]} size={[1.18,.08,1.88]}/>
    <CoveragePanel {...panel} active={coverage.roof} label="Roof" description="Full upper-surface coverage against environmental fallout and light abrasions." position={[-.23,1.72,0]} size={[.92,.1,1.48]}/>
    <CoveragePanel {...panel} active={coverage.trunk} label="Trunk" description="Rear upper-panel protection with a seamless, clear finish." position={[-1.28,1.18,0]} size={[1.2,.1,1.86]}/>
    <CoveragePanel {...panel} active={coverage.bumpers} label="Rear bumper" description="Film defense for loading marks, parking scuffs, and road impacts." position={[-1.96,.76,0]} size={[.42,.48,1.94]}/>
    {[.48,-.52].flatMap((x,index) => [1,-1].map(side => <CoveragePanel key={`door-${x}-${side}`} {...panel} active={coverage.doors} label={`${index ? 'Rear' : 'Front'} ${side > 0 ? 'left' : 'right'} door`} description="Door skin coverage helps prevent scratches, chips, and everyday contact marks." position={[x,.72,side*.99]} size={[.86,.68,.08]}/>))}
    {[1,-1].map(side => <CoveragePanel key={`fender-${side}`} {...panel} active={coverage.fenders} label="Front fender" description="Protection around the wheel arch from stones and tire-thrown debris." position={[1.36,.72,side*.98]} size={[.48,.55,.08]}/>)}
    {[1,-1].map(side => <CoveragePanel key={`quarter-${side}`} {...panel} active={coverage.quarterPanels} label="Quarter panel" description="Continuous rear-side coverage for a consistent full-body shield." position={[-1.3,.75,side*.98]} size={[.72,.58,.08]}/>)}
    {[1,-1].map(side => <CoveragePanel key={`rocker-${side}`} {...panel} active={coverage.rockerPanels} label="Rocker panel" description="Platinum-only emphasis for this low, high-impact road-debris zone." position={[-.05,.28,side*1]} size={[3.15,.13,.1]}/>)}
    {[1,-1].map(side => <CoveragePanel key={`trim-${side}`} {...panel} active={coverage.trims} label="Exterior trims" description="Clear protection continues across compatible exterior trim surfaces." position={[-.25,1.45,side*.91]} size={[1.1,.1,.07]}/>)}
    {[1,-1].map(side => <CoveragePanel key={`mirror-${side}`} {...panel} active={coverage.mirrors} label="Side mirror" description="A forward-facing impact point protected from chips and abrasion." position={[.55,1.34,side*1.2]} size={[.34,.18,.22]}/>)}
    <CoverageLight {...panel} active={coverage.headlights} label="Headlights" position={[2.37,.9,.72]}/><CoverageLight {...panel} active={coverage.headlights} label="Headlights" position={[2.37,.9,-.72]}/><CoverageLight {...panel} active={coverage.taillights} label="Taillights" position={[-1.96,.86,.73]}/><CoverageLight {...panel} active={coverage.taillights} label="Taillights" position={[-1.96,.86,-.73]}/>
    {[[1.4,.22,1],[-1.35,.22,1],[1.4,.22,-1],[-1.35,.22,-1]].map((position,index) => <mesh key={index} position={position} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.42,.42,.24,24]}/><meshStandardMaterial color="#05070c"/></mesh>)}
  </group>
}

function FeatureList({ items }) {
  return <ul className="ppf-feature-list">{items.map(item => <li key={item}><Check size={14}/><span>{item}</span></li>)}</ul>
}

export default function PPFVisualizer() {
  const [selected,setSelected] = useState('premium')
  const [inspected,setInspected] = useState(null)
  const data = PPF_PACKAGES.find(item => item.id === selected) ?? PPF_PACKAGES[0]
  const coverage = getCoverageState(data)
  const selectPackage = (id) => { setSelected(id); setInspected(null) }

  return <section className="visualizer-section" id="visualizer" aria-labelledby="ppf-heading"><div className="public-shell">
    <header className="ppf-heading"><div><p className="eyebrow eyebrow-light">Invisible armor · Visible confidence</p><h2 className="section-title light" id="ppf-heading">Paint Protection<br/>Film Packages</h2></div><p>Paint Protection Film is an invisible, clear layer applied to your vehicle’s paint to protect it from damage. Think of it like a mobile phone screen protector, but for your car’s exterior.</p></header>
    <div className="package-tabs" role="tablist" aria-label="Paint protection film packages">{PPF_PACKAGES.map((item,index) => <button key={item.id} id={`ppf-tab-${item.id}`} role="tab" aria-selected={selected===item.id} aria-controls="ppf-package-panel" onClick={() => selectPackage(item.id)}><span>0{index+1}</span>{item.title}{item.recommendedLabel && <small>{item.recommendedLabel}</small>}</button>)}</div>
    <div className="visualizer-grid">
      <div className="car-canvas">
        <div className="ppf-canvas-label"><span>Interactive coverage view</span><strong>{data.title}</strong></div><span>Drag to rotate · Select a panel</span>
        <div className="ppf-canvas-stage"><Canvas camera={{position:[6,3.8,6],fov:38}} onPointerMissed={() => setInspected(null)}><ambientLight intensity={1.4}/><directionalLight position={[6,8,5]} intensity={4}/><pointLight position={[-4,3,-4]} color="#315eff" intensity={coverage.emphasis==='heavy'?30:20}/><Car coverage={coverage} onInspect={setInspected}/><OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={.7}/></Canvas></div>
        <div className={`ppf-mobile-diagram ${coverage.fullBody?'is-full':''} ${coverage.emphasis==='heavy'?'is-heavy':''}`} aria-label={`${data.title} coverage diagram`}><div className="ppf-diagram-car"><i className="hood"/><i className="roof"/><i className="doors"/><i className="rear"/><b>360°</b></div><p>{data.coverageType}<small>{data.coverageAreas.join(' · ')}</small></p></div>
        {inspected && <div className="ppf-panel-tooltip" role="status"><span>Coverage area</span><strong>{inspected.label}</strong><p>{inspected.description}</p></div>}
        <div className={`ppf-coverage-legend ${coverage.emphasis==='heavy'?'is-heavy':''}`}><span><i/> {coverage.emphasis==='heavy'?'8.5 mil enhanced defense':'7.5 mil protected area'}</span><span><i className="ppf-legend-base"/> Vehicle surface</span></div>
      </div>
      <article className="ppf-package-panel" id="ppf-package-panel" role="tabpanel" aria-labelledby={`ppf-tab-${selected}`}>
        <div className="ppf-panel-head"><div><p>Selected package · {data.coverageType}</p><h3>{data.title} Package</h3><span>{data.subtitle}</span></div><strong>{data.filmThickness.split(' premium')[0]}<small>premium-grade film</small></strong></div>
        <div className="ppf-film-comparison" aria-label="Film thickness comparison"><span className={data.id!=='platinum'?'active':''}><i style={{'--film-width':'75%'}}/>7.5 mil <small>Premium-grade</small></span><span className={data.id==='platinum'?'active':''}><i style={{'--film-width':'100%'}}/>8.5 mil <small>Heavier defense</small></span></div>
        <div className="ppf-detail-block"><h4>Coverage</h4><p>{data.shortDescription}</p><div className="ppf-tags">{data.coverageAreas.map(area => <span key={area}>{area}</span>)}</div></div>
        <div className="ppf-panel-columns"><div><h4><Sparkles size={15}/> Enhancements & benefits</h4><FeatureList items={[...data.keyEnhancements,...data.filmBenefits]}/></div><div><h4><ShieldCheck size={15}/> Warranty & replacement</h4><FeatureList items={[...data.warranty,...(data.replacementClause.length?data.replacementClause:['No panel replacement clause'])]}/></div></div>
        <div className="ppf-addons"><h4><Gift size={16}/> Complimentary with every tier</h4><FeatureList items={data.freeAddOns}/></div>
        <Link className="ppf-book-button" to="/book" state={{service:'Paint Protection Film',package:data.title,packageId:data.id,coverageType:data.coverageType,filmThickness:data.filmThickness}}>{data.ctaLabel} <ArrowRight size={18}/></Link>
      </article>
    </div>
    <div className="ppf-policy-row"><details><summary>Factory warranty coverage <ChevronDown size={16}/></summary><div><p>Manufacturer defects covered:</p><FeatureList items={data.coveredDefects}/><p>Coverage exclusions:</p><FeatureList items={data.exclusions}/></div></details><details><summary>Important installation notes <ChevronDown size={16}/></summary><div><FeatureList items={data.operationalDisclaimers}/></div></details></div>
  </div></section>
}
