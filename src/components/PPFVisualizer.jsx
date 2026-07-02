import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { ArrowRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
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

function CarModel(props) {
  const { scene } = useGLTF('/models/Mazda RX-7.glb')
  return <group {...props}><primitive object={scene} rotation={[0,Math.PI/2,0]} castShadow receiveShadow/></group>
}

useGLTF.preload('/models/Mazda RX-7.glb')

function FilmPatch({ label, description, position, scale, rotation, emphasis, onInspect, shape='plane' }) {
  const material = useRef(null)
  const [hovered,setHovered] = useState(false)
  const isHeavy = emphasis === 'heavy'
  useFrame(({ clock }, delta) => {
    if (!material.current) return
    const pulse = Math.sin(clock.elapsedTime * 2.2) * .035
    const target = hovered ? .7 : .52 + pulse
    material.current.opacity += (target - material.current.opacity) * Math.min(delta * 7, 1)
    const glow = hovered ? 1.35 : (isHeavy ? .95 : .78) + pulse
    material.current.emissiveIntensity += (glow - material.current.emissiveIntensity) * Math.min(delta * 7, 1)
  })
  const inspect = (event) => {
    event.stopPropagation()
    setHovered(true)
    onInspect({ label, description })
  }
  const clearInspect = () => { setHovered(false); onInspect(null) }
  return <mesh position={position} scale={scale} rotation={rotation} renderOrder={3} onPointerOver={inspect} onPointerOut={clearInspect} onClick={inspect}>
    {shape === 'lens' ? <sphereGeometry args={[1,24,12]}/> : <planeGeometry args={[1,1]}/>} 
    <meshStandardMaterial ref={material} color="#00d9ff" emissive="#00bfff" emissiveIntensity={.78} roughness={.2} metalness={.05} side={THREE.DoubleSide} transparent opacity={0} depthWrite={false} polygonOffset polygonOffsetFactor={-2}/>
  </mesh>
}

function FullBodyFilm({ emphasis, onInspect }) {
  const { scene } = useGLTF('/models/Mazda RX-7.glb')
  const isHeavy = emphasis === 'heavy'
  const [hovered,setHovered] = useState(false)
  const material = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: isHeavy ? '#71eaff' : '#00d9ff', emissive: '#00bfff',
    emissiveIntensity: isHeavy ? .8 : .45, roughness: .2, metalness: .05,
    transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  }), [isHeavy])
  const outlineMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: isHeavy ? '#d8f8ff' : '#00d9ff', transparent: true, opacity: 0,
    depthWrite: false, side: THREE.BackSide,
  }), [isHeavy])
  const filmScene = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse(child => {
      if (!child.isMesh) return
      const excluded = /wheel|logo|exhaust/i.test(child.name)
      child.visible = !excluded
      if (!excluded) child.material = material
    })
    return clone
  }, [scene, material])
  const outlineScene = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse(child => {
      if (!child.isMesh) return
      const excluded = /wheel|logo|exhaust/i.test(child.name)
      child.visible = !excluded
      if (!excluded) {
        child.material = outlineMaterial
        child.raycast = () => {}
      }
    })
    return clone
  }, [scene, outlineMaterial])
  useEffect(() => () => { material.dispose(); outlineMaterial.dispose() }, [material, outlineMaterial])
  useFrame(({ clock }, delta) => {
    const pulse = Math.sin(clock.elapsedTime * 1.8) * .025
    const target = hovered ? (isHeavy ? .58 : .47) : (isHeavy ? .45 : .32) + pulse
    material.opacity += (target - material.opacity) * Math.min(delta * 5, 1)
    const glow = hovered ? 1.15 : (isHeavy ? .8 : .45) + pulse
    material.emissiveIntensity += (glow - material.emissiveIntensity) * Math.min(delta * 5, 1)
    const outlineTarget = hovered ? .48 : (isHeavy ? .32 : .22) + pulse
    outlineMaterial.opacity += (outlineTarget - outlineMaterial.opacity) * Math.min(delta * 5, 1)
  })
  const inspect = (event) => {
    event.stopPropagation()
    setHovered(true)
    onInspect({ label: 'Full exterior', description: 'A thin, virtually invisible film layer follows the vehicle surface for complete exterior protection.' })
  }
  const clearInspect = () => { setHovered(false); onInspect(null) }
  return <group>
    <primitive object={outlineScene} rotation={[0,Math.PI/2,0]} scale={1.012} renderOrder={1}/>
    <primitive object={filmScene} rotation={[0,Math.PI/2,0]} scale={1.003} renderOrder={2} onPointerOver={inspect} onPointerOut={clearInspect} onClick={inspect}/>
  </group>
}

function Car({ coverage, onInspect }) {
  const panel = { emphasis: coverage.emphasis, onInspect }
  return <group rotation={[0,-.2,0]}>
    <CarModel/>
    {coverage.fullBody ? <FullBodyFilm {...panel}/> : <>
      <FilmPatch {...panel} label="Hood" description="A primary impact zone protected from stone chips, bug acids, and road wear." position={[1.14,1.035,0]} scale={[1.18,1.48,1]} rotation={[-Math.PI/2,0,0]}/>
      {[1,-1].map(side => <FilmPatch key={`doors-${side}`} {...panel} label="All four doors" description="Door skin coverage helps prevent scratches, chips, and everyday contact marks." position={[-.02,.73,side*.885]} scale={[1.62,.57,1]} rotation={[0,0,0]}/>) }
      {[1,-1].map(side => <FilmPatch key={`headlight-${side}`} {...panel} shape="lens" label="Headlights" description="Clear film helps protect this lighting surface from chips, staining, and daily road wear." position={[1.91,.83,side*.57]} scale={[.22,.09,.3]}/>) }
      {[1,-1].map(side => <FilmPatch key={`taillight-${side}`} {...panel} shape="lens" label="Taillights" description="Clear film helps protect this lighting surface from chips, staining, and daily road wear." position={[-1.92,.82,side*.6]} scale={[.16,.08,.27]}/>) }
    </>}
  </group>
}

export default function PPFVisualizer() {
  const [selected,setSelected] = useState('premium')
  const [inspected,setInspected] = useState(null)
  const data = PPF_PACKAGES.find(item => item.id === selected) ?? PPF_PACKAGES[0]
  const coverage = getCoverageState(data)
  const filmThicknessValue = data.id === 'platinum' ? '8.5 MIL' : '7.5 MIL'
  const visibleCoverageAreas = data.id === 'basic'
    ? data.coverageAreas
    : data.coverageAreas.filter(area => ['Full exterior','Trims','Headlights','All four doors','Roof','Rocker panels','Additional high-impact areas where applicable'].includes(area))
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
        <p className="ppf-model-attribution">Mazda RX-7 by IvOfficial [CC-BY] via Poly Pizza</p>
      </div>
      <article className="ppf-package-panel" id="ppf-package-panel" role="tabpanel" aria-labelledby={`ppf-tab-${selected}`}>
        <div className="ppf-panel-head"><div><p>Selected package</p><h3>{data.title} Package</h3><span>{data.subtitle}</span></div></div>
        <div className={`film-thickness-card ${data.id==='platinum'?'is-heavy':''}`}><span className="film-thickness-value">{filmThicknessValue}</span><span className="film-thickness-label">Premium-grade PPF</span></div>
        <div className="ppf-detail-block"><h4>Coverage</h4><p>{data.shortDescription}</p><div className="ppf-tags">{visibleCoverageAreas.map(area => <span key={area}>{area}</span>)}</div></div>
        <Link className="ppf-book-button" to="/book" state={{service:'Paint Protection Film',package:data.title,packageId:data.id,coverageType:data.coverageType,filmThickness:data.filmThickness}}>{data.ctaLabel} <ArrowRight size={18}/></Link>
      </article>
    </div>
  </div></section>
}
